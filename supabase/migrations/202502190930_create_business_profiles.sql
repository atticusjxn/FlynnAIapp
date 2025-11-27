-- Business Profiles Schema
-- Stores business context for AI receptionist to use during calls

-- Business profiles table
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Basic business info
  business_name TEXT,
  business_type TEXT,
  website_url TEXT,
  phone TEXT,
  email TEXT,

  -- Location
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  service_area TEXT, -- Description of service area (e.g., "Greater Sydney area")

  -- Business hours (stored as JSONB for flexibility)
  business_hours JSONB DEFAULT '{
    "monday": {"open": "09:00", "close": "17:00", "closed": false},
    "tuesday": {"open": "09:00", "close": "17:00", "closed": false},
    "wednesday": {"open": "09:00", "close": "17:00", "closed": false},
    "thursday": {"open": "09:00", "close": "17:00", "closed": false},
    "friday": {"open": "09:00", "close": "17:00", "closed": false},
    "saturday": {"open": "09:00", "close": "13:00", "closed": false},
    "sunday": {"open": null, "close": null, "closed": true}
  }',

  -- Services offered
  services JSONB DEFAULT '[]', -- Array of {name, description, price_range, duration}

  -- Pricing information
  pricing_notes TEXT, -- General pricing info (e.g., "Starting at $95/hour")
  payment_methods TEXT[], -- ["Cash", "Credit Card", "Check", "Bank Transfer"]

  -- Policies
  cancellation_policy TEXT,
  payment_terms TEXT, -- e.g., "Payment due upon completion"
  booking_notice TEXT, -- e.g., "24 hours advance notice preferred"

  -- FAQs
  faqs JSONB DEFAULT '[]', -- Array of {question, answer}

  -- Special notes for AI
  ai_instructions TEXT, -- Custom instructions for how AI should handle calls
  greeting_template TEXT, -- Custom greeting template

  -- Website scraping metadata
  website_scraped_at TIMESTAMPTZ,
  website_scrape_data JSONB, -- Raw scraped data
  auto_update_from_website BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one profile per organization
  UNIQUE(org_id)
);

-- Service offerings table (normalized)
CREATE TABLE IF NOT EXISTS business_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., "Plumbing", "Electrical", "HVAC"

  -- Pricing
  price_type TEXT CHECK (price_type IN ('fixed', 'hourly', 'range', 'quote')),
  price_min DECIMAL(10, 2),
  price_max DECIMAL(10, 2),
  price_unit TEXT, -- e.g., "hour", "job", "sqft"

  -- Availability
  available BOOLEAN DEFAULT true,
  typical_duration_minutes INTEGER,

  -- SEO/Marketing
  keywords TEXT[], -- Keywords for matching caller requests

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Business hours exceptions (holidays, special closures)
CREATE TABLE IF NOT EXISTS business_hours_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,

  date DATE NOT NULL,
  reason TEXT, -- e.g., "Christmas", "Company retreat"
  closed BOOLEAN DEFAULT true,

  -- If not closed, custom hours
  open_time TIME,
  close_time TIME,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(profile_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_profiles_org ON business_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_business_services_profile ON business_services(profile_id);
CREATE INDEX IF NOT EXISTS idx_business_services_available ON business_services(available);
CREATE INDEX IF NOT EXISTS idx_business_hours_exceptions_profile ON business_hours_exceptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_business_hours_exceptions_date ON business_hours_exceptions(date);

-- RLS Policies
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours_exceptions ENABLE ROW LEVEL SECURITY;

-- Business profiles: Users can only access their own org's profile
CREATE POLICY "Users can view own org profile" ON business_profiles
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can manage own org profile" ON business_profiles
  FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Business services: Access through profile
CREATE POLICY "Users can view own org services" ON business_services
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM business_profiles WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage own org services" ON business_services
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM business_profiles WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Business hours exceptions: Access through profile
CREATE POLICY "Users can view own org hours exceptions" ON business_hours_exceptions
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM business_profiles WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage own org hours exceptions" ON business_hours_exceptions
  FOR ALL USING (
    profile_id IN (
      SELECT id FROM business_profiles WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_business_profile_timestamp
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_business_profile_timestamp();

CREATE TRIGGER update_business_service_timestamp
  BEFORE UPDATE ON business_services
  FOR EACH ROW
  EXECUTE FUNCTION update_business_profile_timestamp();

-- Helper function to get business context for AI
CREATE OR REPLACE FUNCTION get_business_context_for_org(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  profile_data JSONB;
  services_data JSONB;
  result JSONB;
BEGIN
  -- Get profile data
  SELECT to_jsonb(bp.*) INTO profile_data
  FROM business_profiles bp
  WHERE bp.org_id = p_org_id;

  IF profile_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get services data
  SELECT COALESCE(jsonb_agg(to_jsonb(bs.*)), '[]'::jsonb) INTO services_data
  FROM business_services bs
  WHERE bs.profile_id = (profile_data->>'id')::UUID
    AND bs.available = true;

  -- Combine into result
  result := profile_data || jsonb_build_object('services_list', services_data);

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE business_profiles IS 'Business context for AI receptionist to provide personalized responses';
COMMENT ON TABLE business_services IS 'Services offered by the business with pricing and availability';
COMMENT ON TABLE business_hours_exceptions IS 'Special dates when business has different hours or is closed';
COMMENT ON FUNCTION get_business_context_for_org IS 'Retrieves complete business context for AI prompts';
