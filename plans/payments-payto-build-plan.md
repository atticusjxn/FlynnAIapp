# Build plan — PayTo "Pay by bank" on Flynn invoices

Status: **planned, not started.** Build only after the trigger (real operators
invoicing through Flynn + asking to get paid in-thread). See `flynn-positioning`
and `flynn-photo-invoices` memories, and `plans/payments-payto-spec-prompt.md`.

## Decision (settled by research, 2026-06)

**Provider: Stripe PayTo via Stripe Connect.** Both the cheapest *and* fastest at
our stage:
- **PayTo fee: 1% + A$0.30, capped at A$3.50, no monthly fee.** The cap makes
  big-ticket trade invoices cheap (a $600 removal costs ~$3.50, not $6+).
- Flat-fee NPP players (Azupay ~$600/mo + $0.54, Monoova/Zepto) only beat Stripe
  past ~200 paid invoices/month and are sales-led (weeks to onboard). Wrong for now.
- Stripe is already in the codebase; the invoice page already has `stripe_payment_url`
  plumbed, so a real Pay button renders the moment a pay URL exists.
- Connect = per-operator sub-merchant accounts → Flynn can take a clip as a Connect
  **application fee**, and Stripe Express handles operator KYC as a single hosted link
  (fits the existing hand-picked connector link in onboarding / `routes/connectPage.js`).

Trade-off accepted: Connect onboarding adds the one bit of setup we sell against,
but it's **opt-in** — only operators who want payment links connect Stripe.

## How it fits the product

Onboarding already sends a hand-selected connector link. "Invoicing + get paid"
becomes one more connector on that page → "Connect Stripe to get paid by bank."
Likely a **premium plan** gate (ignore monetisation mechanics for v1).

## Architecture

```
Operator onboarding → Stripe Connect Express onboarding link (hosted KYC)
   → store connected account id on the user (users.business_brain.stripe_account_id
     or a dedicated column)
Invoice created (create_photo_invoice)
   → if operator has a connected account, create a Stripe PayTo
     PaymentIntent (on_behalf_of / transfer_data → connected acct,
     application_fee_amount = Flynn's clip)
   → store the hosted pay URL on agent_invoices.stripe_payment_url
   → invoice page renders the real "Pay now" button (already coded)
Client taps Pay → Stripe-hosted PayTo authorisation (agreement in their bank app)
Stripe webhook payment_intent.succeeded
   → flip agent_invoices.status = paid, paid_at, payment_method='payto'
   → text the operator "henderson just paid you $X" (flynnOutbound)
   → reconcile to Xero if connected
```

## Phases

**Phase 0 — validate (no Connect build).** Pilot with ONE real operator (you).
Plain Stripe account, manually create a PayTo payment link per invoice, drop it in
`stripe_payment_url`. Prove a real client actually pays via PayTo before building
the platform. Cheapest possible learning.

**Phase 1 — Connect onboarding.** Add Stripe Connect Express. New connector on the
`/setup` page + an agent path ("want to get paid by bank? here's the link"). Store
the connected account id. Handle the not-yet-onboarded and onboarding-incomplete states.

**Phase 2 — wire payments into invoices.** On `create_photo_invoice`, when the
operator is connected, create the PayTo PaymentIntent with `application_fee_amount`,
save the hosted pay URL. The page already renders the button. Fall back to the
current bank-transfer block when not connected.

**Phase 3 — the paid event.** Stripe webhook (`routes/stripeRoutes.js` already
exists) → mark invoice paid (same transition as `mark_invoice_paid`), notify the
operator, stop any chasing, reconcile to Xero. This is the retention payoff — the
loop closes itself with no manual "mark as paid".

**Phase 4 — money model.** Decide the application-fee rate (Flynn's clip per
invoice) and the premium-plan gate. Defensible given competitors charge $29–39/mo.

## Key files
- `services/photoInvoice.js` — `stripe_payment_url` render already done; add PayTo
  PaymentIntent creation helper.
- `services/agent/toolRegistry.js` — `create_photo_invoice` (add the PaymentIntent
  step), `mark_invoice_paid` (webhook reuses its transition).
- `routes/stripeRoutes.js` — add the Connect + PayTo webhook handlers.
- `routes/connectPage.js` / onboarding — add the Stripe "get paid" connector.
- `agent_invoices` — already has `stripe_payment_url`, `status`, `paid_at`,
  `payment_method`.

## Open questions to resolve before Phase 1
- Connected-account model: Express (Flynn-branded onboarding, Flynn is platform) —
  almost certainly yes. Confirm payout/settlement (funds operator-direct vs platform).
- Which payer banks support PayTo today (most majors do; rollout ongoing) — handle
  the "your bank doesn't support PayTo yet → use bank transfer" fallback gracefully.
- Compliance: as a Connect platform Flynn takes on some PSP-of-record weight + KYC
  obligations. Confirm scope with Stripe before launch.
- Premium-plan pricing + the application-fee rate.

## Risks
- Trust: wrong amount/client on a payable invoice is worse than on a static one.
  Keep the confirm gate; consider a higher bar before money can move.
- Onboarding drop-off at Stripe KYC — measure it; it's the friction we sell against.
- Don't market "instant payments" until Phase 3 is live and tested end to end.
