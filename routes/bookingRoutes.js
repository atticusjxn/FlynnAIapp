// Booking Page API Routes
// Public endpoints for the booking system

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { sendCustomerConfirmation, sendBusinessNotification } = require('../services/emailService');
const { sendConfirmationSMS } = require('../services/smsReminderService');
const analytics = require('../services/analytics');
const {
  parseCalendarDate,
  weekdayForCalendarDate,
  zonedWallTimeToUtc,
  formatSlotLabel,
  formatDayLabel,
  addDays,
} = require('../services/bookingPage');
const {
  busyIntervalsForOrg,
  createCalendarEventsForBooking,
} = require('../services/bookingCalendarSync');

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/booking/:slug
 * Get public booking page configuration
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: bookingPage, error } = await supabase
      .from('booking_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !bookingPage) {
      return res.status(404).json({ error: 'Booking page not found' });
    }

    // Return public fields only
    res.json({
      id: bookingPage.id,
      slug: bookingPage.slug,
      business_name: bookingPage.business_name,
      business_logo_url: bookingPage.business_logo_url,
      primary_color: bookingPage.primary_color,
      business_hours: bookingPage.business_hours,
      slot_duration_minutes: bookingPage.slot_duration_minutes,
      buffer_time_minutes: bookingPage.buffer_time_minutes,
      booking_notice_hours: bookingPage.booking_notice_hours,
      max_days_advance: bookingPage.max_days_advance,
      timezone: bookingPage.timezone,
      custom_fields: bookingPage.custom_fields || [],
    });
  } catch (error) {
    console.error('Error fetching booking page:', error);
    res.status(500).json({ error: 'Failed to fetch booking page' });
  }
});

/**
 * GET /api/booking/:slug/availability
 * Get available time slots for a specific date
 */
