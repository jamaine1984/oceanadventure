import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { verifyScene } from './scene-check';

test('a fresh expedition completes through real controls, mooring, shore sale and another survey', async ({ page }) => {
  test.setTimeout(480_000);
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('ocean-adventure-graphics', 'performance');
  });
  await page.goto('/?qa=chapter');
  await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  console.log('Chapter: loaded fresh harbor');
  const objective = page.locator('[data-objective]');
  const assist = page.locator('[data-cruise]');
  const interact = page.locator('[data-interact]');
  const mode = page.locator('#game-root');
  await page.locator('[data-stand]').click();
  console.log('Chapter: opened briefing');
  await page.locator('[data-next-expedition]').click();
  await expect(objective).toHaveText('Sail to the reef survey site');
  await assist.click();
  await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 60_000 });
  console.log('Chapter: sailed to reef');
  await page.screenshot({ path: 'output/gameplay-round2/01-reef-arrival.png' });
  await page.locator('[data-mode-toggle]').click();
  await expect(mode).toHaveAttribute('data-player-mode', 'swim');
  for (let count = 1; count <= 3; count++) {
    await assist.click();
    await expect(interact).toBeEnabled({ timeout: 60_000 });
    await interact.click();
    await expect(objective).toContainText(`${count}/3 species`);
    console.log(`Chapter: photographed species ${count}`);
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'output/gameplay-round2/02-reef-photographs.png' });
  await page.locator('[data-tool="sampler"]').click();
  for (let count = 1; count <= 2; count++) {
    if (await assist.getAttribute('aria-pressed') === 'false') await assist.click();
    await expect(interact).toBeEnabled({ timeout: 45_000 });
    if (count === 1) await interact.click();
    else await page.keyboard.press('f');
    if (count === 1) await expect(objective).toContainText('1/2 samples');
    console.log(`Chapter: collected sample ${count}`);
  }
  await expect(objective).toContainText('Return to your vessel');
  await page.locator('[data-mode-toggle]').click();
  await expect(mode).toHaveAttribute('data-player-mode', 'helm', { timeout: 60_000 });
  console.log('Chapter: boarded from reef');
  await expect(objective).toHaveText('Sail to the wreck recovery site');
  await assist.click();
  await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 60_000 });
  await page.locator('[data-mode-toggle]').click();
  await page.locator('[data-tool="cutter"]').click();
  await assist.click();
  await expect(interact).toBeEnabled({ timeout: 60_000 });
  await page.screenshot({ path: 'output/gameplay-round2/03-wreck-cable.png' });
  await interact.click();
  await expect(objective).toHaveText('Retrieve the research sensor');
  console.log('Chapter: released cable');
  await page.locator('[data-tool="scanner"]').click();
  await assist.click();
  await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 30_000 });
  await interact.click();
  await expect(objective).toContainText('Return to your vessel');
  console.log('Chapter: recovered sensor');
  await page.locator('[data-mode-toggle]').click();
  await expect(mode).toHaveAttribute('data-player-mode', 'helm', { timeout: 60_000 });
  await assist.click();
  await expect(page.locator('[data-walk]')).toBeEnabled({ timeout: 120_000 });
  await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 15_000 });
  console.log('Chapter: moored with gangway reachable');
  await page.screenshot({ path: 'output/gameplay-round2/04-moored-north.png' });
  await page.locator('[data-walk]').click();
  await expect(mode).toHaveAttribute('data-player-mode', 'walk');
  await page.locator('[data-land-destination]').selectOption('research');
  await assist.click();
  // The full pier route takes about 46 seconds at the calibrated walking pace.
  await expect(page.locator('[data-land-interact]')).toHaveText('Visit counter · F', { timeout: 90_000 });
  await page.locator('[data-land-interact]').click();
  await page.locator('[data-cash-in]').click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('1510');
  console.log('Chapter: sold actual earned cargo ashore');
  await expect(page.locator('[data-cash-in]')).toBeDisabled();
  await page.screenshot({ path: 'output/gameplay-round2/05-earned-sale.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Equipment', exact: true }).click();
  await page.locator('[data-inventory-upgrade="tank"]').click();
  await expect(page.locator('.inventory__balance')).toHaveText('1,160 credits');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.locator('.inventory__photo')).toHaveCount(3);
  const photos = await page.locator('.inventory__photo').evaluateAll(images => images.map(image => image.getAttribute('src')));
  await page.screenshot({ path: 'output/gameplay-round2/06-earned-collection.png' });
  await page.reload();
  await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await expect(page.locator('[data-credits]')).toHaveText('1160');
  await page.locator('[data-stand]').click();
  await expect(page.locator('[data-cash-in]')).toBeDisabled();
  await page.locator('[data-next-expedition]').click();
  await page.getByRole('button', { name: 'Open inventory', exact: true }).click();
  await expect(objective).toHaveText('Sail to the turtle lagoon');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  expect(await page.locator('.inventory__photo').evaluateAll(images => images.map(image => image.getAttribute('src')))).toEqual(photos);
  await page.getByRole('button', { name: 'Cargo', exact: true }).click();
  await expect(page.locator('.inventory__heading h3')).toHaveText('Cargo');
  await expect(page.locator('.inventory').getByText('0 recorded · 0 credits', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/gameplay-round2/07-next-survey.png' });
  expect(errors).toEqual([]);
});

