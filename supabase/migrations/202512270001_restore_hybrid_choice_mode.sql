-- Restore hybrid_choice receptionist mode
-- This migration re-enables the hybrid_choice mode for users
-- Now using ONLY Deepgram Australian voice throughout (no TwiML voice switching)
-- Callers can choose between leaving a voicemail or speaking with AI

-- Update default to hybrid_choice for better caller experience
alter table public.users
  alter column receptionist_mode set default 'hybrid_choice';

-- Note: hybrid_choice mode now uses Deepgram Voice Agent for both
-- the greeting AND the choice prompt, eliminating the confusing two-voice experience
-- The AI will recognize when callers say "leave a message" and end the call gracefully
