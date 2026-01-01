-- Migration: Create IVR templates table and seed with preset templates
-- Templates provide customizable greeting scripts for Mode A (SMS Link Follow-Up)

-- 1. Create ivr_templates table
CREATE TABLE IF NOT EXISTS ivr_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry_type TEXT, -- e.g., 'trades', 'events', 'beauty', 'general'
    tone TEXT, -- e.g., 'professional', 'casual', 'friendly'
    script_template TEXT NOT NULL, -- Template with placeholders like {business_name}, {booking_option}, {quote_option}
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for faster industry/tone lookups
CREATE INDEX IF NOT EXISTS idx_ivr_templates_industry ON ivr_templates(industry_type);
CREATE INDEX IF NOT EXISTS idx_ivr_templates_tone ON ivr_templates(tone);

-- 3. Seed preset IVR templates

-- Template 1: Professional & General
INSERT INTO ivr_templates (name, industry_type, tone, script_template, description)
VALUES (
    'Professional - General Business',
    'general',
    'professional',
    'Thank you for calling {business_name}. We''re unable to take your call right now. {booking_option}{quote_option}{voicemail_option}',
    'Professional tone suitable for most businesses'
) ON CONFLICT DO NOTHING;

-- Template 2: Friendly & Casual
INSERT INTO ivr_templates (name, industry_type, tone, script_template, description)
VALUES (
    'Friendly - Casual Business',
    'general',
    'friendly',
    'Hey there! Thanks for calling {business_name}. We''re busy helping another customer. {booking_option}{quote_option}{voicemail_option}',
    'Warm, approachable tone for casual businesses'
) ON CONFLICT DO NOTHING;

-- Template 3: Trades & Repairs
INSERT INTO ivr_templates (name, industry_type, tone, script_template, description)
VALUES (
    'Trades & Repairs Specialist',
    'trades',
    'professional',
    'You''ve reached {business_name}. We''re currently on a job site. {booking_option}{quote_option}{voicemail_option}',
    'Optimized for electricians, plumbers, HVAC, handymen'
) ON CONFLICT DO NOTHING;

-- Template 4: Beauty & Wellness
INSERT INTO ivr_templates (name, industry_type, tone, script_template, description)
VALUES (
    'Beauty & Wellness',
    'beauty',
    'friendly',
    'Hi! You''ve called {business_name}. We''re with a client at the moment. {booking_option}{quote_option}{voicemail_option}',
    'Perfect for salons, spas, wellness practitioners'
) ON CONFLICT DO NOTHING;

-- Template 5: Events & Venues
INSERT INTO ivr_templates (name, industry_type, tone, script_template, description)
VALUES (
    'Events & Venues',
    'events',
    'professional',
    'Thank you for calling {business_name}. Our event coordinators are assisting other clients. {booking_option}{quote_option}{voicemail_option}',
    'For event planners, venues, catering'
) ON CONFLICT DO NOTHING;

-- Template 6: Home Services
INSERT INTO ivr_templates (name, industry_type, tone, script_template, description)
VALUES (
    'Home Services - Detailed',
    'home_services',
    'professional',
    'You''ve reached {business_name}, your local home service experts. We''re currently helping another customer. {booking_option}{quote_option}{voicemail_option}',
    'For cleaning, lawn care, pest control, moving services'
) ON CONFLICT DO NOTHING;

-- Template 7: Urgent/Emergency Services
INSERT INTO ivr_templates (name, industry_type, tone, script_template, description)
VALUES (
    'Urgent Services - Fast Response',
    'emergency',
    'professional',
    '{business_name} here. All our technicians are currently engaged. {booking_option}{quote_option}For emergencies, press 3 to leave an urgent message.',
    'For 24/7 services, emergency repairs, urgent care'
) ON CONFLICT DO NOTHING;

-- Template 8: Creative & Design
INSERT INTO ivr_templates (name, industry_type, tone, script_template, description)
VALUES (
    'Creative & Design Studio',
    'creative',
    'friendly',
    'Hi! You''ve reached {business_name}. We''re in a creative session right now. {booking_option}{quote_option}{voicemail_option}',
    'For designers, photographers, videographers, artists'
) ON CONFLICT DO NOTHING;

-- 4. Add comments for documentation
COMMENT ON TABLE ivr_templates IS 'Pre-built IVR greeting templates for Mode A (SMS Link Follow-Up)';
COMMENT ON COLUMN ivr_templates.script_template IS 'Template with placeholders: {business_name}, {booking_option}, {quote_option}, {voicemail_option}';
COMMENT ON COLUMN ivr_templates.industry_type IS 'Industry category for auto-suggestion based on website scraping';
COMMENT ON COLUMN ivr_templates.tone IS 'Communication style: professional, friendly, casual';

-- 5. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ivr_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ivr_templates_updated_at_trigger
BEFORE UPDATE ON ivr_templates
FOR EACH ROW
EXECUTE FUNCTION update_ivr_templates_updated_at();
