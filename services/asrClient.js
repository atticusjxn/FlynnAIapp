/**
 * Speech-to-text for Flynn's voice command surface — Qwen on DashScope, the SAME
 * provider/key as the draft model (no second account, no upload step).
 *
 * DashScope's OpenAI-compatible mode has no /audio/transcriptions endpoint, but it
 * DOES accept inline base64 audio in a normal chat call to an omni model. We send
 * the clip as an `input_audio` content part and ask for a verbatim transcript.
 * Omni audio responses stream, so we accumulate the SSE deltas.
 *
 * Env (all optional — base URL + key fall back to the draft model's):
 *   ASR_BASE_URL  defaults to DRAFT_LLM_BASE_URL (DashScope compatible-mode)
 *   ASR_API_KEY   defaults to DRAFT_LLM_API_KEY
 *   ASR_MODEL     defaults to 'qwen3-omni-flash'
 *
 * Returns { text, provider, model }. Never throws on empty input.
 */

const deriveFormat = (mimeType) => {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('wav')) return 'wav';
  if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
  if (m.includes('m4a') || m.includes('mp4') || m.includes('aac')) return 'm4a';
  return 'wav';
};

/**
 * Transcribe a short audio clip to text.
 * @param {{buffer: Buffer, mimeType?: string, context?: string}} opts
 * @returns {Promise<{text: string, provider: string|null, model?: string}>}
 */
const transcribeAudio = async ({ buffer, mimeType, context } = {}) => {
  if (!buffer || !buffer.length) return { text: '', provider: null };

  const baseUrl = (process.env.ASR_BASE_URL || process.env.DRAFT_LLM_BASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const apiKey = (process.env.ASR_API_KEY || process.env.DRAFT_LLM_API_KEY || '').trim();
  const model = (process.env.ASR_MODEL || 'qwen3-omni-flash').trim();
  if (!baseUrl || !apiKey) {
    throw new Error('ASR not configured: set ASR_MODEL (+ ASR_BASE_URL/ASR_API_KEY, or rely on DRAFT_LLM_*)');
  }

  const format = deriveFormat(mimeType);
  const dataUri = `data:;base64,${buffer.toString('base64')}`;
  const instruction = context
    ? `Transcribe this audio to text verbatim. It may mention: ${context}. Output ONLY the transcript, no commentary or quotes.`
    : 'Transcribe this audio to text verbatim. Output ONLY the transcript, no commentary or quotes.';

  const body = {
    model,
    stream: true, // omni audio models stream their response on DashScope
    messages: [{
      role: 'user',
      content: [
        { type: 'input_audio', input_audio: { data: dataUri, format } },
        { type: 'text', text: instruction },
      ],
    }],
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    const error = new Error('[ASR] dashscope transcription failed');
    error.status = response.status;
    error.body = errorText;
    throw error;
  }

  // Accumulate streamed `delta.content` (string, or an array of {text} parts).
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let buf = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') {
          text += delta;
        } else if (Array.isArray(delta)) {
          for (const part of delta) {
            if (typeof part?.text === 'string') text += part.text;
          }
        }
      } catch (_) { /* keepalive / partial line — ignore */ }
    }
  }

  return { text: text.trim(), provider: 'dashscope', model };
};

module.exports = { transcribeAudio, deriveFormat };
