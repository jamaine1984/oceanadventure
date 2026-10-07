import { expect, test, type Page } from '@playwright/test';
import { verifyScene } from './scene-check';

async function load(page: Page, path: string) {
  await page.goto(path);
  await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await expect(page.locator('canvas')).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ocean-adventure-graphics', 'performance');
    sessionStorage.setItem('ocean-adventure-graphics', 'performance');
  });
});
async function h5Provider(page: Page, scenario: 'complete' | 'dismiss' | 'no-fill' | 'throw' | 'late' | 'save-fail') {
  await page.addInitScript((mode) => {
    (window as any).h5Calls = [];
    (window as any).adConfig = () => {};
    const save = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if ((window as any).failSave && key.endsWith('ocean-adventure-progress-v1')) throw new Error('Storage full');
      save.call(this, key, value);
    };
    (window as any).adBreak = (ad: any) => {
      (window as any).h5Calls.push(ad.type);
      if (mode === 'throw') throw new Error('Provider unavailable');
      if (mode === 'no-fill') { ad.adBreakDone(); return; }
      if (ad.type === 'next') { ad.beforeAd(); ad.afterAd(); ad.adBreakDone(); return; }
      ad.beforeReward(() => {
        if (mode === 'late') {
          setTimeout(() => { ad.beforeAd(); setTimeout(() => { ad.adViewed(); ad.afterAd(); ad.adBreakDone(); }, 4000); }, 18_000);
          return;
        }
        ad.beforeAd();
        if (mode === 'complete' || mode === 'save-fail') { ad.adViewed(); ad.adViewed(); } else ad.adDismissed();
        if (mode === 'save-fail') (window as any).failSave = true;
        ad.afterAd(); ad.adBreakDone(); ad.adBreakDone();
      });
    };
  }, scenario);
}
async function sell(page: Page, google = false) {
  await load(page, `/?qa=return${google ? '&portal=google' : ''}`);
  await page.getByRole('button', { name: 'Harbor', exact: true }).click();
  await page.locator('[data-cash-in]').click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('1510');
  await expect(page.locator('[data-cash-in]')).toBeDisabled();
}

test('fresh research briefing and fleet previews load', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await load(page, '/?qa=reset');
  await verifyScene(page);
  await expect(page.locator('[data-objective]')).toHaveText('Begin your research expedition');
  await page.getByRole('button', { name: 'Open inventory' }).click();
  await expect(page.getByRole('dialog', { name: 'Expedition inventory' })).toBeVisible();
  await expect(page.getByText('Field research kit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fleet', exact: true }).click();
  await expect(page.locator('.inventory__boat-image')).toHaveCount(2);
  for (const image of await page.locator('.inventory__boat-image').all())
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: 'output/inventory-grant-review/01-fleet-desktop.png' });
  expect(errors).toEqual([]);
});

