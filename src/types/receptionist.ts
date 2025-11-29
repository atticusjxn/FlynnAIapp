/**
 * TypeScript types for AI Receptionist configuration and website scraping
 */

export interface BrandVoice {
  tone: 'professional' | 'casual' | 'friendly' | 'technical';
  formality: 'formal' | 'neutral' | 'informal';
  personality: 'warm' | 'efficient' | 'authoritative' | 'approachable';
  characteristics: string[];
}

export interface BusinessProfile {
  public_name: string;
  legal_name?: string;
  headline: string;
  description: string;
  services: string[];
  brand_voice: BrandVoice;
  target_audience: string;
  value_propositions: string[];
}

export interface ReceptionistConfig {
  businessProfile: BusinessProfile;
  greetingScript: string;
  intakeQuestions: string[];
}

export interface ScrapeWebsiteRequest {
  url: string;
  applyConfig?: boolean;
}

export interface ScrapeWebsiteResponse {
  success: boolean;
  url: string;
  scraped_at: string;
  config: ReceptionistConfig;
  applied: boolean;
  error?: string;
}

export interface ApplyConfigRequest {
  greetingScript?: string;
  intakeQuestions?: string[];
  businessProfile?: BusinessProfile;
}

export interface ApplyConfigResponse {
  success: boolean;
  applied: string[];
  error?: string;
}

export interface ScrapedContactInfo {
  phones?: string[];
  emails?: string[];
  address?: string | object;
}

export interface ScrapedData {
  url: string;
  metadata: {
    title?: string | null;
    description?: string | null;
    siteName?: string | null;
    keywords?: string | null;
  };
  content: string;
  structuredData: any[];
  contact: ScrapedContactInfo;
  businessHours?: string | null;
  services: string[];
  scrapedAt: string;
}
