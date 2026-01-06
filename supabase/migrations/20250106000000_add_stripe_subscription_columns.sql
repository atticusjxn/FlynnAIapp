-- Add Stripe subscription management columns to users table
-- Created: January 6, 2026
-- Purpose: Support native Stripe subscription management with 14-day trials

-- Add subscription-related columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT CHECK (subscription_status IN (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid'
)),
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON public.users(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id
  ON public.users(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_users_subscription_status
  ON public.users(subscription_status);

CREATE INDEX IF NOT EXISTS idx_users_trial_end_date
  ON public.users(trial_end_date)
  WHERE trial_end_date IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.users.stripe_customer_id IS 'Stripe customer ID for billing management';
COMMENT ON COLUMN public.users.stripe_subscription_id IS 'Current active Stripe subscription ID';
COMMENT ON COLUMN public.users.subscription_status IS 'Current subscription status from Stripe webhook events';
COMMENT ON COLUMN public.users.trial_end_date IS 'End date of 14-day free trial period';
