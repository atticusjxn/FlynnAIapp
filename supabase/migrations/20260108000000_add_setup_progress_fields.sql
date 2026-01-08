-- Add setup progress tracking fields to users table
-- These fields track the user's journey through the new onboarding → demo → trial → setup flow

ALTER TABLE users
ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_seen_demo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_started_trial BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_provisioned_phone BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS demo_greeting_customized TEXT;

-- Add helpful comments
COMMENT ON COLUMN users.has_completed_onboarding IS 'True when user completes the simplified 4-step onboarding flow';
COMMENT ON COLUMN users.has_seen_demo IS 'True when user completes the FirstTimeExperienceModal demo';
COMMENT ON COLUMN users.has_started_trial IS 'True when user enters payment info and starts free trial';
COMMENT ON COLUMN users.has_provisioned_phone IS 'True when user completes phone number setup after payment';
COMMENT ON COLUMN users.demo_greeting_customized IS 'The greeting text customized during the demo experience';

-- Create an index for faster queries on setup status
CREATE INDEX IF NOT EXISTS idx_users_setup_progress
ON users(has_completed_onboarding, has_seen_demo, has_started_trial, has_provisioned_phone);
