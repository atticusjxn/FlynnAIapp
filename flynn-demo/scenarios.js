/**
 * Curated lines for the TikTok shoot. Each entry maps trigger keywords to a
 * hand-crafted, on-brand Flynn reply (spoken through the live voice pipeline so
 * timing + voice feel real). The matcher is keyword-scored so phrasing can vary
 * across takes and still land the right scripted reply; anything that doesn't
 * match falls back to the live Qwen persona in persona.js.
 *
 * Tone is Flynn replying TO the operator (the boss), not drafting a customer
 * message: casual Aussie mate, confirms before doing anything irreversible,
 * references plausible context, never "done already".
 */

const SCENARIOS = [
  {
    id: 'invoice-chase',
    label: 'Chase Greg\'s invoice',
    // what you might say on camera
    cue: 'Flynn, chase up Greg\'s invoice will ya',
    keywords: ['greg', 'invoice', 'chase', 'follow up', 'followup', 'nudge', 'overdue', 'pay'],
    reply:
      "yeah Greg's one's about four days over now. want me to send him a nudge? something like \"hey Greg, just chasing that invoice for the bathroom job, no rush, whenever you get a sec\". happy with that?",
  },
  {
    id: 'order-parts',
    label: 'Order PVC from Reece',
    cue: 'can you order some 90 mil PVC from Reece',
    keywords: ['order', 'reece', 'pvc', 'pipe', 'fitting', 'ninety', '90', 'parts', 'lengths'],
    reply:
      "no worries. last run from Reece was ten lengths of the 90 mil, want the same again? i'll put the order through soon as you say go.",
  },
  {
    id: 'order-status',
    label: 'Finlayson\'s order status',
    cue: 'check how my Finlayson\'s order is going',
    keywords: ['finlayson', 'finlaysons', 'order', 'status', 'how', 'going', 'delivery', 'eta', 'arrive'],
    reply:
      "just checked, Finlayson's have it down to land Thursday arvo. i'll ping you soon as it's in.",
  },
  {
    id: 'bunnings-collect',
    label: 'Bunnings click & collect',
    cue: 'is my Bunnings order ready to grab',
    keywords: ['bunnings', 'order', 'ready', 'collect', 'pickup', 'pick up', 'click', 'grab'],
    reply:
      "yep, your click and collect at Springvale's marked ready, been sitting since this morning. want me to set a reminder to grab it on the way home?",
  },
];

/**
 * Pick the best-matching scenario for a transcript, or null.
 * @param {string} transcript
 * @returns {{scenario: object, score: number} | null}
 */
function matchScenario(transcript) {
  const text = (transcript || '').toLowerCase();
  if (!text.trim()) return null;

  let best = null;
  for (const scenario of SCENARIOS) {
    let score = 0;
    for (const kw of scenario.keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (!best || score > best.score) best = { scenario, score };
  }

  // Require at least two keyword hits so a stray "order" doesn't grab a scenario.
  if (best && best.score >= 2) return best;
  return null;
}

module.exports = { SCENARIOS, matchScenario };
