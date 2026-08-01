/**
 * Voice front-door funnel intake.
 *
 * A prospect calls the Flynn ad number straight from a Meta ad. The AI
 * receptionist that answers IS the demo and the sales pitch, and its intake
 * questions double as the configuration interview for the prospect's own
 * receptionist. Config is staged in voice_onboarding_sessions keyed by the
 * caller's phone; at end of call we SMS them an app magic link + claim code,
 * and the iOS first-run claim step applies the config to their new org.
 *
 * The Deepgram Voice Agent pipeline (deepgramVoiceAgent.js) runs this mode when
 * the cached session has mode === 'funnel'.
 */

const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const { normalizePhone, generateAppLink } = require('../services/authLink');
const { estimateCallCost } = require('./callCostEstimate');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Post-call SMS goes from the AU mobile long code. Mobile numbers are outside
// the ACMA Sender ID Register (which covers alphanumeric IDs), and the long
// code keeps the thread two-way.
const SMS_FROM_NUMBER = process.env.TWILIO_FLYNN_NUMBER || '+61480891471';

// Comma-separated E.164 list of ad/funnel inbound numbers.
const FUNNEL_NUMBERS = (process.env.FLYNN_FUNNEL_NUMBERS || '')
  .split(',')
  .map((n) => normalizePhone(n))
  .filter(Boolean);

const isFunnelNumber = (toNumber) => {
  const normalized = normalizePhone(toNumber);
  return Boolean(normalized && FUNNEL_NUMBERS.includes(normalized));
};

// Unambiguous alphabet: no 0/O/1/I/L so the code survives being read aloud or
// retyped from a lock-screen notification.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const generateClaimCode = () => {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
};

/**
 * Fetch an existing (unclaimed, unexpired) session for a caller so a second
 * call resumes instead of restarting.
 */
const getFunnelSession = async (rawPhone) => {
  if (!supabase) return null;
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;

  const { data, error } = await supabase
    .from('voice_onboarding_sessions')
    .select('*')
    .eq('caller_phone', phone)
    .maybeSingle();

  if (error) {
    console.warn('[FunnelIntake] Failed to load session.', { phone, error: error.message });
    return null;
  }
  if (!data) return null;
  if (data.state === 'claimed' || data.state === 'receptionist_live') return data;
  if (new Date(data.expires_at) < new Date()) return null;
  return data;
};

/**
 * The intake interview persona. The conversation must feel like a sharp
 * receptionist getting to know a new client, not a form read aloud — but every
 * answer lands in save_business_profile so the caller's own receptionist is
 * configured by the time they hang up.
 */
const buildFunnelSystemPrompt = (existingConfig) => {
  const resume = existingConfig && Object.keys(existingConfig).length > 0;

  const sections = [
    'ROLE:',
    'You are Flynn, an AI receptionist for Australian tradies. The person calling saw an ad',
    'and is ringing to check you out. This call is the demo: if you sound good, they sign up',
    'and get their own version of you answering their business line. Be upfront about being',
    'an AI if asked, and confident about it. You are the product and you know it.',
    '',
    'GOAL:',
    'Have a natural conversation that captures how their business works. Every answer you',
    'collect configures THEIR receptionist. By the end of the call you want:',
    '- their trade (plumber, sparky, chippy, landscaper, cleaner, etc.)',
    '- business name (if they have one)',
    '- their name',
    '- suburbs or areas they service',
    '- working hours (rough is fine: "weekdays 7 to 4" is enough)',
    '- what they charge for a callout, if they charge one',
    '- what they want done with after-hours calls (take a message, book for next day, or flag emergencies)',
    '',
    'HOW TO RUN THE CALL:',
    '- Open by explaining the deal in one breath: they talk to you for a minute or two,',
    '  and their own receptionist is set up from the conversation, live on their phone',
    '  within about a minute of hanging up. Free week to try it.',
    '- Then just chat. Ask ONE question at a time. React to what they actually say.',
    '- Call save_business_profile EVERY TIME you learn something new. Do not wait until',
    '  the end of the call. Partial saves are expected.',
    '- You are reading speech-to-text off a phone line, so words come through wrong.',
    '  Save what they OBVIOUSLY meant, not the literal text. "call detailing" is car',
    '  detailing, "glacier" is glazier, "removal list" is removalist, "Tyler" is tiler.',
    '  If a trade sounds made up, it was almost certainly misheard: pick the real trade',
    '  it rhymes with. Only ask them to repeat it if you genuinely cannot tell.',
    '- If they ask how it works, what it costs, or whether you are a robot: answer straight,',
    '  short, and get back to the conversation. It is $79 a month after a 7 day free trial,',
    '  card required for the trial, cancel any time.',
    '- If they go quiet or hesitant, do not push. Offer to text them the link so they can',
    '  look at it later.',
    '',
    'TONE:',
    '- Casual, warm, Australian. "no worries", "too easy", "arvo" where natural.',
    '- SHORT responses, 1 to 2 sentences. Contractions always.',
    '- Never corporate, never salesy. You are demonstrating, not pitching.',
    '- One question at a time. Never repeat a question they have answered.',
    '',
    'CLOSING:',
    '- Once you have the essentials (trade, area, hours at minimum), wrap up:',
    '  "Righto, I\'ve got everything I need. I\'ll text you a link right now, tap it and',
    '  your receptionist\'s live in under a minute. Sound good?"',
    '- Confirm, say goodbye briefly, and END THE CALL. Do not keep chatting.',
  ];

  if (resume) {
    const known = Object.entries(existingConfig)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    sections.push(
      '',
      'RESUMING:',
      'This caller has phoned before. You already know:',
      ...known,
      'Greet them like you remember them, confirm nothing has changed, and fill in only',
      'the gaps. Do NOT re-ask what you already know.',
    );
  }

  return sections.join('\n');
};

