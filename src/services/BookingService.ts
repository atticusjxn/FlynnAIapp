// Booking Service
// Manages booking creation, updates, and SMS notifications

import { supabase } from './supabase';
import { Booking, CreateBookingRequest, BookingStatus } from '../types/booking';
import TwilioService from './TwilioService';
import AvailabilityService from './AvailabilityService';

class BookingService {
  /**
   * Create a new booking
   */
  async createBooking(request: CreateBookingRequest): Promise<Booking> {
    // Validate slot is still available
    const isAvailable = await this.isSlotAvailable(
      request.booking_page_id,
      new Date(request.start_time),
      new Date(request.end_time)
    );

    if (!isAvailable) {
      throw new Error('This time slot is no longer available. Please choose another time.');
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        booking_page_id: request.booking_page_id,
        event_id: request.event_id,
        client_name: request.client_name,
        client_email: request.client_email,
        client_phone: request.client_phone,
        start_time: request.start_time,
        end_time: request.end_time,
        notes: request.notes,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Invalidate availability cache
    await AvailabilityService.invalidateCache(
      request.booking_page_id,
      new Date(request.start_time)
    );

    // Send confirmation SMS if phone number provided
    if (request.client_phone) {
      await this.sendBookingConfirmationSMS(data);
    }

    return data;
  }

  /**
   * Get bookings for a booking page
   */
  async getBookings(bookingPageId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_page_id', bookingPageId)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Get booking by ID
   */
  async getBooking(bookingId: string): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get bookings by event ID
   */
  async getBookingsByEvent(eventId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(bookingId: string, status: BookingStatus): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache when status changes
    await AvailabilityService.invalidateCache(
      data.booking_page_id,
      new Date(data.start_time)
    );

    return data;
  }

  /**
   * Confirm booking
   */
  async confirmBooking(bookingId: string): Promise<Booking> {
    return this.updateBookingStatus(bookingId, 'confirmed');
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId: string): Promise<Booking> {
    const booking = await this.updateBookingStatus(bookingId, 'cancelled');

    // Send cancellation SMS
    if (booking.client_phone) {
      await this.sendBookingCancellationSMS(booking);
    }

    return booking;
  }

  /**
   * Check if a time slot is available
   */
  private async isSlotAvailable(
    bookingPageId: string,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    // Check for conflicting bookings
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('booking_page_id', bookingPageId)
      .in('status', ['confirmed', 'pending'])
      .or(`and(start_time.lt.${endTime.toISOString()},end_time.gt.${startTime.toISOString()})`);

    if (error) throw error;

    return data.length === 0;
  }

  /**
   * Send booking confirmation SMS
   */
  private async sendBookingConfirmationSMS(booking: Booking): Promise<void> {
    const startTime = new Date(booking.start_time);
    const formattedDate = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const message = `Your booking has been confirmed for ${formattedDate} at ${formattedTime}. We look forward to seeing you! - ${booking.client_name}`;

    try {
      await TwilioService.sendSMS(booking.client_phone!, message);
    } catch (error) {
      console.error('Failed to send booking confirmation SMS:', error);
      // Don't throw - booking is still created even if SMS fails
    }
  }

  /**
   * Send booking cancellation SMS
   */
  private async sendBookingCancellationSMS(booking: Booking): Promise<void> {
    const startTime = new Date(booking.start_time);
    const formattedDate = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const message = `Your booking for ${formattedDate} at ${formattedTime} has been cancelled. Please contact us if you have any questions.`;

    try {
      await TwilioService.sendSMS(booking.client_phone!, message);
    } catch (error) {
      console.error('Failed to send booking cancellation SMS:', error);
      // Don't throw - cancellation is still processed even if SMS fails
    }
  }

  /**
   * Generate booking link SMS message
   */
  generateBookingLinkMessage(
    bookingUrl: string,
    clientName: string,
    businessName: string
  ): string {
    return `Hi ${clientName}! Thanks for your interest. You can book your appointment at your convenience here: ${bookingUrl}\n\nLooking forward to working with you!\n- ${businessName}`;
  }

  /**
   * Send booking link SMS to client
   */
  async sendBookingLinkSMS(
    phoneNumber: string,
    bookingUrl: string,
    clientName: string,
    businessName: string
  ): Promise<void> {
    const message = this.generateBookingLinkMessage(bookingUrl, clientName, businessName);

    await TwilioService.sendSMS(phoneNumber, message);
  }
}

export default new BookingService();
