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
  addDays,
} = require('../services/bookingPage');

// Calendar services are optional (may not be available in backend-only deployment)
let CalendarIntegrationService = null;
let AppleCalendarService = null;
try {
  CalendarIntegrationService = require('../src/services/CalendarIntegrationService');
} catch (e) {
  console.log('[BookingRoutes] CalendarIntegrationService not available - calendar sync disabled');
}
try {
  AppleCalendarService = require('../src/services/AppleCalendarService');
} catch (e) {
  console.log('[BookingRoutes] AppleCalendarService not available - Apple Calendar sync disabled');
}

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
router.post('/:slug/book', async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      booking_page_id,
      customer_name,
      customer_phone,
      customer_email,
      start_time,
      end_time,
      duration_minutes,
      notes,
      custom_responses,
    } = req.body;

    // Validate required fields
    if (!customer_name || !customer_phone || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    // Check if time slot is still available
    const isAvailable = await checkSlotAvailability(
      bookingPage.id,
      new Date(start_time),
      new Date(end_time)
    );

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

    // Create calendar events (non-blocking)
    createCalendarEvents(bookingPage.org_id, booking, bookingPage.business_name)
      .catch(error => {
        console.error('[Booking] Failed to create calendar events:', error);
      });

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

  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('booking_page_id', bookingPage.id)
    .in('status', ['confirmed', 'pending'])
    .gte('start_time', windowStart.toISOString())
    .lt('start_time', windowEnd.toISOString());

  const busyTimes = (existingBookings || []).map((booking) => ({
    start: new Date(booking.start_time),
    end: new Date(booking.end_time),
  }));

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
 * Helper: Check if a time slot is still available
 */
async function checkSlotAvailability(bookingPageId, startTime, endTime) {
  // Two intervals overlap when existing.start < new.end AND existing.end > new.start.
  // This was an `.or(...)` of those two halves, which is true for essentially
  // any row: a booking next month satisfies `end_time > new.start`. The result
  // was a 409 "no longer available" on every booking after the very first one
  // the page ever took. Chained filters are ANDed, which is the real test.
  const { data: conflictingBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('booking_page_id', bookingPageId)
    .in('status', ['confirmed', 'pending'])
    .lt('start_time', endTime.toISOString())
    .gt('end_time', startTime.toISOString());

  return !conflictingBookings || conflictingBookings.length === 0;
}

/**
 * Helper: Create calendar events in Google and Apple Calendar
 */
async function createCalendarEvents(orgId, booking, businessName) {
  // Skip if no calendar services are available
  if (!CalendarIntegrationService && !AppleCalendarService) {
    return;
  }

  const eventDetails = {
    summary: `${businessName} - ${booking.customer_name}`,
    description: `Appointment with ${booking.customer_name}\nPhone: ${booking.customer_phone}${booking.customer_email ? `\nEmail: ${booking.customer_email}` : ''}${booking.notes ? `\n\nNotes: ${booking.notes}` : ''}`,
    startTime: booking.start_time,
    endTime: booking.end_time,
    attendeeEmail: booking.customer_email,
    attendeeName: booking.customer_name,
  };

  // Build promises array only for available services
  const promises = [];
  if (CalendarIntegrationService?.createGoogleCalendarEvent) {
    promises.push(CalendarIntegrationService.createGoogleCalendarEvent(orgId, eventDetails));
  } else {
    promises.push(Promise.resolve(null));
  }
  if (AppleCalendarService?.createAppleCalendarEvent) {
    promises.push(AppleCalendarService.createAppleCalendarEvent(orgId, eventDetails));
  } else {
    promises.push(Promise.resolve(null));
  }

  // Try to create events in both calendars (non-blocking)
  const [googleEventId, appleEventId] = await Promise.allSettled(promises);

  // Update booking with event IDs
  const updates = {};
  if (googleEventId.status === 'fulfilled' && googleEventId.value) {
    updates.google_event_id = googleEventId.value;
  }
  if (appleEventId.status === 'fulfilled' && appleEventId.value) {
    updates.apple_event_id = appleEventId.value;
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('bookings')
      .update(updates)
      .eq('id', booking.id);
  }
}

module.exports = router;
