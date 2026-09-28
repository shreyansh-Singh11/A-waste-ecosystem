// Automated Demo Video Recorder using Playwright
// Records the 5-minute interactive pitch theater in 1920x1080 Full HD

import fs from 'fs';
import path from 'path';

// Helper to resolve chromium dynamically
async function getChromium() {
  try {
    const pw = await import('playwright');
    return pw.chromium;
  } catch (e) {
    const cachePath = 'C:/Users/shreyansh/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
    if (fs.existsSync(cachePath)) {
      const pw = await import('file:///' + cachePath);
      return pw.chromium;
    }
    throw new Error('Playwright not found in node_modules or npx cache.');
  }
}

const OUTPUT_DIR = path.resolve('playwright-audit', 'videos');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Configurable recording duration in seconds (default 305s for full 5 mins)
const DURATION_SECS = parseInt(process.env.DEMO_DURATION || '305', 10);

console.log(`🎬 Starting 1080p Demo Video Recording...`);
console.log(`⏱️ Duration target: ${DURATION_SECS} seconds`);

(async () => {
  const chromium = await getChromium();
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  console.log(`🌐 Navigating to http://localhost:3000/demo/ ...`);
  await page.goto('http://localhost:3000/demo/', { waitUntil: 'networkidle' });

  // Start demo playback automatically
  await page.waitForTimeout(1000);
  console.log(`▶️ Triggering Demo Playback...`);
  await page.click('#btnPlayPause');

  console.log(`🎥 Recording in progress... (${DURATION_SECS} seconds)`);
  
  // Progress logging
  let elapsed = 0;
  while (elapsed < DURATION_SECS) {
    const sleep = Math.min(10, DURATION_SECS - elapsed);
    await page.waitForTimeout(sleep * 1000);
    elapsed += sleep;
    console.log(`⏳ Recorded ${elapsed} / ${DURATION_SECS} seconds...`);
  }

  console.log(`✅ Recording complete. Finalizing video file...`);
  await page.close();
  await context.close();
  await browser.close();

  // Find latest recorded video
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.webm'))
    .map(f => ({ name: f, time: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (files.length > 0) {
    const latestVideo = path.join(OUTPUT_DIR, files[0].name);
    console.log(`🎉 Demo Video successfully saved to:\n${latestVideo}`);
  }
})();
