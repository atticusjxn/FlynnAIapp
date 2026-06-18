/**
 * Group router — handles inbound messages from team group chats.
 *
 * Flynn is a SILENT OBSERVER here. It posts one intro when first added, then
 * never speaks in the group again unless directly addressed ("Flynn, ..."). All
 * real output goes to the boss privately, in their existing 1:1 thread, where the
 * normal tool loop + confirm gates execute things.
 *
 * Flow per group message:
 *   1. resolve the group + auto-detect the boss (a registered Flynn user in it)
 *   2. learn the sender as a member
 *   3. post the one-time intro (once an owner is known)
 *   4. store the message (idempotent)
 *   5. if addressed "Flynn, ..." → answer to the group (the only public reply)
 *   6. live fast-path: on urgent-looking messages, extract now and DM the boss
 *
 * Routine items are left for the batch sweep + digest (digestScheduler).
 */

const { sendToGroup } = require('../blueBubbles');
const { sendToUser } = require('../flynnOutbound');
const { sanitiseReply } = require('../flynnTone');
const { getLLMClient } = require('../../llmClient');
const registry = require('../agent/toolRegistry');
const { loadConnections } = require('../agent/agentLoop');
const { decryptCredentials } = require('../credentialCrypto');
const { extractAndStore, looksLive } = require('./noteTaker');

const QWEN_MODEL = process.env.SMS_LLM_MODEL || process.env.DRAFT_LLM_MODEL || 'qwen3.5-flash';
const LIVE_WINDOW = 12;          // messages of context for a live extraction
const CONFIRM_ACTION_TTL_MS = 30 * 60 * 1000;
const DIRECT_ADDRESS_RE = /^\s*@?flynn\b[\s,:]*/i;

function currencyFromPhone(phone = '') {
  if (phone.startsWith('+64')) return 'NZD';
  if (phone.startsWith('+44')) return 'GBP';
  if (phone.startsWith('+1')) return 'USD';
  return 'AUD';
}

async function loadUserIntegrations(supabase, phone) {
  const out = {};
  const { data } = await supabase
    .from('user_integrations')
    .select('integration_type, credentials_encrypted')
    .eq('user_phone', phone);
  for (const row of data || []) out[row.integration_type] = decryptCredentials(row.credentials_encrypted);
  return out;
}

/**
 * Find the boss: the registered Flynn user among the group's known phones.
 * Prefer the current sender if they're a user, else the earliest-registered.
 */
async function detectOwner(supabase, { senderPhone, candidatePhones }) {
  const phones = [...new Set([senderPhone, ...candidatePhones].filter(Boolean))];
  if (!phones.length) return null;
  const { data } = await supabase
    .from('users')
    .select('id, phone, business_brain, created_at')
    .in('phone', phones)
    .order('created_at', { ascending: true });
  const users = data || [];
  if (!users.length) return null;
  return users.find((u) => u.phone === senderPhone) || users[0];
}

function ownerLabel(owner) {
  const name = owner?.business_brain?.business_name || owner?.business_brain?.owner_name;
  return name ? String(name) : null;
}

/**
 * Resolve (and lazily create/repair) the group_chats row, learning members and
 * auto-detecting the owner. Returns { group, owner } or { group: null } when the
 * group has no Flynn user in it yet (status 'no_owner' — observed but not acted on).
 */
