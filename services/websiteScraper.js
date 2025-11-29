const axios = require('axios');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

/**
 * Website Scraper Service
 * Scrapes business websites and extracts relevant content for AI receptionist training
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FlynnAI/1.0';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
});

/**
 * Clean and normalize text content
 */
const cleanText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
    .trim();
};

/**
 * Extract metadata from HTML
 */
const extractMetadata = ($) => {
  const metadata = {
    title: $('title').text().trim() || null,
    description: $('meta[name="description"]').attr('content') ||
                 $('meta[property="og:description"]').attr('content') || null,
    siteName: $('meta[property="og:site_name"]').attr('content') || null,
    keywords: $('meta[name="keywords"]').attr('content') || null,
  };

  return metadata;
};

/**
 * Extract main content from page (removes nav, footer, scripts, etc.)
 */
const extractMainContent = ($) => {
  // Remove unwanted elements
  $('script, style, nav, footer, header, aside, .cookie-banner, .popup, .modal').remove();

  // Try to find main content area
  const mainSelectors = [
    'main',
    'article',
    '.content',
    '.main-content',
    '#content',
    '#main',
    'body',
  ];

  let mainContent = null;
  for (const selector of mainSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      mainContent = element;
      break;
    }
  }

  if (!mainContent) {
    mainContent = $('body');
  }

  // Convert HTML to markdown for better LLM processing
  const html = mainContent.html() || '';
  const markdown = turndownService.turndown(html);

  return cleanText(markdown);
};

/**
 * Extract structured data (JSON-LD, microdata, etc.)
 */
const extractStructuredData = ($) => {
  const structuredData = [];

  // Extract JSON-LD
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      const json = JSON.parse($(elem).html());
      structuredData.push(json);
    } catch (error) {
      console.warn('[WebsiteScraper] Failed to parse JSON-LD', { error: error.message });
    }
  });

  return structuredData;
};

/**
 * Extract contact information from page
 */
const extractContactInfo = ($, content) => {
  const contact = {};

  // Extract phone numbers
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = content.match(phoneRegex);
  if (phones && phones.length > 0) {
    contact.phones = [...new Set(phones)].slice(0, 3); // Dedupe and limit to 3
  }

  // Extract email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = content.match(emailRegex);
  if (emails && emails.length > 0) {
    contact.emails = [...new Set(emails)].slice(0, 3); // Dedupe and limit to 3
  }

  // Extract address from structured data
  const addressFromStructured = extractAddressFromStructuredData($);
  if (addressFromStructured) {
    contact.address = addressFromStructured;
  }

  return contact;
};

/**
 * Extract address from JSON-LD structured data
 */
const extractAddressFromStructuredData = ($) => {
  try {
    $('script[type="application/ld+json"]').each((i, elem) => {
      const json = JSON.parse($(elem).html());
      if (json['@type'] === 'LocalBusiness' && json.address) {
        return json.address;
      }
    });
  } catch (error) {
    // Ignore parsing errors
  }
  return null;
};

/**
 * Extract business hours from page content
 */
const extractBusinessHours = (content, structuredData) => {
  // First try structured data
  for (const data of structuredData) {
    if (data['@type'] === 'LocalBusiness' && data.openingHours) {
      return data.openingHours;
    }
  }

  // Try to extract from content with common patterns
  const hoursPatterns = [
    /hours?\s*:?\s*([^\n]+)/i,
    /open\s*:?\s*([^\n]+)/i,
    /monday\s*-?\s*friday\s*:?\s*([^\n]+)/i,
  ];

  for (const pattern of hoursPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
};

/**
 * Main scraping function
 */
const scrapeWebsite = async (url) => {
  console.log('[WebsiteScraper] Scraping website:', { url });

  try {
    // Fetch the page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
      timeout: 15000, // 15 second timeout
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract all content
    const metadata = extractMetadata($);
    const mainContent = extractMainContent($);
    const structuredData = extractStructuredData($);
    const contact = extractContactInfo($, mainContent);
    const businessHours = extractBusinessHours(mainContent, structuredData);

    // Extract services from headings and lists
    const services = [];
    $('h1, h2, h3').each((i, elem) => {
      const heading = $(elem).text().trim();
      if (heading.toLowerCase().includes('service') ||
          heading.toLowerCase().includes('what we do') ||
          heading.toLowerCase().includes('our work')) {
        // Look for services in lists following this heading
        $(elem).nextAll('ul, ol').first().find('li').each((j, li) => {
          const service = $(li).text().trim();
          if (service && service.length < 100) {
            services.push(service);
          }
        });
      }
    });

    const result = {
      url,
      metadata,
      content: mainContent.slice(0, 10000), // Limit to 10k chars
      structuredData,
      contact,
      businessHours,
      services: services.slice(0, 10), // Limit to 10 services
      scrapedAt: new Date().toISOString(),
    };

    console.log('[WebsiteScraper] Successfully scraped website:', {
      url,
      contentLength: mainContent.length,
      servicesFound: services.length,
      hasStructuredData: structuredData.length > 0,
    });

    return result;
  } catch (error) {
    console.error('[WebsiteScraper] Failed to scrape website:', {
      url,
      error: error.message,
      code: error.code,
    });

    throw new Error(`Failed to scrape website: ${error.message}`);
  }
};

module.exports = {
  scrapeWebsite,
};
