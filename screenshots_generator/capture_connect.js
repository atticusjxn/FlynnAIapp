// Render the store slides by CONNECTING to a GUI Chrome (headless hangs on this
// Mac). Start Chrome first with:
//   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
//     --remote-debugging-port=9222 --user-data-dir=/tmp/flynn-render-chrome --no-first-run
// then: node capture_connect.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const configs = [
  { name: '6.5_inch', width: 1242, height: 2688 },
  { name: '6.7_inch', width: 1284, height: 2778 },
];

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  console.log('Connected to Chrome.');

  for (const config of configs) {
    console.log(`\nConfig: ${config.name} (${config.width}x${config.height})`);
    const page = await browser.newPage();
    await page.setViewport({ width: config.width, height: config.height, deviceScaleFactor: 1 });

    const filePath = `file://${path.join(__dirname, 'index.html')}`;
    await page.goto(filePath, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((w, h) => {
      document.documentElement.style.setProperty('--screen-width', `${w}px`);
      document.documentElement.style.setProperty('--screen-height', `${h}px`);
    }, config.width, config.height);

    const outputDir = path.join(__dirname, 'output', config.name);
    fs.mkdirSync(outputDir, { recursive: true });

    for (const id of ['slide1', 'slide2', 'slide3', 'slide4', 'slide5']) {
      const el = await page.$(`#${id}`);
      if (!el) { console.error(`#${id} not found!`); continue; }
      await page.evaluate((elId, w, h) => {
        const el = document.getElementById(elId);
        const clone = el.cloneNode(true);
        clone.style.transform = 'none';
        clone.style.position = 'fixed';
        clone.style.top = '0';
        clone.style.left = '0';
        clone.style.zIndex = '9999';
        clone.style.width = `${w}px`;
        clone.style.height = `${h}px`;
        clone.id = elId + '_capture';
        document.body.appendChild(clone);
      }, id, config.width, config.height);
      const captureEl = await page.$(`#${id}_capture`);
      await captureEl.screenshot({ path: path.join(outputDir, `flynn-screenshot-${id}.png`) });
      await page.evaluate((cid) => document.getElementById(cid).remove(), id + '_capture');
      console.log(`  captured ${id}`);
    }
    await page.close();
  }
  browser.disconnect();
  console.log('\nDone. Output in screenshots_generator/output/');
})().catch((e) => { console.error('RENDER FAILED:', e.message); process.exit(1); });
