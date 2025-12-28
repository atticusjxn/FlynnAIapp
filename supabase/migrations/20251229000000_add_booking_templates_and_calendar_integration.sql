-- Migration: Add booking form templates, custom fields, and enhanced calendar integration
-- Description: Extends booking system with templates, Apple Calendar support, and notification tracking

-- Add custom fields and calendar integration to booking_pages
ALTER TABLE booking_pages
ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS apple_calendar_id text,
ADD COLUMN IF NOT EXISTS selected_template_id uuid,
ADD COLUMN IF NOT EXISTS google_calendar_refresh_token text,
ADD COLUMN IF NOT EXISTS apple_calendar_username text,
ADD COLUMN IF NOT EXISTS apple_calendar_password text;

-- Add start_time and end_time to bookings (actual appointment times)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS start_time timestamptz,
ADD COLUMN IF NOT EXISTS end_time timestamptz,
ADD COLUMN IF NOT EXISTS reminder_1day_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS reminder_1hour_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS apple_event_id text;

-- Create booking form templates table
CREATE TABLE IF NOT EXISTS booking_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template info
  name text NOT NULL,
  industry text NOT NULL, -- 'plumbing', 'electrical', 'beauty', etc.
  description text,
  icon text, -- Icon name for UI

  -- Default fields for this template
  custom_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Example: [
  --   {"label": "Service Type", "type": "select", "required": true, "options": ["Leak Repair", "Installation", "Inspection"]},
  --   {"label": "Property Type", "type": "radio", "required": true, "options": ["Residential", "Commercial"]},
  --   {"label": "Additional Details", "type": "textarea", "required": false}
  -- ]

  -- Template settings
  recommended_duration_minutes integer DEFAULT 60,
  recommended_buffer_minutes integer DEFAULT 15,

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for booking_form_templates
CREATE INDEX IF NOT EXISTS idx_booking_form_templates_industry ON booking_form_templates(industry);
CREATE INDEX IF NOT EXISTS idx_booking_form_templates_active ON booking_form_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_booking_form_templates_order ON booking_form_templates(display_order);

-- Insert 20+ industry templates
INSERT INTO booking_form_templates (name, industry, description, icon, custom_fields, recommended_duration_minutes, recommended_buffer_minutes, display_order) VALUES
-- Home Services
('Plumbing Service', 'plumbing', 'Residential and commercial plumbing services', 'wrench', '[
  {"label": "Service Type", "type": "select", "required": true, "options": ["Leak Repair", "Drain Cleaning", "Installation", "Emergency Service", "Inspection", "Other"]},
  {"label": "Property Type", "type": "radio", "required": true, "options": ["Residential", "Commercial"]},
  {"label": "Urgency", "type": "radio", "required": true, "options": ["Emergency", "Soon", "Flexible"]},
  {"label": "Problem Description", "type": "textarea", "required": true, "placeholder": "Please describe the issue in detail"}
]'::jsonb, 90, 15, 1),

('Electrical Service', 'electrical', 'Licensed electrician services', 'zap', '[
  {"label": "Service Needed", "type": "select", "required": true, "options": ["Wiring", "Panel Upgrade", "Outlet Installation", "Lighting", "Troubleshooting", "Other"]},
  {"label": "Property Type", "type": "radio", "required": true, "options": ["Residential", "Commercial"]},
  {"label": "Emergency Service", "type": "checkbox", "required": false, "options": ["This is an emergency"]},
  {"label": "Details", "type": "textarea", "required": true}
]'::jsonb, 90, 15, 2),

('HVAC Service', 'hvac', 'Heating, ventilation, and air conditioning', 'thermometer', '[
  {"label": "Service Type", "type": "select", "required": true, "options": ["AC Repair", "Heating Repair", "Installation", "Maintenance", "Duct Cleaning"]},
  {"label": "System Type", "type": "select", "required": true, "options": ["Central Air", "Split System", "Heat Pump", "Furnace", "Other"]},
  {"label": "Issue Description", "type": "textarea", "required": true}
]'::jsonb, 120, 15, 3),

