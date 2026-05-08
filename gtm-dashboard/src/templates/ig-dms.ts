// Mirrors gtm-automation/templates/instagram-dm/*.md so the dashboard can
// substitute + render scripts without reading from the filesystem at runtime.
// Keep this in sync when the markdown templates evolve.

import type { IGScript } from '@/lib/types';

export interface IGTemplateContext {
  handle: string;
  /** Optional. The thing they recently posted about, if you've researched it. */
  topic?: string;
}

export const IG_DM_TEMPLATES: Record<IGScript, (ctx: IGTemplateContext) => string> = {
  REV_SHARE: ({ handle, topic }) =>
    `Hey ${handle}, atticus here — founder of Flynn AI (AI receptionist for AU tradies).

Loved your recent post about ${topic ? topic : '[recent post]'}.

Real ask — would you be open to a rev share partnership? I'd give you a unique signup link, you mention Flynn to your audience, and you get $10/month per paying customer for as long as they stay subscribed.

Most of my customers stick around for 12+ months at $29-149/month, so it works out to $120-1,800+ per signup.

Open to a 10 min chat to walk through it?

Cheers,
Atticus`,

  FREE_MONTH: ({ handle, topic }) =>
    `Hey ${handle} — atticus, founder of Flynn AI (AI receptionist for AU tradies).

Saw your post on ${topic ? topic : '[recent post]'}. Real-world content, no BS — that's the audience I'm trying to reach.

Quick offer: free month of Flynn (normally $29/mo) in exchange for one honest post or story about it. No script, no paid promo disclaimer needed unless you want to add one. If you hate it, you say so and we both move on.

Worst case you get a free month. Best case you tell your followers you actually use it.

Want me to set you up?

Cheers,
Atticus`,

  FEEDBACK: ({ handle }) =>
    `Hey ${handle} — atticus, founder of Flynn AI.

I'm building an AI receptionist specifically for AU tradies — answers missed calls, texts the caller a booking link.

Looking for 5 tradies to use it free for 60 days and tell me what's broken / what's missing. No strings, no posting required.

Worst case you get a free 60-day trial. Best case you help shape a tool you'd actually use.

Keen?

Cheers,
Atticus`,
};

export function igScriptLabel(s: IGScript): string {
  return s === 'REV_SHARE'
    ? 'Rev share partnership'
    : s === 'FREE_MONTH'
      ? 'Free month for a post'
      : 'Free 60-day trial for feedback';
}
