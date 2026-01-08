-- COPY AND PASTE THIS INTO SUPABASE SQL EDITOR
-- URL: https://supabase.com/dashboard/project/zvfeafmmtfplzpnocyjw/sql/new
-- Click "Run" after pasting

-- Add setup progress tracking fields to users table
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

-- Verify columns were created
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('has_completed_onboarding', 'has_seen_demo', 'has_started_trial', 'has_provisioned_phone', 'demo_greeting_customized')
ORDER BY column_name;