('Handyman Service', 'handyman', 'General home repairs and maintenance', 'hammer', '[
  {"label": "Service Needed", "type": "select", "required": true, "options": ["General Repair", "Assembly", "Painting", "Drywall", "Carpentry", "Other"]},
  {"label": "Project Size", "type": "radio", "required": true, "options": ["Small (< 2 hours)", "Medium (2-4 hours)", "Large (Full day)"]},
  {"label": "Project Details", "type": "textarea", "required": true}
]'::jsonb, 60, 15, 4),

('Locksmith Service', 'locksmith', 'Lock installation and emergency lockout service', 'key', '[
  {"label": "Service Type", "type": "select", "required": true, "options": ["Lockout", "Lock Installation", "Rekey", "Safe Service", "Key Duplication"]},
  {"label": "Emergency Lockout", "type": "checkbox", "required": false, "options": ["This is an emergency lockout"]},
  {"label": "Property Type", "type": "radio", "required": true, "options": ["Residential", "Commercial", "Automotive"]},
  {"label": "Additional Info", "type": "textarea", "required": false}
]'::jsonb, 45, 15, 5),

-- Beauty & Wellness
('Hair Salon', 'beauty', 'Hair styling and treatment services', 'scissors', '[
  {"label": "Service Type", "type": "select", "required": true, "options": ["Haircut", "Color", "Highlights", "Treatment", "Styling", "Extensions"]},
  {"label": "Hair Length", "type": "radio", "required": true, "options": ["Short", "Medium", "Long"]},
  {"label": "Stylist Preference", "type": "text", "required": false, "placeholder": "Request a specific stylist (optional)"}
]'::jsonb, 60, 15, 6),

('Massage Therapy', 'wellness', 'Therapeutic massage services', 'heart', '[
  {"label": "Massage Type", "type": "select", "required": true, "options": ["Swedish", "Deep Tissue", "Sports", "Hot Stone", "Prenatal", "Aromatherapy"]},
  {"label": "Duration", "type": "radio", "required": true, "options": ["30 minutes", "60 minutes", "90 minutes"]},
  {"label": "Areas of Focus", "type": "textarea", "required": false, "placeholder": "Any specific areas you\'d like us to focus on?"}
]'::jsonb, 60, 15, 7),

('Nail Salon', 'beauty', 'Nail care and manicure services', 'sparkles', '[
  {"label": "Service Type", "type": "select", "required": true, "options": ["Manicure", "Pedicure", "Gel Nails", "Acrylic Nails", "Nail Art", "Manicure + Pedicure"]},
  {"label": "Special Requests", "type": "textarea", "required": false, "placeholder": "Color preferences, designs, etc."}
]'::jsonb, 45, 15, 8),

('Personal Training', 'fitness', 'One-on-one fitness coaching', 'dumbbell', '[
  {"label": "Session Type", "type": "select", "required": true, "options": ["Strength Training", "Cardio", "Weight Loss", "Sports Performance", "General Fitness"]},
  {"label": "Experience Level", "type": "radio", "required": true, "options": ["Beginner", "Intermediate", "Advanced"]},
  {"label": "Fitness Goals", "type": "textarea", "required": true}
]'::jsonb, 60, 15, 9),

-- Professional Services
('Legal Consultation', 'legal', 'Attorney consultation services', 'briefcase', '[
  {"label": "Practice Area", "type": "select", "required": true, "options": ["Family Law", "Business Law", "Real Estate", "Estate Planning", "Personal Injury", "Other"]},
  {"label": "Consultation Type", "type": "radio", "required": true, "options": ["Initial Consultation", "Follow-up", "Document Review"]},
  {"label": "Case Summary", "type": "textarea", "required": true}
]'::jsonb, 60, 15, 10),