async function resolveGroup(supabase, event) {
  const { chatGuid, senderPhone, senderName, participants, groupName } = event;

  let { data: group } = await supabase
    .from('group_chats')
    .select('*')
    .eq('chat_guid', chatGuid)
    .maybeSingle();

  // Learn the sender (and any participants the webhook gave us) as members.
  const candidatePhones = (participants || []).map((p) => p.phone);

  // Need an owner before we do anything beyond observing membership.
  let owner = null;
  if (group?.owner_phone) {
    const { data } = await supabase
      .from('users')
      .select('id, phone, business_brain, created_at')
      .eq('phone', group.owner_phone)
      .maybeSingle();
    owner = data || null;
  }
  if (!owner) {
    owner = await detectOwner(supabase, { senderPhone, candidatePhones });
  }

  const now = new Date().toISOString();
  if (!group) {
    const { data } = await supabase
      .from('group_chats')
      .upsert({
        chat_guid: chatGuid,
        name: groupName || null,
        owner_user_id: owner?.id || null,
        owner_phone: owner?.phone || null,
        status: owner ? 'active' : 'no_owner',
        settings: { digest_hour: 17, live_urgent: true },
        updated_at: now,
      }, { onConflict: 'chat_guid' })
      .select()
      .maybeSingle();
    group = data;
  } else if (owner && (group.status === 'no_owner' || !group.owner_phone)) {
    // A Flynn user finally appeared — adopt them as the boss and activate.
    const { data } = await supabase
      .from('group_chats')
      .update({ owner_user_id: owner.id, owner_phone: owner.phone, status: 'active', updated_at: now })
      .eq('chat_guid', chatGuid)
      .select()
      .maybeSingle();
    group = data || group;
  }

  // Upsert membership (sender always; participants when present).
  const members = [];
  const seen = new Set();
  const pushMember = (phone, name) => {
    if (!phone || seen.has(phone)) return;
    seen.add(phone);
    members.push({
      chat_guid: chatGuid,
      member_phone: phone,
      display_name: name || null,
      role: owner && phone === owner.phone ? 'boss' : 'member',
      is_flynn_user: Boolean(owner && phone === owner.phone),
    });
  };
  pushMember(senderPhone, senderName);
  for (const p of participants || []) pushMember(p.phone, p.name);
  if (members.length) {
    await supabase
      .from('group_members')
      .upsert(members, { onConflict: 'chat_guid,member_phone', ignoreDuplicates: true })
      .then(() => {}, () => {});
  }

  return { group, owner };
}

async function postIntro(supabase, group, owner) {
  const label = ownerLabel(owner);
  const who = label ? `${label}'s assistant` : 'the assistant here';
  const tail = label ? `${label}, i'll` : "i'll";
  const intro = sanitiseReply(
    `hey, i'm flynn, ${who}. i'll keep quiet in here and just take notes. ${tail} message you privately with anything worth actioning.`
  );
  try {
    await sendToGroup(group.chat_guid, intro);
    await supabase.from('group_chats').update({ intro_sent: true, updated_at: new Date().toISOString() }).eq('chat_guid', group.chat_guid);
  } catch (err) {
    console.warn('[GroupRouter] intro send failed:', err?.message || err);
  }
}