test('underwater inventory freezes oxygen and restores focus', async ({ page }) => {
  await load(page, '/?qa=reef');
  await verifyScene(page);
  await page.getByRole('button', { name: 'Open inventory' }).click();
  const air = await page.locator('[data-air]').innerText();
  await page.waitForTimeout(2500);
  await expect(page.locator('[data-air]')).toHaveText(air);
  await page.getByRole('button', { name: 'Cargo', exact: true }).click();
  await expect(page.locator('.inventory').getByText('Water sample', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/inventory-grant-review/02-cargo-reef.png' });
  await page.getByRole('button', { name: 'Close inventory' }).click();
  await expect(page.getByRole('button', { name: 'Open inventory' })).toBeFocused();
});

test('fleet and tank purchase survive reload', async ({ page }) => {
  await load(page, '/?qa=fleet'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open inventory' }).click();
  await page.getByRole('button', { name: 'Fleet', exact: true }).click();
  await page.locator('[data-inventory-boat="voyager"]').click();
  await expect(page.locator('[data-inventory-boat="voyager"]')).toHaveText('Equipped');
  await expect(page.locator('.inventory__balance')).toHaveText('700 credits');
  await page.getByRole('button', { name: 'Equipment', exact: true }).click();
  await page.locator('[data-inventory-upgrade="tank"]').click();
  await expect(page.locator('.inventory__balance')).toHaveText('350 credits');
  await page.reload(); await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await expect(page.locator('[data-harbor-credits]')).toHaveText('350');
  await expect(page.locator('[data-boat="voyager"]')).toHaveText('Equipped');
  await expect(page.locator('[data-upgrade="tank"]')).toHaveText('613 credits');
});

test('cargo sale receipt prevents a second payout', async ({ page }) => {
  await sell(page);
  await page.reload(); await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await page.getByRole('button', { name: 'Harbor', exact: true }).click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('1510');
  await expect(page.locator('[data-cash-in]')).toHaveText('Cargo sold · receipt saved');
  await expect(page.locator('[data-reward-ad]')).toBeHidden();
});

test('Google reward ignores duplicates and persists across reload', async ({ page }) => {
  await h5Provider(page, 'complete'); await sell(page, true);
  await page.locator('[data-reward-ad]').click();
  await expect(page.locator('[data-grant-offer-amount]')).toHaveText('+500 credits');
  await page.screenshot({ path: 'output/inventory-grant-review/03-research-grant.png' });
  await page.getByRole('button', { name: 'Watch ad', exact: true }).click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('2010');
  await expect(page.locator('[data-grant-status]')).toContainText('Receipt saved');
  await expect(page.locator('[data-reward-ad]')).toBeHidden();
  await page.reload(); await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await page.getByRole('button', { name: 'Harbor', exact: true }).click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('2010');
  await expect(page.locator('[data-reward-ad]')).toBeHidden();
  await page.locator('[data-next-expedition]').click();
  expect(await page.evaluate(() => (window as any).h5Calls)).toEqual([]);
  await expect(page.locator('[data-objective]')).toHaveText('Sail to the turtle lagoon');
  await expect(page.locator('[data-credits]')).toHaveText('2010');
});

test('declined and dismissed Google offers grant no credits', async ({ page }) => {
  await h5Provider(page, 'dismiss'); await sell(page, true);
  await page.locator('[data-reward-ad]').click();
  await page.getByRole('button', { name: 'No thanks', exact: true }).click();
  await expect(page.locator('[data-reward-ad]')).toBeEnabled();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('1510');
  await page.locator('[data-reward-ad]').click();
  await page.getByRole('button', { name: 'Watch ad', exact: true }).click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('1510');
  await expect(page.locator('[data-reward-ad]')).toBeEnabled();
});

test('Google no-fill permits another survey', async ({ page }) => {
  await h5Provider(page, 'no-fill'); await sell(page, true);
  await page.locator('[data-reward-ad]').click();
  await expect(page.locator('[data-next-expedition]')).toBeEnabled();
  await expect(page.locator('[data-grant-offer]')).not.toBeVisible();
  await page.locator('[data-next-expedition]').click();
  await expect(page.locator('[data-objective]')).toHaveText('Sail to the turtle lagoon');
  expect(await page.evaluate(() => (window as any).h5Calls)).toEqual(['reward', 'next']);
});

test('mobile inventory fits and categories remain reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await load(page, '/?qa=reset');
  await verifyScene(page);
  await page.getByRole('button', { name: 'Open inventory' }).click();
  for (const name of ['Fleet', 'Equipment', 'Cargo', 'Collection']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.inventory__heading h3')).toHaveText(name);
  }
  const bounds = await page.locator('.inventory').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(844);
  await page.getByRole('button', { name: 'Equipment', exact: true }).click();
  await page.screenshot({ path: 'output/inventory-grant-review/04-equipment-mobile.png' });
});

test('late Google video pauses after the watchdog without paying an expired grant', async ({ page }) => {
  await h5Provider(page, 'late'); await sell(page, true);
  await page.locator('[data-reward-ad]').click();
  await page.getByRole('button', { name: 'Watch ad', exact: true }).click();
  await expect(page.locator('[data-reward-ad]')).toBeEnabled({ timeout: 17_000 });
  await expect(page.locator('[data-reward-ad]')).toBeDisabled({ timeout: 6000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-harbor]')).toHaveClass(/is-open/);
  await expect(page.locator('[data-reward-ad]')).toBeEnabled({ timeout: 8000 });
  await expect(page.locator('[data-harbor-credits]')).toHaveText('1510');
});

test('failed grant save retries without another video and departure saves first', async ({ page }) => {
  await h5Provider(page, 'save-fail'); await sell(page, true);
  await page.locator('[data-reward-ad]').click();
  await page.getByRole('button', { name: 'Watch ad', exact: true }).click();
  await expect(page.locator('[data-reward-ad]')).toHaveText('Save research grant');
  await expect(page.locator('[data-harbor-credits]')).toHaveText('1510');
  await page.locator('[data-next-expedition]').click();
  await expect(page.locator('[data-harbor]')).toHaveClass(/is-open/);
  await page.evaluate(() => { (window as any).failSave = false; });
  await page.locator('[data-reward-ad]').click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('2010');
  expect(await page.evaluate(() => (window as any).h5Calls)).toEqual(['reward']);
  await page.evaluate(() => { (window as any).failSave = true; });
  await page.locator('[data-next-expedition]').click();
  await expect(page.locator('[data-harbor]')).toHaveClass(/is-open/);
  await expect(page.locator('[data-cash-in]')).toHaveText('Cargo sold · receipt saved');
  await page.evaluate(() => { (window as any).failSave = false; });
  await page.reload(); await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await page.getByRole('button', { name: 'Harbor', exact: true }).click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('2010');
  await expect(page.locator('[data-reward-ad]')).toBeHidden();
});

test('closing inventory during a vessel load cannot dive or publish an uncommitted boat', async ({ page }) => {
  await load(page, '/?qa=fleet'); await page.keyboard.press('Escape');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/voyager_research_launch_v2.glb', async route => { await gate; await route.continue(); });
  await page.getByRole('button', { name: 'Open inventory' }).click();
  await page.getByRole('button', { name: 'Fleet', exact: true }).click();
  await page.locator('[data-inventory-boat="voyager"]').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Dive', exact: true }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-player-mode', 'helm');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ocean-adventure-preview-fleet-ocean-adventure-progress-v1')!));
  expect(stored.activeBoat).toBe('aurora'); expect(stored.credits).toBe(2500);
  release();
  await expect(page.locator('[data-vessel-title]')).toHaveText('Voyager X expedition', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Open inventory' }).click();
  await expect(page.locator('[data-inventory-boat="voyager"]')).toHaveText('Equipped');
  await expect(page.locator('.inventory__balance')).toHaveText('700 credits');
});

test('normal game save has one writer and unlocks after closing that tab', async ({ page, context }) => {
  await load(page, '/');
  const second = await context.newPage(); await second.goto('/');
  await expect(second.getByText('Ocean Adventure is open in another tab', { exact: true })).toBeVisible();
  await page.close();
  await second.getByRole('button', { name: 'Reload game', exact: true }).click();
  await second.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await expect(second.locator('[data-objective]')).toHaveText('Begin your research expedition');
  await second.close();
});

test('a real photograph appears in the persistent collection after reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await load(page, '/?qa=reef');
  const shutter = page.getByRole('button', { name: 'Photograph · F', exact: true });
  if (!await shutter.isEnabled()) await page.getByRole('button', { name: 'Swim assist', exact: true }).click();
  await expect(shutter).toBeEnabled({ timeout: 30_000 });
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    (window as any).restorePhotoCanvas = () => { HTMLCanvasElement.prototype.getContext = original; };
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: any[]) {
      if (this.width === 640 && this.height === 400 && args[0] === '2d') return null;
      return original.apply(this, args as any);
    } as typeof original;
  });
  await shutter.click();
  await expect(page.locator('[data-objective]')).toContainText('0/3 species');
  await expect(page.locator('[data-notice]')).toContainText('no observation was recorded');
  await verifyScene(page);
  await page.evaluate(() => { (window as any).restorePhotoCanvas(); delete (window as any).restorePhotoCanvas; });
  if (!await shutter.isEnabled()) await page.getByRole('button', { name: 'Swim assist', exact: true }).click();
  await expect(shutter).toBeEnabled({ timeout: 30_000 }); await shutter.click();
  await expect(page.locator('[data-objective]')).toContainText('1/3 species');
  await verifyScene(page);
  await page.getByRole('button', { name: 'Open inventory' }).click();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.locator('.inventory__photo')).toHaveCount(1);
  const src = await page.locator('.inventory__photo').getAttribute('src');
  expect(src).toMatch(/^data:image\/jpeg;base64,/);
  await page.screenshot({ path: 'output/gameplay-round2/08-sharp-subject-photo.png' });
  await page.reload(); await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 60_000 });
  await page.getByRole('button', { name: 'Open inventory' }).click();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.locator('.inventory__photo')).toHaveAttribute('src', src!);
  expect(errors).toEqual([]);
});
