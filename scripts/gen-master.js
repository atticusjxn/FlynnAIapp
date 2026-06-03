/**
 * Produce the centered, warm-cream master for the locked app-icon character
 * (no-hand winking chat-bubble). Image-to-image via Nano Banana Pro. Generates a
 * few candidates so we can pick the best-centered one.
 *
 * Run: node scripts/gen-master.js
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error('FAL_KEY missing'); process.exit(1); }

const SRC = path.join(__dirname, '..', 'brand', 'logo-concepts', 'lock', '5-cream-no-hand.png');
const OUT_DIR = path.join(__dirname, '..', 'brand', 'logo-concepts', 'master');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CREAM = '#F4E6CE'; // clearly warm cream / beige, not white
const EDIT = 'fal-ai/gemini-3-pro-image-preview/edit';
const headers = { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' };
const dataUri = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');

const PROMPT = `Center the winking smiling chat-bubble character PERFECTLY in the middle of the square frame, with equal even margins on all four sides (the character should sit dead-center). Make the ENTIRE background a single solid flat WARM CREAM / BEIGE color (${CREAM}) — clearly warm and creamy, NOT white, no gradient, no shadow, no circle, no texture. Keep the exact same orange winking creature with the big friendly eye, wide smile and the little speech-bubble tail at the bottom-left. App icon, no text.`;

async function edit() {
  for (const body of [{ prompt: PROMPT, image_urls: [dataUri] }, { prompt: PROMPT, image_url: dataUri }]) {
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
  throw new Error('failed');
}

async function download(url, dest) {
  const res = await fetch(url);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

(async () => {
  console.log(`Generating 3 centered cream masters -> ${OUT_DIR}\n`);
  await Promise.all([1, 2, 3].map(async (n) => {
    try {
      const url = await edit();
      await download(url, path.join(OUT_DIR, `master-${n}.png`));
      console.log(`  ok master-${n}`);
    } catch (e) { console.log(`  FAIL master-${n}: ${e.message}`); }
  }));
  console.log('\nDone.');
})();
