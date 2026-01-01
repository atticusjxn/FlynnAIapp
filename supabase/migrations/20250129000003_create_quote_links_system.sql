-- Quote Links System Migration
-- Creates tables for quote form templates, business quote forms, submissions, and media

-- ============================================================================
-- Quote Form Templates (Global Library)
-- ============================================================================

CREATE TABLE IF NOT EXISTS quote_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT NOT NULL, -- plumbing, electrical, cleaning, lawn, handyman, painting, removalist, beauty
  description TEXT,
  icon TEXT,
  questions JSONB NOT NULL, -- Array of QuestionConfig objects
  price_guide_template JSONB, -- Suggested price rules
  disclaimer_template TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_form_templates_industry ON quote_form_templates(industry);
CREATE INDEX idx_quote_form_templates_active ON quote_form_templates(is_active) WHERE is_active = true;

-- ============================================================================
-- Business Quote Forms (Per Business)
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_quote_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL, -- URL slug like booking pages (e.g., 'joes-plumbing-quote')
  template_id UUID REFERENCES quote_form_templates(id) ON DELETE SET NULL, -- NULL if custom from scratch

  -- Form Configuration
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL, -- Array of customized QuestionConfig objects
  version INT DEFAULT 1,
  is_published BOOLEAN DEFAULT false,

  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563EB',

  -- Settings
  allow_media_upload BOOLEAN DEFAULT true,
  max_photos INT DEFAULT 10,
  max_videos INT DEFAULT 3,
  require_phone BOOLEAN DEFAULT true,
  require_email BOOLEAN DEFAULT false,

  -- Legal
  disclaimer TEXT,
  terms_url TEXT,
  privacy_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_business_quote_forms_org_id ON business_quote_forms(org_id);
CREATE INDEX idx_business_quote_forms_slug ON business_quote_forms(slug);
CREATE INDEX idx_business_quote_forms_published ON business_quote_forms(is_published) WHERE is_published = true;

-- ============================================================================
-- Quote Submissions (Customer Intake)
-- ============================================================================

CREATE TABLE IF NOT EXISTS quote_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES business_quote_forms(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Customer Info
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT,

  -- Submission Data
  answers JSONB NOT NULL, -- {question_id: answer_value}
  form_version INT NOT NULL,

  -- Estimate (if price guide enabled)
  estimated_price_min DECIMAL(10,2),
  estimated_price_max DECIMAL(10,2),
  estimate_note TEXT,
  estimate_shown_to_customer BOOLEAN DEFAULT false,
  price_guide_rules_applied JSONB, -- Array of applied rules for transparency

  -- Status Pipeline
  status TEXT DEFAULT 'new', -- new, reviewing, quoted, won, lost, archived

  -- Relationships
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL, -- Auto-created job card
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL, -- Sent quote
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL, -- Matched/created client

  -- Source Tracking
  source TEXT DEFAULT 'web', -- web, sms, call, direct
  call_sid TEXT, -- If from call flow
  referrer TEXT,

  -- Session Metadata
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  quoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_submissions_org_id ON quote_submissions(org_id);
CREATE INDEX idx_quote_submissions_form_id ON quote_submissions(form_id);
CREATE INDEX idx_quote_submissions_status ON quote_submissions(status);
CREATE INDEX idx_quote_submissions_submitted_at ON quote_submissions(submitted_at DESC);
CREATE INDEX idx_quote_submissions_job_id ON quote_submissions(job_id) WHERE job_id IS NOT NULL;

-- ============================================================================
-- Quote Submission Media (Photos & Videos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS quote_submission_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES quote_submissions(id) ON DELETE CASCADE,

  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  file_url TEXT NOT NULL, -- Supabase Storage URL (private bucket)
  thumbnail_url TEXT, -- For videos and photo previews

  -- File Metadata
  original_filename TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  width INT,
  height INT,
  duration_seconds INT, -- For videos

  -- Upload Tracking
  upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')),
  upload_progress INT DEFAULT 0 CHECK (upload_progress >= 0 AND upload_progress <= 100),
  upload_error TEXT,

  -- Security Scanning
  scan_status TEXT DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'infected', 'error', 'skipped')),
  scanned_at TIMESTAMPTZ,
  scan_result JSONB,

  -- Display Order
  sort_order INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_submission_media_submission_id ON quote_submission_media(submission_id);
