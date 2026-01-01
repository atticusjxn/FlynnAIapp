/**
 * Gemini URL Context Scraper Service
 * 
 * Uses Gemini's URL Context tool to scrape websites without triggering 403 errors.
 * Google's infrastructure fetches the page, bypassing bot protection.
 */

const { GoogleGenAI } = require('@google/genai');

// Model that supports URL Context tool
const SCRAPER_MODEL = 'gemini-2.5-flash';

/**
 * Initialize Gemini client
 */
const getGeminiClient = () => {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is required for website scraping');
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * Scrape a website using Gemini's URL Context tool
 * @param {string} url - The website URL to scrape
 * @returns {Promise<Object>} Scraped business data
 */
const scrapeWebsiteWithGemini = async (url) => {
    console.log('[GeminiUrlScraper] Starting scrape for:', url);

    const ai = getGeminiClient();

    const extractionPrompt = `You are a business information extraction expert. Visit and analyze this website: ${url}

Extract ALL relevant business information and return ONLY valid JSON with this exact structure:
{
  "url": "${url}",
  "metadata": {
    "title": "Page title",
    "description": "Meta description or null",
    "siteName": "Business/Site name",
    "keywords": "Meta keywords or null"
  },
  "content": "Brief summary of the main page content (2-3 sentences)",
  "structuredData": [],
  "contact": {
    "phones": ["phone numbers found"],
    "emails": ["email addresses found"],
    "address": "Physical address if found or null"
  },
  "businessHours": "Business hours if found or null",
  "services": ["List of services/products offered"],
  "scrapedAt": "${new Date().toISOString()}"
}

IMPORTANT RULES:
1. Extract real data from the website, don't make assumptions
2. For services, list specific offerings found on the site
3. Include all phone numbers and emails you find
4. If information isn't available, use null or empty arrays
5. Return ONLY the JSON object, no other text`;

    try {
        const response = await ai.models.generateContent({
            model: SCRAPER_MODEL,
            contents: [{ parts: [{ text: extractionPrompt }] }],
            config: {
                tools: [{ urlContext: {} }],
            },
        });

        // Extract text from response
        const responseText = response.text ||
            response.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('[GeminiUrlScraper] Raw response length:', responseText.length);

        // Parse JSON from response
        let scrapedData;
        try {
            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                scrapedData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('[GeminiUrlScraper] Failed to parse response:', parseError.message);
            console.error('[GeminiUrlScraper] Response was:', responseText.slice(0, 500));
            throw new Error('Failed to parse business data from website');
        }

        // Ensure required fields exist
        scrapedData.url = url;
        scrapedData.scrapedAt = scrapedData.scrapedAt || new Date().toISOString();
        scrapedData.metadata = scrapedData.metadata || {};
        scrapedData.contact = scrapedData.contact || {};
        scrapedData.services = scrapedData.services || [];
        scrapedData.structuredData = scrapedData.structuredData || [];

        console.log('[GeminiUrlScraper] Successfully scraped website:', {
            url,
            title: scrapedData.metadata?.title,
            servicesCount: scrapedData.services?.length || 0,
            hasContact: !!(scrapedData.contact?.phones?.length || scrapedData.contact?.emails?.length),
        });

        // Log URL context metadata if available
        if (response.candidates?.[0]?.urlContextMetadata) {
            console.log('[GeminiUrlScraper] URL Context metadata:',
                response.candidates[0].urlContextMetadata);
        }

        return scrapedData;
    } catch (error) {
        console.error('[GeminiUrlScraper] Error scraping website:', {
            url,
            error: error.message,
            code: error.code,
        });

        // Provide more helpful error messages
        if (error.message?.includes('API key')) {
            throw new Error('Gemini API key is invalid or not configured');
        }
        if (error.message?.includes('quota') || error.message?.includes('rate')) {
            throw new Error('Gemini API rate limit exceeded. Please try again later.');
        }
        if (error.message?.includes('blocked') || error.message?.includes('safety')) {
            throw new Error('Website content was blocked by safety filters');
        }

        throw new Error(`Failed to scrape website: ${error.message}`);
    }
};

module.exports = {
    scrapeWebsiteWithGemini,
};
