const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        defaultViewport: { width: 1290, height: 2796, deviceScaleFactor: 1 }
    });
    const page = await browser.newPage();

    const filePath = `file://${path.join(__dirname, 'index.html')}`;
    console.log(`Opening ${filePath}...`);
    await page.goto(filePath, { waitUntil: 'networkidle0' });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    const slides = ['slide1', 'slide2', 'slide3', 'slide4', 'slide5'];

    for (const id of slides) {
        console.log(`Capturing ${id}...`);
        const element = await page.$(`#${id}`);

        if (element) {
            // We need to ensure the element is visible and not scaled down for the capture
            // The CSS has .screenshot { transform: scale(0.2); }
            // We need to reset that for the capture

            await page.evaluate((elId) => {
                const el = document.getElementById(elId);
                // Clone it to body to isolate it and remove transform
                const clone = el.cloneNode(true);
                clone.style.transform = 'none';
                clone.style.position = 'fixed';
                clone.style.top = '0';
                clone.style.left = '0';
                clone.style.zIndex = '9999';
                clone.style.width = '1290px';
                clone.style.height = '2796px';
                clone.id = elId + '_capture';
                document.body.appendChild(clone);
                return elId + '_capture';
            }, id);

            const captureEl = await page.$(`#${id}_capture`);
            await captureEl.screenshot({ path: path.join(__dirname, `flynn-screenshot-${id}.png`) });

            // Clean up
            await page.evaluate((captureId) => {
                const el = document.getElementById(captureId);
                el.remove();
            }, id + '_capture');
        } else {
            console.error(`Element #${id} not found!`);
        }
    }

    console.log('Done! Screenshots saved to screenshots_generator/ folder.');
    await browser.close();
})();
