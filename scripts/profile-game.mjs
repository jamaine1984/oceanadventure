import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const label = process.argv[2] ?? 'current';
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const results = [];
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))];
try {
  for (const [scene, qa, weather] of [['harbor', 'reset'], ['reef', 'reef'], ['wreck', 'wreck'], ['storm', 'reset', 'Storm'], ['island', 'walk']]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.addInitScript(() => sessionStorage.setItem('ocean-adventure-graphics', 'performance'));
    await page.goto(`http://127.0.0.1:5174/?qa=${qa}&profile`);
    await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 120_000 });
    if (weather) await page.getByRole('button', { name: weather, exact: true }).click();
    await page.waitForTimeout(5000);
    const hardware = await page.evaluate(() => {
      const gl = document.querySelector('#canvas-host canvas').getContext('webgl2');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    const sample = await page.evaluate(async () => {
      const frames = [], start = performance.now(); let last = 0;
      await new Promise(resolve => {
        function collect() {
          const text = document.querySelector('#game-root').dataset.renderProfile;
          if (text) { const frame = JSON.parse(text); if (frame.frame !== last) { frames.push(frame); last = frame.frame; } }
          if (performance.now() - start >= 12_000) resolve(); else requestAnimationFrame(collect);
        }
        requestAnimationFrame(collect);
      });
      return { frames, durationMs: performance.now() - start };
    });
    if (!sample.frames.length) throw new Error(`No render profile from ${scene}`);
    const times = sample.frames.map(f => f.frameMs);
    const record = { scene, hardware, frames: sample.frames.length, fps: Number((sample.frames.length * 1000 / sample.durationMs).toFixed(1)),
      p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), p99Ms: percentile(times, .99),
      updateP50Ms: percentile(sample.frames.map(f => f.updateMs), .5), renderP50Ms: percentile(sample.frames.map(f => f.renderMs), .5),
      trianglesP50: percentile(sample.frames.map(f => f.triangles), .5), callsP50: percentile(sample.frames.map(f => f.calls), .5),
      final: sample.frames.at(-1) };
    results.push(record); console.log(JSON.stringify(record));
    await mkdir('output/gameplay-round2', { recursive: true });
    await page.screenshot({ path: `output/gameplay-round2/${label}-${scene}.png` });
    await context.close();
  }
  await writeFile(`output/gameplay-round2/profile-${label}.json`, JSON.stringify({ label, viewport: '1280x720', graphics: 'performance', sampleSeconds: 12, warmupSeconds: 5, results }, null, 2));
} finally { await browser.close(); }