const buildFunnelGreeting = (existingConfig) => {
  const resume = existingConfig && Object.keys(existingConfig).length > 0;
  if (resume) {
    const name = existingConfig.owner_name ? ` ${String(existingConfig.owner_name).split(' ')[0]}` : '';
    return `Hey${name}, good to hear from you again! Want to pick up where we left off?`;
  }
  return "G'day, you've got Flynn! Quick heads up, I'm an AI receptionist, and here's the fun part: if you tell me a bit about your business, you'll have your own version of me answering your calls in about a minute. What trade are you in?";
};

/**
 * Function schema the Voice Agent calls incrementally during the intake call.
 * All fields optional: partial saves during the conversation are the norm.
 */
const getFunnelFunctionSchema = () => [
  {
    name: 'save_business_profile',
    description:
      'Save what you have learned about the caller\'s business. Call this every time you learn something new during the conversation, with only the fields you learned. Do not wait for the end of the call.',
    parameters: {
      type: 'object',
      properties: {
        trade: {
          type: 'string',
          description:
            'Their trade or service, e.g. "plumber", "electrician", "landscaper", "cleaner". '
            + 'This is phone speech-to-text, so correct obvious mishearings before saving: write '
            + 'the real trade they meant ("car detailing", not "call detailing"), never the raw text.',
        },
        business_name: {
          type: 'string',
          description: 'The business name if they have one',
        },
        owner_name: {
          type: 'string',
          description: 'The caller\'s name',
        },
        service_areas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Suburbs, regions or areas they service, e.g. ["Northern Beaches", "Manly"]',
        },
        hours: {
          type: 'string',
          description: 'Working hours in their own words, e.g. "weekdays 7am to 4pm, Saturday mornings"',
        },
        callout_fee: {
          type: 'string',
          description: 'What they charge for a callout, in their own words, e.g. "$120 inc GST, waived if we do the job", or "no callout fee"',
        },
        after_hours_policy: {
          type: 'string',
          enum: ['take_message', 'book_next_day', 'flag_emergencies', 'unsure'],
          description: 'What they want done with after-hours calls',
        },
        notes: {
          type: 'string',
          description: 'Anything else useful about how they run the business',
        },
      },
    },
  },
];

/**
 * Repair phone-ASR damage to the caller's trade before it is stored.
 *
 * The intake runs on 8kHz mulaw telephony audio through Deepgram Flux, which
 * has no keyterm/keyword-prompting parameter (only eot_threshold,
 * eager_eot_threshold, eot_timeout_ms and language_hint), so the trade cannot
 * be biased at the STT layer. Whatever Flux hears is what the model sees, and
 * the model saves it verbatim: a real caller's "car detailing" was stored as
 * "call detailing", which would then configure their receptionist to answer for
 * a business that does not exist.
 *
 * Two layers cover this. The system prompt tells the model to write down the
 * real-world trade rather than the literal transcript (see
 * buildFunnelSystemPrompt), and this function is the deterministic backstop for
 * when it passes the mangled text through anyway.
 *
 * The lists below are the confusions actually seen or strongly expected on this
 * audio path, not an exhaustive ASR error model. Anything unrecognised is left
 * untouched so a genuine niche trade is never rewritten into the wrong one.
 */

