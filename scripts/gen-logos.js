/**
 * Flynn logo concept generator.
 *
 * Fires each concept prompt through the latest/best fal.ai models and saves the
 * results to brand/logo-concepts/:
 *   - Recraft V4.1 Pro Vector  -> true editable SVG (the actual shippable logo)
 *   - Nano Banana Pro (Gemini 3 Pro Image) -> best raster / character beauty
 *   - GPT Image 2 (OpenAI)     -> best instruction-following raster
 *
 * Run: node scripts/gen-logos.js
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error('FAL_KEY missing from .env');
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, '..', 'brand', 'logo-concepts');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ORANGE = '#FB5B1E';
const OFFWHITE = '#FFF7F0';

// Text-free icon concepts (the app name shows under the icon).
const CONCEPTS = [
  {
    id: 'bubble',
    prompt: `Flat vector iOS app icon, NO text: a single rounded speech bubble in warm orange (${ORANGE}) with two small dot eyes and a subtle friendly smile inside it, soft rounded corners, bold and centered on an off-white (${OFFWHITE}) background, minimal, high contrast, no gradient, modern, friendly, crisp at small sizes.`,
  },
  {
    id: 'bubble-solid',
    prompt: `Flat vector iOS app icon, NO text: a clean white rounded speech bubble with two dot eyes and a small smile, centered on a solid warm orange (${ORANGE}) background, minimal, bold, no gradient, friendly, legible at 60px.`,
  },
  {
    id: 'mascot',
    prompt: `Flat vector mascot app icon, NO text: a simple friendly character named Flynn whose body is a rounded speech bubble, warm orange (${ORANGE}), two dot eyes, a cheerful smile, one tiny waving hand, thick clean outlines, minimal geometric shapes, Duolingo-meets-Manus charm, centered on off-white (${OFFWHITE}), highly legible at small size, no gradient.`,
  },
  {
    id: 'mascot-wink',
    prompt: `Flat vector mascot app icon, NO text: a cute friendly little character made from a rounded orange (${ORANGE}) speech bubble, winking with a cheeky smile, super simple, bold thick outlines, playful, centered on off-white (${OFFWHITE}), no gradient, crisp at icon size.`,
  },
  {
    id: 'monogram',
    prompt: `Flat vector iOS app icon, NO text: a bold geometric letter F whose negative space forms a chat speech bubble, single warm orange (${ORANGE}) on off-white (${OFFWHITE}), ultra-minimal, premium, no gradient, crisp at small sizes.`,
  },
];

const MODELS = [
  { id: 'recraft-v4.1-vector', endpoint: 'fal-ai/recraft/v4.1/pro/text-to-vector', ext: 'svg' },
  { id: 'nano-banana-pro', endpoint: 'fal-ai/gemini-3-pro-image-preview', ext: 'png' },
  { id: 'gpt-image-2', endpoint: 'openai/gpt-image-2', ext: 'png' },
];

const headers = { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' };

async function callModel(endpoint, prompt) {
  // Try with a square-size hint; if the model rejects unknown params, retry minimal.
  const bodies = [
    { prompt, image_size: 'square_hd', num_images: 1 },
    { prompt },
  ];
  let lastErr = '';
  for (const body of bodies) {
    const res = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      const img = json?.images?.[0] || json?.image;
      const url = img?.url || json?.url;
      if (url) return { url, contentType: img?.content_type || '' };
      lastErr = 'no image url in response: ' + JSON.stringify(json).slice(0, 200);
      break;
    }
    lastErr = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 422 && res.status !== 400) break; // only retry param errors
  }
  throw new Error(lastErr);
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

// Small concurrency limiter.
async function pool(items, limit, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]).catch((e) => ({ error: e.message }));
    }
  });
  await Promise.all(runners);
  return results;
}

(async () => {
  const jobs = [];
  for (const c of CONCEPTS) for (const m of MODELS) jobs.push({ concept: c, model: m });

  console.log(`Generating ${jobs.length} images (${CONCEPTS.length} concepts x ${MODELS.length} models) -> ${OUT_DIR}\n`);

  const results = await pool(jobs, 5, async ({ concept, model }) => {
    const t0 = Date.now();
    const { url, contentType } = await callModel(model.endpoint, concept.prompt);
    const ext = contentType.includes('svg') || url.endsWith('.svg') ? 'svg' : model.ext;
    const file = path.join(OUT_DIR, `${concept.id}__${model.id}.${ext}`);
    await download(url, file);
    console.log(`  ok  ${concept.id} / ${model.id}  (${Math.round((Date.now() - t0) / 1000)}s) -> ${path.basename(file)}`);
    return { file };
  });

  const failures = results.filter((r) => r?.error);
  console.log(`\nDone. ${results.length - failures.length}/${results.length} succeeded.`);
  if (failures.length) {
    console.log('Failures:');
    jobs.forEach((j, idx) => { if (results[idx]?.error) console.log(`  ${j.concept.id} / ${j.model.id}: ${results[idx].error}`); });
  }
  console.log(`\nOpen: ${OUT_DIR}`);
})();
