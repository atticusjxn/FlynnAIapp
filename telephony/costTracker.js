/**
 * Call cost + event writer.
 *
 * Handles two things:
 *
 *   1. Finding or creating the `calls` row for a given Telnyx call_control_id.
 *      Events reference the Supabase `calls.id` (UUID), but the outside world
 *      only knows about Telnyx's `call_control_id` (text). This helper memoises
 *      the lookup per call so repeated `logCallEvent` calls during the same
 *      call don't keep hitting the DB.
 *
 *   2. Writing append-only rows into `call_events` with optional latency/cost,
 *      and (on call_ended) rolling per-turn cost estimates up into the
 *      `calls.cost_*_cents` columns.
 *
 * Per-minute rates (cents) from the relaunch plan:
 *
 *   telephony:   0.75   // Telnyx AU inbound
 *   stt+llm+tts: 6.00   // Deepgram Voice Agent ("Custom — BYO LLM + TTS") +
 *                       // Cartesia Sonic-3 streaming, Gemini 2.5 Flash is ~0.01
 *
 * All values are cents; we avoid floats so aggregation in SQL stays exact.
 */

const { supabase } = require('./supabaseClient');

const RATES_CENTS_PER_MINUTE = {
  telephony: 0.75,
  stt: 0.0,   // bundled into Deepgram Voice Agent BYO-LLM+TTS tier
  llm: 0.2,   // Gemini 2.5 Flash at typical 500in/200out per minute
  tts: 2.0,   // Cartesia Sonic-3 approx
  agent: 4.0, // Deepgram Voice Agent orchestration
};

const callRowCache = new Map(); // telnyxCallControlId → Supabase calls.id

async function ensureCallRow({
  telnyxCallControlId,
  userId,
  fromNumber,
  toNumber,
  handlingMode,
}) {
  if (!telnyxCallControlId) {
    throw new Error('ensureCallRow requires telnyxCallControlId');
  }
  const cached = callRowCache.get(telnyxCallControlId);
  if (cached) return cached;

  // Try to find an existing row.
  const { data: existing } = await supabase
    .from('calls')
    .select('id')
    .eq('call_sid', telnyxCallControlId)
    .maybeSingle();

  if (existing?.id) {
    callRowCache.set(telnyxCallControlId, existing.id);
    return existing.id;
  }

  // Insert a new row.
  const { data: created, error } = await supabase
    .from('calls')
    .insert({
      user_id: userId,
      call_sid: telnyxCallControlId,
      from_number: fromNumber || null,
      to_number: toNumber || null,
      status: 'ringing',
      handling_mode: handlingMode || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[calls] Failed to insert call row:', error.message);
    throw error;
  }
  callRowCache.set(telnyxCallControlId, created.id);
  return created.id;
}

async function logCallEvent({
  callId,
  userId,
  eventType,
  eventData = {},
  latencyMs = null,
  costCents = null,
}) {
  if (!callId || !userId || !eventType) {
    console.error('[call_events] Missing required field', { callId, userId, eventType });
    return;
  }
  try {
    const { error } = await supabase.from('call_events').insert({
      call_id: callId,
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
      latency_ms: latencyMs,
      cost_cents: costCents,
    });
    if (error) console.error('[call_events] insert failed:', error.message);
  } catch (err) {
    console.error('[call_events] insert threw:', err.message);
  }
}

/**
 * Compute per-minute cost components for a completed call duration (seconds)
 * and update calls.cost_*_cents. Callers typically invoke this from the
 * `call.hangup` webhook handler.
 */
async function finalizeCallCost({ callId, durationSeconds, mode = 'sms_links' }) {
  const minutes = Math.max(durationSeconds / 60, 0);
  const telephonyCents = Math.round(minutes * RATES_CENTS_PER_MINUTE.telephony);

  let sttCents = 0;
  let llmCents = 0;
  let ttsCents = 0;

  if (mode === 'ai_receptionist') {
    sttCents = Math.round(minutes * RATES_CENTS_PER_MINUTE.agent);
    llmCents = Math.round(minutes * RATES_CENTS_PER_MINUTE.llm);
    ttsCents = Math.round(minutes * RATES_CENTS_PER_MINUTE.tts);
  }

  const totalCents = telephonyCents + sttCents + llmCents + ttsCents;

  const { error } = await supabase
    .from('calls')
    .update({
      duration: Math.round(durationSeconds),
      handling_mode: mode,
      cost_telephony_cents: telephonyCents,
      cost_stt_cents: sttCents,
      cost_llm_cents: llmCents,
      cost_tts_cents: ttsCents,
      cost_total_cents: totalCents,
    })
    .eq('id', callId);

  if (error) console.error('[calls] finalizeCallCost failed:', error.message);
}

function evictCallCache(telnyxCallControlId) {
  callRowCache.delete(telnyxCallControlId);
}

module.exports = {
  RATES_CENTS_PER_MINUTE,
  ensureCallRow,
  logCallEvent,
  finalizeCallCost,
  evictCallCache,
};
