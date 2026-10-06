import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';

// Run against npm run dev. Hardware and duration remain explicit in the saved evidence.
const browser = await chromium.launch({
  channel: process.env.GRANULE_BROWSER || undefined,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !!window.granule);
  await page.locator('#sound').check();
  const frames = Number(process.env.GRANULE_BENCH_FRAMES || 7200);
  console.log(`Measuring ${frames} frames…`);
  const start = Date.now();
  const report = await page.evaluate((frames) => window.granule.benchmark(frames), frames);
  const evidence = {
    ...report,
    elapsedSeconds: (Date.now() - start) / 1000,
    date: new Date().toISOString(),
    browser: await browser.version(),
    consoleErrorsOrWarnings: errors,
    representativeMidRangeHardware: false,
    note: 'Phase 2 stress workload repeats every 240 frames with audio telemetry, lighting, and GPU particles. Mid-range hardware remains unverified; the user authorized continuing on the available GPU.',
  };
  await mkdir('verification', { recursive: true });
  await writeFile('verification/phase2-benchmark.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
  if (!report.passed || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
