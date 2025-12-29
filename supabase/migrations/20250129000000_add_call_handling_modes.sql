-- Migration: Add call handling modes and link configuration
-- This replaces the receptionist_mode system with a more flexible call handling system

-- 1. Add new columns to business_profiles for SMS link follow-up mode
ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS booking_link_url TEXT,
ADD COLUMN IF NOT EXISTS quote_link_url TEXT,
ADD COLUMN IF NOT EXISTS booking_link_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS quote_link_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS ivr_greeting_template TEXT,
ADD COLUMN IF NOT EXISTS ivr_custom_script TEXT;

-- 2. Rename receptionist_mode to call_handling_mode in users table (if it exists there)
-- Check if column exists and rename it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'receptionist_mode'
    ) THEN
        ALTER TABLE users RENAME COLUMN receptionist_mode TO call_handling_mode;
    END IF;
END $$;

-- 3. Add call_handling_mode to users if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS call_handling_mode TEXT DEFAULT 'sms_links';

-- 4. Update existing users with receptionist_configured = true to use ai_receptionist mode
UPDATE users
SET call_handling_mode = 'ai_receptionist'
WHERE receptionist_configured = true;

-- 5. Add check constraint for valid call handling modes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_call_handling_mode_check'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_call_handling_mode_check
        CHECK (call_handling_mode IN ('sms_links', 'ai_receptionist', 'voicemail_only'));
    END IF;
END $$;

-- 6. Create index for faster mode lookups
CREATE INDEX IF NOT EXISTS idx_users_call_handling_mode ON users(call_handling_mode);

-- 7. Add comment for documentation
COMMENT ON COLUMN users.call_handling_mode IS 'Call routing mode: sms_links (default - send booking/quote links), ai_receptionist (AI conversation), voicemail_only (basic voicemail)';
COMMENT ON COLUMN business_profiles.booking_link_url IS 'URL for booking page (e.g., flynnbooking.com/business-slug)';
COMMENT ON COLUMN business_profiles.quote_link_url IS 'URL for quote intake form';
COMMENT ON COLUMN business_profiles.booking_link_enabled IS 'Whether to offer booking link in IVR menu';
COMMENT ON COLUMN business_profiles.quote_link_enabled IS 'Whether to offer quote link in IVR menu';
COMMENT ON COLUMN business_profiles.ivr_greeting_template IS 'Selected IVR template ID from ivr_templates table';
COMMENT ON COLUMN business_profiles.ivr_custom_script IS 'Custom IVR script with placeholders like {business_name}';
