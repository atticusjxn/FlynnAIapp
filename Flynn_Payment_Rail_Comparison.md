# Flynn AU payment rail — provider comparison and legal questions

Research only, as agreed on 2026-07-29. **No provider is chosen here and no
regulatory posture is decided.** Section 4 is the list of things that need an
Australian financial-services lawyer rather than an engineer.

Verified against public sources on 2026-07-29. Anything marked *unverified* could
not be confirmed publicly and needs a sales conversation or legal input.

---

## 1. The finding that changes the sequencing

**Neither Azupay nor Monoova publishes pricing.** Azupay's pricing page is a
"tell us about your business and we'll tailor pricing" form; Monoova routes to
sales. There is no self-serve signup, no public rate card, and no sandbox you can
reach without a commercial conversation.

That means the first useful unit of work is **not code**. It is a sales call plus
a KYB pack. Until an agreement exists, an integration cannot be specced with real
numbers — and the take-rate model depends entirely on those numbers, because
Flynn's margin is the gap between what the rail charges per transaction and what
Flynn charges the tradie.

This is the strongest evidence for the decision already taken: **launch ads
without the take-rate.** The rail is gated on commercial process measured in
weeks, and no amount of engineering shortens it.

---

## 2. Provider comparison

| | **Azupay** | **Monoova** | **Stripe Connect** (incumbent) |
|---|---|---|---|
| Core rail | PayID / NPP real-time A2A | PayID, PayTo, NPP, BPAY, direct debit, **plus card acquiring** | Cards, Apple/Google Pay |
| Positioning | PayID specialist — first in AU to offer dynamic PayID | Broad money-movement API; automated receivables/reconciliation | Global card platform |
| Pricing | Not public — tailored, sales-gated | Not public — sales-gated | Public: ~1.7% + $0.30 domestic cards |
| Flat-fee A2A? | The reason to look at them; **rate unverified** | Likely; **rate unverified** | No — percentage model |
| Breadth | Narrow (A2A focus) | Widest — one integration covers A2A *and* cards | Cards only |
| Fit for Flynn's margin | Best case if flat fee is low | Strong: one provider for both rails | **Cannot carry the take-rate** — percentage pricing leaves no room |
| Onboarding | Online merchant application; KYB + entity detail | KYB, sales-led | Self-serve, minutes |

### Read on the three

- **Stripe stays, but not as the take-rate rail.** It is already integrated for
  subscriptions and is the right way to accept a card. Its percentage pricing is
  the specific reason a capped take-rate can't sit on top — this matches the
  existing note in `flynn_payments_verified_facts` and nothing found today
  contradicts it.
- **Monoova is the stronger single-provider bet** on breadth: cards and
  account-to-account through one integration and one KYB, rather than running
  Azupay for PayID alongside Stripe for cards. Fewer reconciliation seams, one
  commercial relationship.
- **Azupay is the specialist play.** If their flat PayID fee comes in materially
  below Monoova's, the margin case may justify the extra integration. That is a
  pricing question, and pricing is not public — so it is a phone call, not a
  research task.

**Recommended next action (yours, not mine):** approach both, ask the same three
questions — per-transaction fee for PayID/NPP, whether Flynn can take a fee as a
platform, and what entity/KYB evidence they need — and compare the answers.

---

## 3. Surcharging — a nuance worth getting right

The RBA Payments System Board's conclusions paper confirms surcharging is removed
on **eftpos, Mastercard and Visa** (debit, prepaid and credit) from
**1 October 2026**. Current rules hold until then.

The nuance: **the ban is scoped to designated card networks.** PayID / NPP
account-to-account is not one of them, so the ban does not on its face prohibit a
fee on a PayID payment. That is exactly the sort of "reads fine, needs
confirming" point that belongs with a lawyer, not in a design doc — and ACCC
rules on misleading pricing apply regardless of what the RBA designates.

**Design constraint, unchanged and already applied in code:** Flynn's fee comes
out of the tradie's settlement, never added on top of the invoice total the
client sees. The client pays the invoice amount, full stop. The mark-paid work
shipped today treats `paid_amount_cents` as what the client actually paid, with
no fee inflation, so nothing has to be unwound later.

---

## 4. Questions for an Australian financial-services lawyer

**Do not let engineering answer these.**

1. **Does Flynn need an AFSL?** A "single recipient" exemption exists for payment
   platforms restricting payments to one recipient — Flynn, collecting on behalf
   of many tradies, plainly does not fit it. What does apply?
2. **Does the answer change if Flynn never touches funds?** If money moves
   tradie-direct and the provider is the one holding it, Flynn may sit outside the
   licensing perimeter entirely. This single question decides the whole
   architecture and should be asked first.
3. **The licensing regime itself is changing.** Treasury's reforms replace
   "non-cash payment facilities" with "payment products / payment services", and
   PSPs will generally need a licence under the new framework. Building toward the
   old exemption structure is a trap. What is the transition timing?
4. **Can Flynn rely on the provider's licence** as an authorised representative or
   payment facilitator sub-merchant, rather than holding its own?
5. **Settlement and float.** If funds rest anywhere before reaching the tradie,
   even briefly, what obligations attach — trust account, client money rules,
   capital requirements?
6. **Surcharge scope**, per section 3: is a platform fee on a PayID payment
   outside the 1 Oct 2026 ban, and does it stay outside if Flynn also offers cards?

---

## 5. What I did not verify

- Actual per-transaction pricing for either provider — not public.
- Whether either will let a platform take a fee on top of their rate at Flynn's
  volume, which is the commercial crux.
- Settlement timing (T+0 vs T+1) for either.
- Whether Flynn's current entity structure satisfies either provider's KYB.
- Treasury reform commencement dates — flagged as a risk, not pinned down.
