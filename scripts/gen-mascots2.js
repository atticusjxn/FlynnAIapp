/**
 * Flynn mascot — round 2: merge charm (round character) + ownability (Flynn/F),
 * woven subtly so it's a CREATURE, not a flat letter. Nano Banana Pro only
 * (best creativity); vectorize the winner later via fal-ai/recraft/vectorize.
 *
 * Run: node scripts/gen-mascots2.js
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error('FAL_KEY missing'); process.exit(1); }

const OUT_DIR = path.join(__dirname, '..', 'brand', 'logo-concepts', 'mascots-v2');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = `Flat modern mascot app icon, NO text. A warm orange (#FB5B1E) character with bold clean dark outlines, soft rounded dimensional shapes, big expressive friendly eyes, centered on an off-white (#FFF7F0) background, no gradient, charming and lovable like a top consumer app mascot, legible at small size`;

// Nano Banana Pro endpoint.
const NANO = 'fal-ai/gemini-3-pro-image-preview';

const CONCEPTS = [
  { id: 'cowlick-wave', prompt: `${BASE}. A cute round soft character with a warm smile and two little arms (one waving hello), tiny feet, and a small hair cowlick on top of its head subtly shaped like the letter F. It is a creature first, the F is just a playful detail.` },
  { id: 'badge-confident', prompt: `${BASE}. A round friendly character with big eyes and a cheerful grin, one little hand on its hip looking confident, with a small simple "F" emblem badge on its chest like a tiny superhero crest.` },
  { id: 'soft-F-creature', prompt: `${BASE}. A soft, dimensional, chunky character whose plump rounded body gently reads as the letter F from the front, but it has a friendly face, two little arms and tiny feet so it clearly looks like a cute creature, not a flat letter. Rounded, squishy, lovable.` },
  { id: 'sidekick-wink', prompt: `${BASE}. A confident, energetic character winking with a big friendly grin and pointing to the side with one little arm, like an eager helpful sidekick. Dynamic and warm.` },
  { id: 'thumbsup-cowlick', prompt: `${BASE}. A round happy character winking and giving an enthusiastic thumbs up, with a small playful F-shaped cowlick of hair on top. Cheeky and charming.` },
  { id: 'chat-creature', prompt: `${BASE}. A distinctive lovable creature whose head is a soft rounded speech-bubble shape (with a little bubble tail) bearing a friendly winking face, a small rounded body and tiny feet, one hand waving. Combines a chat bubble and a character into one ownable silhouette.` },
  { id: 'peek-wink', prompt: `${BASE}. A cute round character peeking out from behind a soft rounded chat bubble, winking with a cheeky smile and waving one hand over the edge of the bubble.` },
  { id: 'hero-pose', prompt: `${BASE}. A round soft hero character standing proudly with a big warm smile, little arms slightly out, tiny feet, simple and iconic, with a subtle F monogram suggested in the shape of its little tuft of hair. The kind of single friendly mascot you'd put on an app icon.` },
];

const headers = { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' };

async function callNano(prompt) {
  for (const body of [{ prompt, image_size: 'square_hd', num_images: 1 }, { prompt }]) {
    const res = await fetch(`https://fal.run/${NANO}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) {
      const json = await res.json();
      const url = json?.images?.[0]?.url || json?.image?.url || json?.url;
      if (url) return url;
      throw new Error('no url: ' + JSON.stringify(json).slice(0, 150));
    }
    const txt = (await res.text()).slice(0, 150);
    if (res.status !== 422 && res.status !== 400) throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  throw new Error('failed after retry');
}

async function download(url, dest) {
  const res = await fetch(url);
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
  console.log(`Generating ${CONCEPTS.length} mascot v2 images -> ${OUT_DIR}\n`);
  const results = await pool(CONCEPTS, 5, async (c) => {
    const t0 = Date.now();
    const url = await callNano(c.prompt);
    const file = path.join(OUT_DIR, `${c.id}.png`);
    await download(url, file);
    console.log(`  ok  ${c.id}  (${Math.round((Date.now() - t0) / 1000)}s)`);
    return { file };
  });
  const fails = results.filter((r) => r?.error);
  console.log(`\nDone. ${results.length - fails.length}/${results.length} ok.`);
  CONCEPTS.forEach((c, i) => { if (results[i]?.error) console.log(`  FAIL ${c.id}: ${results[i].error}`); });
})();
