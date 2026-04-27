-- Add Google Play Billing columns to subscriptions + plans.
--
-- Run after merging the Android Play Billing work. The new server endpoints
-- (/webhooks/playbilling/verify and /rtdn) upsert into these columns; the
-- subscriptionService.upsertFromGoogleSubscription helper keys on
-- google_purchase_token.

-- subscriptions: store Play purchase token + product id, plus the linked
-- token reference for upgrades/downgrades (Play sets linkedPurchaseToken on
-- the new purchase).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS google_purchase_token text,
  ADD COLUMN IF NOT EXISTS google_product_id text,
  ADD COLUMN IF NOT EXISTS google_linked_purchase_token text;

-- Unique constraint enables the ON CONFLICT upsert path. Using a partial
-- unique index so existing Apple-only rows (where the column is NULL)
-- don't all collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_google_purchase_token_key
  ON public.subscriptions (google_purchase_token)
  WHERE google_purchase_token IS NOT NULL;

-- plans: map a Play product id to a plan row. Mirrors apple_product_id.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS google_product_id text;

-- Populate Play product ids matching iOS canonical IDs. Match by the existing
-- apple_product_id so this is robust to slug/internal-id drift.
UPDATE public.plans SET google_product_id = 'com.flynnai.starter.monthly'
  WHERE apple_product_id = 'com.flynnai.starter.monthly';
UPDATE public.plans SET google_product_id = 'com.flynnai.growth.monthly'
  WHERE apple_product_id = 'com.flynnai.growth.monthly';
UPDATE public.plans SET google_product_id = 'com.flynnai.pro.monthly'
  WHERE apple_product_id = 'com.flynnai.pro.monthly';

-- Reconcile minute quotas to iOS canonical values. The Swift .storekit file
-- is the source of truth; update plans rows to match.
-- (No-op if your column is named differently — adjust ai_minutes_monthly to
-- whatever the live column is.)
UPDATE public.plans SET ai_minutes_monthly = 60
  WHERE apple_product_id = 'com.flynnai.starter.monthly';
UPDATE public.plans SET ai_minutes_monthly = 250
  WHERE apple_product_id = 'com.flynnai.growth.monthly';
UPDATE public.plans SET ai_minutes_monthly = 700
  WHERE apple_product_id = 'com.flynnai.pro.monthly';