CREATE INDEX idx_quote_submission_media_type ON quote_submission_media(media_type);
CREATE INDEX idx_quote_submission_media_scan_status ON quote_submission_media(scan_status);

-- ============================================================================
-- Price Guides (Rules Engine)
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES business_quote_forms(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Display Settings
  estimate_mode TEXT DEFAULT 'internal' CHECK (estimate_mode IN ('internal', 'range', 'starting_from', 'disabled')),
  show_to_customer BOOLEAN DEFAULT false,

  -- Base Pricing
  base_price DECIMAL(10,2),
  base_callout_fee DECIMAL(10,2),
  currency TEXT DEFAULT 'AUD',

  -- Rules (JSON array of PriceRule objects)
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Constraints
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),

  -- Disclaimer & Notes
  disclaimer TEXT DEFAULT 'This is an estimate only. Final price may vary after inspection.',
  internal_notes TEXT,

  -- Versioning
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_guides_form_id ON price_guides(form_id);
CREATE INDEX idx_price_guides_org_id ON price_guides(org_id);
CREATE INDEX idx_price_guides_active ON price_guides(is_active) WHERE is_active = true;

-- ============================================================================
-- Quote Link Analytics Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS quote_link_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES business_quote_forms(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES quote_submissions(id) ON DELETE SET NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event Type
  event_type TEXT NOT NULL, -- link_opened, form_started, question_answered, media_upload_started, media_uploaded, form_submitted, estimate_viewed
  event_data JSONB, -- Additional context (e.g., question_id, answer, file_size)

  -- Session Tracking
  session_id UUID, -- Group events from same user session

  -- Context
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_link_events_form_id ON quote_link_events(form_id);
CREATE INDEX idx_quote_link_events_submission_id ON quote_link_events(submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX idx_quote_link_events_type_created ON quote_link_events(event_type, created_at DESC);
CREATE INDEX idx_quote_link_events_session_id ON quote_link_events(session_id) WHERE session_id IS NOT NULL;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Quote Form Templates (Public Read, Admin Write)
ALTER TABLE quote_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quote form templates are viewable by everyone"
  ON quote_form_templates FOR SELECT
  USING (is_active = true);

-- Business Quote Forms (Org-scoped)
ALTER TABLE business_quote_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's quote forms"
  ON business_quote_forms FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create quote forms for their org"
  ON business_quote_forms FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their org's quote forms"
  ON business_quote_forms FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their org's quote forms"
  ON business_quote_forms FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Public access for published forms (by slug)
CREATE POLICY "Published quote forms are publicly viewable by slug"
  ON business_quote_forms FOR SELECT
  USING (is_published = true);

-- Quote Submissions (Org-scoped for viewing, public for creating)
ALTER TABLE quote_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's quote submissions"
  ON quote_submissions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create quote submissions"
  ON quote_submissions FOR INSERT
  WITH CHECK (true); -- Public submission creation

CREATE POLICY "Users can update their org's quote submissions"
  ON quote_submissions FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Quote Submission Media (Org-scoped)
ALTER TABLE quote_submission_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's submission media"
  ON quote_submission_media FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM quote_submissions WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can upload media to submissions"
  ON quote_submission_media FOR INSERT
  WITH CHECK (true); -- Public upload during submission

CREATE POLICY "Users can update their org's submission media"
  ON quote_submission_media FOR UPDATE
  USING (
    submission_id IN (
      SELECT id FROM quote_submissions WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

-- Price Guides (Org-scoped)
ALTER TABLE price_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's price guides"
  ON price_guides FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create price guides for their org"
  ON price_guides FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their org's price guides"
  ON price_guides FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Quote Link Events (Org-scoped for viewing, public for creating)
ALTER TABLE quote_link_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's quote link events"
  ON quote_link_events FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create quote link events"
  ON quote_link_events FOR INSERT
  WITH CHECK (true); -- Public event logging

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Generate unique quote form slug
CREATE OR REPLACE FUNCTION generate_quote_form_slug(business_name TEXT, org_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  -- Create base slug from business name
  base_slug := lower(regexp_replace(business_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  base_slug := base_slug || '-quote';

  final_slug := base_slug;

  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM business_quote_forms WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quote_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_quote_form_templates_updated_at
  BEFORE UPDATE ON quote_form_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_links_updated_at();

CREATE TRIGGER update_business_quote_forms_updated_at
  BEFORE UPDATE ON business_quote_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_links_updated_at();

CREATE TRIGGER update_quote_submissions_updated_at
  BEFORE UPDATE ON quote_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_links_updated_at();

CREATE TRIGGER update_quote_submission_media_updated_at
  BEFORE UPDATE ON quote_submission_media
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_links_updated_at();

CREATE TRIGGER update_price_guides_updated_at
  BEFORE UPDATE ON price_guides
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_links_updated_at();

-- ============================================================================
-- Seed Data: Quote Form Templates
-- ============================================================================

-- 1. Plumbing Template
INSERT INTO quote_form_templates (name, industry, description, icon, questions, price_guide_template, disclaimer_template) VALUES (
  'Plumbing Job Quote',
  'plumbing',
  'Standard quote form for plumbing services',
  'wrench',
  '[
    {
      "id": "q1",
      "type": "single_choice",
      "question": "What type of plumbing work do you need?",
      "required": true,
      "order": 1,
      "options": [
        {"id": "o1", "label": "Blocked drain", "value": "blocked_drain"},
        {"id": "o2", "label": "Leaking tap/pipe", "value": "leaking"},
        {"id": "o3", "label": "Hot water system", "value": "hot_water"},
        {"id": "o4", "label": "Toilet repair", "value": "toilet"},
        {"id": "o5", "label": "New installation", "value": "installation"},
        {"id": "o6", "label": "Other", "value": "other"}
      ]
    },
    {
      "id": "q2",
      "type": "yes_no",
      "question": "Is this an emergency (water flowing/major leak)?",
      "required": true,
      "order": 2
    },
    {
      "id": "q3",
      "type": "long_text",
      "question": "Please describe the issue in detail",
      "placeholder": "e.g., Kitchen sink is blocked and water won''t drain...",
      "required": true,
      "order": 3,
      "maxLength": 500
    },
    {
      "id": "q4",
      "type": "address",
      "question": "What is the job location?",
      "placeholder": "Suburb or full address",
      "required": true,
      "order": 4
    }
  ]'::jsonb,
  '[
    {
      "id": "r1",
      "name": "Base callout fee",
      "enabled": true,
      "condition": {"questionId": "q1", "operator": "equals", "value": "blocked_drain"},
      "action": {"type": "add", "value": 150, "note": "Standard callout fee"},
      "order": 1
    },
    {
      "id": "r2",
      "name": "Emergency surcharge",
      "enabled": true,
      "condition": {"questionId": "q2", "operator": "equals", "value": true},
      "action": {"type": "add", "value": 100, "note": "After-hours emergency service"},
      "order": 2
    }
  ]'::jsonb,
  'This is an estimate only based on the information provided. Final price will be confirmed after inspection.'
);

-- 2. Electrical Template
INSERT INTO quote_form_templates (name, industry, description, icon, questions, price_guide_template) VALUES (
  'Electrical Work Quote',
  'electrical',
  'Standard quote form for electrical services',
  'zap',
  '[
    {
      "id": "q1",
      "type": "single_choice",
      "question": "What electrical work do you need?",
      "required": true,
      "order": 1,
      "options": [
        {"id": "o1", "label": "Power point installation", "value": "power_point"},
        {"id": "o2", "label": "Light installation", "value": "lighting"},
        {"id": "o3", "label": "Switchboard upgrade", "value": "switchboard"},
        {"id": "o4", "label": "Fault finding", "value": "fault"},
        {"id": "o5", "label": "Safety inspection", "value": "inspection"},
        {"id": "o6", "label": "Other", "value": "other"}
      ]
    },
    {
      "id": "q2",
      "type": "number",
      "question": "How many points/lights/outlets?",
      "required": false,
      "order": 2,
      "min": 1,
      "max": 50,
      "unit": "units"
    },
    {
      "id": "q3",
      "type": "long_text",
      "question": "Please describe the work required",
      "required": true,
      "order": 3,
      "maxLength": 500
    },
    {
      "id": "q4",
      "type": "address",
      "question": "Job location",
      "required": true,
      "order": 4
    }
  ]'::jsonb,
  '[
    {
      "id": "r1",
      "name": "Per power point",
      "enabled": true,
      "condition": {"questionId": "q1", "operator": "equals", "value": "power_point"},
      "action": {"type": "set_band", "value": {"min": 150, "max": 250}, "note": "Per power point installed"},
      "order": 1
    }
  ]'::jsonb
);

-- 3. Cleaning Template
INSERT INTO quote_form_templates (name, industry, description, icon, questions) VALUES (
  'Cleaning Service Quote',
  'cleaning',
  'Quote form for cleaning services',
  'sparkles',
  '[
    {
      "id": "q1",
      "type": "single_choice",
      "question": "What type of cleaning do you need?",
      "required": true,
      "order": 1,
      "options": [
        {"id": "o1", "label": "Regular house clean", "value": "regular"},
        {"id": "o2", "label": "Deep clean", "value": "deep"},
        {"id": "o3", "label": "End of lease", "value": "end_of_lease"},
        {"id": "o4", "label": "Office cleaning", "value": "office"},
        {"id": "o5", "label": "Carpet cleaning", "value": "carpet"},
        {"id": "o6", "label": "Window cleaning", "value": "windows"}
      ]
    },
    {
      "id": "q2",
      "type": "single_choice",
      "question": "Property size",
      "required": true,
      "order": 2,
      "options": [
        {"id": "o1", "label": "1 bedroom", "value": "1bed"},
        {"id": "o2", "label": "2 bedrooms", "value": "2bed"},
        {"id": "o3", "label": "3 bedrooms", "value": "3bed"},
        {"id": "o4", "label": "4+ bedrooms", "value": "4bed"}
      ]
    },
    {
      "id": "q3",
      "type": "multi_select",
      "question": "Which areas need cleaning? (select all)",
      "required": false,
      "order": 3,
      "options": [
        {"id": "o1", "label": "Kitchen", "value": "kitchen"},
        {"id": "o2", "label": "Bathrooms", "value": "bathrooms"},
        {"id": "o3", "label": "Living areas", "value": "living"},
        {"id": "o4", "label": "Bedrooms", "value": "bedrooms"},
        {"id": "o5", "label": "Windows", "value": "windows"},
        {"id": "o6", "label": "Carpets", "value": "carpets"}
      ]
    },
    {
      "id": "q4",
      "type": "address",
      "question": "Cleaning location",
      "required": true,
      "order": 4
    }
  ]'::jsonb
);

-- 4. Lawn & Garden Template
INSERT INTO quote_form_templates (name, industry, description, icon, questions) VALUES (
  'Lawn & Garden Quote',
  'lawn',
  'Quote form for lawn mowing and gardening',
  'leaf',
  '[
    {
      "id": "q1",
      "type": "multi_select",
      "question": "What services do you need? (select all)",
      "required": true,
      "order": 1,
      "options": [
        {"id": "o1", "label": "Lawn mowing", "value": "mowing"},
        {"id": "o2", "label": "Hedging/trimming", "value": "trimming"},
        {"id": "o3", "label": "Weeding", "value": "weeding"},
        {"id": "o4", "label": "Pruning", "value": "pruning"},
        {"id": "o5", "label": "Rubbish removal", "value": "rubbish"},
        {"id": "o6", "label": "Garden maintenance", "value": "maintenance"}
      ]
    },
    {
      "id": "q2",
      "type": "single_choice",
      "question": "Approximate lawn/garden size",
      "required": true,
      "order": 2,
      "options": [
        {"id": "o1", "label": "Small (< 100 sqm)", "value": "small"},
        {"id": "o2", "label": "Medium (100-300 sqm)", "value": "medium"},
        {"id": "o3", "label": "Large (300-500 sqm)", "value": "large"},
        {"id": "o4", "label": "Extra large (500+ sqm)", "value": "xlarge"}
      ]
    },
    {
      "id": "q3",
      "type": "yes_no",
      "question": "Do you need regular ongoing service?",
      "required": false,
      "order": 3
    },
    {
      "id": "q4",
      "type": "address",
      "question": "Property location",
      "required": true,
      "order": 4
    }
  ]'::jsonb
);

-- 5. Handyman Template
INSERT INTO quote_form_templates (name, industry, description, icon, questions) VALUES (
  'Handyman Service Quote',
  'handyman',
  'General handyman quote form',
  'hammer',
  '[
    {
      "id": "q1",
      "type": "long_text",
      "question": "What jobs need doing?",
      "placeholder": "List all the tasks you need help with...",
      "required": true,
      "order": 1,
      "maxLength": 1000
    },
    {
      "id": "q2",
      "type": "single_choice",
      "question": "How urgent is this work?",
      "required": true,
      "order": 2,
      "options": [
        {"id": "o1", "label": "Emergency - ASAP", "value": "emergency"},
        {"id": "o2", "label": "This week", "value": "this_week"},
        {"id": "o3", "label": "Within 2 weeks", "value": "two_weeks"},
        {"id": "o4", "label": "Flexible timing", "value": "flexible"}
      ]
    },
    {
      "id": "q3",
      "type": "number",
      "question": "Approximately how many hours do you think this will take?",
      "required": false,
      "order": 3,
      "min": 1,
      "max": 40,
      "unit": "hours"
    },
    {
      "id": "q4",
      "type": "address",
      "question": "Job location",
      "required": true,
      "order": 4
    }
  ]'::jsonb
);

