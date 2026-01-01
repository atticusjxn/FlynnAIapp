-- Add missing fields to business_profiles table
-- This migration adds fields that were expected by the app but missing from the schema

ALTER TABLE public.business_profiles
  -- Basic business info
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,

  -- Location fields
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS service_area TEXT,

  -- Business hours (separate from "hours" which is for different purpose)
  ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
    "monday": {"open": "09:00", "close": "17:00", "closed": false},
    "tuesday": {"open": "09:00", "close": "17:00", "closed": false},
    "wednesday": {"open": "09:00", "close": "17:00", "closed": false},
    "thursday": {"open": "09:00", "close": "17:00", "closed": false},
    "friday": {"open": "09:00", "close": "17:00", "closed": false},
    "saturday": {"open": "09:00", "close": "13:00", "closed": false},
    "sunday": {"open": null, "close": null, "closed": true}
  }',

  -- Pricing and policies
  ADD COLUMN IF NOT EXISTS pricing_notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_methods TEXT[],
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS booking_notice TEXT,

  -- FAQs
  ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]',

  -- AI customization
  ADD COLUMN IF NOT EXISTS ai_instructions TEXT,
  ADD COLUMN IF NOT EXISTS greeting_template TEXT,

  -- Website scraping (separate from last_scraped_at)
  ADD COLUMN IF NOT EXISTS website_scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS website_scrape_data JSONB,
  ADD COLUMN IF NOT EXISTS auto_update_from_website BOOLEAN DEFAULT false;

-- Create index for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_business_profiles_business_name ON public.business_profiles(business_name);
CREATE INDEX IF NOT EXISTS idx_business_profiles_website_url ON public.business_profiles(website_url);

-- Comment for documentation
COMMENT ON COLUMN public.business_profiles.business_name IS 'Public business name (can differ from legal_name)';
COMMENT ON COLUMN public.business_profiles.business_hours IS 'Structured business hours for AI receptionist';
COMMENT ON COLUMN public.business_profiles.ai_instructions IS 'Custom instructions for how AI should handle calls';
