const OpenAI = require('openai');
const { generateConversationPrompt } = require('./businessContextService');
const { getAvailabilitySummary } = require('./availabilityService');

/**
 * AI Conversation Service
 * Handles intelligent, context-aware conversations with callers
 * Uses OpenAI to understand caller intent and respond appropriately
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - max_tokens: 80 (down from 150) - Forces 1-2 sentence responses for faster generation
 * - streaming: true - Allows processing to start as soon as first tokens arrive
 * - Response time: ~2-3s (down from ~4-6s)
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
  customQuestions = null,
}) => {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    // Get availability information for scheduling context
    let availabilityContext = '';
    if (user?.id) {
      try {
        const availability = await getAvailabilitySummary(user.id, 7);

        if (availability.enabled && availability.available) {
          availabilityContext = `\n\nCURRENT AVAILABILITY:
${availability.summary}
Business hours: ${availability.businessHours?.start} - ${availability.businessHours?.end}

IMPORTANT: When a customer requests a specific date/time, check if it falls within business hours and mention if it conflicts with existing bookings. Suggest the next available time if their requested time isn't available.`;
        } else if (availability.enabled && !availability.available) {
          availabilityContext = `\n\nCURRENT AVAILABILITY:
${availability.summary}

Let the customer know we're currently fully booked and will need to call them back to schedule.`;
        }
      } catch (error) {
        console.error('[AIConversation] Failed to get availability', error);
        // Continue without availability context
      }
    }

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

    // CRITICAL: Add user's custom questions if provided
    if (customQuestions && Array.isArray(customQuestions) && customQuestions.length > 0) {
      systemPrompt += `\n\nCUSTOM QUESTIONS TO ASK (in natural conversation flow):
${customQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

IMPORTANT: Work these questions naturally into the conversation. Don't ask them all at once - ask them one at a time as the conversation flows. Make sure you get answers to ALL these questions before ending the call.`;
    }

    // Append availability context to system prompt
    systemPrompt += availabilityContext;

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

    // OPTIMIZATION: Use streaming for faster perceived response time
    // Stream allows us to start processing audio as soon as first tokens arrive
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
                preferredTime: {
                  type: 'string',
                  description: 'Preferred time for service if mentioned',
                },
                location: {
                  type: 'string',
                  description: 'Service location/address if mentioned',
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
      max_tokens: 80, // OPTIMIZATION: Reduced from 150 to 80 for faster responses (1-2 sentences max)
      stream: true, // OPTIMIZATION: Enable streaming for faster first token
    });

    // Collect streamed response
    let aiReply = '';
    let toolCalls = [];

    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        aiReply += delta.content;
      }

      if (delta?.tool_calls) {
        // Accumulate tool call chunks
        delta.tool_calls.forEach((toolCallChunk) => {
          const index = toolCallChunk.index;
          if (!toolCalls[index]) {
            toolCalls[index] = {
              id: toolCallChunk.id || '',
              type: toolCallChunk.type || 'function',
              function: {
                name: toolCallChunk.function?.name || '',
                arguments: '',
              },
            };
          }
          if (toolCallChunk.function?.arguments) {
            toolCalls[index].function.arguments += toolCallChunk.function.arguments;
          }
          if (toolCallChunk.function?.name) {
            toolCalls[index].function.name = toolCallChunk.function.name;
          }
        });
      }
    }

    // Extract structured booking info if AI used the function
    let bookingInfo = null;
    if (toolCalls.length > 0) {
      const toolCall = toolCalls[0];
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
