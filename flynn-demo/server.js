/**
 * Flynn TikTok demo server — a filming prop, NOT wired to production.
 *
 * Pipeline: browser (Chrome Web Speech API does STT, push-to-talk) -> POST /turn
 * -> match curated scenario (scenarios.js) or fall back to live Qwen (persona.js)
 * -> TTS (Deepgram Aura-2 AU male/female, or Cartesia) -> audio back to browser,
 * which plays it through the Mac's output (-> car Bluetooth speakers).
 *
 * Reuses the repo's existing modules + .env. No new accounts, no install:
 * express/dotenv already live in the repo's node_modules.
 *
 *   node flynn-demo/server.js        # then open http://localhost:5050
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const { getLLMClient } = require('../llmClient');
const { sanitiseReply } = require('../services/flynnTone');
const { transcribeAudio } = require('../services/asrClient');
const cartesia = require('../telephony/cartesiaTTS');
const { SCENARIOS, matchScenario } = require('./scenarios');
const { SYSTEM_PROMPT } = require('./persona');

const PORT = process.env.DEMO_PORT || 5050;

// --- Voices ----------------------------------------------------------------
// Deepgram Aura-2 has built-in AU voices (no cloning). Cartesia uses the
// configured AU voice UUIDs. All produce mp3.
const VOICES = {
  hyperion: { provider: 'deepgram', model: 'aura-2-hyperion-en', label: 'Aussie male (Deepgram Hyperion)' },
  theia: { provider: 'deepgram', model: 'aura-2-theia-en', label: 'Aussie female (Deepgram Theia)' },
  'cartesia-male': { provider: 'cartesia', gender: 'male', label: 'Aussie male (Cartesia clone)' },
  'cartesia-female': { provider: 'cartesia', gender: 'female', label: 'Aussie female (Cartesia)' },
};
const DEFAULT_VOICE = 'hyperion'; // genuine AU male (arcas was US despite the label)

function resolveVoice(key) {
  return VOICES[key] ? key : DEFAULT_VOICE;
}

// --- TTS -------------------------------------------------------------------
async function deepgramSpeak(text, model) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error('DEEPGRAM_API_KEY is not set');
  const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[Deepgram] speak ${res.status}: ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function synthesize(text, voiceKey) {
  const voice = VOICES[resolveVoice(voiceKey)];
  if (voice.provider === 'deepgram') {
    return deepgramSpeak(text, voice.model);
  }
  // Repo default is the now-sunsetted 'sonic-english'; use the current model.
  return cartesia.synthesizeToBuffer(text, {
    gender: voice.gender,
    format: 'mp3',
    modelId: process.env.CARTESIA_MODEL || 'sonic-3',
  });
}

function toDataUrl(buffer) {
  return `data:audio/mpeg;base64,${buffer.toString('base64')}`;
}

// --- Pre-cache scripted audio per voice ------------------------------------
// Cache key `${voiceKey}:${scenarioId}` -> data URL. Warms playback so scripted
// takes are instant and never depend on a live TTS call mid-shoot.
const audioCache = new Map();

async function warmVoice(voiceKey) {
  const key = resolveVoice(voiceKey);
  const results = [];
  for (const scenario of SCENARIOS) {
    const cacheKey = `${key}:${scenario.id}`;
    if (!audioCache.has(cacheKey)) {
      try {
        const buf = await synthesize(scenario.reply, key);
        audioCache.set(cacheKey, toDataUrl(buf));
        results.push({ id: scenario.id, ok: true });
      } catch (err) {
        results.push({ id: scenario.id, ok: false, error: err.message });
      }
    } else {
      results.push({ id: scenario.id, ok: true, cached: true });
    }
  }
  return results;
}

// --- LLM fallback ----------------------------------------------------------
async function liveReply(userText) {
  const client = getLLMClient('compatible');
  const response = await client.chat.completions.create({
    model: process.env.DRAFT_LLM_MODEL || 'qwen3.5-flash',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
    max_tokens: 120,
    temperature: 0.7,
    enable_thinking: false,
  });
  const raw = response?.choices?.[0]?.message?.content || '';
  return sanitiseReply(raw);
}

// --- App -------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/scenarios', (_req, res) => {
  res.json({
    voices: Object.entries(VOICES).map(([key, v]) => ({ key, label: v.label })),
    defaultVoice: DEFAULT_VOICE,
    scenarios: SCENARIOS.map((s) => ({ id: s.id, label: s.label, cue: s.cue })),
  });
});

app.post('/warm', async (req, res) => {
  const voice = resolveVoice(req.body?.voice);
  try {
    const results = await warmVoice(voice);
    res.json({ voice, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Main turn: { text, voice } -> { matched, scenarioId, replyText, audio }
app.post('/turn', async (req, res) => {
  const text = (req.body?.text || '').trim();
  const voice = resolveVoice(req.body?.voice);
  if (!text) return res.status(400).json({ error: 'no transcript' });

  try {
    const match = matchScenario(text);
    if (match) {
      const cacheKey = `${voice}:${match.scenario.id}`;
      let audio = audioCache.get(cacheKey);
      if (!audio) {
        audio = toDataUrl(await synthesize(match.scenario.reply, voice));
        audioCache.set(cacheKey, audio);
      }
      return res.json({
        matched: true,
        scenarioId: match.scenario.id,
        replyText: match.scenario.reply,
        audio,
      });
    }

    // Off-script -> live Qwen + live TTS.
    const replyText = await liveReply(text);
    const audio = toDataUrl(await synthesize(replyText, voice));
    return res.json({ matched: false, replyText, audio });
  } catch (err) {
    console.error('[turn] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Manual TTS for testing: { text, voice } -> { audio }
app.post('/speak', async (req, res) => {
  const text = (req.body?.text || '').trim();
  const voice = resolveVoice(req.body?.voice);
  if (!text) return res.status(400).json({ error: 'no text' });
  try {
    res.json({ audio: toDataUrl(await synthesize(text, voice)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backup STT (DashScope Qwen omni) if Chrome Web Speech is unavailable.
// Body = raw audio bytes, ?voice & ?format via query/headers.
app.post('/transcribe', async (req, res) => {
  try {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const mimeType = req.headers['content-type'] || 'audio/wav';
    const { text } = await transcribeAudio({
      buffer,
      mimeType,
      context: 'tradie commands: Greg, invoice, Reece, PVC, Finlayson, Bunnings, click and collect',
    });
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`\n  Flynn demo running:  http://localhost:${PORT}`);
  console.log(`  Warming default voice (${DEFAULT_VOICE})...`);
  try {
    const results = await warmVoice(DEFAULT_VOICE);
    const ok = results.filter((r) => r.ok).length;
    console.log(`  Pre-cached ${ok}/${results.length} scripted lines.`);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) console.log('  Failed:', failed);
  } catch (err) {
    console.log(`  Warm failed (TTS will run live per turn): ${err.message}`);
  }
  console.log('');
});
