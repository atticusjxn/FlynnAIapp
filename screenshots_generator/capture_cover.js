
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    console.log('Launching browser for Cover Image...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set viewport to target dimensions
    await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });

    const filePath = `file://${path.join(__dirname, 'cover.html')}`;
    console.log(`Opening ${filePath}...`);
    await page.goto(filePath, { waitUntil: 'networkidle0' });

    // Wait for fonts
    await page.evaluate(() => document.fonts.ready);

    const outputDir = path.join(__dirname, 'output', 'cover');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const captureEl = await page.$('#capture-target');

    // We trim the screenshot to the element to ensure no extra whitespace from the body
    await captureEl.screenshot({
        path: path.join(outputDir, 'feature_graphic.png'),
        omitBackground: true
    });

    console.log(`Saved to ${path.join(outputDir, 'feature_graphic.png')}`);

    await browser.close();
})();
