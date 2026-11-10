/**
 * Renders the video-composite assets (stage bg, transparent phone chassis,
 * transparent captions, end card) from va-916.html / va-45.html by
 * element-screenshotting each #asset. Same GUI-Chrome-on-:9222 workaround
 * as render.js.
 *
 * Usage: node render_video_assets.js
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const PAGES = [
  { file: 'va-916.html', suffix: '916' },
  { file: 'va-45.html', suffix: '45' },
];
const IDS = ['bg', 'chassis', 'cap1', 'cap2', 'cap3', 'end'];
// bg and end are opaque; everything else needs transparency preserved.
const TRANSPARENT = new Set(['chassis', 'cap1', 'cap2', 'cap3']);

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 2200, deviceScaleFactor: 1 });

  const outDir = path.resolve(__dirname, '../ad-creatives-batch1/composite-assets');
  fs.mkdirSync(outDir, { recursive: true });

  for (const p of PAGES) {
    const url = 'file://' + path.resolve(__dirname, 'html', p.file);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    for (const id of IDS) {
      const el = await page.$('#' + id);
      const file = path.join(outDir, `${id}-${p.suffix}.png`);
      await el.screenshot({ path: file, omitBackground: TRANSPARENT.has(id) });
      console.log(`${p.suffix}  ${id}`);
    }
  }

  await page.close();
  browser.disconnect();
  console.log('done');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
