-- Update receptionist_mode constraint to support new call handling modes
-- Old modes: 'voicemail_only', 'ai_only', 'hybrid_choice'
-- New modes: 'sms_links', 'ai_receptionist', 'voicemail_only'

-- Drop the old constraint
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS receptionist_mode_valid;

-- Add new constraint with updated modes
ALTER TABLE public.users
ADD CONSTRAINT receptionist_mode_valid
CHECK (receptionist_mode IN ('sms_links', 'ai_receptionist', 'voicemail_only', 'ai_only', 'hybrid_choice'));

-- Migrate existing data from old modes to new modes
UPDATE public.users
SET receptionist_mode = CASE
  WHEN receptionist_mode = 'ai_only' THEN 'ai_receptionist'
  WHEN receptionist_mode = 'hybrid_choice' THEN 'sms_links'
  WHEN receptionist_mode = 'voicemail_only' THEN 'voicemail_only'
  ELSE 'sms_links'  -- default to sms_links for any other values
END
WHERE receptionist_mode IS NOT NULL;

-- Set default to 'sms_links' for new users
ALTER TABLE public.users
ALTER COLUMN receptionist_mode SET DEFAULT 'sms_links';

-- Ensure null modes fall back to sms_links
UPDATE public.users
SET receptionist_mode = 'sms_links'
WHERE receptionist_mode IS NULL;
