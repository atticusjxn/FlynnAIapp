/**
 * Generate a consistent Flynn POSE set (same character) for use across the app.
 * Image-to-image via Nano Banana Pro, using the locked character as reference.
 * White background -> removed to transparent locally afterward.
 *
 * Run: node scripts/gen-poses.js
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error('FAL_KEY missing'); process.exit(1); }

const REF = path.join(__dirname, '..', 'brand', 'logo-concepts', 'mascots-v2', 'sidekick-wink.png');
const OUT_DIR = path.join(__dirname, '..', 'brand', 'logo-concepts', 'poses', 'raw');
fs.mkdirSync(OUT_DIR, { recursive: true });

const EDIT = 'fal-ai/gemini-3-pro-image-preview/edit';
const headers = { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' };
const ref = 'data:image/png;base64,' + fs.readFileSync(REF).toString('base64');

const SAME = 'Keep the EXACT same orange character from the reference: round, warm orange (#FB5B1E), bold dark outline, one eye winking and one big friendly round eye, wide cheerful smile. Same art style. Cute full little mascot with small rounded arms and tiny feet. Plain solid pure WHITE background, full body centered, app mascot illustration, no text.';

const POSES = [
  { id: 'wave', prompt: `Draw this character waving hello with one little arm raised, cheerful. ${SAME}` },
  { id: 'thumbsup', prompt: `Draw this character giving an enthusiastic thumbs up, celebrating, big happy grin. ${SAME}` },
  { id: 'thinking', prompt: `Draw this character thinking, one little hand on its chin, curious and pondering (eyes can both be open and looking up). ${SAME}` },
  { id: 'point', prompt: `Draw this character pointing helpfully to the side with one little arm, confident and friendly. ${SAME}` },
  { id: 'peek', prompt: `Draw this character peeking out from behind a rounded chat speech bubble, waving one hand over the edge. ${SAME}` },
  { id: 'write', prompt: `Draw this character holding a pencil and happily writing/drafting a message, focused and cheerful. ${SAME}` },
  { id: 'sleep', prompt: `Draw this character sleeping peacefully with both eyes closed and small "z z z" above its head, relaxed (for an empty state). ${SAME}` },
  { id: 'phone', prompt: `Draw this character happily holding a smartphone with a tiny chat bubble popping from it. ${SAME}` },
];

async function edit(prompt) {
  for (const body of [{ prompt, image_urls: [ref] }, { prompt, image_url: ref }]) {
    const res = await fetch(`https://fal.run/${EDIT}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) {
      const j = await res.json();
      const url = j?.images?.[0]?.url || j?.image?.url || j?.url;
      if (url) return url;
      throw new Error('no url');
    }
    const t = (await res.text()).slice(0, 160);
    if (res.status !== 422 && res.status !== 400) throw new Error(`HTTP ${res.status}: ${t}`);
  }
  throw new Error('failed');
}
async function dl(url, dest) { fs.writeFileSync(dest, Buffer.from(await (await fetch(url)).arrayBuffer())); }
async function pool(items, limit, w) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const x = i++; out[x] = await w(items[x]).catch((e) => ({ error: e.message })); } }));
  return out;
}

(async () => {
  console.log(`Generating ${POSES.length} poses -> ${OUT_DIR}\n`);
  const r = await pool(POSES, 4, async (p) => {
    const t0 = Date.now();
    const url = await edit(p.prompt);
    await dl(url, path.join(OUT_DIR, `${p.id}.png`));
    console.log(`  ok ${p.id} (${Math.round((Date.now() - t0) / 1000)}s)`);
    return {};
  });
  POSES.forEach((p, i) => { if (r[i]?.error) console.log(`  FAIL ${p.id}: ${r[i].error}`); });
  console.log('\nDone.');
})();
