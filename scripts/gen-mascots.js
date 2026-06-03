/**
 * Flynn MASCOT variation generator.
 * Explores the character (the distinctive, ownable route) — poses, expressions,
 * silhouettes. Mostly Nano Banana Pro (best character); top silhouettes also as
 * editable Recraft V4.1 vectors.
 *
 * Run: node scripts/gen-mascots.js
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error('FAL_KEY missing'); process.exit(1); }

const OUT_DIR = path.join(__dirname, '..', 'brand', 'logo-concepts', 'mascots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ORANGE = '#FB5B1E';
const OFFWHITE = '#FFF7F0';
const STYLE = `flat vector mascot app icon, NO text, warm orange (${ORANGE}), bold thick clean rounded outlines, minimal geometric shapes, friendly and characterful (Duolingo-meets-Manus charm), centered, off-white (${OFFWHITE}) background, legible at small size, no gradient`;

const NANO = { id: 'nano', endpoint: 'fal-ai/gemini-3-pro-image-preview', ext: 'png' };
const RECRAFT = { id: 'recraft-svg', endpoint: 'fal-ai/recraft/v4.1/pro/text-to-vector', ext: 'svg' };

// Each: {id, prompt, models}
const CONCEPTS = [
  { id: 'classic-wave', models: [NANO, RECRAFT],
    prompt: `A round friendly orange character named Flynn with big cheerful eyes, a warm smile, two short stubby arms (one waving hello) and little feet, standing. ${STYLE}.` },
  { id: 'wink-thumbsup', models: [NANO],
    prompt: `A cute round orange character winking with a cheeky grin, giving a thumbs up with a stubby arm, two little feet. ${STYLE}.` },
  { id: 'peek-bubble', models: [NANO, RECRAFT],
    prompt: `A friendly round orange character peeking out from inside a rounded speech bubble, only its smiling face and one waving hand visible over the edge of the bubble. ${STYLE}.` },
  { id: 'phone-reply', models: [NANO],
    prompt: `A happy round orange character holding a small smartphone, a tiny orange reply chat bubble popping out of the phone, friendly grin. ${STYLE}.` },
  { id: 'f-silhouette', models: [NANO, RECRAFT],
    prompt: `A friendly little creature whose whole body is subtly shaped like a bold geometric letter F, with two dot eyes and a cheerful smile on it, minimal and iconic — a character that doubles as the letter F. ${STYLE}.` },
  { id: 'bubble-head', models: [NANO, RECRAFT],
    prompt: `A distinctive little creature whose HEAD is a rounded speech-bubble shape (with the little bubble tail) and has two friendly dot eyes and a warm smile, a tiny rounded body and stubby feet. ${STYLE}.` },
  { id: 'minimal-head', models: [NANO, RECRAFT],
    prompt: `An ultra-simple iconic orange character: just a round head with two dot eyes and a warm friendly smile, no limbs, very clean and bold, the kind of simple mark that reads instantly at tiny sizes. ${STYLE}.` },
  { id: 'sidekick-point', models: [NANO],
    prompt: `An energetic round orange character leaning in and pointing helpfully to the side with a big confident grin, like a friendly sidekick. ${STYLE}.` },
  { id: 'dash', models: [NANO],
    prompt: `A round orange character happily dashing/running to the side carrying a tiny chat message bubble, small motion lines, energetic and friendly. ${STYLE}.` },
];

const headers = { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' };

async function callModel(endpoint, prompt) {
  for (const body of [{ prompt, image_size: 'square_hd', num_images: 1 }, { prompt }]) {
    const res = await fetch(`https://fal.run/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) {
      const json = await res.json();
      const img = json?.images?.[0] || json?.image;
      const url = img?.url || json?.url;
      if (url) return { url, contentType: img?.content_type || '' };
      throw new Error('no url: ' + JSON.stringify(json).slice(0, 150));
    }
    const txt = (await res.text()).slice(0, 150);
    if (res.status !== 422 && res.status !== 400) throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  throw new Error('failed after retry');
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function pool(items, limit, worker) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx]).catch((e) => ({ error: e.message })); }
  }));
  return out;
}

(async () => {
  const jobs = [];
  for (const c of CONCEPTS) for (const m of c.models) jobs.push({ c, m });
  console.log(`Generating ${jobs.length} mascot images -> ${OUT_DIR}\n`);
  const results = await pool(jobs, 5, async ({ c, m }) => {
    const t0 = Date.now();
    const { url, contentType } = await callModel(m.endpoint, c.prompt);
    const ext = contentType.includes('svg') || url.endsWith('.svg') ? 'svg' : m.ext;
    const file = path.join(OUT_DIR, `${c.id}__${m.id}.${ext}`);
    await download(url, file);
    console.log(`  ok  ${c.id} / ${m.id}  (${Math.round((Date.now() - t0) / 1000)}s)`);
    return { file };
  });
  const fails = results.filter((r) => r?.error);
  console.log(`\nDone. ${results.length - fails.length}/${results.length} ok.`);
  jobs.forEach((j, i) => { if (results[i]?.error) console.log(`  FAIL ${j.c.id}/${j.m.id}: ${results[i].error}`); });
})();
