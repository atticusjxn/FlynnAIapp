-- =============================================================================
-- Flynn Demo Account Seed — "Mate's Plumbing Co."
-- =============================================================================
-- Reconstructs the demo account end-to-end for the QA walkthrough. Safe to
-- re-run — all upserts/deletes are idempotent. The canonical demo identity is:
--   auth user id   : 45c45982-4e77-40ff-86d8-31375df31645   (demo@flynnai.app)
--   default org id : 44394955-4a05-41aa-ae28-0d6639c859a7
--
-- Schema note: business_profiles is PK'd on user_id, NOT org_id. The original
-- UX_AUDIT_FINDINGS.md implied the opposite — that was based on a stale
-- migration file that never shipped. The deployed schema is user_id-keyed.
-- =============================================================================

DO $$
DECLARE
  v_uid  uuid := '45c45982-4e77-40ff-86d8-31375df31645'::uuid;
  v_org  uuid := '44394955-4a05-41aa-ae28-0d6639c859a7'::uuid;
  v_name text := 'Mate''s Plumbing Co.';
BEGIN

-- ---------------------------------------------------------------------------
-- orgs — pin the canonical demo org id.
-- ---------------------------------------------------------------------------
INSERT INTO public.orgs (id, name, created_at, updated_at)
VALUES (v_org, v_name, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- org_members — ensure the demo user owns the canonical org.
-- ---------------------------------------------------------------------------
INSERT INTO public.org_members (org_id, user_id, role, status, created_at)
VALUES (v_org, v_uid, 'owner', 'active', NOW())
ON CONFLICT (org_id, user_id) DO UPDATE SET
  role   = 'owner',
  status = 'active';

-- ---------------------------------------------------------------------------
-- users — flip onboarding back to in-progress + ensure tenancy/call-mode set.
-- Leaves onboarding_completed = false so the QA flow walks every step.
-- ---------------------------------------------------------------------------
UPDATE public.users
SET default_org_id        = v_org,
    onboarding_completed  = false,
    has_provisioned_phone = true,        -- Step 6 shows "Already connected"
    call_handling_mode    = 'sms_links',
    forwarding_verified   = false,
    updated_at            = NOW()
WHERE id = v_uid;

-- ---------------------------------------------------------------------------
-- subscriptions — a trialing Growth subscription so the dashboard shows
-- "Trial · N days left" instead of the "Start 14-day free trial" upsell.
-- ---------------------------------------------------------------------------
DELETE FROM public.subscriptions WHERE user_id = v_uid;
INSERT INTO public.subscriptions (
  user_id, plan_id, status, trial_end_at, current_period_start, current_period_end
)
SELECT v_uid, p.id, 'trialing',
       NOW() + INTERVAL '14 days', NOW(), NOW() + INTERVAL '14 days'
FROM public.plans p
WHERE p.slug = 'growth'
LIMIT 1;

-- ---------------------------------------------------------------------------
-- business_profiles — Mate's Plumbing. PK is user_id.
-- ---------------------------------------------------------------------------
INSERT INTO public.business_profiles (
  user_id, org_id, business_name, industry, website_url,
  services, hours_json, service_areas, faqs,
  pricing_notes, ai_instructions, ai_greeting_text, ivr_custom_script,
  ai_followup_questions, booking_link_enabled, quote_link_enabled,
  created_at, updated_at
) VALUES (
  v_uid, v_org, v_name, 'plumbing', 'https://matesplumbing.com.au',
  '[
    {"name":"Hot Water Repairs","description":"Gas and electric systems, same-day where possible","price_range":"$150–$400"},
    {"name":"Blocked Drains","description":"CCTV inspection + high-pressure jetting","price_range":"$110–$280"},
    {"name":"Bathroom Renovations","description":"Full reno or partial — supply and install","price_range":"$3,000–$9,000"},
    {"name":"Emergency Call-Outs","description":"Available 24/7, 365 days","price_range":"$195 after-hours call-out"},
    {"name":"Leak Detection & Repair","description":"All pipe types, non-invasive detection","price_range":"$130–$350"},
    {"name":"Gas Fitting","description":"Licensed gas fitter — appliance install, reticulation","price_range":"$120–$450"}
  ]'::jsonb,
  '{
    "mon": {"open":"07:00","close":"17:00"},
    "tue": {"open":"07:00","close":"17:00"},
    "wed": {"open":"07:00","close":"17:00"},
    "thu": {"open":"07:00","close":"17:00"},
    "fri": {"open":"07:00","close":"16:00"},
    "sat": {"open":"08:00","close":"13:00"}
  }'::jsonb,
  '["Inner Sydney","Eastern Suburbs","Inner West","Lower North Shore"]'::jsonb,
  '[
    {"q":"Do you charge a call-out fee?","a":"Yes — $110 standard, $195 after-hours. Waived if you proceed with the work."},
    {"q":"Are you licensed and insured?","a":"Yes, fully licensed plumber and gas fitter (NSW licence #PL12345), with full public liability insurance."},
    {"q":"Do you service my area?","a":"We cover inner Sydney, eastern suburbs, and inner west. Text your suburb and we''ll confirm."},
    {"q":"How quickly can you get here?","a":"Same-day for most jobs. Within 2 hours for genuine emergencies during business hours."},
    {"q":"Do you offer free quotes?","a":"Free quotes for jobs over $500. Smaller jobs have a $55 assessment fee, credited toward the work if you proceed."}
  ]'::jsonb,
  'Call-out $110 (standard), $195 (after-hours, waived if work proceeds). All prices include GST. Firm price given before starting work.',
  'Friendly but professional — think helpful tradie, not call centre. Use "G''day" in the opening. '
  'Mention we are fully licensed and insured if the caller asks about credentials. '
  'For genuine emergencies (burst pipe, flooding, gas smell, no hot water with baby/elderly) skip the normal '
  'booking flow — get the address first, then a callback number, and flag as emergency. '
  'Call-out fee is $110 standard and waived if work proceeds — state this calmly if asked; do not over-explain.',
  'G''day, thanks for calling Mate''s Plumbing. I''m probably on the tools right now, '
  'but I can take a message and get back to you. What can I help you with?',
  'G''day, thanks for calling Mate''s Plumbing. I''m on a job right now so I can''t get to the phone. '
  'Press 1 and I''ll text you a booking link, press 2 for a free quote form, '
  'or press 0 for an emergency and I''ll call you straight back. Cheers!',
  '["What type of plumbing issue do you have?","What suburb are you in?","When would suit you — weekday or weekend, morning or afternoon?","What name should I put the booking under?","What''s the best callback number?"]'::jsonb,
  true, true,
  NOW(), NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
  org_id                 = EXCLUDED.org_id,
  business_name          = EXCLUDED.business_name,
  industry               = EXCLUDED.industry,
  website_url            = EXCLUDED.website_url,
  services               = EXCLUDED.services,
  hours_json             = EXCLUDED.hours_json,
  service_areas          = EXCLUDED.service_areas,
  faqs                   = EXCLUDED.faqs,
  pricing_notes          = EXCLUDED.pricing_notes,
  ai_instructions        = EXCLUDED.ai_instructions,
  ai_greeting_text       = EXCLUDED.ai_greeting_text,
  ivr_custom_script      = EXCLUDED.ivr_custom_script,
  ai_followup_questions  = EXCLUDED.ai_followup_questions,
  booking_link_enabled   = EXCLUDED.booking_link_enabled,
  quote_link_enabled     = EXCLUDED.quote_link_enabled,
  updated_at             = NOW();

END $$;
