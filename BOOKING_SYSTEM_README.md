# Flynn AI Booking System - Complete Setup Guide

## Overview

A fully-functional Calendly-like booking page system at `flynnai.app/[businessname]` with:
- ✅ Google & Apple Calendar integration
- ✅ 22 industry-specific booking form templates
- ✅ Auto-booking with calendar sync
- ✅ Email confirmations via Resend
- ✅ SMS reminders via Twilio
- ✅ Automated reminder scheduler (24h & 1h before appointments)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Flynn AI System                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  React Native App (Mobile)                               │
│  ├── Settings → Booking Page Setup                       │
│  ├── Calendar Integration (Google/Apple OAuth)           │
│  └── Template Selection (22 industries)                  │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Next.js Booking Pages (Web) - /booking-pages            │
│  ├── [slug]/page.tsx (Dynamic booking pages)             │
│  ├── DatePicker → TimeSlotPicker → BookingForm           │
│  └── Flynn UI Styling + "Powered by Flynn" Footer        │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Express.js Backend - server.js                          │
│  ├── /api/booking/:slug (Get booking page)               │
│  ├── /api/booking/:slug/availability (Get slots)         │
│  ├── /api/booking/:slug/book (Create booking)            │
│  └── Cron: Booking reminder scheduler (runs every 60s)   │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Services Layer                                           │
│  ├── CalendarIntegrationService (Google OAuth)           │
│  ├── AppleCalendarService (CalDAV)                       │
│  ├── AvailabilityService (Slot generation + sync)        │
│  ├── emailService (Resend API)                           │
│  ├── smsReminderService (Twilio)                         │
│  └── bookingReminderScheduler (Automated reminders)      │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Supabase Database                                        │
│  ├── booking_pages (Business config)                     │
│  ├── booking_form_templates (22 industry templates)      │
│  ├── bookings (Customer appointments)                    │
│  └── booking_slots_cache (Performance optimization)      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Database Migration

Run the database migration to create tables and insert templates:

```bash
# The migration file has already been created at:
# supabase/migrations/20251229000000_add_booking_templates_and_calendar_integration.sql

# Apply it to your Supabase database
npx supabase db push
```

This will:
- Add custom_fields, calendar integration columns to booking_pages
- Create booking_form_templates table
- Insert 22 industry templates (plumbing, beauty, legal, medical, etc.)
- Add reminder tracking fields to bookings

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

**Required for booking system:**
- `RESEND_API_KEY` - Get from https://resend.com
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `BOOKING_DOMAIN=flynnai.app`

**Already configured (Twilio, Supabase, OpenAI):**
- These should already be set up for Flynn's voicemail features

### 3. Install Next.js Booking Pages

```bash
cd booking-pages
npm install
npm run build
```

### 4. Deploy to Fly.io

Update your `fly.toml` to serve both Express and Next.js:

```toml
[[services]]
  internal_port = 3000  # Express server
  protocol = "tcp"

[[services]]
  internal_port = 3001  # Next.js booking pages
  protocol = "tcp"
```

Or use a reverse proxy setup:
- Express on port 3000 handles `/api/*` routes
- Next.js on port 3001 handles `/*` for booking pages

### 5. Google Calendar Setup

**In Google Cloud Console:**
1. Create OAuth 2.0 credentials
2. Add authorized redirect URI: `flynnai://auth/google/callback`
3. Enable Google Calendar API
4. Copy Client ID and Secret to `.env`

**In the Flynn app:**
1. Go to Settings → Booking Page
2. Tap "Connect Calendar"
3. Authorize Google Calendar access
4. Select which calendar to sync with

### 6. Apple Calendar Setup (Optional)

**For users:**
1. Generate app-specific password at appleid.apple.com
2. Enter Apple ID and app password in Flynn settings
3. Select calendar to sync

## File Structure

```
FlynnAI/
├── server.js                           # Express backend with booking routes
├── routes/
│   └── bookingRoutes.js                # Booking API endpoints
├── services/
│   ├── emailService.js                 # Resend email service
│   ├── smsReminderService.js           # Twilio SMS service
│   └── bookingReminderScheduler.js     # Automated reminders
├── src/
│   ├── services/
│   │   ├── BookingPageService.ts       # Booking page CRUD
│   │   ├── BookingTemplateService.ts   # Template management
│   │   ├── AvailabilityService.ts      # Slot generation + calendar sync
│   │   ├── CalendarIntegrationService.ts  # Google Calendar OAuth
│   │   └── AppleCalendarService.ts     # CalDAV integration
│   ├── screens/settings/
│   │   └── BookingPageSetupScreen.tsx  # Configure booking page
│   └── types/
│       └── booking.ts                  # TypeScript types
├── booking-pages/                      # Next.js booking pages app
│   ├── app/
│   │   ├── [slug]/page.tsx             # Dynamic booking pages
│   │   ├── layout.tsx                  # Root layout
│   │   └── globals.css                 # Flynn UI styles
│   ├── components/
│   │   ├── BookingPageClient.tsx       # Main booking flow
│   │   ├── BusinessHeader.tsx          # Business branding
│   │   ├── DatePicker.tsx              # Calendar date picker
│   │   ├── TimeSlotPicker.tsx          # Available time slots
│   │   ├── BookingForm.tsx             # Customer details form
│   │   ├── ConfirmationModal.tsx       # Success confirmation
│   │   └── FlynnFooter.tsx             # "Powered by Flynn"
│   └── lib/
│       └── supabase.ts                 # Supabase client + types
└── supabase/migrations/
    └── 20251229000000_add_booking_templates_and_calendar_integration.sql
```

