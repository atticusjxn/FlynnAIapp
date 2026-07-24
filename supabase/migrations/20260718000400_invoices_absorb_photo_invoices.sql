-- Unify the two invoice tables: public.invoices absorbs the agent's photo
-- invoices, and agent_invoices becomes read-only legacy.
--
-- Applied to prod 2026-07-19. Safe to do as one step because both tables were
-- near-empty test data (4 rows in invoices, 5 in agent_invoices) — this was a
-- schema + code problem, not a data migration.
--
-- Before: the agent wrote phone-keyed agent_invoices (integer cents,
-- public_token, {description, amount_cents} line items) while the iOS app read
-- org-keyed public.invoices (decimal dollars, generated invoice_number,
-- {description, quantity, unit_price, total}). They never synced, so an
-- invoice created over text was invisible in the app.

-- Columns invoices lacked that the agent + hosted /i/:token page need.
alter table public.invoices
  add column if not exists public_token text,
  add column if not exists photo_urls jsonb not null default '[]'::jsonb,
  add column if not exists currency text not null default 'AUD',
  add column if not exists user_phone text,
  add column if not exists client_handle text,
  add column if not exists client_email text,
  add column if not exists xero_synced boolean not null default false;

-- Partial unique: existing app-created rows have no token and must not collide.
create unique index if not exists invoices_public_token_unique
  on public.invoices(public_token) where public_token is not null;
create index if not exists invoices_user_phone_idx on public.invoices(user_phone);
create index if not exists invoices_phone_handle_idx on public.invoices(user_phone, client_handle);

-- Relax the NOT NULLs that make an agent-created invoice impossible:
--  invoice_number is generated per-org via generate_invoice_number (needs an org)
--  org_id is NOT NULL, but 19 of 107 users aren't in an org yet and blocking
--  their invoicing would regress a live feature.
alter table public.invoices alter column invoice_number drop not null;
alter table public.invoices alter column org_id drop not null;

-- org_id may now be NULL, so the org policy must explicitly ignore those rows.
-- Org-less agent invoices are only ever served by the token-gated public page
-- or the agent itself, both of which use the service role.
drop policy if exists "Invoices org member access" on public.invoices;
create policy "Invoices org member access"
  on public.invoices
  for all
  using (
    auth.role() = 'service_role'
    or (org_id is not null and public.is_org_member(org_id))
  )
  with check (
    auth.role() = 'service_role'
    or (org_id is not null and public.is_org_member(org_id))
  );

-- Migrate the legacy agent_invoices rows (cents -> decimal, line-item reshape).
insert into public.invoices (
  org_id, user_phone, client_name, client_email, invoice_number, title, line_items,
  subtotal, tax_rate, tax_amount, total, amount_paid, amount_due,
  currency, photo_urls, public_token, status,
  issued_date, due_date, sent_at, viewed_at, paid_at, notes, created_at, updated_at
)
select
  ai.org_id, ai.user_phone, ai.client_name, ai.client_email, null,
  coalesce(ai.client_name, 'Invoice'),
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'description', li->>'description',
      'quantity', 1,
      'unit_price', round(coalesce((li->>'amount_cents')::numeric, 0) / 100.0, 2),
      'total',      round(coalesce((li->>'amount_cents')::numeric, 0) / 100.0, 2)
    ))
    from jsonb_array_elements(case when jsonb_typeof(ai.line_items)='array' then ai.line_items else '[]'::jsonb end) li
  ), '[]'::jsonb),
  round(coalesce(ai.subtotal_cents,0)/100.0, 2),
  case when coalesce(ai.subtotal_cents,0) > 0
       then round(coalesce(ai.tax_cents,0)::numeric * 100 / ai.subtotal_cents, 2) else 0 end,
  round(coalesce(ai.tax_cents,0)/100.0, 2),
  round(coalesce(ai.total_cents,0)/100.0, 2),
  case when ai.status = 'paid' then round(coalesce(ai.total_cents,0)/100.0, 2) else 0 end,
  case when ai.status = 'paid' then 0 else round(coalesce(ai.total_cents,0)/100.0, 2) end,
  coalesce(ai.currency, 'AUD'), coalesce(ai.photo_urls, '[]'::jsonb), ai.public_token,
  case when ai.status = 'paid' then 'paid' else 'sent' end,
  coalesce(ai.sent_at::date, ai.created_at::date, current_date),
  ai.due_date, ai.sent_at, ai.viewed_at, ai.paid_at, ai.message, ai.created_at, ai.updated_at
from public.agent_invoices ai
where ai.public_token is not null
  and not exists (select 1 from public.invoices i where i.public_token = ai.public_token);

update public.invoices i
   set client_handle = lower(trim(i.client_name))
 where i.client_handle is null and i.client_name is not null;