-- 6. Painting Template
INSERT INTO quote_form_templates (name, industry, description, icon, questions) VALUES (
  'Painting Quote',
  'painting',
  'Quote form for painting services',
  'paintbrush',
  '[
    {
      "id": "q1",
      "type": "single_choice",
      "question": "What type of painting?",
      "required": true,
      "order": 1,
      "options": [
        {"id": "o1", "label": "Interior walls", "value": "interior_walls"},
        {"id": "o2", "label": "Exterior walls", "value": "exterior_walls"},
        {"id": "o3", "label": "Ceilings", "value": "ceilings"},
        {"id": "o4", "label": "Doors/trim", "value": "doors_trim"},
        {"id": "o5", "label": "Fence", "value": "fence"},
        {"id": "o6", "label": "Full house", "value": "full_house"}
      ]
    },
    {
      "id": "q2",
      "type": "number",
      "question": "How many rooms/areas?",
      "required": false,
      "order": 2,
      "min": 1,
      "max": 20,
      "unit": "rooms"
    },
    {
      "id": "q3",
      "type": "yes_no",
      "question": "Do you need us to supply paint?",
      "required": true,
      "order": 3
    },
    {
      "id": "q4",
      "type": "long_text",
      "question": "Any other details?",
      "placeholder": "Colors, prep work needed, timeline, etc.",
      "required": false,
      "order": 4,
      "maxLength": 500
    },
    {
      "id": "q5",
      "type": "address",
      "question": "Property location",
      "required": true,
      "order": 5
    }
  ]'::jsonb
);