test('dragging the swim camera cancels vessel return and the next click restarts it', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ocean-adventure-graphics', 'performance'));
  await page.goto('/?qa=reef');
  await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  const button = page.locator('[data-mode-toggle]');
  await button.click();
  await expect(button).toHaveText('Cancel boat return');
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(680, 365, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('[data-cruise]')).toHaveAttribute('aria-pressed', 'false');
  await expect(button).toHaveText('Return to boat');
  await button.click();
  await expect(button).toHaveText('Cancel boat return');
  await expect(page.locator('[data-cruise]')).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(button).toHaveText('Return to boat');
});

test('Seagrass Watch earns a distinct lagoon survey, stable readings and persistent rewards through actual controls', async ({ page }) => {
  test.setTimeout(600_000);
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('ocean-adventure-graphics', 'performance');
    const save=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value) {
      if((window as any).failCargoSave&&key.endsWith('ocean-adventure-progress-v1'))throw new Error('Storage full');
      save.call(this,key,value);
    };
  });
  await page.goto('/?qa=lagoon&profile');
  await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  const objective = page.locator('[data-objective]');
  const assist = page.locator('[data-cruise]');
  const interact = page.locator('[data-interact]');
  const mode = page.locator('#game-root');
  const reading = page.locator('[data-reading-progress]');
  await expect(objective).toHaveText('Sail to the turtle lagoon');
  await assist.click();
  await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 75_000 });
  await page.locator('[data-mode-toggle]').click();
  await expect(mode).toHaveAttribute('data-player-mode', 'swim');
  console.log('Lagoon: arrived with no seeded cargo');
  for (let count = 1; count <= 2; count++) {
    if (await assist.getAttribute('aria-pressed') === 'false') await assist.click();
    await expect(interact).toBeEnabled({ timeout: 60_000 });
    await interact.click();
    await expect(objective).toContainText(`${count}/2 species`);
    console.log(`Lagoon: photographed required species ${count}`);
  }
  await page.waitForTimeout(1200);
  await verifyScene(page);
  const profile=await page.evaluate(async()=>{
    const frames:Array<{frame:number;frameMs:number;triangles:number;calls:number}> = [];
    const start=performance.now();let last=0;
    await new Promise<void>(resolve=>{
      const collect=()=>{
        const data=document.querySelector<HTMLElement>('#game-root')!.dataset.renderProfile;
        if(data){const frame=JSON.parse(data);if(frame.frame!==last){frames.push(frame);last=frame.frame;}}
        if(performance.now()-start>=12000)resolve();else requestAnimationFrame(collect);
      };requestAnimationFrame(collect);
    });
    const gl=document.querySelector<HTMLCanvasElement>('#canvas-host canvas')!.getContext('webgl2')!;
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const times=frames.map(f=>f.frameMs).sort((a,b)=>a-b);
    return {scene:'lagoon',viewport:'1280x720',graphics:'performance',sampleSeconds:12,hardware:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),frames:frames.length,fps:Number((frames.length*1000/(performance.now()-start)).toFixed(1)),p95Ms:times[Math.floor(times.length*.95)],final:frames.at(-1)};
  });
  expect(profile.frames).toBeGreaterThan(20);
  await mkdir('output/gameplay-round3',{recursive:true});
  await writeFile('output/gameplay-round3/profile-lagoon.json',JSON.stringify(profile,null,2));
  console.log('Lagoon profile:',JSON.stringify(profile));
  await page.screenshot({ path: 'output/gameplay-round3/01-lagoon-wildlife.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await verifyScene(page);
  await page.screenshot({ path: 'output/gameplay-round3/02-lagoon-mobile.png' });
  expect(await page.locator('body').evaluate(body => body.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('[data-tool="sampler"]').click();
  for (let count = 1; count <= 2; count++) {
    if (await assist.getAttribute('aria-pressed') === 'false') await assist.click();
    await expect(interact).toBeEnabled({ timeout: 60_000 });
    await interact.click();
    if (count === 1) await expect(objective).toContainText('1/2 samples');
  }
  await expect(objective).toContainText('Return to your vessel');
  await page.locator('[data-mode-toggle]').click();
  await expect(mode).toHaveAttribute('data-player-mode', 'helm', { timeout: 75_000 });
  await expect(objective).toHaveText('Sail to the acoustic transect');
  await assist.click();
  await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 75_000 });
  await page.locator('[data-mode-toggle]').click();
  await page.locator('[data-tool="scanner"]').click();
  await assist.click();
  await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 60_000 });
  await expect(interact).toBeEnabled();
  await interact.click();
  await expect(reading).toBeVisible();
  await page.keyboard.down('w');
  await page.waitForTimeout(180);
  await page.keyboard.up('w');
  await expect(reading).toBeHidden();
  await expect(objective).toContainText('0/3 readings');
  console.log('Lagoon: movement interrupted a reading without credit');
  if (!(await interact.isEnabled())) {
    await assist.click();
    await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 30_000 });
  }
  await expect(interact).toBeEnabled();
  await interact.click();
  await page.locator('[data-pause-toggle]').click();
  await expect(reading).toBeVisible();
  const pausedValue = await reading.getAttribute('value');
  await page.waitForTimeout(1_200);
  await expect(reading).toHaveAttribute('value', pausedValue!);
  await page.locator('[data-resume]').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'output/gameplay-round3/03-acoustic-reading.png' });
  await expect(objective).toContainText('1/3 readings', { timeout: 10_000 });
  console.log('Lagoon: pause froze dwell, resume earned the first reading');
  await page.reload();
  await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await expect(objective).toHaveText('Sail to the acoustic transect');
  await page.locator('[data-mode-toggle]').click();
  await page.locator('[data-tool="scanner"]').click();
  await expect(objective).toContainText('1/3 readings');
  await expect(reading).toBeHidden();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'output/gameplay-round3/04-partial-reload.png' });
  for (let count = 2; count <= 3; count++) {
    await assist.click();
    await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 60_000 });
    await expect(interact).toBeEnabled();
    if(count===2) {
      await page.keyboard.down('q');
      await expect(interact).toBeDisabled();
      await page.keyboard.up('q');
      await expect(interact).toBeEnabled();
      await page.keyboard.down('Space');
      await expect(interact).toBeDisabled();
      await page.keyboard.up('Space');
      await expect(interact).toBeEnabled();
      await page.screenshot({path:'output/gameplay-round3/07-station-ready.png'});
    }
    await interact.click();
    if (count < 3) await expect(objective).toContainText(`${count}/3 readings`, { timeout: 10_000 });
    else await expect(objective).toContainText('Return to your vessel', { timeout: 10_000 });
    console.log(`Lagoon: completed reading ${count}`);
  }
  await page.locator('[data-mode-toggle]').click();
  await expect(mode).toHaveAttribute('data-player-mode', 'helm', { timeout: 75_000 });
  await assist.click();
  await expect(page.locator('[data-walk]')).toBeEnabled({ timeout: 120_000 });
  await expect(assist).toHaveAttribute('aria-pressed', 'false', { timeout: 15_000 });
  await page.locator('[data-stand]').click();
  await page.evaluate(()=>(window as any).failCargoSave=true);
  await page.locator('[data-cash-in]').click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('0');
  await expect(page.locator('[data-cash-in]')).toBeEnabled();
  await expect(page.locator('[data-notice]')).toContainText('Cargo kept safely aboard');
  await page.evaluate(()=>(window as any).failCargoSave=false);
  await page.locator('[data-cash-in]').click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('1540');
  await expect(page.locator('[data-cash-in]')).toBeDisabled();
  await page.screenshot({ path: 'output/gameplay-round3/05-lagoon-sale.png' });
  console.log('Lagoon: sold actual two-species, two-sample, three-reading cargo for 1540');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.locator('.inventory__photo')).toHaveCount(2);
  await page.screenshot({path:'output/gameplay-round3/08-lagoon-collection.png'});
  const photos = await page.locator('.inventory__photo').evaluateAll(images => images.map(image => image.getAttribute('src')));
  await page.reload();
  await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await expect(page.locator('[data-credits]')).toHaveText('1540');
  await page.locator('[data-stand]').click();
  await expect(page.locator('[data-cash-in]')).toBeDisabled();
  await page.locator('[data-next-expedition]').click();
  await expect(objective).toHaveText('Sail to the coral garden');
  await page.getByRole('button', { name: 'Open inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  expect(await page.locator('.inventory__photo').evaluateAll(images => images.map(image => image.getAttribute('src')))).toEqual(photos);
  await page.getByRole('button', { name: 'Cargo', exact: true }).click();
  await expect(page.locator('.inventory').getByText('0 recorded · 0 credits', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/gameplay-round3/06-next-passage.png' });
  expect(errors).toEqual([]);
});

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    console.log('Chapter failure:', await page.locator('#game-root').getAttribute('data-player-mode'), await page.locator('[data-objective]').innerText(), await page.locator('[data-tool-prompt]').innerText(), await page.locator('[data-notice]').innerText());
    await page.screenshot({ path: 'output/gameplay-round2/chapter-failure.png' });
  }
});
