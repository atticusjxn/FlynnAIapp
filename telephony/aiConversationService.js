const OpenAI = require('openai');
const { generateConversationPrompt } = require('./businessContextService');

/**
 * AI Conversation Service
 * Handles intelligent, context-aware conversations with callers
 * Uses OpenAI to understand caller intent and respond appropriately
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
 * Process caller's speech and generate intelligent AI response
 * Considers business context and conversation history
 */
const processCallerMessage = async ({
  callerMessage,
  conversationHistory = [],
  businessContext = null,
  user = null,
}) => {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    // Build system prompt with business context
    let systemPrompt = generateConversationPrompt(businessContext);

    if (!systemPrompt) {
      // Fallback if no business context available
      const businessName = user?.business_name || user?.email?.split('@')[0] || 'our business';
      systemPrompt = `You are an AI receptionist for ${businessName}.

YOUR ROLE:
- Answer customer questions professionally and helpfully
- Gather essential information: customer name, phone number, and service needed
- Be friendly, concise (1-2 sentences), and professional
- Always aim to book an appointment or schedule a callback

CONVERSATION GOALS:
1. Understand what the customer needs
2. Get their name and contact information
3. Confirm we can help them
4. Schedule or promise a callback`;
    }

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: callerMessage },
    ];

    console.log('[AIConversation] Processing message:', {
      callerMessage,
      historyLength: conversationHistory.length,
      hasBusinessContext: !!businessContext,
    });

    // Get AI response using function calling to extract structured data
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_booking_info',
            description: 'Extract booking information from the conversation when available',
            parameters: {
              type: 'object',
              properties: {
                customerName: {
                  type: 'string',
                  description: 'Customer full name',
                },
                phoneNumber: {
                  type: 'string',
                  description: 'Customer phone number',
                },
                serviceRequested: {
                  type: 'string',
                  description: 'Service or job the customer is requesting',
                },
                preferredDate: {
                  type: 'string',
                  description: 'Preferred date for service if mentioned',
                },
                urgency: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'emergency'],
                  description: 'Urgency level of the request',
                },
                additionalNotes: {
                  type: 'string',
                  description: 'Any additional relevant information',
                },
              },
            },
          },
        },
      ],
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 150, // Keep responses concise for phone calls
    });

    const response = completion.choices[0].message;
    const aiReply = response.content || '';

    // Extract structured booking info if AI used the function
    let bookingInfo = null;
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolCall = response.tool_calls[0];
      if (toolCall.function.name === 'extract_booking_info') {
        try {
          bookingInfo = JSON.parse(toolCall.function.arguments);
          console.log('[AIConversation] Extracted booking info:', bookingInfo);
        } catch (e) {
          console.error('[AIConversation] Failed to parse booking info:', e);
        }
      }
    }

    // Determine if we have enough information to complete the conversation
    const hasRequiredInfo = bookingInfo &&
      bookingInfo.customerName &&
      (bookingInfo.phoneNumber || bookingInfo.serviceRequested);

    return {
      aiReply,
      bookingInfo,
      shouldContinue: !hasRequiredInfo,
      conversationComplete: hasRequiredInfo,
    };
  } catch (error) {
    console.error('[AIConversation] Error processing message:', error);
    throw error;
  }
};

/**
 * Generate appropriate next question based on conversation state
 * Falls back to this if AI doesn't naturally ask for required info
 */
const getNextQuestion = (bookingInfo = {}) => {
  if (!bookingInfo.customerName) {
    return "May I have your name, please?";
  }
  if (!bookingInfo.phoneNumber) {
    return "And what's the best phone number to reach you?";
  }
  if (!bookingInfo.serviceRequested) {
    return "What service can we help you with today?";
  }
  return null; // All required info collected
};

/**
 * Generate a closing message once all info is collected
 */
const generateClosingMessage = (bookingInfo, businessContext) => {
  const businessName = businessContext?.businessName || 'our team';
  const customerName = bookingInfo?.customerName?.split(' ')[0] || 'there';

  return `Thank you, ${customerName}! Someone from ${businessName} will be in touch shortly to confirm your booking. Have a great day!`;
};

module.exports = {
  processCallerMessage,
  getNextQuestion,
  generateClosingMessage,
};