-- 7. Removalist Template
INSERT INTO quote_form_templates (name, industry, description, icon, questions) VALUES (
  'Removalist Quote',
  'removalist',
  'Quote form for moving/removal services',
  'truck',
  '[
    {
      "id": "q1",
      "type": "single_choice",
      "question": "What are you moving?",
      "required": true,
      "order": 1,
      "options": [
        {"id": "o1", "label": "1 bedroom unit", "value": "1bed"},
        {"id": "o2", "label": "2 bedroom house/unit", "value": "2bed"},
        {"id": "o3", "label": "3 bedroom house", "value": "3bed"},
        {"id": "o4", "label": "4+ bedroom house", "value": "4bed"},
        {"id": "o5", "label": "Office", "value": "office"},
        {"id": "o6", "label": "Just a few items", "value": "few_items"}
      ]
    },
    {
      "id": "q2",
      "type": "short_text",
      "question": "Moving from (suburb/address)",
      "required": true,
      "order": 2,
      "placeholder": "e.g., Bondi, NSW"
    },
    {
      "id": "q3",
      "type": "short_text",
      "question": "Moving to (suburb/address)",
      "required": true,
      "order": 3,
      "placeholder": "e.g., Manly, NSW"
    },
    {
      "id": "q4",
      "type": "multi_select",
      "question": "Additional services needed?",
      "required": false,
      "order": 4,
      "options": [
        {"id": "o1", "label": "Packing", "value": "packing"},
        {"id": "o2", "label": "Unpacking", "value": "unpacking"},
        {"id": "o3", "label": "Boxes/supplies", "value": "boxes"},
        {"id": "o4", "label": "Storage", "value": "storage"},
        {"id": "o5", "label": "Piano/pool table", "value": "specialty"}
      ]
    },
    {
      "id": "q5",
      "type": "date_time",
      "question": "Preferred moving date",
      "required": false,
      "order": 5
    }
  ]'::jsonb
);

