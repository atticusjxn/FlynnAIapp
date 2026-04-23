/**
 * Cartesia Sonic-3 TTS client.
 *
 * Two entry points:
 *
 *   1. `synthesizeToBuffer(text, opts)` — one-shot REST synthesis used for
 *      pre-generating IVR greeting audio (uploaded to Supabase Storage, then
 *      played via `telnyx.playAudio(ivr_greeting_audio_url)`).
 *
 *   2. `openStream(opts)` — realtime WebSocket streaming used by the Mode B
 *      AI receptionist (Deepgram Voice Agent BYO-TTS path). Returns a minimal
 *      `{ sendText, close, onAudio }` API; chunks come back raw PCM by default.
 *
 * Env:
 *   CARTESIA_API_KEY
 *   CARTESIA_VERSION             default 2024-11-13
 *   CARTESIA_VOICE_AU_MALE       UUID of Cartesia "Australian Man"
 *   CARTESIA_VOICE_AU_FEMALE     UUID of Cartesia "Australian Woman"
 */

const WebSocket = require('ws');
const crypto = require('crypto');

const CARTESIA_REST = 'https://api.cartesia.ai';
const CARTESIA_WS = 'wss://api.cartesia.ai/tts/websocket';

function version() {
  return process.env.CARTESIA_VERSION || '2024-11-13';
}

function authHeaders() {
  const key = process.env.CARTESIA_API_KEY;
  if (!key) throw new Error('CARTESIA_API_KEY is not set');
  return {
    'X-API-Key': key,
    'Cartesia-Version': version(),
    'Content-Type': 'application/json',
  };
}

function resolveVoiceId(gender) {
  const g = (gender || 'female').toLowerCase();
  const id =
    g === 'male'
      ? process.env.CARTESIA_VOICE_AU_MALE
      : process.env.CARTESIA_VOICE_AU_FEMALE;
  if (!id) throw new Error(`CARTESIA_VOICE_AU_${g.toUpperCase()} is not set`);
  return id;
}

// ---------------------------------------------------------------------------
// One-shot REST synthesis
// ---------------------------------------------------------------------------

/**
 * Synthesize `text` and return audio bytes as a Buffer.
 *
 * @param {string} text
 * @param {object} opts
 * @param {string} [opts.voiceId]        — explicit Cartesia voice UUID
 * @param {'male'|'female'} [opts.gender] — used when voiceId is omitted
 * @param {'mp3'|'wav'|'pcm_s16le'} [opts.format='mp3']
 * @param {number} [opts.sampleRate=24000]
 * @param {string} [opts.modelId='sonic-english'] — Cartesia model family; use 'sonic-multilingual' for non-English
 */
async function synthesizeToBuffer(text, opts = {}) {
  const format = opts.format || 'mp3';
  const voiceId = opts.voiceId || resolveVoiceId(opts.gender);
  const modelId = opts.modelId || 'sonic-english';
  const sampleRate = opts.sampleRate || 24000;

  const outputFormat =
    format === 'mp3'
      ? { container: 'mp3', encoding: 'mp3', sample_rate: sampleRate }
      : format === 'wav'
        ? { container: 'wav', encoding: 'pcm_s16le', sample_rate: sampleRate }
        : { container: 'raw', encoding: 'pcm_s16le', sample_rate: sampleRate };

  const res = await fetch(`${CARTESIA_REST}/tts/bytes`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model_id: modelId,
      transcript: text,
      voice: { mode: 'id', id: voiceId },
      output_format: outputFormat,
      language: 'en',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Cartesia] REST synthesis ${res.status}: ${body}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Streaming WebSocket synthesis
// ---------------------------------------------------------------------------

/**
 * Open a streaming TTS session. Returns an object with:
 *
 *   sendText(textChunk, { continue?: boolean })  — send a text chunk; set
 *     `continue: false` on the last chunk to flush the sentence.
 *   close()  — close the WebSocket.
 *   onAudio(cb)  — subscribe to audio chunks (Buffer) as they arrive.
 *   onDone(cb)   — subscribe to synthesis completion.
 *   onError(cb)  — subscribe to errors.
 *
 * @param {object} opts
 * @param {string} [opts.voiceId]
 * @param {'male'|'female'} [opts.gender]
 * @param {string} [opts.modelId='sonic-english']
 * @param {number} [opts.sampleRate=24000]
 */
function openStream(opts = {}) {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) throw new Error('CARTESIA_API_KEY is not set');

  const voiceId = opts.voiceId || resolveVoiceId(opts.gender);
  const modelId = opts.modelId || 'sonic-english';
  const sampleRate = opts.sampleRate || 24000;

  const url = `${CARTESIA_WS}?api_key=${encodeURIComponent(apiKey)}&cartesia_version=${encodeURIComponent(version())}`;
  const ws = new WebSocket(url);

  const audioHandlers = [];
  const doneHandlers = [];
  const errorHandlers = [];

  // Each utterance on the same socket shares a context id so partial text
  // chunks are stitched together. Callers can rotate this per sentence.
  let contextId = crypto.randomUUID();

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'chunk' && message.data) {
        const buf = Buffer.from(message.data, 'base64');
        for (const cb of audioHandlers) cb(buf);
      } else if (message.type === 'done') {
        for (const cb of doneHandlers) cb();
      } else if (message.type === 'error') {
        for (const cb of errorHandlers) cb(new Error(message.error || 'Cartesia error'));
      }
    } catch (err) {
      for (const cb of errorHandlers) cb(err);
    }
  });

  ws.on('error', (err) => {
    for (const cb of errorHandlers) cb(err);
  });

  function sendText(textChunk, { continueUtterance = false } = {}) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        model_id: modelId,
        transcript: textChunk,
        voice: { mode: 'id', id: voiceId },
        output_format: {
          container: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: sampleRate,
        },
        language: 'en',
        context_id: contextId,
        continue: continueUtterance,
      })
    );
  }

  function resetContext() {
    contextId = crypto.randomUUID();
  }

  function close() {
    try { ws.close(); } catch {}
  }

  return {
    ready: new Promise((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    }),
    sendText,
    resetContext,
    close,
    onAudio: (cb) => audioHandlers.push(cb),
    onDone: (cb) => doneHandlers.push(cb),
    onError: (cb) => errorHandlers.push(cb),
  };
}

module.exports = {
  synthesizeToBuffer,
  openStream,
  resolveVoiceId,
};
