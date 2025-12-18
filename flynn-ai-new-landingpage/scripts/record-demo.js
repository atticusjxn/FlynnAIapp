import { launch } from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

(async () => {
    const browser = await launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set viewport to 1920x1080
    await page.setViewport({ width: 1920, height: 1080 });

    const recorder = new PuppeteerScreenRecorder(page, {
        followNewTab: true,
        fps: 60,
        ffmpeg_Path: null, // Uses internal ffmpeg
        videoFrame: {
            width: 1920,
            height: 1080,
        },
        aspectRatio: '16:9',
    });

    const savePath = join(__dirname, '..', 'demo-video.mp4');
    console.log(`Starting recording to ${savePath}...`);

    await recorder.start(savePath);

    try {
        // Navigate to the demo page
        await page.goto('http://localhost:3000/demo', { waitUntil: 'networkidle0' });
    } catch (e) {
        console.error("Could not connect to localhost:3000. Make sure 'npm run dev' is running.");
        await browser.close();
        process.exit(1);
    }

    // Wait for 32 seconds
    console.log('Recording for 32 seconds...');
    await new Promise(r => setTimeout(r, 32000));

    await recorder.stop();
    console.log('Recording stopped.');

    await browser.close();
    console.log(`Video saved to ${savePath}`);
})();
