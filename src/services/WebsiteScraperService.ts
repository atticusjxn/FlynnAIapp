/**
 * Website Scraper Service
 *
 * Crawls business websites to extract relevant information
 * for the AI receptionist to use during calls.
 *
 * Uses OpenAI to intelligently parse website content.
 */

import type {
  WebsiteScrapeResult,
  BusinessService,
  BusinessHours,
} from '../types/businessProfile';
import { apiClient } from './apiClient';

export class WebsiteScraperError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'WebsiteScraperError';
  }
}

class WebsiteScraperServiceClass {
  /**
   * Scrape a business website and extract relevant information
   */
  async scrapeWebsite(websiteUrl: string): Promise<WebsiteScrapeResult> {
    try {
      // Validate URL
      const url = this.validateUrl(websiteUrl);

      console.log('[WebsiteScraper] Starting scrape for:', url);

      // Call backend scraper endpoint using apiClient (handles auth automatically)
      const response = await apiClient.post<{
        success: boolean;
        url: string;
        scraped_at: string;
        applied?: boolean;
        config?: {
          businessProfile: any;
          greetingScript: string;
          intakeQuestions: any[];
        };
        data?: any;
        error?: string;
      }>('/api/scrape-website', { url });

      if (!response.success) {
        throw new WebsiteScraperError(
          response.error || 'Failed to scrape website',
          'SCRAPE_FAILED',
          500
        );
      }

      // Check if config exists
      if (!response.config) {
        throw new WebsiteScraperError(
          'Server returned incomplete data',
          'INVALID_RESPONSE',
          500
        );
      }

      // Extract contact info from scraped data
      const contactInfo = response.config.businessProfile?.contact_info || {};

      // Transform server response to expected format
      const result: WebsiteScrapeResult = {
        success: true,
        url: response.url,
        scraped_at: response.scraped_at,
        config: response.config,
        data: {
          services: response.config.businessProfile?.services?.map((name: string) => ({
            name,
          })),
          business_hours: response.config.businessProfile?.business_hours,
          contact_info: {
            phone: contactInfo.phones?.[0] || contactInfo.phone,
            email: contactInfo.emails?.[0] || contactInfo.email,
            address: contactInfo.address,
          },
          pricing_notes: response.config.businessProfile?.pricing_notes,
          policies: {
            cancellation: response.config.businessProfile?.cancellation_policy,
            payment: response.config.businessProfile?.payment_terms,
          },
        },
      };

      console.log('[WebsiteScraper] Scrape completed successfully');
      return result;
    } catch (error) {
      console.error('[WebsiteScraper] Error:', error);

      if (error instanceof WebsiteScraperError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to scrape website';

      throw new WebsiteScraperError(
        errorMessage,
        'SCRAPE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Validate and normalize URL
   */
  private validateUrl(url: string): string {
    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const parsed = new URL(url);

      // Must be http or https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }

      return parsed.toString();
    } catch (error) {
      throw new WebsiteScraperError(
        'Invalid website URL',
        'INVALID_URL',
        400,
        error
      );
    }
  }

  /**
   * Format scraped data for display in UI
   */
  formatScrapedData(result: WebsiteScrapeResult): {
    services: string;
    hours: string;
    pricing: string;
    contact: string;
  } {
    const { data } = result;

    // Format services
    const services =
      data.services && data.services.length > 0
        ? data.services.map((s) => `• ${s.name}${s.description ? `: ${s.description}` : ''}`).join('\n')
        : 'No services found';

    // Format hours
    const hours = data.business_hours
      ? this.formatBusinessHours(data.business_hours)
      : 'No hours found';

    // Format pricing
    const pricing = data.pricing_notes || 'No pricing information found';

    // Format contact
    const contact = data.contact_info
      ? [
          data.contact_info.phone && `Phone: ${data.contact_info.phone}`,
          data.contact_info.email && `Email: ${data.contact_info.email}`,
          data.contact_info.address && `Address: ${data.contact_info.address}`,
        ]
          .filter(Boolean)
          .join('\n')
      : 'No contact info found';

    return { services, hours, pricing, contact };
  }

  /**
   * Format business hours for display
   */
  private formatBusinessHours(hours: BusinessHours): string {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const formatted: string[] = [];

    days.forEach((day) => {
      const dayHours = hours[day as keyof BusinessHours];
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

export const WebsiteScraperService = new WebsiteScraperServiceClass();
