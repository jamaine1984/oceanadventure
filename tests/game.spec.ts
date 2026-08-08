import { expect, test, type Page } from '@playwright/test';

async function expectLoaded(page: Page) {
  await page.locator('[data-loading]').waitFor({ state: 'hidden', timeout: 30_000 });
  await expect(page.locator('canvas')).toBeVisible();
}

function failOnPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return () => expect(errors, errors.join('\n')).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?qa=reset');
  await expectLoaded(page);
});

test('standalone build loads, renders, and hides portal rewards', async ({ page }) => {
  const assertNoErrors = failOnPageErrors(page);
  await page.goto('/');
  await expectLoaded(page);
  await expect(page.locator('[data-objective]')).toHaveText('Reach the first signal buoy');
  await expect.poll(async () => Number(await page.locator('[data-target-range]').innerText())).toBeGreaterThan(20);
  await expect(page.locator('[data-reward-ad]')).toBeHidden();
  await expect.poll(async () => Number(await page.locator('[data-fps]').innerText())).toBeGreaterThanOrEqual(30);
  assertNoErrors();
});

test('pause menu stops play and changes graphics profile', async ({ page }) => {
  await page.goto('/');
  await expectLoaded(page);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('[data-pause-menu]')).toHaveAttribute('aria-hidden', 'false');
  await page.getByRole('button', { name: 'Performance' }).click();
  await expect(page.getByRole('button', { name: 'Performance' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Resume voyage' }).click();
  await expect(page.locator('[data-pause-menu]')).toHaveAttribute('aria-hidden', 'true');
});

test('underwater mission exposes beacon guidance and stable air telemetry', async ({ page }) => {
  await page.goto('/?qa=dive');
  await expectLoaded(page);
  await expect(page.locator('[data-mode]')).toHaveText('Dive');
  await expect(page.locator('[data-objective]')).toHaveText('Recover the sunken research beacon');
  await expect(page.locator('[data-npc]')).toContainText('Beacon signal is');
  await expect(page.locator('[data-air]')).not.toHaveText('0');
});

test('high-speed reef collision prevents tunneling and cuts speed', async ({ page }) => {
  await page.goto('/?qa=impact');
  await expectLoaded(page);
  await expect(page.locator('[data-notice]')).toHaveText('Hull impact. Reduce speed near reefs.', { timeout: 8_000 });
  await expect.poll(async () => Number(await page.locator('[data-speed]').innerText())).toBeLessThan(16);
});

test('fleet purchase equips Voyager and persists after reload', async ({ page }) => {
  await page.goto('/?qa=fleet');
  await expectLoaded(page);
  await expect(page.locator('[data-harbor-credits]')).toHaveText('2500');
  await page.locator('button[data-boat="voyager"]').click();
  await expect(page.locator('button[data-boat="voyager"]')).toHaveText('Equipped');
  await expect(page.locator('[data-harbor-credits]')).toHaveText('700');
  await page.reload();
  await expectLoaded(page);
  await expect(page.locator('button[data-boat="voyager"]')).toHaveText('Equipped');
});

test('captain log renders all discovered achievements responsively', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?qa=achievements');
  await expectLoaded(page);
  await expect(page.locator('[data-achievement-count]')).toHaveText('5');
  await expect(page.locator('.achievement.is-unlocked')).toHaveCount(5);
  await expect(page.locator('.harbor__panel')).toBeVisible();
});
