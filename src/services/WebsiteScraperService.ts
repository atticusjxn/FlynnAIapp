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

const SCRAPER_API_URL = process.env.EXPO_PUBLIC_APP_BASE_URL || 'http://localhost:8080';

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

      // Call backend scraper endpoint
      const response = await fetch(`${SCRAPER_API_URL}/api/scrape-website`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new WebsiteScraperError(
          `Failed to scrape website: ${error.message || response.statusText}`,
          'SCRAPE_FAILED',
          response.status
        );
      }

      const result: WebsiteScrapeResult = await response.json();

      console.log('[WebsiteScraper] Scrape completed successfully');
      return result;
    } catch (error) {
      console.error('[WebsiteScraper] Error:', error);

      if (error instanceof WebsiteScraperError) {
        throw error;
      }

      throw new WebsiteScraperError(
        'Failed to scrape website',
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