('Accounting/Tax Service', 'accounting', 'Tax preparation and accounting services', 'calculator', '[
  {"label": "Service Type", "type": "select", "required": true, "options": ["Tax Preparation", "Bookkeeping", "Business Consulting", "Audit Support", "Financial Planning"]},
  {"label": "Client Type", "type": "radio", "required": true, "options": ["Individual", "Small Business", "Corporation"]},
  {"label": "Details", "type": "textarea", "required": false}
]'::jsonb, 60, 15, 11),

('Real Estate Showing', 'realestate', 'Property viewing appointments', 'home', '[
  {"label": "Property Type", "type": "select", "required": true, "options": ["Single Family Home", "Condo", "Townhouse", "Multi-Family", "Commercial", "Land"]},
  {"label": "Looking To", "type": "radio", "required": true, "options": ["Buy", "Rent", "Sell"]},
  {"label": "Budget Range", "type": "text", "required": false},
  {"label": "Additional Requirements", "type": "textarea", "required": false}
]'::jsonb, 60, 15, 12),

-- Health & Medical
('Medical Appointment', 'medical', 'General medical consultations', 'stethoscope', '[
  {"label": "Visit Type", "type": "select", "required": true, "options": ["New Patient", "Follow-up", "Annual Physical", "Sick Visit", "Vaccination"]},
  {"label": "Reason for Visit", "type": "textarea", "required": true},
  {"label": "Insurance Provider", "type": "text", "required": false}
]'::jsonb, 30, 15, 13),

('Dental Appointment', 'dental', 'Dental care appointments', 'tooth', '[
  {"label": "Appointment Type", "type": "select", "required": true, "options": ["Cleaning", "Exam", "Filling", "Emergency", "Cosmetic", "Orthodontics"]},
  {"label": "New Patient", "type": "checkbox", "required": false, "options": ["I am a new patient"]},
  {"label": "Dental Concerns", "type": "textarea", "required": false}
]'::jsonb, 60, 15, 14),

('Veterinary Appointment', 'veterinary', 'Pet health care services', 'paw-print', '[
  {"label": "Pet Type", "type": "select", "required": true, "options": ["Dog", "Cat", "Bird", "Rabbit", "Other"]},
  {"label": "Visit Reason", "type": "select", "required": true, "options": ["Wellness Exam", "Vaccination", "Sick Visit", "Emergency", "Grooming", "Other"]},
  {"label": "Pet Name & Age", "type": "text", "required": true},
  {"label": "Symptoms/Details", "type": "textarea", "required": false}
]'::jsonb, 45, 15, 15),

-- Automotive
('Auto Repair', 'automotive', 'Vehicle maintenance and repair', 'car', '[
  {"label": "Service Type", "type": "select", "required": true, "options": ["Oil Change", "Brake Service", "Engine Repair", "Transmission", "Inspection", "Diagnostic", "Other"]},
  {"label": "Vehicle Make & Model", "type": "text", "required": true},
  {"label": "Year", "type": "text", "required": true},
  {"label": "Issue Description", "type": "textarea", "required": false}
]'::jsonb, 90, 30, 16),

-- Cleaning Services
('House Cleaning', 'cleaning', 'Residential cleaning services', 'spray-can', '[
  {"label": "Service Type", "type": "select", "required": true, "options": ["Regular Cleaning", "Deep Cleaning", "Move In/Out", "Post-Construction", "Window Cleaning"]},
  {"label": "Home Size", "type": "select", "required": true, "options": ["Studio/1BR", "2BR", "3BR", "4BR", "5+ BR"]},
  {"label": "Frequency", "type": "radio", "required": true, "options": ["One-time", "Weekly", "Bi-weekly", "Monthly"]},
  {"label": "Special Instructions", "type": "textarea", "required": false}
]'::jsonb, 120, 30, 17),

