-- Org-attribute the phone-keyed agent tables.
--
-- The agent still OWNS these tables. agent_invoices backs the live hosted
-- /i/<token> invoice page, the quote/invoice chaser crons, and
-- mark_invoice_paid, and its shape is incompatible with public.invoices
-- (integer cents vs decimal dollars, public_token which invoices has no
-- equivalent of, and {description, amount_cents} line items vs
-- {description, quantity, unit_price, total}). A full cutover to
-- public.invoices is a separate, carefully-tested change.
--
-- What this does instead is the prerequisite for ANY unification: give the
-- agent rows an org_id so they're attributable to a business rather than only
-- to a phone number. Nullable, so users who aren't in an org (19 of 107 at
-- time of writing) keep working exactly as before.
--
-- Applied to prod 2026-07-19. Backfill resolved 1 of 5 existing agent_invoices
-- (the rest are phone-only rows with no linked user row to resolve an org from).

alter table public.agent_invoices
  add column if not exists org_id uuid references public.organizations(id) on delete set null;

alter table public.agent_quotes
  add column if not exists org_id uuid references public.organizations(id) on delete set null;

create index if not exists agent_invoices_org_idx on public.agent_invoices(org_id, created_at desc);
create index if not exists agent_quotes_org_idx on public.agent_quotes(org_id, created_at desc);

update public.agent_invoices ai
   set org_id = u.default_org_id
  from public.users u
 where ai.user_id = u.id
   and ai.org_id is null
   and u.default_org_id is not null;

update public.agent_quotes aq
   set org_id = u.default_org_id
  from public.users u
 where aq.user_id = u.id
   and aq.org_id is null
   and u.default_org_id is not null;
