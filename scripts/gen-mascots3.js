/**
 * Flynn mascot — round 3: lock the winking helper character, explore framing &
 * background (white vs solid-orange vs fill-frame) and the speech-bubble tail.
 * Nano Banana Pro only.
 *
 * Run: node scripts/gen-mascots3.js
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error('FAL_KEY missing'); process.exit(1); }

const OUT_DIR = path.join(__dirname, '..', 'brand', 'logo-concepts', 'mascots-v3');
fs.mkdirSync(OUT_DIR, { recursive: true });

const NANO = 'fal-ai/gemini-3-pro-image-preview';
const headers = { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' };

// Consistent character description.
const CHAR = `a charming round cartoon mascot named Flynn, warm orange (#FB5B1E), one eye playfully winking and one big friendly round eye, a wide cheerful open smile, a small cartoon hand pointing to the side, bold clean dark outline, lovable like a top consumer app mascot`;
const ICON = `Flat modern mascot app icon, NO text, centered, legible at small size, no gradient`;

const CONCEPTS = [
  { id: '1-white', prompt: `${ICON}. ${CHAR}, on a pure flat solid WHITE background, no circle, no texture, no drop shadow behind it.` },
  { id: '2-solid-orange', prompt: `${ICON}. A charming round mascot (one eye winking, one big friendly eye, wide happy smile, a hand pointing to the side) rendered in clean cream/off-white with a bold dark outline, on a SOLID warm orange (#FB5B1E) background filling the whole tile — Discord / Waze style, high contrast, bold.` },
  { id: '3-fill-frame', prompt: `${ICON}. Extreme close-up: a charming round orange (#FB5B1E) mascot FACE — one eye winking, one big friendly eye, a wide happy open smile, bold dark outline — the face FILLS THE ENTIRE SQUARE FRAME edge to edge like the Duolingo owl, almost no background, maximally bold and legible at tiny sizes.` },
  { id: '4-tail-white', prompt: `${ICON}. ${CHAR}, and its round body has a small subtle speech-bubble tail at the bottom-left so the silhouette also reads as a friendly chat bubble — but it clearly looks like a winking creature first. Pure flat solid WHITE background.` },
  { id: '5-tail-orange', prompt: `${ICON}. A round winking smiling mascot with a small subtle speech-bubble tail at the bottom-left (so it reads as a chat bubble with a face), rendered in cream/off-white with a bold dark outline, on a SOLID warm orange (#FB5B1E) background.` },
  { id: '6-clean-flat', prompt: `${ICON}. A cleaner, flatter, more minimal modern version of ${CHAR}, simplified flat shapes and minimal shading, thick confident outline, on a pure solid WHITE background.` },
  { id: '7-no-hand', prompt: `${ICON}. Just the face, no hand: a charming round orange (#FB5B1E) mascot, one eye winking, one big friendly eye, a wide cheerful smile, bold dark outline — simple and iconic, on a pure solid WHITE background.` },
  { id: '8-F-badge', prompt: `${ICON}. ${CHAR}, with a small simple dark "F" emblem badge on its cheek or body for brand ownership, on a pure solid WHITE background.` },
];

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
  console.log(`Generating ${CONCEPTS.length} framing variations -> ${OUT_DIR}\n`);
  const results = await pool(CONCEPTS, 5, async (c) => {
    const t0 = Date.now();
    const url = await callNano(c.prompt);
    await download(url, path.join(OUT_DIR, `${c.id}.png`));
    console.log(`  ok  ${c.id}  (${Math.round((Date.now() - t0) / 1000)}s)`);
    return {};
  });
  const fails = results.filter((r) => r?.error);
  console.log(`\nDone. ${results.length - fails.length}/${results.length} ok.`);
  CONCEPTS.forEach((c, i) => { if (results[i]?.error) console.log(`  FAIL ${c.id}: ${results[i].error}`); });
})();
