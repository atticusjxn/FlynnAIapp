/**
 * Renders the ad-creative HTML templates to PNG at every Meta placement
 * ratio. Same GUI-Chrome workaround as screenshots_generator/capture_store.js
 * — headless Chrome hangs on this machine.
 *
 * Usage: node render.js
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const RATIOS = [
  { name: '9x16', width: 1080, height: 1920 }, // Reels / Stories
  { name: '4x5', width: 1080, height: 1350 },  // Feed
  { name: '1x1', width: 1080, height: 1080 },  // Feed / carousel
];

const SINGLE_SLIDES = ['a-painpoint', 'b-callnow', 'c-hero-home', 'd-hero-invoice'];
const CAROUSEL_CARDS = ['c1', 'c2', 'c3', 'c4'];

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null,
  });
  const page = await browser.newPage();

  const outDir = path.resolve(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });

  // Flat filenames with the ratio suffixed — e.g. b-callnow-1x1.png — so
  // they sort and identify themselves correctly once dropped into Meta's
  // ad set uploader, which only ever sees a flat file list.
  for (const slide of SINGLE_SLIDES) {
    const url = 'file://' + path.resolve(__dirname, 'html', slide + '.html');
    for (const ratio of RATIOS) {
      await page.setViewport({ width: ratio.width, height: ratio.height, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 400)); // let @font-face settle
      const file = path.join(outDir, `${slide}-${ratio.name}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: ratio.width, height: ratio.height } });
      console.log(`${ratio.name}  ${slide}`);
    }
  }

  // Carousel: only needs the square placement.
  const carouselUrl = 'file://' + path.resolve(__dirname, 'html', 'e-carousel.html');
  await page.setViewport({ width: 1080, height: 1080 * CAROUSEL_CARDS.length, deviceScaleFactor: 1 });
  await page.goto(carouselUrl, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  for (let i = 0; i < CAROUSEL_CARDS.length; i++) {
    const el = await page.$('#' + CAROUSEL_CARDS[i]);
    const file = path.join(outDir, `e-carousel-card-${i + 1}-1x1.png`);
    await el.screenshot({ path: file });
    console.log(`carousel  card-${i + 1}`);
  }

  await page.close();
  browser.disconnect();
  console.log('done');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
