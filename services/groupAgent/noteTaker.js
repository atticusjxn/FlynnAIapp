/**
 * Ambient note-taker — the "Granola" pass over a team group chat.
 *
 * Given a window of group messages, it extracts concrete action items, decisions
 * and durable facts the business owner might want to act on, mapping each onto a
 * real tool from the agent registry where possible. Vertical-agnostic: it adapts
 * to whatever the business is, not just tradies.
 *
 * Output is conservative — most group chatter yields nothing. Items are deduped
 * on (chat_guid, dedupe_key) so the live fast-path and the batch sweep can both
 * run over overlapping windows without raising the same thing twice.
 *
 * extractAndStore() returns the NEWLY inserted items (those that didn't collide
 * with an existing dedupe_key) so the caller can decide what to DM.
 */

const crypto = require('crypto');
const { getLLMClient } = require('../../llmClient');
const registry = require('../agent/toolRegistry');

const QWEN_MODEL = process.env.SMS_LLM_MODEL || process.env.DRAFT_LLM_MODEL || 'qwen3.5-flash';

const CATEGORIES = ['timesheet', 'order', 'booking', 'invoice', 'decision', 'fact', 'followup', 'other'];

// A compact tool menu the model can map suggestions onto. Built from the live
// registry so it never drifts from what Flynn can actually do.
function toolMenu() {
  const lines = [];
  for (const cap of registry.CAPABILITIES) {
    for (const tool of cap.tools) {
      // Skip the plumbing tools — they aren't things to suggest off a group chat.
      if (['save_login', 'connect_tools'].includes(tool.name)) continue;
      lines.push(`- ${tool.name}: ${tool.description.split('.')[0]}`);
    }
  }
  return lines.join('\n');
}

function dedupeKey(chatGuid, category, summary) {
  const subject = String(summary || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ');
  return crypto.createHash('sha1').update(`${chatGuid}|${category}|${subject}`).digest('hex');
}

function buildPrompt(chat, rows) {
  const transcript = rows
    .map((r) => `${r.sender_name || r.sender_phone || 'someone'}: ${r.body}`)
    .join('\n');

  const system = `You silently observe a work group chat for a business and pull out what the owner might need to act on. You are not a participant — you never reply to the group, you just take notes.

Extract concrete ACTION ITEMS, DECISIONS, and durable FACTS. Be conservative: ignore banter, greetings, jokes, and vague chatter. If nothing is actionable, return an empty list.

For each item return:
- summary: one short plain sentence the owner will read (e.g. "Jack worked 6h Friday — log his timesheet", "Sam needs MDF for the Wong job").
- category: one of ${CATEGORIES.join(', ')}.
- urgency: "live" if it's time-sensitive or money-related and the owner would want to know now (a quote request, an urgent order, a customer waiting); otherwise "routine".
- suggested_tool: the single best matching tool name from the menu below, or null if none fits.
- suggested_args: a JSON object of arguments for that tool inferred from the chat (best effort; omit anything you don't know). null if no tool.

Tools you can map to:
${toolMenu()}

Respond with JSON only: {"items": [ {summary, category, urgency, suggested_tool, suggested_args}, ... ]}.`;

  const user = `Group chat "${chat?.name || 'team'}". Recent messages:\n${transcript}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

async function callModel(messages) {
  const client = getLLMClient('compatible');
  const raw = await client.chat.completions.create({
    model: QWEN_MODEL,
    messages,
    max_tokens: 700,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  });
  const content = raw?.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

/**
 * Extract from a window of message rows and upsert into group_action_items.
 *
 * @param {object}   chat       group_chats row ({ chat_guid, owner_phone, name })
 * @param {Array}    rows       group_messages rows ({ id, sender_name, sender_phone, body })
 * @param {object}   supabase
 * @param {boolean}  markExtracted  flag the passed rows as swept (batch pass does; live doesn't)
 * @returns {Promise<Array>} the newly inserted action items
 */
async function extractAndStore({ chat, rows, supabase, markExtracted = false }) {
  const usable = (rows || []).filter((r) => r?.body && r.body.trim());
  if (!usable.length || !chat?.owner_phone) {
    if (markExtracted) await flagExtracted(supabase, rows);
    return [];
  }

  let items = [];
  try {
    items = await callModel(buildPrompt(chat, usable));
  } catch (err) {
    console.warn('[NoteTaker] extraction failed:', err?.message || err);
    // Don't mark extracted on failure — let the next sweep retry.
    return [];
  }

  const sourceIds = usable.map((r) => r.id).filter(Boolean);
  const candidates = [];
  for (const it of items) {
    const summary = String(it?.summary || '').trim();
    if (!summary) continue;
    const category = CATEGORIES.includes(it?.category) ? it.category : 'other';
    const urgency = it?.urgency === 'live' ? 'live' : 'routine';
    const suggestedTool = it?.suggested_tool && registry.findTool(it.suggested_tool)
      ? it.suggested_tool
      : null;
    candidates.push({
      chat_guid: chat.chat_guid,
      owner_phone: chat.owner_phone,
      source_message_ids: sourceIds,
      summary,
      category,
      suggested_tool: suggestedTool,
      suggested_args: suggestedTool ? (it.suggested_args || {}) : null,
      urgency,
      status: 'new',
      dedupe_key: dedupeKey(chat.chat_guid, category, summary),
    });
  }

  let inserted = [];
  if (candidates.length) {
    // ignoreDuplicates: a dedupe_key collision means we've already raised it.
    const { data } = await supabase
      .from('group_action_items')
      .upsert(candidates, { onConflict: 'chat_guid,dedupe_key', ignoreDuplicates: true })
      .select();
    inserted = data || [];
  }

  if (markExtracted) await flagExtracted(supabase, usable);
  return inserted;
}

async function flagExtracted(supabase, rows) {
  const ids = (rows || []).map((r) => r?.id).filter(Boolean);
  if (!ids.length) return;
  await supabase
    .from('group_messages')
    .update({ extracted: true })
    .in('id', ids)
    .then(() => {}, () => {});
}

// Cheap pre-filter so routine chatter never hits the LLM on the hot path. Trips
// on urgency/money/order language; the batch sweep catches everything else.
const LIVE_HINTS = /\b(asap|urgent|right now|today|tonight|this arvo|need(?:ed)?|order|invoice|quote|pay|payment|deposit|book(?:ing)?|emergency|callout|call out|broke down|leak)\b/i;

function looksLive(text = '') {
  return LIVE_HINTS.test(text);
}

module.exports = { extractAndStore, looksLive, dedupeKey };
