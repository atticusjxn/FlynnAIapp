/**
 * Per-call cost estimation for the voice pipeline, in USD cents.
 *
 * Rates are July-2026 PAYG list prices, env-overridable so they can be trued
 * up against real invoices without a deploy. The margin model ($79/mo against
 * a ~70% gross-margin floor) depends on this telemetry being honest — log the
 * estimate on every call, then reconcile monthly against provider bills.
 */

const RATES_PER_MIN_USD = {
  // Deepgram Flux conversational STT (streaming)
  stt: parseFloat(process.env.COST_STT_PER_MIN || '0.0065'),
  // Gemini 2.5 Flash think layer (approx, prompt-cached)
  llm: parseFloat(process.env.COST_LLM_PER_MIN || '0.010'),
  // Cartesia Sonic-3 / ElevenLabs Flash at ~50% agent talk-time
  tts: parseFloat(process.env.COST_TTS_PER_MIN || '0.040'),
  // Twilio AU inbound + media stream
  telephony: parseFloat(process.env.COST_TELEPHONY_PER_MIN || '0.025'),
};

/**
 * @param {number} durationSeconds
 * @returns {{ totalCents: number, breakdown: Record<string, number> }} component cents
 */
const estimateCallCost = (durationSeconds) => {
  const minutes = Math.max(0, durationSeconds || 0) / 60;
  const breakdown = {};
  let totalCents = 0;
  for (const [component, ratePerMin] of Object.entries(RATES_PER_MIN_USD)) {
    const cents = Math.round(minutes * ratePerMin * 100);
    breakdown[component] = cents;
    totalCents += cents;
  }
  return { totalCents, breakdown };
};

module.exports = { estimateCallCost, RATES_PER_MIN_USD };
