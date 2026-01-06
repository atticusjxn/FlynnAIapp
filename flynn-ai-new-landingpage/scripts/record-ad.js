
import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set viewport to 1080x1920 (9:16)
    await page.setViewport({
        width: 1080,
        height: 1920,
        deviceScaleFactor: 1,
    });

    const recorder = new PuppeteerScreenRecorder(page, {
        fps: 60,
        ffmpeg_Path: null, // use default ffmpeg
        videoFrame: {
            width: 1080,
            height: 1920,
        },
        aspectRatio: '9:16',
    });

    const savePath = path.join(__dirname, '..', 'flynn-ad.mp4');
    console.log(`Recording to ${savePath}...`);

    await recorder.start(savePath);

    console.log('Navigating to ad page...');
    // We assume the dev server is running on port 5173
    await page.goto('http://localhost:3000/instagram-ad', {
        waitUntil: 'networkidle0',
    });

    // Wait for the full animation sequence (roughly 15 seconds)
    // Logo (0-2s) -> Text (2-3s) -> CTA (3s+) -> Loop
    // Let's record for 9.5 seconds to capture the CTA well
    console.log('Recording for 9.5 seconds...');
    await new Promise(r => setTimeout(r, 9500));

    await recorder.stop();
    console.log('Recording finished!');

    await browser.close();
})();