async function storeMessage(supabase, event) {
  const { data } = await supabase
    .from('group_messages')
    .upsert({
      chat_guid: event.chatGuid,
      sender_phone: event.senderPhone || null,
      sender_name: event.senderName || null,
      body: event.text || '',
      message_guid: event.messageGuid || null,
    }, { onConflict: 'message_guid', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  return data;
}

/**
 * The only time Flynn speaks in-group: a direct "Flynn, ..." question. Answers
 * briefly from the owner's business context. Read-only — no tools, no private
 * action items leaked.
 */
async function handleDirectAddress(supabase, group, owner, event) {
  const question = event.text.replace(DIRECT_ADDRESS_RE, '').trim();
  if (!question) return;

  const { data: recent } = await supabase
    .from('group_messages')
    .select('sender_name, sender_phone, body')
    .eq('chat_guid', group.chat_guid)
    .order('created_at', { ascending: false })
    .limit(8);
  const transcript = (recent || []).reverse()
    .map((r) => `${r.sender_name || r.sender_phone || 'someone'}: ${r.body}`)
    .join('\n');

  const brain = owner?.business_brain || {};
  const system = `You are Flynn, ${ownerLabel(owner) || 'the team'}'s assistant, in their work group chat. Someone addressed you directly. Answer in one or two short, plain sentences. Lowercase starts, contractions, no em dashes, no sign-offs. Only answer from the business context and the recent messages. If you don't know, say so briefly. Never expose private notes or suggestions you've sent the owner.

Business context: ${JSON.stringify(brain)}`;
  const user = `Recent messages:\n${transcript}\n\nThey said: "${question}"`;

  let reply = '';
  try {
    const client = getLLMClient('compatible');
    const raw = await client.chat.completions.create({
      model: QWEN_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 200,
      enable_thinking: false,
    });
    reply = (raw?.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    console.warn('[GroupRouter] direct-address LLM failed:', err?.message || err);
    return;
  }
  if (reply) {
    try { await sendToGroup(group.chat_guid, sanitiseReply(reply)); }
    catch (err) { console.warn('[GroupRouter] direct-address reply failed:', err?.message || err); }
  }
}

/**
 * Try to pre-park a single live item as awaiting_confirmation so the boss's
 * one-word "yeah" runs it via the existing executePendingTool path. Only when:
 * the tool's provider is connected AND the boss has no other pending action
 * (pending_actions is one-row-per-phone). Returns the confirmation text if
 * parked, else null (caller falls back to a plain heads-up + Path A injection).
 */
async function maybeParkLiveAction(supabase, owner, item) {
  if (!item.suggested_tool) return null;
  const entry = registry.findTool(item.suggested_tool);
  if (!entry) return null;

  const phone = owner.phone;

  // Slot must be free — never clobber an existing pending action.
  const { data: existing } = await supabase
    .from('pending_actions')
    .select('id')
    .eq('user_phone', phone)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (existing) return null;

  const connections = await loadConnections(supabase, phone);
  const userIntegrations = await loadUserIntegrations(supabase, phone);
  const ctx = {
    user: owner,
    phone,
    connections,
    userIntegrations,
    brain: owner.business_brain || {},
    currency: (owner.business_brain || {}).currency || currencyFromPhone(phone),
  };

  // Only pre-park when the provider is actually connected; otherwise let the
  // boss's 1:1 turn handle the connect gate properly via Path A.
  if (!registry.connectionFor(entry.capability, ctx, item.suggested_args || {})) return null;

  const confirmation = entry.tool.confirmMessage
    ? entry.tool.confirmMessage(item.suggested_args || {}, ctx)
    : `want me to ${item.summary}? reply yeah`;

  await supabase.from('pending_actions').upsert({
    user_phone: phone,
    action_type: entry.tool.name,
    action_data: item.suggested_args || {},
    confirmation_message: confirmation,
    status: 'awaiting_confirmation',
    tool_name: entry.tool.name,
    tool_args: item.suggested_args || {},
    expires_at: new Date(Date.now() + CONFIRM_ACTION_TTL_MS).toISOString(),
  }, { onConflict: 'user_phone' }).then(() => {}, () => {});

  return confirmation;
}

/**
 * Live fast-path: extract over a recent window and DM the boss any live items.
 * Routine items are stored too (deduped) and wait for the digest.
 */
async function runLiveExtraction(supabase, group, owner) {
  const { data: recent } = await supabase
    .from('group_messages')
    .select('id, sender_name, sender_phone, body')
    .eq('chat_guid', group.chat_guid)
    .order('created_at', { ascending: false })
    .limit(LIVE_WINDOW);
  const rows = (recent || []).reverse();

  // Don't mark extracted here — the batch sweep is authoritative and dedupe
  // keeps it from raising these again.
  const inserted = await extractAndStore({ chat: group, rows, supabase, markExtracted: false });
  const liveItems = inserted.filter((i) => i.urgency === 'live');
  if (!liveItems.length) return;

  // Pre-park only when there's exactly one live item (one pending slot).
  let parkedConfirmation = null;
  if (liveItems.length === 1) {
    parkedConfirmation = await maybeParkLiveAction(supabase, owner, liveItems[0]);
  }

  const bubbles = [];
  for (const it of liveItems) {
    if (it === liveItems[0] && parkedConfirmation) bubbles.push(parkedConfirmation);
    else bubbles.push(`${it.summary}. want me to handle it?`);
  }

  try {
    await sendToUser(owner.phone, bubbles, { channel: 'imessage', supabase });
    await supabase
      .from('group_action_items')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .in('id', liveItems.map((i) => i.id));
  } catch (err) {
    console.warn('[GroupRouter] live DM failed:', err?.message || err);
  }
}

/**
 * Entry point — called by routes/iMessageInbound.js for group messages.
 */
async function processGroupMessage(event, { supabase }) {
  if (!supabase || !event?.chatGuid) return;

  const { group, owner } = await resolveGroup(supabase, event);

  // No Flynn user in the group yet — observe membership only, don't store or act.
  if (!group || group.status !== 'active' || !owner) return;

  if (!group.intro_sent) await postIntro(supabase, group, owner);

  await storeMessage(supabase, event);

  if (DIRECT_ADDRESS_RE.test(event.text)) {
    await handleDirectAddress(supabase, group, owner, event);
    return; // a direct question isn't also a note-taking trigger
  }

  if (event.text && looksLive(event.text) && group.settings?.live_urgent !== false) {
    await runLiveExtraction(supabase, group, owner);
  }
}

module.exports = { processGroupMessage };
