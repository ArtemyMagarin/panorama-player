import { expect, test } from '@playwright/test';

test.describe('page scrolling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/pages/scrollable.html');
    await page.waitForFunction(() => (window as any).__panoLoaded === true);
  });

  test('page scrolls when wheel is used without modifier over player', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.hover();

    const fovBefore = await page.evaluate(() => (window as any).__pano.getView().fov);

    await page.mouse.wheel(0, 200);

    const fovAfter = await page.evaluate(() => (window as any).__pano.getView().fov);

    expect(fovAfter).toBe(fovBefore);
  });

  test('page can scroll normally below player', async ({ page }) => {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });

    const scrollPos = await page.evaluate(() => window.scrollY);
    expect(scrollPos).toBeGreaterThan(0);

    const content = await page.locator('#content').isVisible();
    expect(content).toBe(true);
  });

  test('player zoom requires modifier while page scroll does not', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.hover();

    const initialFov = await page.evaluate(() => (window as any).__pano.getView().fov);

    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');

    const zoomedFov = await page.evaluate(() => (window as any).__pano.getView().fov);
    expect(zoomedFov).toBeLessThan(initialFov);
  });
});
