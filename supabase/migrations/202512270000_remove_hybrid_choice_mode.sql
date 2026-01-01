-- Remove hybrid_choice receptionist mode
-- This migration converts all users from hybrid_choice to ai_only (conversational mode)
-- Reasoning: hybrid_choice uses two different voices (TwiML greeting + Deepgram voice agent)
-- which creates a confusing caller experience

-- Convert all hybrid_choice users to ai_only (conversational mode)
update public.users
  set receptionist_mode = 'ai_only'
where receptionist_mode = 'hybrid_choice';

-- Update default to ai_only
alter table public.users
  alter column receptionist_mode set default 'ai_only';

-- Note: This change affects the onboarding flow - users will now only see two options:
-- 1. ai_only: AI handles all missed calls immediately (conversational mode)
-- 2. voicemail_only: Skip AI and go straight to voicemail
