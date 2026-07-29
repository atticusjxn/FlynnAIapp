/**
 * Renders store.html to App Store PNGs at every size Apple accepts.
 *
 * Headless Chrome hangs on this machine, so this connects to a GUI-session
 * Chrome instead (same workaround as capture_connect.js). Start one first:
 *
 *   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *     --remote-debugging-port=9222 --user-data-dir=/tmp/flynn-render-chrome \
 *     --no-first-run --headless=new
 *
 * Then:  node capture_store.js
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Slides are authored at 1290x2796 (6.9"). Everything else is the same layout
// scaled, so the type stays proportionally as large.
const BASE_W = 1290;
const BASE_H = 2796;

const SIZES = [
  { name: '6.9_inch', width: 1290, height: 2796 }, // required for new submissions
  { name: '6.5_inch', width: 1242, height: 2688 }, // legacy slot
  { name: '6.7_inch', width: 1284, height: 2778 },
];

const SLIDES = ['s1', 's2', 's3', 's4', 's5'];

(async () => {
  const browser = await puppeteer.connect({
    // localhost, not 127.0.0.1: Chrome binds the debug port on ::1 here and
    // the IPv4 literal 404s.
    browserURL: 'http://localhost:9222',
    defaultViewport: null,
  });
  const page = await browser.newPage();
  const url = 'file://' + path.resolve(__dirname, 'store.html');

  for (const size of SIZES) {
    const outDir = path.resolve(__dirname, 'output', size.name);
    fs.mkdirSync(outDir, { recursive: true });

    // Scale the whole slide rather than re-laying it out, so proportions and
    // type weight are identical across sizes.
    const scale = size.width / BASE_W;

    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate((s, h) => {
      document.querySelectorAll('.slide').forEach((el) => {
        el.style.transformOrigin = 'top left';
        el.style.transform = `scale(${s})`;
        // The 6.5"/6.7" aspect ratios are slightly taller than 6.9"; stretch
        // the vertical so the frame fills rather than letterboxing.
        el.style.height = `${h / s}px`;
      });
    }, scale, size.height);
    await new Promise((r) => setTimeout(r, 600)); // let webfonts settle

    for (let i = 0; i < SLIDES.length; i++) {
      const el = await page.$('#' + SLIDES[i]);
      const file = path.join(outDir, `flynn-screenshot-slide${i + 1}.png`);
      await el.screenshot({ path: file });
      console.log(`${size.name}  slide${i + 1}  ${size.width}x${size.height}`);
    }
  }

  await page.close();
  browser.disconnect();
  console.log('done');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
