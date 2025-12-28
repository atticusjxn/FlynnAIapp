// Booking Page Service
// Manages booking page creation, updates, and slug management

import { supabase } from './supabase';
import { BookingPage, CreateBookingPageRequest, UpdateBookingPageRequest, BusinessHours } from '../types/booking';

class BookingPageService {
  /**
   * Get booking page for an organization
   */
  async getBookingPage(orgId: string): Promise<BookingPage | null> {
    const { data, error } = await supabase
      .from('booking_pages')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No booking page found
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * Get booking page by slug (public endpoint)
   */
  async getBookingPageBySlug(slug: string): Promise<BookingPage | null> {
    const { data, error } = await supabase
      .from('booking_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * Create booking page for organization
   */
  async createBookingPage(request: CreateBookingPageRequest): Promise<BookingPage> {
    // Generate slug if not provided
    const slug = request.slug || this.generateSlug(request.business_name);

    // Check if slug is available
    const slugAvailable = await this.isSlugAvailable(slug);
    if (!slugAvailable) {
      throw new Error(`Slug "${slug}" is already taken. Please choose another.`);
    }

    // Default business hours (Monday-Friday, 9am-5pm)
    const defaultBusinessHours: BusinessHours = {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' },
    };

    const { data, error } = await supabase
      .from('booking_pages')
      .insert({
        org_id: request.org_id,
        slug,
        business_name: request.business_name,
        business_hours: request.business_hours || defaultBusinessHours,
        slot_duration_minutes: request.slot_duration_minutes || 60,
        buffer_time_minutes: request.buffer_time_minutes || 15,
        google_calendar_id: request.google_calendar_id,
        is_active: request.is_active !== undefined ? request.is_active : true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update booking page
   */
  async updateBookingPage(
    bookingPageId: string,
    updates: UpdateBookingPageRequest
  ): Promise<BookingPage> {
    // If slug is being updated, check availability
    if (updates.slug) {
      const slugAvailable = await this.isSlugAvailable(updates.slug, bookingPageId);
      if (!slugAvailable) {
        throw new Error(`Slug "${updates.slug}" is already taken. Please choose another.`);
      }
    }

    const { data, error } = await supabase
      .from('booking_pages')
      .update(updates)
      .eq('id', bookingPageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete booking page
   */
  async deleteBookingPage(bookingPageId: string): Promise<void> {
    const { error } = await supabase
      .from('booking_pages')
      .delete()
      .eq('id', bookingPageId);

    if (error) throw error;
  }

  /**
   * Toggle booking page active status
   */
  async toggleActive(bookingPageId: string, isActive: boolean): Promise<BookingPage> {
    return this.updateBookingPage(bookingPageId, { is_active: isActive });
  }

  /**
   * Check if slug is available
   */
  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('booking_pages')
      .select('id')
      .eq('slug', slug);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.single();

    if (error) {
      // PGRST116 means no rows found, which means slug is available
      return error.code === 'PGRST116';
    }

    return !data;
  }

  /**
   * Generate URL-friendly slug from business name
   */
  generateSlug(businessName: string): string {
    return businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get full booking URL for a booking page
   */
  getBookingUrl(slug: string): string {
    const domain = process.env.BOOKING_DOMAIN || 'flynnai.app';
    return `https://${domain}/${slug}`;
  }

  /**
   * Validate business hours
   */
  validateBusinessHours(businessHours: BusinessHours): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    let hasEnabledDay = false;

    for (const day of days) {
      const hours = businessHours[day as keyof BusinessHours];

      if (hours.enabled) {
        hasEnabledDay = true;

        // Validate time format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(hours.start)) {
          errors.push(`Invalid start time for ${day}: ${hours.start}`);
        }
        if (!timeRegex.test(hours.end)) {
          errors.push(`Invalid end time for ${day}: ${hours.end}`);
        }

        // Validate end time is after start time
        if (hours.start >= hours.end) {
          errors.push(`End time must be after start time for ${day}`);
        }
      }
    }

    if (!hasEnabledDay) {
      errors.push('At least one day must be enabled');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default new BookingPageService();
