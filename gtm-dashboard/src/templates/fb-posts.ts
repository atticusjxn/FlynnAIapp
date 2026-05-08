// Mirrors gtm-automation/templates/facebook-groups/*.md.

import type { FBPostType } from '@/lib/types';

export interface FBPostContext {
  city?: string;
  trade?: string;
}

export const FB_POST_TEMPLATES: Record<FBPostType, (ctx: FBPostContext) => string> = {
  VALUE_QUESTION: () =>
    `Quick poll for the group — how many of you are losing $$ to missed calls?

Trying to get a real-world feel for the scale of the problem. If you've ever been on a job and ignored a call from a number you didn't recognise, only to find out later it was a $400-2,000 booking, drop a comment.

Genuinely curious whether this is a 1-2 a week thing or a daily thing for most.`,

  CASE_STUDY: ({ city }) =>
    `Spoke to a sparky in ${city || 'Sydney'} this week who'd been losing 6-8 jobs a week to missed calls.

Worked out to roughly $3-4k/week in lost revenue.

He set up an AI receptionist (Flynn — full disclosure, that's my product) two weeks ago. First 14 days: 23 calls captured, 8 of them booked into actual jobs. ~$3,200 in revenue from calls he wouldn't have answered.

Not posting this as a sales pitch — posting because the maths surprised me. The cost of missed calls is way bigger than most tradies realise.

If anyone wants to chat about how their numbers compare, hit me up.`,

  GENUINE_HELP: ({ trade }) =>
    `G'day all — I run a small AI/automation business and have been helping AU ${trade || 'tradies'} set up systems for missed calls, follow-ups, and quotes.

Happy to spend 15 min on a call with anyone here who's:
→ Losing leads to missed calls
→ Drowning in admin / quote chasing
→ Wanting to figure out which AI tools are worth a damn vs. hype

No pitch, no upsell. Genuine 15 min — bring your problem, I'll either point you to a free tool that fixes it or tell you it's not solvable yet.

DM me or comment "interested" and I'll book a slot.

— Atticus`,
};

export function fbPostLabel(t: FBPostType): string {
  return t === 'VALUE_QUESTION'
    ? 'Value question'
    : t === 'CASE_STUDY'
      ? 'Case study'
      : 'Genuine help';
}
