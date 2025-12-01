const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const configs = [
    {
        name: '6.5_inch',
        width: 1242,
        height: 2688,
        scale: 1
    },
    {
        name: '6.7_inch',
        width: 1284,
        height: 2778,
        scale: 1
    }
];

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch();

    for (const config of configs) {
        console.log(`\nProcessing config: ${config.name} (${config.width}x${config.height})...`);

        const page = await browser.newPage();
        await page.setViewport({ width: config.width, height: config.height, deviceScaleFactor: config.scale });

        const filePath = `file://${path.join(__dirname, 'index.html')}`;
        console.log(`Opening ${filePath}...`);
        await page.goto(filePath, { waitUntil: 'networkidle0' });

        // Wait for fonts to load
        await page.evaluate(() => document.fonts.ready);

        // Update CSS variables for the specific resolution
        await page.evaluate((w, h) => {
            document.documentElement.style.setProperty('--screen-width', `${w}px`);
            document.documentElement.style.setProperty('--screen-height', `${h}px`);
        }, config.width, config.height);

        const slides = ['slide1', 'slide2', 'slide3', 'slide4', 'slide5'];

        for (const id of slides) {
            console.log(`Capturing ${id}...`);
            const element = await page.$(`#${id}`);

            if (element) {
                await page.evaluate((elId, w, h) => {
                    const el = document.getElementById(elId);
                    // Clone it to body to isolate it and remove transform
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
                    return elId + '_capture';
                }, id, config.width, config.height);

                const captureEl = await page.$(`#${id}_capture`);
                // Ensure output directory exists
                const outputDir = path.join(__dirname, 'output', config.name);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                await captureEl.screenshot({ path: path.join(outputDir, `flynn-screenshot-${id}.png`) });

                // Clean up
                await page.evaluate((captureId) => {
                    const el = document.getElementById(captureId);
                    el.remove();
                }, id + '_capture');
            } else {
                console.error(`Element #${id} not found!`);
            }
        }
        await page.close();
    }

    console.log('\nDone! Screenshots saved to screenshots_generator/output/ folder.');
    await browser.close();
})();
