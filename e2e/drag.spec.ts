import { expect, test } from '@playwright/test';

test.describe('drag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/pages/single.html');
    await page.waitForFunction(() => (window as any).__panoLoaded === true);
  });

  test('rightward drag increases yaw', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__pano.getView());
    const box = (await page.locator('canvas').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 200, cy, { steps: 10 });
    await page.mouse.up();
    const after = await page.evaluate(() => (window as any).__pano.getView());
    expect(after.yaw).toBeGreaterThan(before.yaw);
    expect(after.pitch).toBeCloseTo(before.pitch, 3);
  });

  test('leftward drag decreases yaw', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__pano.getView());
    const box = (await page.locator('canvas').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 200, cy, { steps: 10 });
    await page.mouse.up();
    const after = await page.evaluate(() => (window as any).__pano.getView());
    expect(after.yaw).toBeLessThan(before.yaw);
    expect(after.pitch).toBeCloseTo(before.pitch, 3);
  });

  test('vertical pointer drag changes pitch and clamps within range', async ({ page }) => {
    const box = (await page.locator('canvas').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + 80, { steps: 8 });
    await page.mouse.up();

    let view = await page.evaluate(() => (window as any).__pano.getView());
    expect(view.pitch).not.toBeCloseTo(0, 3);

    for (let i = 0; i < 5; i++) {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx, cy + 800, { steps: 10 });
      await page.mouse.up();
    }
    view = await page.evaluate(() => (window as any).__pano.getView());
    expect(view.pitch).toBeLessThanOrEqual(89);
    expect(view.pitch).toBeGreaterThanOrEqual(-89);
  });
});
