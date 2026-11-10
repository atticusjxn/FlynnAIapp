# Flynn — First Paid Test Plan (Meta, AUD)

> The plan to point budget at B1 once it's filmed. Goal of the test: find ONE
> ad + audience combo that gets you Message-Flynn leads at a price you'd happily
> pay again. Not to be profitable on day one — to find the winner you scale.

## The one number to judge everything on
**Cost per "Lead"** = cost per person who tapped *Message Flynn* on the landing page
(the standard `Lead` event we wired). Planning range, AU, decent video:
- **Optimised: ~$4–12 AUD / lead**
- **Learning phase (first ~1–2 weeks): $15–30+ / lead** — don't panic, it drops.
- A `Lead` is a *tap-to-message*, not a sale. True cost per **paying sub** is more
  like **$40–120+** once you factor activation → $49/mo conversion. Watch that via
  the `Activated` event, not this one.

## Campaign structure (keep it dead simple)
One campaign, one ad set, 5 ads (the 5 B1 hook variants on a constant body).

| Layer | Setting |
|---|---|
| Campaign objective | **Sales** (already built as a draft: *Flynn — Receipt Demo — Web Conversions*) |
| Conversion location | **Website** → dataset **Flynn Web** → event **Lead** |
| Budget | **Advantage+ campaign budget (CBO)** so Meta moves spend to the winning hook |
| Ad set audience | **Broad** — AU, 25–55, no interest stacking. Let the pixel find them. (Advantage+ audience is fine.) |
| Placements | **Advantage+ (automatic)** |
| Ads | **5 ads = the 5 B1 hooks**, identical body, identical CTA → flynnai.app |

Why broad + CBO + 5 hooks: you're testing *creative*, not audiences. The hook is
80% of the result. Let Meta's algorithm + the budget optimiser do the targeting and
crown the hook. One variable at a time.

## Budget — pick one
| Tier | Daily | What it buys |
|---|---|---|
| **Minimum viable** | **$20/day** | ~2–4 leads/day. Learns slowly, reads noisy. OK to dip a toe. |
| **Recommended test** | **$40–50/day** | ~50 leads/week → enough to exit learning + actually trust the data. |
| Run for | **7–10 days** | Don't touch it for the first 3–4 days (learning phase). Judging early = killing winners. |

Total for a real read: **~$300–500 over a week.** Treat it as the cost of *finding*
your winning creative, not as customer acquisition.

## The decision rules (when to kill / scale)
- **First 3–4 days:** hands off. Meta is in learning. Early CPL is meaningless.
- **Hook-rate first, CPL second.** In Ads Manager add the **Hook rate** / 3-sec
  video play column. Kill any hook under ~**25–30%** 3-sec view rate even if CPL
  looks ok — it won't scale.
- **Day 5–7:** Meta will be spending most of the budget on 1–2 of the 5 hooks.
  That's your answer — those are the winners.
- **Kill** an ad if: hook-rate is low AND it's got spend with ~0 leads.
- **Scale** the winner: once one hook is under your target CPL with volume,
  duplicate it into its own campaign and raise budget **~20–30% every 3–4 days**
  (bigger jumps reset learning).
- **Refresh** when CPL creeps up after ~1–2 weeks (creative fatigue) — that's when
  hooks #6–10 / a new body come in.

## What "good" looks like for go/no-go
- 🟢 **Winner found:** a hook holding **< ~$10 CPL** with 30%+ hook-rate → scale it,
  start watching Activated → paying.
- 🟡 **Promising but pricey:** $10–20 CPL → iterate the hook/landing, don't scale yet.
- 🔴 **All 5 dead:** every hook > ~$25 CPL with low hook-rate → the *creative* is the
  problem, not the spend. Reshoot hooks before adding budget. (Don't just throw
  money at a weak video.)

## Before you press publish (checklist)
- [ ] B1 filmed + 5 hook cuts exported clean (no TikTok watermark), 9:16, captions burned in
- [ ] Draft campaign opened → conversion event set to **Lead**
- [ ] 5 ads loaded (one per hook), same body, CTA → flynnai.app
- [ ] Daily budget set ($40–50 recommended), CBO on
- [ ] Landing page tested on YOUR phone: tap Message Flynn → it fires (check Events Manager Test Events)
- [ ] Payment method on the **Mates Rates** ad account confirmed
- [ ] Then: Review and publish → **Publish**

## Don't-do list
- Don't optimise on **link clicks** — cheap clicks, low intent. (See why: Lead = the
  actual tap that matters.)
- Don't stack interests / go narrow on the first test — you're testing hooks, not audiences.
- Don't edit the ad set in the first 3–4 days — every edit resets learning.
- Don't judge on **ad-level CPA** in week one — judge on **which ads Meta chooses to spend on** + hook-rate.
