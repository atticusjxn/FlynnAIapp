// Booking Page API Routes
// Public endpoints for the booking system

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { sendCustomerConfirmation, sendBusinessNotification } = require('../services/emailService');
const { sendConfirmationSMS } = require('../services/smsReminderService');

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

    // Parse date
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Generate available slots for the day
    const slots = await generateDaySlots(
      bookingPage,
      selectedDate
    );

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
async function generateDaySlots(bookingPage, date) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];
  const dayHours = bookingPage.business_hours[dayName];

  // If day is not enabled, return empty array
  if (!dayHours || !dayHours.enabled) {
    return [];
  }

  // Parse business hours
  const [startHour, startMinute] = dayHours.start.split(':').map(Number);
  const [endHour, endMinute] = dayHours.end.split(':').map(Number);

  // Create datetime for start and end of business day
  const dayStart = new Date(date);
  dayStart.setHours(startHour, startMinute, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(endHour, endMinute, 0, 0);

  // Get existing bookings for this day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('booking_page_id', bookingPage.id)
    .in('status', ['confirmed', 'pending'])
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString());

  const busyTimes = (existingBookings || []).map(booking => ({
    start: new Date(booking.start_time),
    end: new Date(booking.end_time),
  }));

  // Generate slots
  const slots = [];
  let currentSlotStart = new Date(dayStart);

  while (currentSlotStart < dayEnd) {
    const slotEnd = new Date(currentSlotStart.getTime() + bookingPage.slot_duration_minutes * 60000);

    // Check if slot end is within business hours
    if (slotEnd > dayEnd) {
      break;
    }

    // Check if slot overlaps with busy times
    const isAvailable = !busyTimes.some(busy => {
      return currentSlotStart < busy.end && slotEnd > busy.start;
    });

    // Check if slot is in the past
    const isPast = currentSlotStart < new Date();

    slots.push({
      start_time: currentSlotStart.toISOString(),
      end_time: slotEnd.toISOString(),
      is_available: isAvailable && !isPast,
    });

    // Move to next slot (duration + buffer)
    currentSlotStart = new Date(
      currentSlotStart.getTime() +
      (bookingPage.slot_duration_minutes + bookingPage.buffer_time_minutes) * 60000
    );
  }

  return slots;
}

/**
 * Helper: Check if a time slot is still available
 */
async function checkSlotAvailability(bookingPageId, startTime, endTime) {
  const { data: conflictingBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('booking_page_id', bookingPageId)
    .in('status', ['confirmed', 'pending'])
    .or(`start_time.lt.${endTime.toISOString()},end_time.gt.${startTime.toISOString()}`);

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