// Whole-value corrections, matched after lowercasing and collapsing whitespace.
const TRADE_PHRASE_FIXES = new Map([
  ['call detailing', 'car detailing'],
  ['cool detailing', 'car detailing'],
  ['core detailing', 'car detailing'],
  ['card detailing', 'car detailing'],
  ['removal list', 'removalist'],
  ['removal is', 'removalist'],
  ['pest patrol', 'pest control'],
  ['best control', 'pest control'],
  ['air con', 'air conditioning'],
  ['aircon', 'air conditioning'],
  ['gyprock', 'gyprocking'],
  ['lawn moaning', 'lawn mowing'],
  ['lawn morning', 'lawn mowing'],
]);

// Single-token corrections, applied word by word when no phrase matched. Every
// entry is a misheard or misspelt token, never a valid alternative name for a
// trade: "tiling", "concreting" and "brickie" are all things a real tradie
// legitimately says, so they are deliberately absent. This map corrects errors,
// it does not impose preferred vocabulary on the caller.
const TRADE_WORD_FIXES = new Map([
  ['tyler', 'tiler'],
  ['glacier', 'glazier'],
  ['arbourist', 'arborist'],
  ['aborist', 'arborist'],
  ['concreater', 'concreter'],
  ['carpentary', 'carpentry'],
  ['carpentery', 'carpentry'],
  ['plummer', 'plumber'],
  ['plumer', 'plumber'],
  ['electrican', 'electrician'],
  ['mechanik', 'mechanic'],
  ['landscapper', 'landscaper'],
]);

const normaliseTrade = (raw) => {
  if (!raw || typeof raw !== 'string') return raw;

  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return raw;

  const lower = cleaned.toLowerCase();

  const phraseFix = TRADE_PHRASE_FIXES.get(lower);
  if (phraseFix) {
    if (phraseFix !== lower) {
      console.log('[FunnelIntake] Corrected mis-transcribed trade.', { heard: cleaned, stored: phraseFix });
    }
    return phraseFix;
  }

  const words = lower.split(' ');
  const fixed = words.map((w) => TRADE_WORD_FIXES.get(w) || w);
  const result = fixed.join(' ');

  if (result !== lower) {
    console.log('[FunnelIntake] Corrected mis-transcribed trade.', { heard: cleaned, stored: result });
    return result;
  }

  return cleaned;
};

/** Parse "$120 inc GST" / "no callout fee" style answers into cents, or null. */
const calloutFeeToCents = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  if (/no\s+(call\s*-?\s*out|callout)\s+fee|free|none|nothing/i.test(raw)) return 0;
  const match = raw.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  return Math.round(parseFloat(match[1]) * 100);
};

/**
 * Upsert incrementally-extracted config into the caller's staging session.
 * Called from the Voice Agent's function-call handler mid-call.
 */
const saveFunnelConfig = async ({ callerPhone, callSid, config, _retried }) => {
  if (!supabase) return { success: false, error: 'storage unavailable' };
  const phone = normalizePhone(callerPhone);
  if (!phone) return { success: false, error: 'invalid caller phone' };

  // Raw fetch (no expiry filter): an expired row still owns the unique
  // caller_phone slot, so it must be revived in place, not re-inserted.
  const { data: existing } = await supabase
    .from('voice_onboarding_sessions')
    .select('*')
    .eq('caller_phone', phone)
    .maybeSingle();

  const expired = existing && new Date(existing.expires_at) < new Date();
  const incoming = pruneEmpty(config);
  if (incoming.trade) {
    incoming.trade = normaliseTrade(incoming.trade);
  }
  const merged = {
    ...((existing && !expired ? existing.business_config : null) || {}),
    ...incoming,
  };

  if (existing) {
    const callSids = existing.call_sids || [];
    const isNewCall = callSid && !callSids.includes(callSid);
    const { error } = await supabase
      .from('voice_onboarding_sessions')
      .update({
        business_config: merged,
        state: 'in_call',
        // A fresh code on revival: the old one may have been in a long-dead SMS.
        ...(expired ? { claim_code: generateClaimCode(), reengage_count: 0 } : {}),
        call_sids: isNewCall ? [...callSids, callSid] : callSids,
        call_count: isNewCall ? (existing.call_count || 1) + 1 : existing.call_count,
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) {
      console.error('[FunnelIntake] Failed to update session config.', { phone, error: error.message });
      return { success: false, error: error.message };
    }
    return { success: true, config: merged };
  }

  const { error } = await supabase.from('voice_onboarding_sessions').insert({
    caller_phone: phone,
    claim_code: generateClaimCode(),
    state: 'in_call',
    business_config: merged,
    call_sids: callSid ? [callSid] : [],
  });
  if (error) {
    // Unique-violation race (two saves in the same call): retry once as update.
    if (error.code === '23505' && !_retried) {
      return saveFunnelConfig({ callerPhone, callSid, config, _retried: true });
    }
    console.error('[FunnelIntake] Failed to insert session.', { phone, error: error.message });
    return { success: false, error: error.message };
  }
  return { success: true, config: merged };
};

const pruneEmpty = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
};

