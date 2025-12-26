-- Migration: Create Booking System Tables
-- Description: Custom booking page system for Flynn AI
-- Allows businesses to have their own booking URLs with Google Calendar integration

-- Booking Pages Configuration
CREATE TABLE booking_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- URL and branding
  slug text NOT NULL UNIQUE, -- e.g., "joes-plumbing" for flynnbooking.com/joes-plumbing
  business_name text NOT NULL,
  business_logo_url text,
  primary_color text DEFAULT '#ff4500',

  -- Booking settings
  business_hours jsonb NOT NULL DEFAULT '{
    "monday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "tuesday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "wednesday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "thursday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "friday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "saturday": {"enabled": false, "start": "09:00", "end": "17:00"},
    "sunday": {"enabled": false, "start": "09:00", "end": "17:00"}
  }'::jsonb,

  -- Time slot configuration
  slot_duration_minutes integer NOT NULL DEFAULT 60, -- Default 1-hour appointments
  buffer_time_minutes integer NOT NULL DEFAULT 15, -- Buffer between appointments
  booking_notice_hours integer NOT NULL DEFAULT 24, -- Minimum advance notice required
  max_days_advance integer NOT NULL DEFAULT 60, -- How far ahead customers can book

  -- Availability
  timezone text NOT NULL DEFAULT 'Australia/Sydney',
  google_calendar_id text, -- Which calendar to check for availability

  -- Booking form customization
  enabled_services jsonb, -- Array of service names to show in dropdown
  custom_questions jsonb, -- [{label, type, required, options}]

  -- Status
  is_active boolean NOT NULL DEFAULT true,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for booking_pages
CREATE INDEX idx_booking_pages_org_id ON booking_pages(org_id);
CREATE INDEX idx_booking_pages_slug ON booking_pages(slug);
CREATE UNIQUE INDEX idx_booking_pages_org_id_unique ON booking_pages(org_id); -- One booking page per org

-- Bookings Table
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_page_id uuid NOT NULL REFERENCES booking_pages(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Customer information
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,

  -- Booking details
  service_type text,
  requested_datetime timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  notes text,
  custom_responses jsonb, -- Answers to custom_questions

  -- Status tracking
  status text NOT NULL DEFAULT 'pending', -- pending, confirmed, cancelled, completed, no_show
  confirmation_sent_at timestamptz,
  reminder_sent_at timestamptz,

  -- Links to Flynn entities
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,

  -- Google Calendar integration
  google_event_id text, -- ID of event created in Google Calendar

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text
);

-- Indexes for bookings
CREATE INDEX idx_bookings_booking_page_id ON bookings(booking_page_id);
CREATE INDEX idx_bookings_org_id ON bookings(org_id);
CREATE INDEX idx_bookings_customer_phone ON bookings(customer_phone);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_requested_datetime ON bookings(requested_datetime);
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_event_id ON bookings(event_id);

-- Cached Availability Slots (optional optimization)
-- This table can cache calculated availability to reduce Google Calendar API calls
CREATE TABLE booking_slots_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_page_id uuid NOT NULL REFERENCES booking_pages(id) ON DELETE CASCADE,

  -- Slot details
  slot_datetime timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  is_available boolean NOT NULL DEFAULT true,

  -- Cache metadata
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, -- Expire cache after 1 hour

  UNIQUE(booking_page_id, slot_datetime)
);

-- Indexes for booking_slots_cache
CREATE INDEX idx_booking_slots_cache_booking_page_id ON booking_slots_cache(booking_page_id);
CREATE INDEX idx_booking_slots_cache_slot_datetime ON booking_slots_cache(slot_datetime);
CREATE INDEX idx_booking_slots_cache_expires_at ON booking_slots_cache(expires_at);

-- Row Level Security (RLS)

-- Enable RLS
ALTER TABLE booking_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_pages
CREATE POLICY "Users can view their organization's booking page"
  ON booking_pages FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert booking pages for their organization"
  ON booking_pages FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can update their organization's booking page"
  ON booking_pages FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete their organization's booking page"
  ON booking_pages FOR DELETE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for bookings
CREATE POLICY "Users can view bookings for their organization"
  ON bookings FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Public can insert bookings (customer-facing booking form)
CREATE POLICY "Anyone can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update bookings for their organization"
  ON bookings FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id
      FROM org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- RLS Policies for booking_slots_cache
CREATE POLICY "Users can view cached slots for their organization's booking page"
  ON booking_slots_cache FOR SELECT
  USING (
    booking_page_id IN (
      SELECT id FROM booking_pages
      WHERE org_id IN (
        SELECT om.org_id
        FROM org_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- Public can view cached slots (for booking page availability display)
CREATE POLICY "Anyone can view cached slots for active booking pages"
  ON booking_slots_cache FOR SELECT
  USING (
    booking_page_id IN (
      SELECT id FROM booking_pages WHERE is_active = true
    )
  );

CREATE POLICY "System can manage cached slots"
  ON booking_slots_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_booking_pages_updated_at
  BEFORE UPDATE ON booking_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_booking_slots()
RETURNS void AS $$
BEGIN
  DELETE FROM booking_slots_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE booking_pages IS 'Custom booking pages for businesses (flynnbooking.com/[slug])';
COMMENT ON TABLE bookings IS 'Customer bookings made through booking pages';
COMMENT ON TABLE booking_slots_cache IS 'Cached availability slots to reduce Google Calendar API calls';
COMMENT ON COLUMN booking_pages.slug IS 'URL-safe unique identifier for booking page (e.g., joes-plumbing)';
COMMENT ON COLUMN booking_pages.buffer_time_minutes IS 'Time buffer between appointments to prevent back-to-back bookings';
COMMENT ON COLUMN booking_pages.booking_notice_hours IS 'Minimum advance notice required for bookings (prevents same-day bookings if > 24)';
COMMENT ON COLUMN bookings.status IS 'Booking status: pending (new), confirmed (approved), cancelled, completed, no_show';
