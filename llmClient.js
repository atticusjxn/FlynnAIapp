const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const PROVIDERS = {
  OPENAI: 'openai',
  GROK: 'grok',
  GEMINI: 'gemini',
  ANTHROPIC: 'anthropic',
  COMPATIBLE: 'compatible',
};

const resolveProvider = () => {
  const explicit = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (explicit) {
    if (explicit === PROVIDERS.COMPATIBLE || explicit === 'draft') {
      return PROVIDERS.COMPATIBLE;
    }
    if (explicit === PROVIDERS.ANTHROPIC || explicit === 'claude') {
      return PROVIDERS.ANTHROPIC;
    }
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

/**
 * Anthropic (Claude) client.
 *
 * Implemented over fetch (like the Grok client) so there's no hard SDK
 * dependency. Exposes an OpenAI-compatible `chat.completions.create` so existing
 * callers keep reading `choices[0].message.content`, plus:
 *  - prompt caching: pass `cacheSystem: true` to mark the system prefix with
 *    `cache_control: { type: 'ephemeral' }` (business brain + tone samples are
 *    stable across a thread, so this is a big latency/cost win).
 *  - streaming: `messages.stream(request)` returns the raw fetch Response whose
 *    body is the Anthropic SSE stream, for endpoints that want to stream drafts.
 */
const createAnthropicClient = () => {
  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Anthropic client requested but ANTHROPIC_API_KEY/CLAUDE_API_KEY is not configured.');
  }

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  const defaultModel = process.env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-4-6';

  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
  };

  // Map model names from other providers onto a Claude model.
  const mapModelName = (modelName) => {
    if (modelName && typeof modelName === 'string' && modelName.startsWith('claude')) {
      return modelName;
    }
    return defaultModel;
  };

  // Convert an OpenAI-style request into an Anthropic Messages request.
  const buildBody = (request = {}, { stream = false } = {}) => {
    const messages = Array.isArray(request.messages) ? request.messages : [];

    // System messages become Anthropic's top-level `system` (array of blocks so
    // we can attach cache_control). Everything else maps to user/assistant turns.
    const systemTexts = [];
    const convo = [];
    for (const msg of messages) {
      if (!msg || typeof msg.content !== 'string') continue;
      if (msg.role === 'system') {
        systemTexts.push(msg.content);
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        // Merge consecutive same-role turns (Anthropic requires alternation).
        const last = convo[convo.length - 1];
        if (last && last.role === msg.role) {
          last.content += `\n\n${msg.content}`;
        } else {
          convo.push({ role: msg.role, content: msg.content });
        }
      }
    }

    let system;
    if (systemTexts.length > 0) {
      const block = { type: 'text', text: systemTexts.join('\n\n') };
      if (request.cacheSystem) {
        block.cache_control = { type: 'ephemeral' };
      }
      system = [block];
    }

    const maxTokens = request.max_tokens || request.max_output_tokens || 1024;

    const body = {
      model: mapModelName(request.model),
      max_tokens: maxTokens,
      messages: convo.length > 0 ? convo : [{ role: 'user', content: '' }],
    };
    if (system) body.system = system;
    if (typeof request.temperature === 'number') body.temperature = request.temperature;
    if (typeof request.top_p === 'number') body.top_p = request.top_p;
    if (stream) body.stream = true;
    return body;
  };

  const toOpenAIShape = (json) => {
    const text = Array.isArray(json.content)
      ? json.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      : '';
    return {
      id: json.id || `anthropic-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: json.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: json.stop_reason === 'max_tokens' ? 'length' : 'stop',
        },
      ],
      usage: {
        prompt_tokens: json.usage?.input_tokens ?? 0,
        completion_tokens: json.usage?.output_tokens ?? 0,
        total_tokens: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
        cache_read_input_tokens: json.usage?.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: json.usage?.cache_creation_input_tokens ?? 0,
      },
    };
  };

  const chat = {
    completions: {
      create: async (request = {}) => {
        const response = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(buildBody(request)),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const error = new Error('[Anthropic] Message completion failed');
          error.status = response.status;
          error.body = errorText;
          throw error;
        }

        const json = await response.json();
        return toOpenAIShape(json);
      },
    },
  };

  // Raw streaming: returns the fetch Response so the caller can pipe the SSE body.
  const messages = {
    stream: async (request = {}) => {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildBody(request, { stream: true })),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const error = new Error('[Anthropic] Streaming message failed');
        error.status = response.status;
        error.body = errorText;
        throw error;
      }

      return response;
    },
  };

  const audio = {
    transcriptions: {
      create: async () => {
        throw new Error('Anthropic client does not implement audio.transcriptions.create.');
      },
    },
  };

  return {
    provider: PROVIDERS.ANTHROPIC,
    chat,
    messages,
    audio,
  };
};

/**
 * Generic OpenAI-compatible client.
 *
 * Almost every cheap/fast inference host (Groq, Alibaba DashScope/Qwen, DeepSeek,
 * OpenRouter, Together, Fireworks, Cerebras, ...) exposes an OpenAI-compatible
 * `/chat/completions` endpoint. This one client targets any of them via config,
 * so the drafting model is a swap (env var), not a rewrite — letting us A/B
 * naturalness/cost without touching code.
 *
 * Config precedence: explicit opts -> env. Env vars (DRAFT_* preferred so the
 * cheap drafting model is independent of the telephony LLM):
 *   DRAFT_LLM_BASE_URL  (e.g. https://openrouter.ai/api/v1,
 *                        https://api.groq.com/openai/v1,
 *                        https://dashscope-intl.aliyuncs.com/compatible-mode/v1)
 *   DRAFT_LLM_API_KEY
 *   DRAFT_LLM_MODEL     (e.g. a cheap fast chat model id for the chosen host)
 */
const createCompatibleClient = (opts = {}) => {
  const baseUrl = (opts.baseUrl || process.env.DRAFT_LLM_BASE_URL || process.env.COMPAT_LLM_BASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const apiKey = (opts.apiKey || process.env.DRAFT_LLM_API_KEY || process.env.COMPAT_LLM_API_KEY || '').trim();
  const defaultModel = (opts.model || process.env.DRAFT_LLM_MODEL || process.env.COMPAT_LLM_MODEL || '').trim();

  if (!baseUrl) {
    throw new Error('OpenAI-compatible client requested but DRAFT_LLM_BASE_URL is not configured.');
  }
  if (!apiKey) {
    throw new Error('OpenAI-compatible client requested but DRAFT_LLM_API_KEY is not configured.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  // OpenRouter is happiest with these (optional elsewhere, harmless).
  if (process.env.DRAFT_LLM_REFERER) headers['HTTP-Referer'] = process.env.DRAFT_LLM_REFERER;
  if (process.env.DRAFT_LLM_TITLE) headers['X-Title'] = process.env.DRAFT_LLM_TITLE;

  const buildBody = (request = {}, { stream = false } = {}) => {
    const body = {
      model: request.model || defaultModel,
      messages: request.messages || [],
    };
    if (typeof request.temperature === 'number') body.temperature = request.temperature;
    if (typeof request.top_p === 'number') body.top_p = request.top_p;
    if (request.max_tokens || request.max_output_tokens) {
      body.max_tokens = request.max_tokens || request.max_output_tokens;
    }
    if (request.response_format) body.response_format = request.response_format;
    // Provider-specific passthroughs. Qwen (DashScope) hybrid-thinking models need
    // enable_thinking:false for low latency; merge any other extra fields too.
    if (typeof request.enable_thinking === 'boolean') body.enable_thinking = request.enable_thinking;
    if (request.extra_body && typeof request.extra_body === 'object') {
      Object.assign(body, request.extra_body);
    }
    if (stream) body.stream = true;
    return body;
  };

  const chat = {
    completions: {
      create: async (request = {}) => {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(buildBody(request)),
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const error = new Error('[CompatibleLLM] Chat completion failed');
          error.status = response.status;
          error.body = errorText;
          throw error;
        }
        return normaliseChatResponse(await response.json());
      },
      // Raw streaming: returns the fetch Response so the caller can pipe the SSE body.
      stream: async (request = {}) => {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(buildBody(request, { stream: true })),
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const error = new Error('[CompatibleLLM] Streaming chat failed');
          error.status = response.status;
          error.body = errorText;
          throw error;
        }
        return response;
      },
    },
  };

  const audio = {
    transcriptions: {
      create: async () => {
        throw new Error('OpenAI-compatible client does not implement audio.transcriptions.create.');
      },
    },
  };

  return {
    provider: PROVIDERS.COMPATIBLE,
    model: defaultModel,
    baseUrl,
    chat,
    audio,
  };
};

const getLLMClient = (providerOverride) => {
  const provider = (providerOverride || '').trim().toLowerCase() || resolveProvider();

  if (provider === PROVIDERS.COMPATIBLE || provider === 'draft') {
    return createCompatibleClient();
  }

  if (provider === PROVIDERS.ANTHROPIC || provider === 'claude') {
    return createAnthropicClient();
  }

  if (provider === PROVIDERS.GROK) {
    return createGrokClient();
  }

  if (provider === PROVIDERS.GEMINI) {
    return createGeminiClient();
  }

  if (provider === PROVIDERS.OPENAI) {
    return createOpenAIClient();
  }

  return createOpenAIClient();
};

module.exports = {
  getLLMClient,
  PROVIDERS,
};