// The answers that actually configure a usable receptionist. How many of these
// we hold decides whether the follow-up SMS can honestly claim a finished setup.
const ESSENTIAL_CONFIG_FIELDS = ['trade', 'business_name', 'owner_name', 'service_areas', 'hours'];

const countCapturedEssentials = (config) => {
  if (!config || typeof config !== 'object') return 0;
  return ESSENTIAL_CONFIG_FIELDS.filter((field) => {
    const value = config[field];
    if (value === null || value === undefined || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;
};

/**
 * Onboarding SMS copy, keyed to how much the call actually produced.
 *
 * Under two essentials the caller dropped out early, so the message admits the
 * call was cut short and asks them to finish in the app rather than claiming a
 * receptionist that is ready to go. Tone rules from CLAUDE.md: lowercase
 * opener, no em dashes, short sentences, prose only.
 */
const buildOnboardingSms = ({ url, claimCode, captured }) => {
  const thin = captured < 2;

  if (!url) {
    return thin
      ? `hey, it's Flynn. we got cut off before I had much to go on. grab the Flynn app from the App Store and sign in with this number, you can finish setting your receptionist up in a minute. setup code if you need it: ${claimCode}`
      : `hey, it's Flynn. your receptionist's ready. grab the Flynn app from the App Store and sign in with this number, everything you told me is already there. setup code if you need it: ${claimCode}`;
  }

  // The sign-in tail carries the same claim as the opener, so it varies too.
  // Telling a caller who answered one question that "everything's already
  // there" is the exact promise this whole branch exists to avoid making.
  const codeLine = `only if you use a different number, your setup code is ${claimCode}`;

  return thin
    ? `hey, it's Flynn. we got cut off before I had much to go on, no worries. tap this and you can finish setting your receptionist up in the app, takes about a minute: ${url}\n\nsign in with this same number. ${codeLine}`
    : `hey, it's Flynn. your receptionist's ready, she learned your business from that call. tap this and she's live in under a minute: ${url}\n\nsign in with this same number and everything's already there. ${codeLine}`;
};

/**
 * End of call: persist transcript, move the state machine forward, and text the
 * caller the app magic link + claim code from the AU long code.
 */
const completeFunnelCall = async ({ callerPhone, callSid, transcript }) => {
  if (!supabase) return;
  const phone = normalizePhone(callerPhone);
  if (!phone) return;

  // Cost telemetry: funnel calls are CAC, not COGS (funnel: true, no tenant).
  if (callSid && Array.isArray(transcript) && transcript.length > 1) {
    try {
      const durationSeconds = Math.max(0, Math.floor(
        (new Date(transcript[transcript.length - 1].timestamp) - new Date(transcript[0].timestamp)) / 1000,
      ));
      const { totalCents, breakdown } = estimateCallCost(durationSeconds);
      const billingMonth = new Date();
      billingMonth.setDate(1);
      billingMonth.setHours(0, 0, 0, 0);
      await supabase.from('ai_call_usage').insert({
        call_sid: callSid,
        call_duration_seconds: durationSeconds,
        call_cost_cents: totalCents,
        cost_breakdown: breakdown,
        funnel: true,
        billing_period_month: billingMonth.toISOString().split('T')[0],
      });
    } catch (err) {
      console.warn('[FunnelIntake] Failed to log funnel call cost.', { callSid, error: err.message });
    }
  }

  const session = await getFunnelSession(phone);
  if (!session) {
    console.warn('[FunnelIntake] Call completed but no session found (caller may not have said anything useful).', { phone, callSid });
    return;
  }
  if (session.state === 'claimed' || session.state === 'receptionist_live') {
    // Existing customer ringing the ad line again; nothing to send.
    return;
  }

  await supabase
    .from('voice_onboarding_sessions')
    .update({
      state: 'call_completed',
      transcript: transcript && transcript.length > 0 ? transcript : session.transcript,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  // Magic link: ensures the auth user exists and mints a single-use sign-in
  // deep link (flynnai:// with an https bounce for cold installs).
  let link = null;
  try {
    link = await generateAppLink(phone);
  } catch (err) {
    console.error('[FunnelIntake] generateAppLink failed.', { phone, error: err.message });
  }

  if (!twilioClient) {
    console.error('[FunnelIntake] Twilio client unavailable; cannot send onboarding SMS.', { phone });
    return;
  }

  // Two codes reach this person within minutes of each other: this setup code,
  // and the numeric sign-in code Supabase texts when they verify their number.
  // Naming it "setup code" and saying when it's needed is what stops them
  // trying to type it into the sign-in field.
  const url = link?.httpsUrl || link?.url || null;

  // Callers who hang up in the first few seconds used to get the same "she
  // learned your business from that call" text as someone who did the full
  // interview. Promising a finished setup to a person who answered one question
  // reads as a lie at exactly the moment they have to decide whether to tap, so
  // short calls get copy that matches what Flynn actually got.
  const captured = countCapturedEssentials(session.business_config);
  const body = buildOnboardingSms({ url, claimCode: session.claim_code, captured });

  try {
    await twilioClient.messages.create({
      to: phone,
      from: SMS_FROM_NUMBER,
      body,
    });
    await supabase
      .from('voice_onboarding_sessions')
      .update({ state: 'sms_sent', last_sms_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', session.id);
    console.log('[FunnelIntake] Onboarding SMS sent.', { phone, callSid });
  } catch (err) {
    console.error('[FunnelIntake] Failed to send onboarding SMS.', { phone, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Re-engagement sweep: called from the server's 60s cron tick, internally
// throttled. Two nudges max (+24h, +72h after the onboarding SMS), then stop —
// Flynn never nags.
// ---------------------------------------------------------------------------

let lastReengageSweep = 0;
const REENGAGE_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

// Two variants per nudge for the same reason the onboarding SMS has two: a
// caller who hung up after one question has no "setup" saved to come back to,
// and telling them she remembers everything from the call is plainly false.
const REENGAGE_MESSAGES = [
  {
    rich: (url) => `hey, your receptionist's still sitting here ready to go. she remembers everything from your call. one tap and she's answering for you: ${url}`,
    thin: (url) => `hey, we got cut off the other day before I had much to go on. still keen? it's a couple of questions in the app and she's answering your calls: ${url}`,
  },
  {
    rich: (url) => `last one from me, promise. your setup's saved for a few more days if you want it: ${url}`,
    thin: (url) => `last one from me, promise. if you want to finish setting her up, the link still works for a few more days: ${url}`,
  },
];

const processFunnelReengage = async () => {
  if (!supabase || !twilioClient) return;
  const now = Date.now();
  if (now - lastReengageSweep < REENGAGE_SWEEP_INTERVAL_MS) return;
  lastReengageSweep = now;

  const { data: sessions, error } = await supabase
    .from('voice_onboarding_sessions')
    .select('*')
    .eq('state', 'sms_sent')
    .lt('reengage_count', REENGAGE_MESSAGES.length)
    .gt('expires_at', new Date().toISOString());
  if (error || !sessions || sessions.length === 0) return;

  for (const session of sessions) {
    const lastSms = session.last_sms_at ? new Date(session.last_sms_at).getTime() : 0;
    // First nudge 24h after the onboarding SMS, second 48h after the first.
    const waitMs = (session.reengage_count === 0 ? 24 : 48) * 3600 * 1000;
    if (now - lastSms < waitMs) continue;

    let link = null;
    try {
      link = await generateAppLink(session.caller_phone);
    } catch (err) {
      console.warn('[FunnelIntake] Re-engage link generation failed.', { phone: session.caller_phone, error: err.message });
    }
    const url = link?.httpsUrl || link?.url;
    if (!url) continue;

    try {
      await twilioClient.messages.create({
        to: session.caller_phone,
        from: SMS_FROM_NUMBER,
        body: REENGAGE_MESSAGES[session.reengage_count][
          countCapturedEssentials(session.business_config) < 2 ? 'thin' : 'rich'
        ](url),
      });
      await supabase
        .from('voice_onboarding_sessions')
        .update({
          reengage_count: session.reengage_count + 1,
          last_sms_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);
      console.log('[FunnelIntake] Re-engage SMS sent.', {
        phone: session.caller_phone,
        nudge: session.reengage_count + 1,
      });
    } catch (err) {
      console.error('[FunnelIntake] Re-engage SMS failed.', { phone: session.caller_phone, error: err.message });
    }
  }
};

module.exports = {
  isFunnelNumber,
  processFunnelReengage,
  getFunnelSession,
  buildFunnelSystemPrompt,
  buildFunnelGreeting,
  getFunnelFunctionSchema,
  saveFunnelConfig,
  completeFunnelCall,
  calloutFeeToCents,
  generateClaimCode,
  normaliseTrade,
  countCapturedEssentials,
  buildOnboardingSms,
};
