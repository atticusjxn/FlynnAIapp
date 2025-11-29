const OpenAI = require('openai');

/**
 * Business Profile Generator Service
 * Uses LLM to extract business information and generate AI receptionist content
 * from scraped website data
 */

// Determine which LLM provider to use
const ACTIVE_LLM_PROVIDER = (() => {
  const explicit = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  return (process.env.XAI_API_KEY || process.env.GROK_API_KEY) ? 'grok' : 'openai';
})();

const PROFILE_GENERATION_MODEL = process.env.PROFILE_GENERATION_MODEL
  || (ACTIVE_LLM_PROVIDER === 'grok' ? 'grok-2-1212' : 'gpt-4o-mini');

// Initialize LLM client
const llmClient = (() => {
  if (ACTIVE_LLM_PROVIDER === 'grok') {
    return new OpenAI({
      apiKey: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    });
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
})();

/**
 * Generate business profile from scraped website data
 */
const generateBusinessProfile = async (scrapedData) => {
  console.log('[BusinessProfileGenerator] Generating business profile from scraped data');

  const systemPrompt = `You are a business analysis expert. Extract key business information from website content.

IMPORTANT: Many modern websites use client-side rendering, so the main content may be minimal.
In these cases, PRIORITIZE the metadata (title, description, keywords) and structured data to extract information.

Analyze the provided website data and extract:
1. Business name and legal name (if different)
2. A compelling headline (one sentence that captures what they do)
3. A 2-3 sentence description of the business
4. List of services offered (each as a short phrase)
5. Brand voice characteristics (professional/casual, warm/formal, technical/simple, etc.)
6. Target audience (who they serve)
7. Key value propositions (what makes them special)

Return ONLY valid JSON with this structure:
{
  "public_name": "Business Name",
  "legal_name": "Legal Name (or same as public_name)",
  "headline": "One sentence describing the business",
  "description": "2-3 sentences about the business",
  "services": ["Service 1", "Service 2", ...],
  "brand_voice": {
    "tone": "professional|casual|friendly|technical",
    "formality": "formal|neutral|informal",
    "personality": "warm|efficient|authoritative|approachable",
    "characteristics": ["characteristic1", "characteristic2"]
  },
  "target_audience": "Who they serve",
  "value_propositions": ["Value prop 1", "Value prop 2", ...]
}`;

  const userPrompt = `Website URL: ${scrapedData.url}

METADATA (High Priority):
Title: ${scrapedData.metadata?.title || 'N/A'}
Description: ${scrapedData.metadata?.description || 'N/A'}
Keywords: ${scrapedData.metadata?.keywords || 'N/A'}
Site Name: ${scrapedData.metadata?.siteName || 'N/A'}

STRUCTURED DATA:
${scrapedData.structuredData ? JSON.stringify(scrapedData.structuredData, null, 2) : 'None'}

SERVICES FOUND:
${scrapedData.services?.join(', ') || 'None'}

CONTACT INFO:
${JSON.stringify(scrapedData.contact, null, 2)}

BUSINESS HOURS:
${scrapedData.businessHours || 'Not specified'}

PAGE CONTENT (may be minimal if JS-rendered):
${scrapedData.content?.slice(0, 2000) || 'Minimal content - relying on metadata'}

Extract business profile information and return as JSON. If content is minimal, rely heavily on metadata and keywords.`;

  try {
    const completion = await llmClient.chat.completions.create({
      model: PROFILE_GENERATION_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    const content = completion?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM returned empty response');
    }

    const profile = JSON.parse(content);

    console.log('[BusinessProfileGenerator] Generated business profile:', {
      businessName: profile.public_name,
      servicesCount: profile.services?.length || 0,
      tone: profile.brand_voice?.tone,
    });

    return profile;
  } catch (error) {
    console.error('[BusinessProfileGenerator] Failed to generate business profile:', {
      error: error.message,
    });
    throw new Error(`Failed to generate business profile: ${error.message}`);
  }
};

/**
 * Generate AI receptionist greeting script
 */
const generateGreetingScript = async (businessProfile, scrapedData) => {
  console.log('[BusinessProfileGenerator] Generating greeting script');

  const systemPrompt = `You are an expert at writing friendly, professional phone greetings for business AI receptionists.

Create a natural, conversational greeting script (2-3 sentences max) that:
- Welcomes the caller warmly
- States the business name clearly
- Offers to help
- Matches the business's brand voice
- Is appropriate for phone delivery (no complex words, natural pauses)

The greeting should sound like a real human receptionist, not robotic or overly formal.

Return ONLY the greeting script text, nothing else.`;

  const userPrompt = `Business Name: ${businessProfile.public_name}
Headline: ${businessProfile.headline}
Description: ${businessProfile.description}
Brand Voice: ${businessProfile.brand_voice.tone}, ${businessProfile.brand_voice.personality}
Target Audience: ${businessProfile.target_audience}

Generate a greeting script for this business's AI receptionist.`;

  try {
    const completion = await llmClient.chat.completions.create({
      model: PROFILE_GENERATION_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const greeting = completion?.choices?.[0]?.message?.content?.trim();
    if (!greeting) {
      throw new Error('LLM returned empty greeting');
    }

    console.log('[BusinessProfileGenerator] Generated greeting:', {
      length: greeting.length,
      preview: greeting.slice(0, 50),
    });

    return greeting;
  } catch (error) {
    console.error('[BusinessProfileGenerator] Failed to generate greeting:', {
      error: error.message,
    });
    throw new Error(`Failed to generate greeting: ${error.message}`);
  }
};

/**
 * Generate intake questions for AI receptionist
 */
const generateIntakeQuestions = async (businessProfile, scrapedData) => {
  console.log('[BusinessProfileGenerator] Generating intake questions');

  const systemPrompt = `You are an expert at designing customer intake questions for service businesses.

Create 4-6 essential questions the AI receptionist should ask to capture all the information needed to help the customer and create a job/appointment.

Questions should:
- Be conversational and natural (for phone conversation)
- Be open-ended when appropriate
- Gather critical information (name, contact, service needed, location, timeline, urgency)
- Match the business's services and brand voice
- Be in a logical order (start with basics, then specifics)

Return ONLY valid JSON array of question strings:
["Question 1?", "Question 2?", ...]`;

  const userPrompt = `Business: ${businessProfile.public_name}
Services: ${businessProfile.services.join(', ')}
Target Audience: ${businessProfile.target_audience}
Brand Voice: ${businessProfile.brand_voice.tone}

Generate intake questions for this business's AI receptionist.`;

  try {
    const completion = await llmClient.chat.completions.create({
      model: PROFILE_GENERATION_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
    });

    const content = completion?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM returned empty response');
    }

    let questions;
    try {
      // Try parsing as JSON object first
      const parsed = JSON.parse(content);
      questions = parsed.questions || parsed.intake_questions || Object.values(parsed);
    } catch {
      // If that fails, try extracting array
      const arrayMatch = content.match(/\[.*\]/s);
      if (arrayMatch) {
        questions = JSON.parse(arrayMatch[0]);
      } else {
        throw new Error('Could not parse questions from LLM response');
      }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('LLM returned invalid questions format');
    }

    console.log('[BusinessProfileGenerator] Generated intake questions:', {
      count: questions.length,
    });

    return questions;
  } catch (error) {
    console.error('[BusinessProfileGenerator] Failed to generate questions:', {
      error: error.message,
    });
    throw new Error(`Failed to generate intake questions: ${error.message}`);
  }
};

/**
 * Generate complete AI receptionist configuration from website
 */
const generateReceptionistConfig = async (scrapedData) => {
  console.log('[BusinessProfileGenerator] Generating complete receptionist config');

  try {
    // Step 1: Generate business profile
    const businessProfile = await generateBusinessProfile(scrapedData);

    // Step 2: Generate greeting script
    const greetingScript = await generateGreetingScript(businessProfile, scrapedData);

    // Step 3: Generate intake questions
    const intakeQuestions = await generateIntakeQuestions(businessProfile, scrapedData);

    const config = {
      businessProfile,
      greetingScript,
      intakeQuestions,
      generatedAt: new Date().toISOString(),
    };

    console.log('[BusinessProfileGenerator] Successfully generated complete config:', {
      businessName: businessProfile.public_name,
      greetingLength: greetingScript.length,
      questionsCount: intakeQuestions.length,
    });

    return config;
  } catch (error) {
    console.error('[BusinessProfileGenerator] Failed to generate receptionist config:', {
      error: error.message,
    });
    throw error;
  }
};

module.exports = {
  generateBusinessProfile,
  generateGreetingScript,
  generateIntakeQuestions,
  generateReceptionistConfig,
};
