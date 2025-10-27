const OpenAI = require('openai');

const PROVIDERS = {
  OPENAI: 'openai',
  GROK: 'grok',
};

const resolveProvider = () => {
  const explicit = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (explicit) {
    if (explicit === PROVIDERS.GROK) {
      return PROVIDERS.GROK;
    }
    return PROVIDERS.OPENAI;
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

const getLLMClient = () => {
  const provider = resolveProvider();

  if (provider === PROVIDERS.GROK) {
    return createGrokClient();
  }

  return createOpenAIClient();
};

module.exports = {
  getLLMClient,
  PROVIDERS,
};
