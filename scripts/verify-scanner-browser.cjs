// Consumed by playwright-cli run-code --filename, which provides the page argument.
async page => {
  const origin = new URL(page.url()).origin;
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw Error('Scanner QA requires an isolated localhost preview.');
  await page.goto('about:blank');
  const context = await page.context().browser().newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  await context.addInitScript(() => sessionStorage.setItem('ocean-adventure-graphics', 'performance'));
  const screen = await context.newPage(), errors = [], evidence = [];
  screen.on('pageerror', error => errors.push(error.message));
  try {
    await screen.goto(origin + '/?qa=reef&profile');
    await screen.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60000 });
    await screen.getByRole('button', { name: 'Scanner', exact: true }).tap();
    await screen.locator('[data-sonar-contacts]').waitFor({ state: 'visible', timeout: 15000 });
    const session = await context.newCDPSession(screen);
    const swipe = async upward => {
      const rect = await screen.locator('.dive-tools').boundingBox();
      const x = rect.x + rect.width - 20, start = upward ? rect.y + rect.height - 8 : rect.y + 8;
      const end = upward ? rect.y + 8 : rect.y + rect.height - 8;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
      for (let step = 1; step <= 10; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start + (end - start) * step / 10 }] });
        await screen.waitForTimeout(30);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await screen.waitForTimeout(150);
    };
    const scroll = () => screen.locator('.dive-tools').evaluate(el => ({ top: el.scrollTop, maximum: el.scrollHeight - el.clientHeight }));
    for (let i = 0; i < 8 && (await scroll()).top > 1; i++) await swipe(false);
    if ((await scroll()).top > 1) throw Error('Touch cannot reach the tool tabs');
    await screen.screenshot({ path: 'output/playwright/scan-touch-top.png' });
    for (let i = 0; i < 8 && (await scroll()).top < (await scroll()).maximum - 2; i++) await swipe(true);
    const bottom = await scroll();
    if (bottom.top < bottom.maximum - 2) throw Error('Touch cannot reach identification details');
    await screen.screenshot({ path: 'output/playwright/scan-touch-bottom.png' });
    await screen.locator('[data-scan-target]').selectOption('sediment');
    await screen.waitForFunction(() => document.querySelector('[data-scan-note]').textContent.includes('sediment'));
    const profile = () => screen.locator('#game-root').evaluate(el => JSON.parse(el.dataset.renderProfile));
    const automaticStart = (await profile()).sonarSweeps;
    await screen.waitForFunction(count => JSON.parse(document.querySelector('#game-root').dataset.renderProfile).sonarSweeps > count, automaticStart, { timeout: 30000 });
    await screen.getByRole('button', { name: 'Automatic scanning', exact: true }).tap();
    const manual = (await profile()).sonarSweeps;
    await screen.waitForTimeout(10000);
    if ((await profile()).sonarSweeps !== manual) throw Error('Manual mode still emits automatic sweeps');
    await screen.getByRole('button', { name: 'Scan / recover · F', exact: true }).tap();
    await screen.waitForTimeout(300);
    if ((await profile()).sonarSweeps <= manual) throw Error('Touch manual scan failed');
    for (const size of [{ width: 844, height: 390 }, { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
      await screen.setViewportSize(size);
      const layout = await screen.locator('.dive-tools').evaluate(el => { const rect = el.getBoundingClientRect(), hud = document.querySelector('.hud__strip').getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, hudBottom: hud.bottom }; });
      if (layout.x < 0 || layout.right > size.width || layout.y < layout.hudBottom + 4 || layout.bottom > size.height) throw Error('Scanner overlaps HUD/viewport ' + JSON.stringify({ size, layout }));
      await screen.locator('[data-scan-target]').scrollIntoViewIfNeeded();
      await screen.screenshot({ path: `output/playwright/scan-touch-${size.width}x${size.height}.png` });
      const canvas = screen.locator('#canvas-host canvas'), first = await canvas.screenshot();
      const pixels = await screen.evaluate(async base64 => {
        const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + base64)).blob());
        const sample = document.createElement('canvas'); sample.width = sample.height = 24;
        const ctx = sample.getContext('2d'); ctx.drawImage(bitmap, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data, colors = new Set(); let brightness = 0;
        for (let i = 0; i < data.length; i += 4) { colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); brightness += data[i] + data[i + 1] + data[i + 2]; }
        return { colors: colors.size, brightness: brightness / 1728 };
      }, first.toString('base64'));
      if (pixels.colors < 40 || pixels.brightness < 15) throw Error('Blank scene ' + JSON.stringify(pixels));
      await screen.waitForTimeout(1100);
      if ((await canvas.screenshot()).equals(first)) throw Error('Scene is not moving');
      evidence.push({ size, pixels });
    }
    if (errors.length) throw Error(errors.join('; '));
    return { touchScroll: bottom, manualScanning: true, errors, evidence };
  } finally { await context.close(); }
}
