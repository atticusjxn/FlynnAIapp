const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const PROVIDERS = {
  OPENAI: 'openai',
  GROK: 'grok',
  GEMINI: 'gemini',
};

const resolveProvider = () => {
  const explicit = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (explicit) {
    if (explicit === PROVIDERS.GROK) {
      return PROVIDERS.GROK;
    }
    if (explicit === PROVIDERS.GEMINI) {
      return PROVIDERS.GEMINI;
    }
    return PROVIDERS.OPENAI;
  }

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return PROVIDERS.GEMINI;
  }

  if (process.env.XAI_API_KEY || process.env.GROK_API_KEY) {
    return PROVIDERS.GROK;
  }

  return PROVIDERS.OPENAI;
};

const normaliseChatResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload.choices)) {
    return payload;
  }

  if (payload.output && Array.isArray(payload.output.choices)) {
    return {
      ...payload,
      choices: payload.output.choices,
    };
  }

  if (Array.isArray(payload.data) && !payload.choices) {
    return {
      ...payload,
      choices: payload.data,
    };
  }

  return payload;
};

const mapChatRequest = (request = {}) => {
  const mapped = { ...request };

  if (mapped.max_tokens && !mapped.max_output_tokens) {
    mapped.max_output_tokens = mapped.max_tokens;
  }

  if (!mapped.max_output_tokens && typeof process.env.GROK_DEFAULT_MAX_OUTPUT === 'string') {
    const parsed = Number.parseInt(process.env.GROK_DEFAULT_MAX_OUTPUT, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      mapped.max_output_tokens = parsed;
    }
  }

  if (mapped.response_format && mapped.response_format.type === 'json_object') {
    mapped.response_format = { type: 'json_object' };
  }

  return mapped;
};

const createGrokClient = () => {
  const apiKey = (process.env.XAI_API_KEY || process.env.GROK_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Grok client requested but XAI_API_KEY/GROK_API_KEY is not configured.');
  }

  const baseUrl = (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');

  const commonHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const chat = {
    completions: {
      create: async (request = {}) => {
        const body = mapChatRequest({
          model: request.model || process.env.GROK_CHAT_MODEL || 'grok-4-fast',
          ...request,
        });

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const error = new Error('[Grok] Chat completion failed');
          error.status = response.status;
          error.body = errorText;
          throw error;
        }

        const json = await response.json();
        return normaliseChatResponse(json);
      },
    },
  };

  const audio = {
    transcriptions: {
      create: async () => {
        throw new Error('Grok client does not implement audio.transcriptions.create.');
      },
    },
  };

  return {
    provider: PROVIDERS.GROK,
    chat,
    audio,
  };
};

const createOpenAIClient = () => {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('OpenAI client requested but OPENAI_API_KEY is not configured.');
  }

  const client = new OpenAI({ apiKey });
  return Object.assign(client, { provider: PROVIDERS.OPENAI });
};

const createGeminiClient = () => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Gemini client requested but GEMINI_API_KEY/GOOGLE_API_KEY is not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const defaultModel = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

  // Map model names to Gemini models
  const mapModelName = (modelName) => {
    if (!modelName || typeof modelName !== 'string') {
      return defaultModel;
    }

    // If it's already a gemini model, use it
    if (modelName.startsWith('gemini-')) {
      return modelName;
    }

    // Map other providers' models to appropriate Gemini models
    if (modelName.includes('gpt-4') || modelName.includes('grok') || modelName.includes('claude')) {
      return defaultModel; // Use gemini-2.5-flash as default
    }

    // Default fallback
    return defaultModel;
  };

  // Create OpenAI-compatible interface for Gemini
  const chat = {
    completions: {
      create: async (request = {}) => {
        const requestedModel = request.model || defaultModel;
        const geminiModel = mapModelName(requestedModel);

        // Handle JSON response format for Gemini
        const generationConfig = {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.max_tokens ?? 2048,
          topP: request.top_p ?? 1,
        };

        // Gemini uses responseMimeType instead of response_format
        if (request.response_format?.type === 'json_object') {
          generationConfig.responseMimeType = 'application/json';
        }

        const model = genAI.getGenerativeModel({
          model: geminiModel,
          generationConfig,
        });

        // Convert OpenAI-style messages to Gemini format
        const messages = request.messages || [];
        const history = [];
        const systemInstructions = [];

        for (const msg of messages) {
          if (msg.role === 'system') {
            systemInstructions.push(msg.content);
          } else if (msg.role === 'user') {
            history.push({
              role: 'user',
              parts: [{ text: msg.content }],
            });
          } else if (msg.role === 'assistant') {
            history.push({
              role: 'model',
              parts: [{ text: msg.content }],
            });
          }
        }

        // Gemini requires first message in history to be 'user'
        // If history starts with 'model', we need to handle it differently
        let chatHistory = history.slice(0, -1); // All but the last message
        let userPrompt = '';

        const lastMessage = history[history.length - 1];

        // If last message is user, that's what we'll send
        if (lastMessage?.role === 'user') {
          userPrompt = lastMessage.parts[0].text;
        } else {
          // If last message is model (shouldn't happen in normal flow), use empty string
          userPrompt = '';
        }

        // If chat history starts with 'model', remove leading model messages
        while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
          chatHistory.shift();
        }

        // Start chat session
        const systemInstructionText = systemInstructions.length > 0
          ? systemInstructions.join('\n\n')
          : undefined;

        // Gemini requires systemInstruction as object with parts, not plain string
        const systemInstructionConfig = systemInstructionText
          ? { parts: [{ text: systemInstructionText }] }
          : undefined;

        const chat = model.startChat({
          history: chatHistory,
          ...(systemInstructionConfig && { systemInstruction: systemInstructionConfig }),
        });

        // Send message and get response
        const result = await chat.sendMessage(userPrompt);
        const response = result.response;
        const text = response.text();

        // Return in OpenAI format
        return {
          id: `gemini-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: geminiModel,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: text,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        };
      },
    },
  };

  const audio = {
    transcriptions: {
      create: async () => {
        throw new Error('Gemini client does not implement audio.transcriptions.create. Use OpenAI or Deepgram for transcription.');
      },
    },
  };

  return {
    provider: PROVIDERS.GEMINI,
    chat,
    audio,
  };
};

const getLLMClient = () => {
  const provider = resolveProvider();

  if (provider === PROVIDERS.GROK) {
    return createGrokClient();
  }

  if (provider === PROVIDERS.GEMINI) {
    return createGeminiClient();
  }

  return createOpenAIClient();
};

module.exports = {
  getLLMClient,
  PROVIDERS,
};
