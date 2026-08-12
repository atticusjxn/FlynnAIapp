-- Collapse the 3-tier catalog (starter $29 / growth $79 / pro $179, all with
-- 14-day Apple product ids that never matched a real StoreKit config) into the
-- 2-tier catalog services/pricing.js and FlynnAI.storekit already ship:
--   Flynn Link          $29/mo  com.flynnai.link.monthly
--   Flynn Receptionist  $69/mo  com.flynnai.receptionist.monthly
--
-- `plans` was never seeded by a migration (see 20240101000000_baseline_core_tables.sql
-- — CREATE TABLE only), so a fresh `supabase db reset` boots with an empty
-- catalog and the paywall shows "Plans not available". This seeds the real
-- two rows on top of that baseline and, on prod, reconciles the existing
-- starter/growth rows in place rather than duplicating them.
--
-- `google_product_id` is left null — Android is parked (see CLAUDE.md
-- Non-Goals) and the stale starter/growth Play ids on the old rows referred
-- to products that don't exist for the new tiers either.

INSERT INTO public.plans (name, display_name, apple_product_id, price_monthly_aud, ai_minutes_monthly, includes_voice_clone, is_active)
VALUES
  ('link', 'Flynn Link', 'com.flynnai.link.monthly', 29.00, 0, false, true),
  ('receptionist', 'Flynn Receptionist', 'com.flynnai.receptionist.monthly', 69.00, 250, false, true)
ON CONFLICT (apple_product_id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  price_monthly_aud = EXCLUDED.price_monthly_aud,
  ai_minutes_monthly = EXCLUDED.ai_minutes_monthly,
  includes_voice_clone = EXCLUDED.includes_voice_clone,
  is_active = EXCLUDED.is_active,
  google_product_id = NULL;

-- The old starter/growth rows are reconciled by the upsert above (matched by
-- their existing apple_product_id). The old pro tier has no equivalent in the
-- 2-tier model — retire it rather than delete it, since a historical
-- subscriptions.plan_id row could still reference it.
UPDATE public.plans SET is_active = false
  WHERE apple_product_id = 'com.flynnai.pro.monthly';
