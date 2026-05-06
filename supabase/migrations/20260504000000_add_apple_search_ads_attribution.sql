set local search_path = public;
set local statement_timeout = '60s';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.apple_search_ads_attributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  token_captured_at timestamptz,
  claimed_at timestamptz not null default now(),
  attribution boolean not null default false,
  org_id uuid references public.organizations(id) on delete set null,
  campaign_id text,
  ad_group_id text,
  keyword_id text,
  ad_id text,
  claim_type text,
  conversion_type text,
  country_or_region text,
  click_date timestamptz,
  impression_date timestamptz,
  apple_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'attributed', 'unattributed', 'failed')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists apple_search_ads_attributions_token_hash_key
  on public.apple_search_ads_attributions (token_hash);

create index if not exists apple_search_ads_attributions_user_id_idx
  on public.apple_search_ads_attributions (user_id);
create index if not exists apple_search_ads_attributions_campaign_id_idx
  on public.apple_search_ads_attributions (campaign_id);
create index if not exists apple_search_ads_attributions_ad_group_id_idx
  on public.apple_search_ads_attributions (ad_group_id);
create index if not exists apple_search_ads_attributions_keyword_id_idx
  on public.apple_search_ads_attributions (keyword_id);
create index if not exists apple_search_ads_attributions_created_at_idx
  on public.apple_search_ads_attributions (created_at);

drop trigger if exists touch_apple_search_ads_attributions_updated_at
  on public.apple_search_ads_attributions;
create trigger touch_apple_search_ads_attributions_updated_at
  before update on public.apple_search_ads_attributions
  for each row
  execute function public.touch_updated_at();

alter table public.apple_search_ads_attributions enable row level security;

drop policy if exists "Users can view own ASA attribution" on public.apple_search_ads_attributions;
create policy "Users can view own ASA attribution"
  on public.apple_search_ads_attributions
  for select
  using (user_id = auth.uid());

create table if not exists public.subscription_conversion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  apple_search_ads_attribution_id uuid
    references public.apple_search_ads_attributions(id) on delete set null,
  event_name text not null
    check (event_name in ('trial_started', 'subscription_active')),
  product_id text,
  plan_id uuid references public.plans(id) on delete set null,
  apple_original_transaction_id text not null,
  apple_latest_transaction_id text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists subscription_conversion_events_apple_event_key
  on public.subscription_conversion_events (event_name, apple_original_transaction_id);

create index if not exists subscription_conversion_events_user_id_idx
  on public.subscription_conversion_events (user_id);
create index if not exists subscription_conversion_events_subscription_id_idx
  on public.subscription_conversion_events (subscription_id);
create index if not exists subscription_conversion_events_asa_attribution_id_idx
  on public.subscription_conversion_events (apple_search_ads_attribution_id);
create index if not exists subscription_conversion_events_occurred_at_idx
  on public.subscription_conversion_events (occurred_at);

alter table public.subscription_conversion_events enable row level security;

drop policy if exists "Users can view own subscription conversion events"
  on public.subscription_conversion_events;
create policy "Users can view own subscription conversion events"
  on public.subscription_conversion_events
  for select
  using (user_id = auth.uid());

comment on table public.apple_search_ads_attributions is
  'Apple Search Ads AdServices attribution claims keyed by hashed attribution token.';
comment on table public.subscription_conversion_events is
  'Subscription milestones joined to Apple Search Ads attribution when available.';
