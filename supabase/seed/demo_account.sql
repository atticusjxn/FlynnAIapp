-- =============================================================================
-- Flynn Demo Account Seed — "Mate's Plumbing Co."
-- =============================================================================
-- Provisioning steps:
--   1. Create the auth user via Admin API (run once, copy returned UUID):
--      curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
--        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
--        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
--        -H "Content-Type: application/json" \
--        -d '{"email":"demo@flynnai.app","password":"FlynnDemo2026!","email_confirm":true}'
--   2. Copy the returned id → replace <DEMO_UID> below
--   3. psql $DATABASE_URL < supabase/seed/demo_account.sql
--
-- For Supabase MCP:  replace <DEMO_UID> and run via execute_sql.
-- =============================================================================

DO $$
DECLARE
  v_uid  uuid := '<DEMO_UID>'::uuid;
  v_name text := 'Mate''s Plumbing Co.';
BEGIN

-- ---------------------------------------------------------------------------
-- business_profiles
-- ---------------------------------------------------------------------------
INSERT INTO public.business_profiles (
  user_id,
  business_name,
  industry,
  website_url,
  services,
  hours_json,
  service_areas,
  faqs,
  pricing_notes,
  ai_instructions,
  ai_greeting_text,
  ivr_custom_script,
  ai_followup_questions,
  booking_link_enabled,
  quote_link_enabled,
  created_at,
  updated_at
)
VALUES (
  v_uid,
  v_name,
  'plumbing',
  'https://matesplumbing.com.au',

  -- services
  '[
    {"name":"Hot Water Repairs","description":"Gas and electric systems, same-day where possible","price_range":"$150–$400"},
    {"name":"Blocked Drains","description":"CCTV inspection + high-pressure jetting","price_range":"$110–$280"},
    {"name":"Bathroom Renovations","description":"Full reno or partial — supply and install","price_range":"$3,000–$9,000"},
    {"name":"Emergency Call-Outs","description":"Available 24/7, 365 days","price_range":"$195 after-hours call-out"},
    {"name":"Leak Detection & Repair","description":"All pipe types, non-invasive detection","price_range":"$130–$350"},
    {"name":"Gas Fitting","description":"Licensed gas fitter — appliance install, reticulation","price_range":"$120–$450"}
  ]'::jsonb,

  -- hours_json
  '{
    "monday":    {"open":"07:00","close":"17:00"},
    "tuesday":   {"open":"07:00","close":"17:00"},
    "wednesday": {"open":"07:00","close":"17:00"},
    "thursday":  {"open":"07:00","close":"17:00"},
    "friday":    {"open":"07:00","close":"16:00"},
    "saturday":  {"open":"08:00","close":"13:00"},
    "sunday":    {"closed":true}
  }'::jsonb,

  -- service_areas
  '["Inner Sydney","Eastern Suburbs","Inner West","Lower North Shore"]'::jsonb,

  -- faqs
  '[
    {"question":"Do you charge a call-out fee?","answer":"Yes — $110 standard, $195 after-hours. The call-out fee is waived if you proceed with the work."},
    {"question":"Are you licensed and insured?","answer":"Yes, fully licensed plumber and gas fitter (NSW licence #PL12345), with full public liability insurance."},
    {"question":"Do you service my area?","answer":"We cover inner Sydney, eastern suburbs, and inner west. Text your suburb and we''ll confirm."},
    {"question":"How quickly can you get here?","answer":"Same-day for most jobs. Within 2 hours for genuine emergencies during business hours."},
    {"question":"Do you offer free quotes?","answer":"Free quotes for jobs over $500. For smaller jobs we charge a $55 assessment fee, which is credited toward the work if you proceed."}
  ]'::jsonb,

  -- pricing_notes
  'Call-out $110 (standard), $195 (after-hours, waived if work proceeds). All prices include GST. Firm price given before starting work.',

  -- ai_instructions
  'Friendly but professional — think helpful tradie, not call centre. Use "G''day" in the opening. '
  'Mention we are fully licensed and insured if the caller asks about credentials. '
  'For genuine emergencies (burst pipe, flooding, gas smell, no hot water with baby/elderly) skip the normal '
  'booking flow — get the address first, then a callback number, and flag as emergency. '
  'Call-out fee is $110 standard and waived if work proceeds — state this calmly if asked; do not over-explain.',

  -- ai_greeting_text
  'G''day, thanks for calling Mate''s Plumbing. I''m probably on the tools right now, '
  'but I can take a message and get back to you. What can I help you with?',

  -- ivr_custom_script
  'G''day, thanks for calling Mate''s Plumbing. I''m on a job right now so I can''t get to the phone. '
  'Press 1 and I''ll text you a booking link, press 2 for a free quote form, '
  'or press 0 for an emergency and I''ll call you straight back. Cheers!',

  -- ai_followup_questions
  '["What type of plumbing issue do you have?","What suburb are you in?","When would suit you — weekday or weekend, morning or afternoon?","What name should I put the booking under?","What''s the best callback number?"]'::jsonb,

  true,   -- booking_link_enabled
  true,   -- quote_link_enabled
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
  business_name          = EXCLUDED.business_name,
  industry               = EXCLUDED.industry,
  services               = EXCLUDED.services,
  hours_json             = EXCLUDED.hours_json,
  service_areas          = EXCLUDED.service_areas,
  faqs                   = EXCLUDED.faqs,
  pricing_notes          = EXCLUDED.pricing_notes,
  ai_instructions        = EXCLUDED.ai_instructions,
  ai_greeting_text       = EXCLUDED.ai_greeting_text,
  ivr_custom_script      = EXCLUDED.ivr_custom_script,
  ai_followup_questions  = EXCLUDED.ai_followup_questions,
  updated_at             = NOW();

END $$;
