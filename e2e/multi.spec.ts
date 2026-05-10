import { expect, test } from '@playwright/test';

test.describe('multi-instance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/pages/multi.html');
    await page.waitForFunction(() => (window as any).__panoLoaded === true);
  });

  test('exactly one shared <style> element regardless of instance count', async ({ page }) => {
    const count = await page.evaluate(
      () => document.querySelectorAll('#panorama-player-styles').length,
    );
    expect(count).toBe(1);
  });

  test('drag on player A leaves player B untouched', async ({ page }) => {
    const beforeA = await page.evaluate(() => (window as any).__panos[0].getView());
    const beforeB = await page.evaluate(() => (window as any).__panos[1].getView());

    const aBox = (await page.locator('[data-testid="host-a"] canvas').boundingBox())!;
    const cx = aBox.x + aBox.width / 2;
    const cy = aBox.y + aBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 200, cy, { steps: 10 });
    await page.mouse.up();

    const afterA = await page.evaluate(() => (window as any).__panos[0].getView());
    const afterB = await page.evaluate(() => (window as any).__panos[1].getView());

    expect(afterA.yaw).not.toBeCloseTo(beforeA.yaw, 3);
    expect(afterB.yaw).toBeCloseTo(beforeB.yaw, 6);
    expect(afterB.pitch).toBeCloseTo(beforeB.pitch, 6);
    expect(afterB.fov).toBeCloseTo(beforeB.fov, 6);
  });

  test('destroying one player leaves shared stylesheet for the survivor', async ({ page }) => {
    await page.evaluate(() => (window as any).__panos[0].destroy());
    const count = await page.evaluate(
      () => document.querySelectorAll('#panorama-player-styles').length,
    );
    expect(count).toBe(1);

    const bBox = (await page.locator('[data-testid="host-b"] canvas').boundingBox())!;
    const cx = bBox.x + bBox.width / 2;
    const cy = bBox.y + bBox.height / 2;

    const before = await page.evaluate(() => (window as any).__panos[1].getView());
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy, { steps: 8 });
    await page.mouse.up();
    const after = await page.evaluate(() => (window as any).__panos[1].getView());
    expect(after.yaw).not.toBeCloseTo(before.yaw, 3);
  });

  test('destroying all players removes the stylesheet', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__panos[0].destroy();
      (window as any).__panos[1].destroy();
    });
    const count = await page.evaluate(
      () => document.querySelectorAll('#panorama-player-styles').length,
    );
    expect(count).toBe(0);
  });
});
