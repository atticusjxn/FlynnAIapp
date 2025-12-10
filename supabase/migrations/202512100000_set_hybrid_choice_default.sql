-- Update default receptionist mode to hybrid_choice
-- This allows callers to choose between leaving a message or booking with AI

-- Change the default for the column
alter table public.users
  alter column receptionist_mode set default 'hybrid_choice';

-- Update existing users who are on voicemail_only to hybrid_choice
-- (only if they haven't explicitly configured their receptionist)
update public.users
  set receptionist_mode = 'hybrid_choice'
where receptionist_mode = 'voicemail_only'
  and (receptionist_configured is null or receptionist_configured = false);

-- Note: Users who have explicitly configured their receptionist (receptionist_configured = true)
-- will keep their current mode setting
