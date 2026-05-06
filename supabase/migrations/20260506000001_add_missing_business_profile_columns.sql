-- Add columns referenced by iOS BusinessProfileInput that are missing from business_profiles.
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS ivr_template_id UUID REFERENCES ivr_templates(id),
  ADD COLUMN IF NOT EXISTS ai_greeting_text TEXT,
  ADD COLUMN IF NOT EXISTS ai_followup_questions JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS voice_profile_id UUID,
  ADD COLUMN IF NOT EXISTS sms_booking_template TEXT,
  ADD COLUMN IF NOT EXISTS sms_quote_template TEXT,
  ADD COLUMN IF NOT EXISTS service_areas TEXT[],
  ADD COLUMN IF NOT EXISTS hours_json JSONB;