## Usage Flow

### Business Owner (Flynn App):

1. **Setup Booking Page:**
   - Settings → Booking Page Setup
   - Enter business name → generates slug (e.g., "jacks-plumbing")
   - Choose template from 22 industries
   - Customize form fields (or keep template defaults)
   - Set business hours
   - Configure appointment duration & buffer time

2. **Connect Calendar:**
   - Connect Google Calendar and/or Apple Calendar
   - Choose which calendar to sync with
   - Flynn blocks out busy times automatically

3. **Share Booking Link:**
   - Copy link: `https://flynnai.app/jacks-plumbing`
   - Share via SMS, email, website, social media

### Customer (Public Booking Page):

1. **Visit booking page** → `flynnai.app/jacks-plumbing`
2. **Select date** → Calendar shows available dates
3. **Choose time slot** → See only available times (synced with calendar)
4. **Fill details** → Name, phone, email, custom form fields
5. **Confirm** → Booking created + confirmation sent

### Automated System:

1. **Booking created:**
   - ✅ Email confirmation sent to customer (Resend)
   - ✅ SMS confirmation sent to customer (Twilio)
   - ✅ Email notification sent to business
   - ✅ Event created in Google/Apple Calendar
   - ✅ Booking stored in Supabase

2. **24 hours before:**
   - ✅ Reminder email sent
   - ✅ Reminder SMS sent

3. **1 hour before:**
   - ✅ Final reminder email
   - ✅ Final reminder SMS

## API Endpoints

### GET /api/booking/:slug
Get public booking page configuration

**Response:**
```json
{
  "id": "uuid",
  "slug": "jacks-plumbing",
  "business_name": "Jack's Plumbing",
  "business_logo_url": "https://...",
  "primary_color": "#2563EB",
  "business_hours": { ... },
  "slot_duration_minutes": 60,
  "custom_fields": [ ... ]
}
```

### GET /api/booking/:slug/availability?date=2025-12-30
Get available time slots for a specific date

**Response:**
```json
{
  "slots": [
    {
      "start_time": "2025-12-30T09:00:00Z",
      "end_time": "2025-12-30T10:00:00Z",
      "is_available": true
    },
    ...
  ]
}
```

### POST /api/booking/:slug/book
Create a new booking

**Request:**
```json
{
  "customer_name": "John Doe",
  "customer_phone": "+1234567890",
  "customer_email": "john@example.com",
  "start_time": "2025-12-30T09:00:00Z",
  "end_time": "2025-12-30T10:00:00Z",
  "duration_minutes": 60,
  "notes": "Need emergency repair",
  "custom_responses": {
    "Service Type": "Leak Repair",
    "Urgency": "Emergency"
  }
}
```

## 22 Industry Templates

1. Plumbing Service
2. Electrical Service
3. HVAC Service
4. Handyman Service
5. Locksmith Service
6. Hair Salon
7. Massage Therapy
8. Nail Salon
9. Personal Training
10. Legal Consultation
11. Accounting/Tax Service
12. Real Estate Showing
13. Medical Appointment
14. Dental Appointment
15. Veterinary Appointment
16. Auto Repair
17. House Cleaning
18. Dog Grooming
19. Tutoring Session
20. Photography Session
21. Business Consulting
22. General Appointment

Each template includes:
- Industry-specific custom form fields
- Recommended appointment duration
- Recommended buffer time between appointments
- Pre-filled service type options

## Testing

1. **Create a booking page in the app**
2. **Visit the public URL:** `http://localhost:3001/your-slug` (dev) or `https://flynnai.app/your-slug` (prod)
3. **Test the booking flow:**
   - Select a date
   - Choose a time slot
   - Fill out the form
   - Submit booking
   - Verify confirmation email & SMS
4. **Check calendar sync:** Event should appear in connected Google/Apple Calendar
5. **Wait for reminders:** Test 24h and 1h reminders (or manually trigger)

## Troubleshooting

**Booking page not found (404):**
- Ensure booking page `is_active = true` in database
- Check slug matches URL exactly
- Verify Next.js app is running

**No available time slots:**
- Check business_hours are enabled for the selected day
- Verify calendar isn't fully booked
- Check slot_duration + buffer_time doesn't exceed business hours

**Calendar sync not working:**
- Google: Verify OAuth credentials and refresh token
- Apple: Ensure app-specific password is correct
- Check logs for API errors

**Emails not sending:**
- Verify `RESEND_API_KEY` is set correctly
- Check `FROM_EMAIL` domain is verified in Resend
- Look for error logs in server console

**SMS not sending:**
- Verify Twilio credentials
- Check phone number format (+1234567890)
- Ensure Twilio messaging service is configured

## Next Steps

1. **Customize branding:** Add business logo and colors in booking page settings
2. **Test calendar integration:** Connect Google and/or Apple Calendar
3. **Send test bookings:** Create bookings and verify all notifications
4. **Deploy to production:** Push to Fly.io and test with real domain
5. **Monitor performance:** Check Supabase logs for any issues

## Support

For issues or questions:
- GitHub: https://github.com/anthropics/flynn-ai
- Email: support@flynnai.app
