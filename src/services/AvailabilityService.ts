import { supabase } from './supabase';
import { addDays, addMinutes, format, isAfter, isBefore, isWithinInterval, parseISO, startOfDay } from 'date-fns';

/**
 * AvailabilityService
 * Calculates user availability based on calendar events and business hours
 * Used by AI receptionist to suggest appropriate appointment times
 */

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface AvailabilityWindow {
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
  nextAvailableSlot?: TimeSlot;
}

export interface BusinessHours {
  start: string; // HH:mm format (e.g., "09:00")
  end: string; // HH:mm format (e.g., "17:00")
}

export interface UserPreferences {
  business_hours_start?: string;
  business_hours_end?: string;
  default_event_duration_minutes?: number;
  calendar_sync_enabled?: boolean;
}

export const AvailabilityService = {
  /**
   * Get user's availability for a date range
   */
  async getAvailability(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AvailabilityWindow[]> {
    try {
      // Get user preferences
      const prefs = await this.getUserPreferences(userId);

      if (!prefs.calendar_sync_enabled) {
        return [];
      }

      const businessHours: BusinessHours = {
        start: prefs.business_hours_start || '09:00',
        end: prefs.business_hours_end || '17:00',
      };

      // Get all calendar events in range
      const events = await this.getEventsInRange(userId, startDate, endDate);

      // Calculate availability for each day
      const windows: AvailabilityWindow[] = [];
      let currentDate = startOfDay(startDate);

      while (isBefore(currentDate, endDate) || currentDate.getTime() === startDate.getTime()) {
        const dayEvents = events.filter(event => {
          const eventStart = parseISO(event.start_time);
          return format(eventStart, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
        });

        const slots = this.calculateDaySlots(currentDate, dayEvents, businessHours);
        const nextAvailable = slots.find(slot => slot.available);

        windows.push({
          date: format(currentDate, 'yyyy-MM-dd'),
          slots,
          nextAvailableSlot: nextAvailable,
        });

        currentDate = addDays(currentDate, 1);
      }

      return windows;
    } catch (error) {
      console.error('[AvailabilityService] Failed to get availability', error);
      return [];
    }
  },

  /**
   * Get next available time slot starting from now
   */
  async getNextAvailableSlot(
    userId: string,
    durationMinutes: number = 60,
    searchDays: number = 14
  ): Promise<TimeSlot | null> {
    try {
      const now = new Date();
      const endDate = addDays(now, searchDays);

      const windows = await this.getAvailability(userId, now, endDate);

      for (const window of windows) {
        for (const slot of window.slots) {
          if (slot.available && isAfter(slot.start, now)) {
            // Check if slot is long enough for requested duration
            const slotDuration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
            if (slotDuration >= durationMinutes) {
              return {
                start: slot.start,
                end: addMinutes(slot.start, durationMinutes),
                available: true,
              };
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[AvailabilityService] Failed to get next available slot', error);
      return null;
    }
  },

  /**
   * Check if a specific time slot is available
   */
  async isTimeSlotAvailable(
    userId: string,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    try {
      const events = await this.getEventsInRange(userId, startTime, endTime);

      // Check if any event overlaps with the requested time
      for (const event of events) {
        const eventStart = parseISO(event.start_time);
        const eventEnd = parseISO(event.end_time);

        const overlaps =
          (isAfter(startTime, eventStart) && isBefore(startTime, eventEnd)) || // Start time during event
          (isAfter(endTime, eventStart) && isBefore(endTime, eventEnd)) || // End time during event
          (isBefore(startTime, eventStart) && isAfter(endTime, eventEnd)); // Event completely within requested time

        if (overlaps) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[AvailabilityService] Failed to check time slot', error);
      return false;
    }
  },

  /**
   * Get formatted availability summary for AI receptionist
   */
  async getAvailabilitySummary(userId: string, days: number = 7): Promise<string> {
    try {
      const now = new Date();
      const endDate = addDays(now, days);

      const prefs = await this.getUserPreferences(userId);

      if (!prefs.calendar_sync_enabled) {
        return 'Calendar sync is not enabled. Unable to check availability.';
      }

      const nextSlot = await this.getNextAvailableSlot(userId, 60, days);

      if (!nextSlot) {
        return `No availability in the next ${days} days.`;
      }

      const dayOfWeek = format(nextSlot.start, 'EEEE'); // e.g., "Monday"
      const date = format(nextSlot.start, 'MMMM d'); // e.g., "January 12"
      const time = format(nextSlot.start, 'h:mm a'); // e.g., "9:00 AM"

      // Get all available slots for the next 7 days for more context
      const windows = await this.getAvailability(userId, now, endDate);
      const availableCount = windows.reduce((count, window) => {
        return count + window.slots.filter(s => s.available && isAfter(s.start, now)).length;
      }, 0);

      return `Next available: ${dayOfWeek}, ${date} at ${time}. ${availableCount} slots available in the next ${days} days.`;
    } catch (error) {
      console.error('[AvailabilityService] Failed to get availability summary', error);
      return 'Unable to check availability at this time.';
    }
  },

  /**
   * Get events in a date range
   */
  async getEventsInRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ start_time: string; end_time: string; title: string; source: string }>> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('start_time, end_time, title, source')
        .eq('user_id', userId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('[AvailabilityService] Failed to get events', error);
      return [];
    }
  },

  /**
   * Get user calendar preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('business_hours_start, business_hours_end, default_event_duration_minutes, calendar_sync_enabled')
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        business_hours_start: data.business_hours_start,
        business_hours_end: data.business_hours_end,
        default_event_duration_minutes: data.default_event_duration_minutes || 60,
        calendar_sync_enabled: data.calendar_sync_enabled !== false,
      };
    } catch (error) {
      console.error('[AvailabilityService] Failed to get user preferences', error);
      return {
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        default_event_duration_minutes: 60,
        calendar_sync_enabled: true,
      };
    }
  },

  /**
   * Calculate time slots for a single day
   */
  calculateDaySlots(
    date: Date,
    events: Array<{ start_time: string; end_time: string }>,
    businessHours: BusinessHours,
    slotDurationMinutes: number = 60
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];

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
        start: currentSlotStart,
        end: currentSlotEnd,
        available: !hasConflict,
      });

      currentSlotStart = currentSlotEnd;
    }

    return slots;
  },

  /**
   * Get availability for a specific date and time
   * Useful for AI receptionist to check if a caller's requested time is available
   */
  async checkSpecificTime(
    userId: string,
    requestedDateTime: Date,
    durationMinutes: number = 60
  ): Promise<{ available: boolean; suggestedAlternatives?: TimeSlot[] }> {
    try {
      const endTime = addMinutes(requestedDateTime, durationMinutes);
      const isAvailable = await this.isTimeSlotAvailable(userId, requestedDateTime, endTime);

      if (isAvailable) {
        return { available: true };
      }

      // If not available, find 3 alternative slots
      const alternatives: TimeSlot[] = [];
      const searchEndDate = addDays(requestedDateTime, 14);

      const windows = await this.getAvailability(userId, requestedDateTime, searchEndDate);

      for (const window of windows) {
        for (const slot of window.slots) {
          if (slot.available && alternatives.length < 3) {
            alternatives.push(slot);
          }
          if (alternatives.length >= 3) break;
        }
        if (alternatives.length >= 3) break;
      }

      return {
        available: false,
        suggestedAlternatives: alternatives,
      };
    } catch (error) {
      console.error('[AvailabilityService] Failed to check specific time', error);
      return { available: false };
    }
  },
};

export default AvailabilityService;