-- Pet Services
('Dog Grooming', 'petcare', 'Professional dog grooming services', 'dog', '[
  {"label": "Service Type", "type": "select", "required": true, "options": ["Full Groom", "Bath Only", "Haircut", "Nail Trim", "De-shedding Treatment"]},
  {"label": "Dog Breed", "type": "text", "required": true},
  {"label": "Dog Size", "type": "radio", "required": true, "options": ["Small (< 25 lbs)", "Medium (25-50 lbs)", "Large (50-100 lbs)", "Extra Large (> 100 lbs)"]},
  {"label": "Special Notes", "type": "textarea", "required": false, "placeholder": "Temperament, special needs, etc."}
]'::jsonb, 90, 15, 18),

-- Education & Tutoring
('Tutoring Session', 'education', 'Academic tutoring services', 'book-open', '[
  {"label": "Subject", "type": "select", "required": true, "options": ["Math", "Science", "English", "History", "Foreign Language", "Test Prep", "Other"]},
  {"label": "Student Grade Level", "type": "select", "required": true, "options": ["Elementary", "Middle School", "High School", "College", "Adult"]},
  {"label": "Session Type", "type": "radio", "required": true, "options": ["In-Person", "Online"]},
  {"label": "Topics to Cover", "type": "textarea", "required": false}
]'::jsonb, 60, 15, 19),

-- Photography
('Photography Session', 'photography', 'Professional photography services', 'camera', '[
  {"label": "Session Type", "type": "select", "required": true, "options": ["Portrait", "Family", "Engagement", "Wedding", "Event", "Product", "Real Estate"]},
  {"label": "Location", "type": "radio", "required": true, "options": ["Studio", "Outdoor", "Client Location"]},
  {"label": "Number of People", "type": "text", "required": false},
  {"label": "Vision/Theme", "type": "textarea", "required": false}
]'::jsonb, 120, 30, 20),

-- Consulting
('Business Consulting', 'consulting', 'Professional business consultation', 'trending-up', '[
  {"label": "Consultation Focus", "type": "select", "required": true, "options": ["Strategy", "Marketing", "Operations", "Finance", "Technology", "HR", "General"]},
  {"label": "Company Size", "type": "select", "required": true, "options": ["Startup", "1-10 employees", "11-50 employees", "51-200 employees", "200+ employees"]},
  {"label": "Main Challenge", "type": "textarea", "required": true}
]'::jsonb, 60, 15, 21),

-- General/Default
('General Appointment', 'general', 'Standard appointment booking', 'calendar', '[
  {"label": "Appointment Purpose", "type": "textarea", "required": true, "placeholder": "Please describe what you need"},
  {"label": "Preferred Contact Method", "type": "radio", "required": false, "options": ["Phone", "Email", "Text"]}
]'::jsonb, 60, 15, 22)

ON CONFLICT DO NOTHING;

-- Update BookingSlot schema to fix column naming
-- The migration uses slot_datetime instead of start_time, let me correct the booking type
ALTER TABLE booking_slots_cache
DROP COLUMN IF EXISTS date,
ADD COLUMN IF NOT EXISTS date date;

-- Add update trigger for booking_form_templates
CREATE TRIGGER update_booking_form_templates_updated_at
  BEFORE UPDATE ON booking_form_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE booking_form_templates IS 'Pre-built booking form templates for different industries';
COMMENT ON COLUMN booking_pages.custom_fields IS 'Custom form fields for booking page (overrides template defaults)';
COMMENT ON COLUMN booking_pages.apple_calendar_id IS 'Apple Calendar ID for CalDAV integration';
COMMENT ON COLUMN booking_pages.selected_template_id IS 'Reference to the booking form template being used';
COMMENT ON COLUMN bookings.start_time IS 'Actual appointment start time (derived from requested_datetime)';
COMMENT ON COLUMN bookings.end_time IS 'Actual appointment end time (start_time + duration)';