-- 8. Beauty/Salon Template
INSERT INTO quote_form_templates (name, industry, description, icon, questions) VALUES (
  'Beauty Service Quote',
  'beauty',
  'Quote form for beauty and salon services',
  'star',
  '[
    {
      "id": "q1",
      "type": "multi_select",
      "question": "Which services are you interested in?",
      "required": true,
      "order": 1,
      "options": [
        {"id": "o1", "label": "Hair cut/style", "value": "hair"},
        {"id": "o2", "label": "Hair color", "value": "color"},
        {"id": "o3", "label": "Nails", "value": "nails"},
        {"id": "o4", "label": "Facial", "value": "facial"},
        {"id": "o5", "label": "Massage", "value": "massage"},
        {"id": "o6", "label": "Makeup", "value": "makeup"}
      ]
    },
    {
      "id": "q2",
      "type": "yes_no",
      "question": "Is this for a special event?",
      "required": false,
      "order": 2
    },
    {
      "id": "q3",
      "type": "long_text",
      "question": "Tell us more about what you''re looking for",
      "placeholder": "Describe your desired style, any specific requirements, etc.",
      "required": false,
      "order": 3,
      "maxLength": 500
    },
    {
      "id": "q4",
      "type": "date_time",
      "question": "Preferred appointment date/time",
      "required": false,
      "order": 4
    }
  ]'::jsonb
);

-- ============================================================================
-- Update business_profiles to reference quote forms
-- ============================================================================

-- Add quote_form_id column to business_profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_profiles' AND column_name = 'quote_form_id'
  ) THEN
    ALTER TABLE business_profiles
    ADD COLUMN quote_form_id UUID REFERENCES business_quote_forms(id) ON DELETE SET NULL;

    CREATE INDEX idx_business_profiles_quote_form_id ON business_profiles(quote_form_id);
  END IF;
END $$;

COMMENT ON TABLE quote_form_templates IS 'Global library of quote form templates by industry';
COMMENT ON TABLE business_quote_forms IS 'Customized quote forms per business with unique slugs';
COMMENT ON TABLE quote_submissions IS 'Customer-submitted quote requests via public forms';
COMMENT ON TABLE quote_submission_media IS 'Photos and videos uploaded with quote submissions';
COMMENT ON TABLE price_guides IS 'Rules-based pricing estimation engine per quote form';
COMMENT ON TABLE quote_link_events IS 'Analytics tracking for quote link interactions';
