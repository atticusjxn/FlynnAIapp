import puppeteer from '/Users/atticus/FlynnAIapp/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HTML_FILE  = path.resolve(__dirname, 'Flynn AI Ad _standalone_.html');
const FRAMES_DIR = '/tmp/flynn_ad_frames';
const OUTPUT     = path.join(process.env.HOME, 'Downloads', 'flynnai-ad-motion.mp4');
const DURATION_MS = 22000; // 22s — full 20s animation + 2s buffer for close scene

console.log('HTML :', HTML_FILE);
console.log('Out  :', OUTPUT);

fs.mkdirSync(FRAMES_DIR, { recursive: true });
// Clear old frames
fs.readdirSync(FRAMES_DIR).forEach(f => fs.unlinkSync(path.join(FRAMES_DIR, f)));

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',          // allow file:// blob URLs
    '--allow-file-access-from-files',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

// Open CDP session for screencast
const client = await page.createCDPSession();

const frames = [];
client.on('Page.screencastFrame', async ({ data, sessionId }) => {
  frames.push(data);
  // Must ack each frame or Chrome pauses delivery
  await client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});

await client.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 92,
  everyNthFrame: 1,
});

console.log('Loading animation...');
await page.goto(`file://${HTML_FILE}`, { waitUntil: 'networkidle0', timeout: 15000 })
  .catch(() => {}); // file:// won't fire networkidle cleanly — that's fine

console.log(`Recording for ${DURATION_MS / 1000}s...`);
await new Promise(r => setTimeout(r, DURATION_MS));

await client.send('Page.stopScreencast').catch(() => {});
await browser.close();

console.log(`Captured ${frames.length} frames`);
if (frames.length === 0) {
  console.error('No frames captured — the animation may not have started. Try increasing DURATION_MS or check the HTML loads correctly in a browser.');
  process.exit(1);
}

// Write JPEG frames
frames.forEach((data, i) => {
  const num = String(i).padStart(6, '0');
  fs.writeFileSync(path.join(FRAMES_DIR, `frame_${num}.jpg`), Buffer.from(data, 'base64'));
});

// Calculate actual captured fps
const fps = Math.round(frames.length / (DURATION_MS / 1000));
console.log(`Stitching at ~${fps} fps → ${OUTPUT}`);

execSync(
  `ffmpeg -y \
    -framerate ${fps} \
    -i "${FRAMES_DIR}/frame_%06d.jpg" \
    -vf "scale=1080:1920:flags=lanczos,setsar=1" \
    -c:v libx264 \
    -preset slow \
    -crf 16 \
    -pix_fmt yuv420p \
    -movflags +faststart \
    "${OUTPUT}"`,
  { stdio: 'inherit' }
);

console.log(`\n✓ Done → ${OUTPUT}`);
