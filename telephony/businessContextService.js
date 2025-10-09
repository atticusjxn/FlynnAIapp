const OpenAI = require('openai');

/**
 * Business Context Service
 * Searches for businesses and extracts business information
 * from Google Business Profile for AI receptionist conversations
 */

let openaiClient = null;

const getOpenAIClient = () => {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
};

/**
 * Search for businesses using Google Places API Text Search
 * Returns a list of potential matches for the user to select from
 */
const searchBusinesses = async (businessName, location = '', latitude = null, longitude = null) => {
  const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!googlePlacesApiKey) {
    console.error('[BusinessSearch] GOOGLE_PLACES_API_KEY not configured');
    throw new Error('Google Places API key not configured. Please add GOOGLE_PLACES_API_KEY to your .env file.');
  }

  try {
    // Build search query
    const searchQuery = location
      ? `${businessName} ${location}`
      : businessName;

    console.log('[BusinessSearch] Searching for:', searchQuery);

    // Build API URL with location bias if coordinates provided
    let apiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${googlePlacesApiKey}`;

    if (latitude && longitude) {
      // Add location bias to prioritize nearby results
      apiUrl += `&location=${latitude},${longitude}&radius=50000`; // 50km radius
      console.log('[BusinessSearch] Using location bias:', { latitude, longitude });
    }

    // Call Google Places API
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BusinessSearch] Google Places API error:', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[BusinessSearch] API returned error status:', data.status);
      throw new Error(`Google Places API error: ${data.status}`);
    }

    // Transform results to our format
    const businesses = (data.results || []).slice(0, 5).map(place => ({
      name: place.name,
      address: place.formatted_address,
      rating: place.rating,
      reviewCount: place.user_ratings_total,
      businessType: place.types?.[0]?.replace(/_/g, ' '),
      placeId: place.place_id,
      location: place.geometry?.location,
      // Construct Google Maps URL
      url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
    }));

    console.log('[BusinessSearch] Found', businesses.length, 'businesses');

    return businesses;
  } catch (error) {
    console.error('[BusinessSearch] Failed to search businesses:', error);
    throw error;
  }
};

/**
 * Fetch and parse business context from a Google Business Profile URL
 * Uses web scraping + OpenAI to extract structured business information
 */
const extractBusinessContext = async (businessProfileUrl) => {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    console.log('[BusinessContext] Fetching business profile:', businessProfileUrl);

    // Fetch the public business profile page
    const response = await fetch(businessProfileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch business profile: ${response.status}`);
    }

    const html = await response.text();

    // Use OpenAI to extract structured business information from the HTML
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a business information extraction assistant. Extract key details from a Google Business Profile page HTML and return them as structured JSON.

Extract the following information:
- businessName: The name of the business
- businessType: Type/category of business (e.g., "Construction", "Plumbing", "Beauty Salon")
- description: Short description of what the business does
- services: Array of services offered (be comprehensive)
- specialties: Specific areas of expertise or specialty services
- hoursOfOperation: Business hours if available
- serviceArea: Geographic areas served
- yearsInBusiness: How long they've been operating (if mentioned)
- certifications: Any certifications, licenses, or credentials mentioned

Return ONLY valid JSON with these fields. If information is not available, use null or empty array.`,
        },
        {
          role: 'user',
          content: `Extract business information from this Google Business Profile HTML:\n\n${html.substring(0, 50000)}`, // Limit to 50k chars to avoid token limits
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const businessContext = JSON.parse(completion.choices[0].message.content);

    console.log('[BusinessContext] Extracted context:', {
      businessName: businessContext.businessName,
      businessType: businessContext.businessType,
      servicesCount: businessContext.services?.length || 0,
    });

    return {
      ...businessContext,
      lastUpdated: new Date().toISOString(),
      sourceUrl: businessProfileUrl,
    };
  } catch (error) {
    console.error('[BusinessContext] Failed to extract business context:', error);
    throw error;
  }
};

/**
 * Generate a conversational AI prompt incorporating business context
 * This prompt helps the AI answer customer questions intelligently
 */
const generateConversationPrompt = (businessContext) => {
  if (!businessContext || !businessContext.businessName) {
    return null;
  }

  const {
    businessName,
    businessType,
    description,
    services = [],
    specialties = [],
    hoursOfOperation,
    serviceArea,
  } = businessContext;

  return `You are an AI receptionist for ${businessName}, a ${businessType || 'service business'}.

BUSINESS OVERVIEW:
${description || 'A professional service provider.'}

SERVICES OFFERED:
${services.length > 0 ? services.map(s => `- ${s}`).join('\n') : 'General services in our industry.'}

${specialties.length > 0 ? `SPECIALTIES:\n${specialties.map(s => `- ${s}`).join('\n')}\n` : ''}

${hoursOfOperation ? `HOURS:\n${hoursOfOperation}\n` : ''}

${serviceArea ? `SERVICE AREA:\n${serviceArea}\n` : ''}

YOUR ROLE:
- Answer customer questions about services professionally and accurately
- If asked about a service we offer, confirm and briefly explain
- If asked about something we don't offer, politely decline and suggest what we do offer
- Be friendly, helpful, and professional
- Keep responses concise (1-2 sentences max)
- Always aim to book an appointment or gather contact details

CONVERSATION GOALS:
1. Understand what the customer needs
2. Confirm if we can help them
3. Get their name and contact information
4. Schedule or promise a callback

Remember: You represent ${businessName}. Be knowledgeable, helpful, and aim to convert every inquiry into a booking.`;
};

module.exports = {
  searchBusinesses,
  extractBusinessContext,
  generateConversationPrompt,
};
