const { createClient } = require('@supabase/supabase-js');
const { addDays, addMinutes, format, isAfter, isBefore, isWithinInterval, parseISO, startOfDay } = require('date-fns');

/**
 * Availability Service (Backend)
 * Provides calendar availability information for AI receptionist
 * Queries calendar_events table to determine user's free time slots
 */

let supabaseClient = null;

const initializeSupabase = () => {
  if (!supabaseClient && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return supabaseClient;
};

/**
 * Get user's calendar preferences
 */
const getUserPreferences = async (userId) => {
  const supabase = initializeSupabase();

  const { data, error } = await supabase
    .from('users')
    .select('business_hours_start, business_hours_end, default_event_duration_minutes, calendar_sync_enabled')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Availability] Failed to get user preferences', error);
    return {
      business_hours_start: '09:00:00',
      business_hours_end: '17:00:00',
      default_event_duration_minutes: 60,
      calendar_sync_enabled: true,
    };
  }

  return {
    business_hours_start: data.business_hours_start || '09:00:00',
    business_hours_end: data.business_hours_end || '17:00:00',
    default_event_duration_minutes: data.default_event_duration_minutes || 60,
    calendar_sync_enabled: data.calendar_sync_enabled !== false,
  };
};

/**
 * Get calendar events in a date range
 */
const getEventsInRange = async (userId, startDate, endDate) => {
  const supabase = initializeSupabase();

  const { data, error } = await supabase
    .from('calendar_events')
    .select('start_time, end_time, title, source')
    .eq('user_id', userId)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[Availability] Failed to get events', error);
    return [];
  }

  return data || [];
};

/**
 * Calculate time slots for a single day
 */
const calculateDaySlots = (date, events, businessHours, slotDurationMinutes = 60) => {
  const slots = [];

  // Parse business hours
  const [startHour, startMinute] = businessHours.start.split(':').map(Number);
  const [endHour, endMinute] = businessHours.end.split(':').map(Number);

  // Create start and end times for the day
  const dayStart = new Date(date);
  dayStart.setHours(startHour, startMinute, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(endHour, endMinute, 0, 0);

  // Generate all possible slots during business hours
  let currentSlotStart = dayStart;

  while (isBefore(currentSlotStart, dayEnd)) {
    const currentSlotEnd = addMinutes(currentSlotStart, slotDurationMinutes);

    // Stop if slot extends beyond business hours
    if (isAfter(currentSlotEnd, dayEnd)) {
      break;
    }

    // Check if slot conflicts with any event
    const hasConflict = events.some(event => {
      const eventStart = parseISO(event.start_time);
      const eventEnd = parseISO(event.end_time);

      return (
        isWithinInterval(currentSlotStart, { start: eventStart, end: eventEnd }) ||
        isWithinInterval(currentSlotEnd, { start: eventStart, end: eventEnd }) ||
        (isBefore(currentSlotStart, eventStart) && isAfter(currentSlotEnd, eventEnd))
      );
    });

    slots.push({
      start: currentSlotStart.toISOString(),
      end: currentSlotEnd.toISOString(),
      available: !hasConflict,
    });

    currentSlotStart = currentSlotEnd;
  }

  return slots;
};

/**
 * Get next available time slot
 */
const getNextAvailableSlot = async (userId, durationMinutes = 60, searchDays = 14) => {
  const prefs = await getUserPreferences(userId);

  if (!prefs.calendar_sync_enabled) {
    return null;
  }

  const now = new Date();
  const endDate = addDays(now, searchDays);

  const businessHours = {
    start: prefs.business_hours_start,
    end: prefs.business_hours_end,
  };

  // Get all calendar events in range
  const events = await getEventsInRange(userId, now, endDate);

  // Calculate availability for each day
  let currentDate = startOfDay(now);

  while (isBefore(currentDate, endDate) || currentDate.getTime() === now.getTime()) {
    const dayEvents = events.filter(event => {
      const eventStart = parseISO(event.start_time);
      return format(eventStart, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
    });

    const slots = calculateDaySlots(currentDate, dayEvents, businessHours, durationMinutes);

    // Find first available slot that's in the future
    for (const slot of slots) {
      const slotStart = parseISO(slot.start);
      if (slot.available && isAfter(slotStart, now)) {
        return {
          start: slot.start,
          end: slot.end,
          dayOfWeek: format(slotStart, 'EEEE'),
          date: format(slotStart, 'MMMM d'),
          time: format(slotStart, 'h:mm a'),
        };
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return null;
};

/**
 * Get formatted availability summary for AI
 */
const getAvailabilitySummary = async (userId, days = 7) => {
  try {
    const prefs = await getUserPreferences(userId);

    if (!prefs.calendar_sync_enabled) {
      return {
        enabled: false,
        summary: 'Calendar sync is not enabled.',
      };
    }

    const nextSlot = await getNextAvailableSlot(userId, 60, days);

    if (!nextSlot) {
      return {
        enabled: true,
        available: false,
        summary: `No availability in the next ${days} days.`,
      };
    }

    const summary = `Next available: ${nextSlot.dayOfWeek}, ${nextSlot.date} at ${nextSlot.time}`;

    return {
      enabled: true,
      available: true,
      nextSlot,
      summary,
      businessHours: {
        start: prefs.business_hours_start,
        end: prefs.business_hours_end,
      },
    };
  } catch (error) {
    console.error('[Availability] Failed to get summary', error);
    return {
      enabled: false,
      summary: 'Unable to check availability at this time.',
    };
  }
};

/**
 * Check if a specific time is available
 */
const checkSpecificTime = async (userId, requestedDateTime, durationMinutes = 60) => {
  try {
    const endTime = addMinutes(parseISO(requestedDateTime), durationMinutes);
    const events = await getEventsInRange(userId, parseISO(requestedDateTime), endTime);

    // Check for conflicts
    for (const event of events) {
      const eventStart = parseISO(event.start_time);
      const eventEnd = parseISO(event.end_time);
      const reqStart = parseISO(requestedDateTime);

      const overlaps =
        (isAfter(reqStart, eventStart) && isBefore(reqStart, eventEnd)) ||
        (isAfter(endTime, eventStart) && isBefore(endTime, eventEnd)) ||
        (isBefore(reqStart, eventStart) && isAfter(endTime, eventEnd));

      if (overlaps) {
        return {
          available: false,
          conflictingEvent: event.title,
        };
      }
    }

    return { available: true };
  } catch (error) {
    console.error('[Availability] Failed to check specific time', error);
    return { available: false, error: 'Unable to check availability' };
  }
};

module.exports = {
  getAvailabilitySummary,
  getNextAvailableSlot,
  checkSpecificTime,
  getUserPreferences,
};
