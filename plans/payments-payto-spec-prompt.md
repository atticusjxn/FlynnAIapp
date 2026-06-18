# Spec-out prompt — real "Pay by bank" (PayTo) for Flynn invoices

Paste the block below into a fresh Claude Code session **when the timing is right**
(see "When to revisit"). It asks for a *spec*, not code — a plan you can react to
before committing weeks of work to a money-movement feature.

---

## When to revisit (don't build before this)

Build this only once BOTH are true:
1. Real operators (not testers) are sending photo invoices through Flynn regularly.
2. You've heard, unprompted, some version of "can they just pay me from this?".

Until then the right-sized version already ships: copyable bank details on the
invoice page + the photo invoice itself. The thing to validate first is cheaper —
*does anyone use the invoice feature at all?* See memory `flynn-photo-invoices`
and `flynn-current-users-testers`.

Why it's worth doing eventually (the real reasons, not the UX):
- **Revenue model** — clip a small % of each invoice paid through Flynn; usage-aligned.
- **Retention moat** — being in the money flow means Flynn gets the "paid" event
  automatically: auto-reconcile, auto-stop-chasing, no manual "mark as paid".

The hard tension to design around: PayTo means per-operator KYC/merchant
onboarding, which fights Flynn's core promise of "no app, no login, just text it."

---

## The prompt

> I want a spec (NOT code yet) for wiring a real "Pay by bank" button into Flynn's
> invoices, so a client can tap Pay on a Flynn invoice link and authorise the
> payment in their own banking app (PayTo / pay-by-bank), money landing in the
> operator's account.
>
> First, ground yourself in the current implementation before proposing anything:
> - Read memory `flynn-photo-invoices` and `flynn-integrations-strategy`.
> - Read `services/photoInvoice.js` (invoice model + the hosted page render, incl.
>   the current bank-transfer block and `stripe_payment_url` field already plumbed),
>   `routes/invoicePage.js` (the public `/i/:token` page), and the `create_photo_invoice`
>   / `mark_invoice_paid` tools in `services/agent/toolRegistry.js`.
> - Note the `agent_invoices` table (phone-keyed) and the `documents` bucket.
> - The agent is phone-keyed (`users.business_brain`), NOT org-based; whatever you
>   design has to fit that. Currency is inferred from phone prefix (+61 AUD / +64 NZD).
>
> Then produce a spec that answers, concretely:
> 1. **Provider choice.** Compare, for AU (NZ later): Stripe PayTo (already some
>    Stripe in the repo), vs AU bank-rail PSPs (Azupay, Zai, Monoova, Banked, Till).
>    For each: does it do PayTo and/or PayID request-to-pay, per-operator onboarding
>    model, KYC burden, fees, payout timing, settlement (do funds touch Flynn or go
>    operator-direct?), API quality, and AU/NZ coverage. Recommend one, with reasoning.
> 2. **Funds + onboarding model.** How does each operator get paid out — Stripe
>    Connect Express, the PSP's sub-merchant model, or operator-direct? Design the
>    KYC/onboarding so it intrudes as little as possible on the "just text it" promise
>    (e.g. a one-link hosted onboarding Flynn texts, like the existing `/setup` Nango
>    page in `routes/connectPage.js`). What's the minimum an operator must do before
>    their first payable invoice?
> 3. **The pay flow.** What actually happens when the client taps Pay on `/i/:token`
>    — hosted PSP page? PayTo agreement screen? PayID request? Sequence it end to end,
>    including the case where the client's bank doesn't support PayTo.
> 4. **The paid event.** Webhook → flip `agent_invoices.status` to paid, set `paid_at`,
>    text the operator ("henderson just paid you $X"), stop any chasing. Reconcile
>    against Xero if connected.
> 5. **Money model.** Should Flynn take a clip per transaction? How (application fee
>    via Connect / PSP split)? What rate is defensible for a tradie on a big removal?
> 6. **Compliance + risk** for a solo founder: what regulatory/AFSL/PSP-of-record
>    weight Flynn takes on under each model, chargeback/fraud exposure, and support load.
> 7. **MVP vs full.** The smallest version that proves operators want it (maybe one
>    pilot operator on a hosted PSP pay page, manual onboarding) vs the productised
>    version. Phase it.
>
> Deliverable: a provider comparison table, a recommended approach with rationale,
> a phased build plan with rough effort, the key risks, and the smallest validating
> MVP. Flag every open question that needs my decision. Do not write code in this pass.

---

## Notes for future-me

- The invoice page already has a `stripe_payment_url` field — if a PSP gives a hosted
  pay URL per invoice, the page renders a real Pay button the moment that's populated
  (see the `payBlock` logic in `services/photoInvoice.js`).
- `mark_invoice_paid` exists for the manual path; the webhook should call the same
  state transition.
- Keep the deferred share-card PNG + server-side PDF in mind — both need a headless
  render step on Fly that a payments build might justify adding.
