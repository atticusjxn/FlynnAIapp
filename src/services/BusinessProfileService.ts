/**
 * Business Profile Service
 *
 * Manages business profile CRUD operations and
 * integrates with website scraper.
 */

import { supabase } from './supabase';
import { OrganizationService } from './organizationService';
import type {
  BusinessProfile,
  BusinessProfileInput,
  BusinessServiceDetailed,
  WebsiteScrapeResult,
} from '../types/businessProfile';
import { WebsiteScraperService } from './WebsiteScraperService';

export class BusinessProfileError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'BusinessProfileError';
  }
}

class BusinessProfileServiceClass {
  /**
   * Get business profile for current organization
   */
  async getProfile(): Promise<BusinessProfile | null> {
    try {
      const { orgId } = await OrganizationService.fetchOnboardingData();
      if (!orgId) {
        throw new BusinessProfileError('Organization not found', 'ORG_NOT_FOUND', 404);
      }

      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('org_id', orgId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        throw new BusinessProfileError(
          'Failed to get business profile',
          'DB_ERROR',
          500,
          error
        );
      }

      return data as BusinessProfile | null;
    } catch (error) {
      if (error instanceof BusinessProfileError) throw error;
      throw new BusinessProfileError(
        'Failed to get business profile',
        'GET_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Create or update business profile
   */
  async upsertProfile(input: BusinessProfileInput): Promise<BusinessProfile> {
    try {
      const { orgId } = await OrganizationService.fetchOnboardingData();
      if (!orgId) {
        throw new BusinessProfileError('Organization not found', 'ORG_NOT_FOUND', 404);
      }

      const { data, error } = await supabase
        .from('business_profiles')
        .upsert(
          {
            org_id: orgId,
            ...input,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'org_id',
          }
        )
        .select()
        .single();

      if (error) {
        console.error('[BusinessProfile] Supabase upsert error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new BusinessProfileError(
          'Failed to save business profile',
          'UPSERT_ERROR',
          500,
          error
        );
      }

      return data as BusinessProfile;
    } catch (error) {
      if (error instanceof BusinessProfileError) throw error;
      throw new BusinessProfileError(
        'Failed to save business profile',
        'SAVE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Scrape website and update profile
   */
  async scrapeAndUpdateProfile(websiteUrl: string): Promise<{
    profile: BusinessProfile;
    scrapeResult: WebsiteScrapeResult;
  }> {
    try {
      console.log('[BusinessProfile] Scraping website:', websiteUrl);

      // Scrape website
      const scrapeResult = await WebsiteScraperService.scrapeWebsite(websiteUrl);

      if (!scrapeResult.success) {
        throw new BusinessProfileError(
          scrapeResult.error || 'Website scraping failed',
          'SCRAPE_FAILED',
          400
        );
      }

      // Get current profile
      const currentProfile = await this.getProfile();

      // Prepare update data
      const updateData: BusinessProfileInput = {
        website_url: websiteUrl,
        website_scraped_at: scrapeResult.scraped_at,
        website_scrape_data: scrapeResult.data as Record<string, unknown>,
      };

      // Merge scraped data with existing profile
      if (scrapeResult.data.services && scrapeResult.data.services.length > 0) {
        updateData.services = scrapeResult.data.services;
      }

      if (scrapeResult.data.business_hours) {
        updateData.business_hours = scrapeResult.data.business_hours;
      }

      if (scrapeResult.data.pricing_notes) {
        updateData.pricing_notes = scrapeResult.data.pricing_notes;
      }

      if (scrapeResult.data.contact_info) {
        if (scrapeResult.data.contact_info.phone) {
          updateData.phone = scrapeResult.data.contact_info.phone;
        }
        if (scrapeResult.data.contact_info.email) {
          updateData.email = scrapeResult.data.contact_info.email;
        }
        if (scrapeResult.data.contact_info.address) {
          updateData.address_line1 = scrapeResult.data.contact_info.address;
        }
      }

      if (scrapeResult.data.policies) {
        if (scrapeResult.data.policies.cancellation) {
          updateData.cancellation_policy = scrapeResult.data.policies.cancellation;
        }
        if (scrapeResult.data.policies.payment) {
          updateData.payment_terms = scrapeResult.data.policies.payment;
        }
      }

      // Save updated profile
      const profile = await this.upsertProfile(updateData);

      console.log('[BusinessProfile] Profile updated from website scrape');

      return { profile, scrapeResult };
    } catch (error) {
      if (error instanceof BusinessProfileError) throw error;
      throw new BusinessProfileError(
        'Failed to scrape and update profile',
        'SCRAPE_UPDATE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Get business services for current profile
   */
  async getServices(): Promise<BusinessServiceDetailed[]> {
    try {
      const profile = await this.getProfile();
      if (!profile) {
        return [];
      }

      const { data, error } = await supabase
        .from('business_services')
        .select('*')
        .eq('profile_id', profile.id)
        .order('name');

      if (error) {
        throw new BusinessProfileError(
          'Failed to get services',
          'DB_ERROR',
          500,
          error
        );
      }

      return (data as BusinessServiceDetailed[]) || [];
    } catch (error) {
      if (error instanceof BusinessProfileError) throw error;
      throw new BusinessProfileError(
        'Failed to get services',
        'GET_SERVICES_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Add or update a service
   */
  async upsertService(
    service: Partial<BusinessServiceDetailed>
  ): Promise<BusinessServiceDetailed> {
    try {
      const profile = await this.getProfile();
      if (!profile) {
        throw new BusinessProfileError('Profile not found', 'PROFILE_NOT_FOUND', 404);
      }

      const { data, error } = await supabase
        .from('business_services')
        .upsert({
          ...service,
          profile_id: profile.id,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new BusinessProfileError(
          'Failed to save service',
          'UPSERT_ERROR',
          500,
          error
        );
      }

      return data as BusinessServiceDetailed;
    } catch (error) {
      if (error instanceof BusinessProfileError) throw error;
      throw new BusinessProfileError(
        'Failed to save service',
        'SAVE_SERVICE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Delete a service
   */
  async deleteService(serviceId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('business_services')
        .delete()
        .eq('id', serviceId);

      if (error) {
        throw new BusinessProfileError(
          'Failed to delete service',
          'DELETE_ERROR',
          500,
          error
        );
      }
    } catch (error) {
      if (error instanceof BusinessProfileError) throw error;
      throw new BusinessProfileError(
        'Failed to delete service',
        'DELETE_SERVICE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Get business context formatted for AI prompts
   */
  async getAIContext(): Promise<string | null> {
    try {
      const profile = await this.getProfile();
      if (!profile) {
        return null;
      }

      const context: string[] = [];

      // Business name and type
      if (profile.business_name) {
        context.push(`Business: ${profile.business_name}`);
      }
      if (profile.business_type) {
        context.push(`Type: ${profile.business_type}`);
      }

      // Services
      if (profile.services && profile.services.length > 0) {
        const servicesList = profile.services
          .map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ''}`)
          .join('\n');
        context.push(`\nServices offered:\n${servicesList}`);
      }

      // Pricing
      if (profile.pricing_notes) {
        context.push(`\nPricing: ${profile.pricing_notes}`);
      }

      // Business hours
      if (profile.business_hours) {
        const hoursText = this.formatBusinessHours(profile.business_hours);
        context.push(`\nBusiness hours:\n${hoursText}`);
      }

      // Location
      if (profile.service_area) {
        context.push(`\nService area: ${profile.service_area}`);
      } else if (profile.city && profile.state) {
        context.push(`\nLocation: ${profile.city}, ${profile.state}`);
      }

      // Policies
      if (profile.cancellation_policy) {
        context.push(`\nCancellation policy: ${profile.cancellation_policy}`);
      }
      if (profile.payment_terms) {
        context.push(`\nPayment terms: ${profile.payment_terms}`);
      }
      if (profile.booking_notice) {
        context.push(`\nBooking notice: ${profile.booking_notice}`);
      }

      // Custom AI instructions
      if (profile.ai_instructions) {
        context.push(`\nSpecial instructions: ${profile.ai_instructions}`);
      }

      return context.join('\n');
    } catch (error) {
      console.error('[BusinessProfile] Error getting AI context:', error);
      return null;
    }
  }

  /**
   * Format business hours for display
   */
  private formatBusinessHours(hours: any): string {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const formatted: string[] = [];

    days.forEach((day) => {
      const dayHours = hours[day];
      if (!dayHours) return;

      if (dayHours.closed) {
        formatted.push(`${this.capitalize(day)}: Closed`);
      } else if (dayHours.open && dayHours.close) {
        formatted.push(`${this.capitalize(day)}: ${dayHours.open} - ${dayHours.close}`);
      }
    });

    return formatted.join('\n');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export const BusinessProfileService = new BusinessProfileServiceClass();