router.get('/:slug/availability', async (req, res) => {
  try {
    const { slug } = req.params;
    const { date } = req.query; // Format: YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    // Get booking page
    const { data: bookingPage, error: pageError } = await supabase
      .from('booking_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (pageError || !bookingPage) {
      return res.status(404).json({ error: 'Booking page not found' });
    }

    // `date` is a calendar day in the *business's* timezone, so it is handed
    // through as a string. Parsing it into a Date here would re-interpret it in
    // the server's zone, which is the bug this endpoint used to have.
    if (!parseCalendarDate(date)) {
      return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' });
    }

    const slots = await generateDaySlots(bookingPage, date);

    res.json({ slots });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

/**
 * POST /api/booking/:slug/book
 * Create a new booking
 */
// Public, unauthenticated POST — keep a lid on it. Same in-memory pattern as
// the invoice page's email endpoint: fine at one Fly machine, revisit if we
// ever scale out.
const bookHits = new Map();
const bookAllowed = (ip) => {
  const now = Date.now();
  const hits = (bookHits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (hits.length >= 10) return false;
  hits.push(now);
  bookHits.set(ip, hits);
  return true;
};

router.post('/:slug/book', async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      customer_name,
      customer_phone,
      customer_email,
      start_time,
      end_time,
      duration_minutes,
      notes,
      custom_responses,
      website, // honeypot — humans never see it, bots autofill it
    } = req.body;

    // A filled honeypot gets a fake success: a 4xx just teaches the bot to
    // drop the field.
    if (website) {
      return res.status(201).json({ id: 'ok', status: 'confirmed' });
    }

    if (!bookAllowed(req.ip || 'unknown')) {
      return res.status(429).json({ error: 'Too many requests, try again shortly' });
    }

    // Validate required fields
    if (!customer_name || !customer_phone || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return res.status(400).json({ error: 'Invalid time range' });
    }
    const phoneDigits = String(customer_phone).replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      return res.status(400).json({ error: 'That phone number doesn\'t look right' });
    }

    // Get booking page to verify it exists and get org_id
    const { data: bookingPage, error: pageError } = await supabase
      .from('booking_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (pageError || !bookingPage) {
      return res.status(404).json({ error: 'Booking page not found' });
    }

    // Re-check the slot against BOTH busy sources — the page's own bookings
    // and the tradie's calendars. Availability already filtered on both, but
    // the slot list can be minutes stale by the time the form is submitted.
    const isAvailable = await checkSlotAvailability(bookingPage, startDate, endDate);

    if (!isAvailable) {
      return res.status(409).json({ error: 'Time slot is no longer available' });
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        booking_page_id: bookingPage.id,
        org_id: bookingPage.org_id,
        customer_name,
        customer_phone,
        customer_email,
        start_time,
        end_time,
        duration_minutes,
        notes,
        custom_responses,
        status: 'confirmed', // Auto-confirm bookings
        requested_datetime: start_time,
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      return res.status(500).json({ error: 'Failed to create booking' });
    }

    // The conversion at the end of the artifact loop: sent -> opened -> made.
    analytics.capture(bookingPage.org_id, analytics.EVENTS.BOOKING_MADE, {
      slug,
      org_id: bookingPage.org_id,
      booking_id: booking.id,
      start_time,
    });

    // Send notifications (non-blocking)
    Promise.all([
      sendCustomerConfirmation(booking, bookingPage.business_name),
      sendConfirmationSMS(booking, bookingPage.business_name),
      sendBusinessNotification(booking, bookingPage.business_name, bookingPage.business_email),
    ]).catch(error => {
      console.error('[Booking] Failed to send notifications:', error);
    });

    // Write the slot back into the tradie's real calendar(s), and mirror the
    // booking into `jobs` so it shows up in the app alongside call-booked work.
    // Both non-blocking: the customer already has their 201.
    createCalendarEventsForBooking({ orgId: bookingPage.org_id, bookingPage, booking })
      .then((eventIds) => {
        if (Object.keys(eventIds).length > 0) {
          return supabase.from('bookings').update(eventIds).eq('id', booking.id);
        }
        return null;
      })
      .catch((error) => console.error('[Booking] Calendar write-back failed:', error));

    createJobForBooking(bookingPage, booking)
      .catch((error) => console.error('[Booking] Job mirror failed:', error));

    res.status(201).json(booking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * Helper: Generate available slots for a specific day
 */
async function generateDaySlots(bookingPage, dateStr) {
  const cal = parseCalendarDate(dateStr);
  if (!cal) return [];

  // Business hours are wall-clock times in the business's own zone. Building
  // them with setHours() used the *server's* zone, so a Sydney tradie's 9-5
  // came out 10-11h off on a UTC Fly machine.
  const timeZone = bookingPage.timezone || 'Australia/Sydney';
  const dayHours = bookingPage.business_hours?.[weekdayForCalendarDate(cal)];
  if (!dayHours || !dayHours.enabled) return [];

  const [startHour, startMinute] = String(dayHours.start).split(':').map(Number);
  const [endHour, endMinute] = String(dayHours.end).split(':').map(Number);
  if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return [];

  const dayStart = zonedWallTimeToUtc(cal.year, cal.month, cal.day, startHour, startMinute, timeZone);
  const dayEnd = zonedWallTimeToUtc(cal.year, cal.month, cal.day, endHour, endMinute, timeZone);

  // Existing bookings across that calendar day *in the business's zone*, which
  // is not the same window as the server's midnight-to-midnight.
  const nextDay = addDays(cal, 1);
  const windowStart = zonedWallTimeToUtc(cal.year, cal.month, cal.day, 0, 0, timeZone);
  const windowEnd = zonedWallTimeToUtc(nextDay.year, nextDay.month, nextDay.day, 0, 0, timeZone);

  // Two busy sources, queried together: this page's own bookings, and the
  // tradie's real calendars (Google/Apple where connected). Without the second
  // one, a job booked over the phone and living only in Google Calendar was
  // invisible here, and the page happily double-booked over it.
  const [{ data: existingBookings }, calendarBusy] = await Promise.all([
    supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('booking_page_id', bookingPage.id)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', windowStart.toISOString())
      .lt('start_time', windowEnd.toISOString()),
    busyIntervalsForOrg({
      orgId: bookingPage.org_id,
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      googleCalendarId: bookingPage.google_calendar_id || 'primary',
    }).catch((err) => {
      console.warn('[BookingRoutes] calendar busy lookup failed (bookings-only availability):', err.message);
      return [];
    }),
  ]);

  const busyTimes = [
    ...(existingBookings || []).map((booking) => ({
      start: new Date(booking.start_time),
      end: new Date(booking.end_time),
    })),
    ...calendarBusy,
  ];

  const now = new Date();
  // Both of these were configured on every page and applied by nothing.
  const noticeMs = Math.max(0, Number(bookingPage.booking_notice_hours ?? 0)) * 3600000;
  const earliestBookable = new Date(now.getTime() + noticeMs);
  const maxDays = Math.max(1, Number(bookingPage.max_days_advance ?? 60));
  const horizon = new Date(now.getTime() + maxDays * 86400000);

  const duration = Math.max(5, Number(bookingPage.slot_duration_minutes ?? 60));
  const buffer = Math.max(0, Number(bookingPage.buffer_time_minutes ?? 0));

  const slots = [];
  let currentSlotStart = new Date(dayStart);

  while (currentSlotStart < dayEnd) {
    const slotEnd = new Date(currentSlotStart.getTime() + duration * 60000);
    if (slotEnd > dayEnd) break;

    const clashes = busyTimes.some(
      (busy) => currentSlotStart < busy.end && slotEnd > busy.start
    );

    slots.push({
      start_time: currentSlotStart.toISOString(),
      end_time: slotEnd.toISOString(),
      // Rendered in the business's zone so the page never has to guess.
      label: formatSlotLabel(currentSlotStart, timeZone),
      is_available:
        !clashes && currentSlotStart >= earliestBookable && currentSlotStart <= horizon,
    });

    currentSlotStart = new Date(currentSlotStart.getTime() + (duration + buffer) * 60000);
  }

  return slots;
}

/**
 * Helper: Check if a time slot is still available, against both the page's
 * own bookings and the tradie's connected calendars.
 */
async function checkSlotAvailability(bookingPage, startTime, endTime) {
  // Two intervals overlap when existing.start < new.end AND existing.end > new.start.
  // This was an `.or(...)` of those two halves, which is true for essentially
  // any row: a booking next month satisfies `end_time > new.start`. The result
  // was a 409 "no longer available" on every booking after the very first one
  // the page ever took. Chained filters are ANDed, which is the real test.
  const [{ data: conflictingBookings }, calendarBusy] = await Promise.all([
    supabase
      .from('bookings')
      .select('id')
      .eq('booking_page_id', bookingPage.id)
      .in('status', ['confirmed', 'pending'])
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString()),
    busyIntervalsForOrg({
      orgId: bookingPage.org_id,
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      googleCalendarId: bookingPage.google_calendar_id || 'primary',
    }).catch(() => []),
  ]);

  if (conflictingBookings && conflictingBookings.length > 0) return false;
  // busyIntervalsForOrg returns merged {start: Date, end: Date} intervals.
  return !calendarBusy.some((busy) => startTime < busy.end && busy.start < endTime);
}

/**
 * Helper: mirror an online booking into `jobs` so it appears in the app's
 * Jobs tab next to call-booked work. Before this, an online booking lived
 * only in `bookings` — a table the app never reads.
 */
async function createJobForBooking(bookingPage, booking) {
  const { data: owner } = await supabase
    .from('users')
    .select('id')
    .eq('default_org_id', bookingPage.org_id)
    .limit(1)
    .maybeSingle();
  if (!owner?.id) {
    // jobs.user_id is NOT NULL; an org with no resolvable owner can't take one.
    console.warn('[Booking] No owner user for org; skipping job mirror.', { orgId: bookingPage.org_id });
    return;
  }

  const timeZone = bookingPage.timezone || 'Australia/Sydney';
  const start = new Date(booking.start_time);
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(start);

  const { error } = await supabase.from('jobs').insert({
    user_id: owner.id,
    org_id: bookingPage.org_id,
    status: 'new',
    source: 'booking_page',
    customer_name: booking.customer_name,
    customer_phone: booking.customer_phone,
    customer_email: booking.customer_email || null,
    title: `${booking.customer_name} — booked online`,
    summary: booking.notes || 'Booked through your booking page',
    notes: booking.notes || null,
    scheduled_date: dateStr,
    scheduled_time: formatSlotLabel(start, timeZone),
    scheduled_at: booking.start_time,
    captured_at: new Date().toISOString(),
    event_payload: { booking_id: booking.id, booking_page_id: bookingPage.id },
  });
  if (error) {
    console.error('[Booking] jobs insert failed:', error.message);
  }
}

module.exports = router;
