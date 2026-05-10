import { expect, test } from '@playwright/test';

test.describe('zoom', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/pages/single.html');
    await page.waitForFunction(() => (window as any).__panoLoaded === true);
  });

  test('wheel down zooms in (decreases FOV); clamped at fovRange[0]', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__pano.getView());

    const canvas = page.locator('canvas');
    await canvas.hover();
    await page.mouse.wheel(0, -200);
    const mid = await page.evaluate(() => (window as any).__pano.getView());
    expect(mid.fov).toBeLessThan(before.fov);

    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -200);
    }
    const after = await page.evaluate(() => (window as any).__pano.getView());
    expect(after.fov).toBeGreaterThanOrEqual(30);
  });

  test('wheel up zooms out and clamps at fovRange[1]', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.hover();

    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 200);
    }
    const after = await page.evaluate(() => (window as any).__pano.getView());
    expect(after.fov).toBeLessThanOrEqual(100);
    expect(after.fov).toBeGreaterThanOrEqual(95);
  });

  test('pinch via dispatched pointer events changes FOV', async ({ page, browserName }) => {
    test.skip(
      browserName === 'chromium' && !test.info().project.name.includes('mobile'),
      'pinch requires touch points; covered by mobile project',
    );

    const before = await page.evaluate(() => (window as any).__pano.getView());

    await page.evaluate(() => {
      const el = document.querySelector('canvas') as HTMLElement;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      function fire(type: string, id: number, x: number, y: number): void {
        const ev = new PointerEvent(type, {
          pointerId: id,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
        });
        el.dispatchEvent(ev);
      }
      fire('pointerdown', 1, cx - 30, cy);
      fire('pointerdown', 2, cx + 30, cy);
      for (let i = 1; i <= 10; i++) {
        const off = 30 + i * 10;
        fire('pointermove', 1, cx - off, cy);
        fire('pointermove', 2, cx + off, cy);
      }
      fire('pointerup', 1, cx - 130, cy);
      fire('pointerup', 2, cx + 130, cy);
    });

    const after = await page.evaluate(() => (window as any).__pano.getView());
    expect(after.fov).not.toBeCloseTo(before.fov, 3);
    expect(after.fov).toBeGreaterThanOrEqual(30);
    expect(after.fov).toBeLessThanOrEqual(100);
  });
});
