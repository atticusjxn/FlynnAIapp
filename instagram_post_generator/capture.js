const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: {
            width: 1920,
            height: 1080
        }
    });
    const page = await browser.newPage();

    // Load the local HTML file
    const filePath = `file://${path.join(__dirname, 'index.html')}`;
    await page.goto(filePath, { waitUntil: 'networkidle0' });

    // Define slides to capture
    const slides = ['slide1', 'slide2', 'slide3', 'slide4', 'slide5'];

    for (let i = 0; i < slides.length; i++) {
        const slideId = slides[i];
        const element = await page.$(`#${slideId}`);

        if (element) {
            // We need to ensure the element is captured at full resolution (1080x1350)
            // The CSS scales it down for preview. We might need to adjust styles or viewport.
            // Or we can just screenshot the element. Puppeteer screenshots the element at its current rendered size.
            // Since we applied transform: scale(0.4), it will be small.

            // Let's evaluate script in the page to reset the scale for capture
            await page.evaluate((id) => {
                const el = document.getElementById(id);
                el.style.transform = 'scale(1)';
                el.style.position = 'fixed';
                el.style.top = '0';
                el.style.left = '0';
                el.style.zIndex = '9999';
            }, slideId);

            // Set viewport to match slide size
            await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });

            await element.screenshot({
                path: `flynn_insta_${slideId}.png`,
                omitBackground: false
            });

            // Reset styles (optional, but good for consistency if we were staying on page)
            await page.evaluate((id) => {
                const el = document.getElementById(id);
                el.style.transform = 'scale(0.4)';
                el.style.position = 'absolute';
                el.style.top = '0';
                el.style.left = '0';
                el.style.zIndex = '';
            }, slideId);

            console.log(`Captured ${slideId}`);
        }
    }

    await browser.close();
})();
