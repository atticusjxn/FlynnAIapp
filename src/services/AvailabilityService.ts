// Availability Service
// Manages Google Calendar integration and available slot calculation

import { supabase } from './supabase';
import { BookingPage, BookingSlot, BusinessHours } from '../types/booking';

interface CalendarEvent {
  start: string; // ISO datetime
  end: string; // ISO datetime
}

class AvailabilityService {
  /**
   * Get available booking slots for a date range
   */
  async getAvailableSlots(
    bookingPage: BookingPage,
    startDate: Date,
    endDate: Date
  ): Promise<BookingSlot[]> {
    // First check cache
    const cachedSlots = await this.getCachedSlots(bookingPage.id, startDate, endDate);
    if (cachedSlots.length > 0) {
      return cachedSlots;
    }

    // Generate fresh slots
    const slots = await this.generateSlots(bookingPage, startDate, endDate);

    // Cache the slots
    await this.cacheSlots(bookingPage.id, slots);

    return slots;
  }

  /**
   * Generate available slots based on business hours and calendar events
   */
  private async generateSlots(
    bookingPage: BookingPage,
    startDate: Date,
    endDate: Date
  ): Promise<BookingSlot[]> {
    const slots: BookingSlot[] = [];

    // Get busy times from Google Calendar
    const busyTimes = await this.getGoogleCalendarBusyTimes(
      bookingPage.google_calendar_id,
      startDate,
      endDate
    );

    // Get existing bookings
    const existingBookings = await this.getExistingBookings(bookingPage.id, startDate, endDate);

    // Generate slots for each day
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const daySlots = this.generateDaySlots(
        currentDate,
        bookingPage.business_hours,
        bookingPage.slot_duration_minutes,
        bookingPage.buffer_time_minutes,
        [...busyTimes, ...existingBookings]
      );

      slots.push(...daySlots);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return slots;
  }

  /**
   * Generate slots for a single day
   */
  private generateDaySlots(
    date: Date,
    businessHours: BusinessHours,
    slotDuration: number,
    bufferTime: number,
    busyTimes: CalendarEvent[]
  ): BookingSlot[] {
    const slots: BookingSlot[] = [];
    const dayName = this.getDayName(date);
    const dayHours = businessHours[dayName];

    // Skip if day is not enabled
    if (!dayHours.enabled) {
      return slots;
    }

    // Parse business hours
    const [startHour, startMinute] = dayHours.start.split(':').map(Number);
    const [endHour, endMinute] = dayHours.end.split(':').map(Number);

    // Create datetime for start and end of business day
    const dayStart = new Date(date);
    dayStart.setHours(startHour, startMinute, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(endHour, endMinute, 0, 0);

    // Generate slots
    let currentSlotStart = new Date(dayStart);
    while (currentSlotStart < dayEnd) {
      const slotEnd = new Date(currentSlotStart.getTime() + slotDuration * 60000);

      // Check if slot end is within business hours
      if (slotEnd > dayEnd) {
        break;
      }

      // Check if slot overlaps with busy times
      const isAvailable = !this.isSlotBusy(currentSlotStart, slotEnd, busyTimes);

      slots.push({
        start_time: currentSlotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        is_available: isAvailable,
      });

      // Move to next slot (duration + buffer)
      currentSlotStart = new Date(currentSlotStart.getTime() + (slotDuration + bufferTime) * 60000);
    }

    return slots;
  }

  /**
   * Check if a slot overlaps with busy times
   */
  private isSlotBusy(
    slotStart: Date,
    slotEnd: Date,
    busyTimes: CalendarEvent[]
  ): boolean {
    for (const busy of busyTimes) {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);

      // Check for overlap
      if (slotStart < busyEnd && slotEnd > busyStart) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get busy times from Google Calendar
   */
  private async getGoogleCalendarBusyTimes(
    calendarId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    if (!calendarId) {
      return [];
    }

    // TODO: Implement Google Calendar API integration
    // This should call Google Calendar freebusy API
    // For now, return empty array as placeholder
    console.warn('Google Calendar integration not yet implemented');
    return [];

    /*
    // Placeholder implementation structure:
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: calendarId }],
      }),
    });

    const data = await response.json();
    return data.calendars[calendarId].busy || [];
    */
  }

  /**
   * Get existing bookings from database
   */
  private async getExistingBookings(
    bookingPageId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('booking_page_id', bookingPageId)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());

    if (error) throw error;

    return data.map(booking => ({
      start: booking.start_time,
      end: booking.end_time,
    }));
  }

  /**
   * Get cached slots from database
   */
  private async getCachedSlots(
    bookingPageId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BookingSlot[]> {
    const { data, error } = await supabase
      .from('booking_slots_cache')
      .select('slots, cached_at')
      .eq('booking_page_id', bookingPageId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    if (error) throw error;

    // Check if cache is still valid (less than 1 hour old)
    const now = new Date();
    const validSlots: BookingSlot[] = [];

    for (const cache of data) {
      const cachedAt = new Date(cache.cached_at);
      const hoursSinceCached = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCached < 1) {
        validSlots.push(...(cache.slots as BookingSlot[]));
      }
    }

    return validSlots;
  }

  /**
   * Cache slots in database
   */
  private async cacheSlots(bookingPageId: string, slots: BookingSlot[]): Promise<void> {
    // Group slots by date
    const slotsByDate = new Map<string, BookingSlot[]>();

    for (const slot of slots) {
      const date = slot.start_time.split('T')[0];
      if (!slotsByDate.has(date)) {
        slotsByDate.set(date, []);
      }
      slotsByDate.get(date)!.push(slot);
    }

    // Insert cache entries
    const cacheEntries = Array.from(slotsByDate.entries()).map(([date, daySlots]) => ({
      booking_page_id: bookingPageId,
      date,
      slots: daySlots,
    }));

    // Delete old cache entries first
    await supabase
      .from('booking_slots_cache')
      .delete()
      .eq('booking_page_id', bookingPageId)
      .in('date', Array.from(slotsByDate.keys()));

    // Insert new cache
    const { error } = await supabase
      .from('booking_slots_cache')
      .insert(cacheEntries);

    if (error) throw error;
  }

  /**
   * Invalidate cache for a booking page
   */
  async invalidateCache(bookingPageId: string, date?: Date): Promise<void> {
    let query = supabase
      .from('booking_slots_cache')
      .delete()
      .eq('booking_page_id', bookingPageId);

    if (date) {
      query = query.eq('date', date.toISOString().split('T')[0]);
    }

    const { error } = await query;
    if (error) throw error;
  }

  /**
   * Get day name from date
   */
  private getDayName(date: Date): keyof BusinessHours {
    const days: (keyof BusinessHours)[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return days[date.getDay()];
  }
}

export default new AvailabilityService();
