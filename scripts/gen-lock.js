/**
 * Lock the winking helper character: image-to-image edits via Nano Banana Pro
 * to put him on a SOLID cream background and make him read more like a chat
 * message (speech-bubble tail / body). Keeps the same character.
 *
 * Run: node scripts/gen-lock.js
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error('FAL_KEY missing'); process.exit(1); }

const SRC = path.join(__dirname, '..', 'brand', 'logo-concepts', 'mascots-v2', 'sidekick-wink.png');
const OUT_DIR = path.join(__dirname, '..', 'brand', 'logo-concepts', 'lock');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CREAM = '#FAF2E8';
const EDIT = 'fal-ai/gemini-3-pro-image-preview/edit';
const headers = { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' };

const dataUri = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');

const KEEP = 'Keep the exact same orange winking, smiling, pointing cartoon character — same face, same wink, same big eye, same open smile, same bold dark outline, same pointing hand. App icon, no text.';

const CONCEPTS = [
  { id: '1-cream-clean', prompt: `Replace the background with a single SOLID flat warm cream color (${CREAM}) filling the entire square — no circle, no gradient, no shadow. ${KEEP}` },
  { id: '2-cream-tail', prompt: `Put him on a SOLID flat warm cream (${CREAM}) background filling the whole square. Add a small speech-bubble tail at the bottom-left of his round body so he reads like a friendly chat message bubble with a face. ${KEEP}` },
  { id: '3-cream-bubble-body', prompt: `Solid flat warm cream (${CREAM}) background. Gently reshape his round body into a soft rounded speech-bubble shape with a little tail at the bottom-left, so he clearly looks like a friendly chat message with a winking face. ${KEEP}` },
  { id: '4-cream-tail-b', prompt: `Solid flat warm cream (${CREAM}) background filling the square, no circle. Give him a subtle chat-bubble tail at the lower left so the silhouette reads as a message, but he still looks like a winking creature first. ${KEEP}` },
  { id: '5-cream-no-hand', prompt: `Solid flat warm cream (${CREAM}) background. Remove the pointing hand for a cleaner, simpler icon; add a small chat-bubble tail at the bottom-left so he reads as a message. ${KEEP.replace('same pointing hand. ', '')}` },
];

async function edit(prompt) {
  const variants = [
    { prompt, image_urls: [dataUri] },
    { prompt, image_url: dataUri },
  ];
  for (const body of variants) {
    const res = await fetch(`https://fal.run/${EDIT}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) {
      const json = await res.json();
      const url = json?.images?.[0]?.url || json?.image?.url || json?.url;
      if (url) return url;
      throw new Error('no url: ' + JSON.stringify(json).slice(0, 150));
    }
    const txt = (await res.text()).slice(0, 200);
    if (res.status !== 422 && res.status !== 400) throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  throw new Error('failed after param retry');
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
  console.log(`Editing ${CONCEPTS.length} cream/message variations -> ${OUT_DIR}\n`);
  const results = await pool(CONCEPTS, 4, async (c) => {
    const t0 = Date.now();
    const url = await edit(c.prompt);
    await download(url, path.join(OUT_DIR, `${c.id}.png`));
    console.log(`  ok  ${c.id}  (${Math.round((Date.now() - t0) / 1000)}s)`);
    return {};
  });
  const fails = results.filter((r) => r?.error);
  console.log(`\nDone. ${results.length - fails.length}/${results.length} ok.`);
  CONCEPTS.forEach((c, i) => { if (results[i]?.error) console.log(`  FAIL ${c.id}: ${results[i].error}`); });
})();
