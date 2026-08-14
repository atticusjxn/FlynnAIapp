-- Attribution for the number-seeding metric.
--
-- Inbound client SMS can only ever reach Flynn on a number the client already
-- has in their phone: AU carriers have no SMS equivalent of the **61* voice
-- divert, and Twilio Hosted SMS (voice stays with the carrier, SMS routes to
-- Twilio) is US/Canada only. So an org's number has to be seeded outbound, one
-- conversation at a time, and we need to see whether that is actually working.
--
-- `sms_messages` recorded only (user_phone, direction, body) — no record of
-- WHICH Flynn number a message arrived on or went out from, so seeding was
-- unmeasurable.
alter table public.sms_messages
  add column if not exists to_number   text,   -- inbound: number it arrived on; outbound: number it was sent from
  add column if not exists org_id      uuid references public.organizations(id) on delete set null,
  add column if not exists sender_role text;

-- 'boss'   = the operator texting Flynn (shared platform number)
-- 'client' = the org's own customer texting the org's Flynn number  <- the metric
-- 'unknown'= sender could not be attributed
alter table public.sms_messages
  drop constraint if exists sms_messages_sender_role_check;
alter table public.sms_messages
  add constraint sms_messages_sender_role_check
  check (sender_role is null or sender_role in ('boss', 'client', 'unknown'));

create index if not exists sms_messages_org_created_idx
  on public.sms_messages (org_id, created_at desc);
create index if not exists sms_messages_to_number_idx
  on public.sms_messages (to_number)
  where to_number is not null;
-- The seeding query filters on client traffic specifically.
create index if not exists sms_messages_client_seeding_idx
  on public.sms_messages (org_id, sender_role, created_at)
  where sender_role = 'client';
