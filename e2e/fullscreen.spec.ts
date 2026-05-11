import { test, expect } from '@playwright/test';

test.describe('fullscreen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/pages/fullscreen.html');
    await page.waitForLoadState('networkidle');
  });

  test('shows fullscreen button when fullscreen is available', async ({ page }) => {
    const button = page.locator('.panorama-player__fullscreen-btn');
    await expect(button).toBeVisible();
  });

  test('does not show fullscreen button when fullscreen is disabled', async ({ page }) => {
    await page.goto('/e2e/pages/fullscreen-disabled.html');
    await page.waitForLoadState('networkidle');

    const button = page.locator('.panorama-player__fullscreen-btn');
    await expect(button).not.toBeAttached();
  });

  test('enters fullscreen when button is clicked', async ({ page }) => {
    const button = page.locator('.panorama-player__fullscreen-btn');
    await button.click({ force: true });

    await page.waitForTimeout(200);

    const isFullscreen = await page.evaluate(() => !!document.fullscreenElement);
    expect(isFullscreen).toBe(true);
  });

  test('exits fullscreen when button is clicked while in fullscreen', async ({ page }) => {
    const button = page.locator('.panorama-player__fullscreen-btn');
    await button.click({ force: true });

    await page.waitForTimeout(200);

    await button.click({ force: true });

    await page.waitForTimeout(200);

    const isFullscreen = await page.evaluate(() => !!document.fullscreenElement);
    expect(isFullscreen).toBe(false);
  });

  test('updates button icon when fullscreen state changes', async ({ page }) => {
    const button = page.locator('.panorama-player__fullscreen-btn');

    const initialIcon = await button.locator('svg path').getAttribute('d');

    await button.click({ force: true });
    await page.waitForTimeout(200);

    const fullscreenIcon = await button.locator('svg path').getAttribute('d');
    expect(fullscreenIcon).not.toBe(initialIcon);

    await button.click({ force: true });
    await page.waitForTimeout(200);

    const exitIcon = await button.locator('svg path').getAttribute('d');
    expect(exitIcon).toBe(initialIcon);
  });

  test('updates aria-label when fullscreen state changes', async ({ page }) => {
    const button = page.locator('.panorama-player__fullscreen-btn');

    const initialLabel = await button.getAttribute('aria-label');
    expect(initialLabel).toBe('Enter fullscreen');

    await button.click({ force: true });
    await page.waitForTimeout(200);

    const fullscreenLabel = await button.getAttribute('aria-label');
    expect(fullscreenLabel).toBe('Exit fullscreen');

    await button.click({ force: true });
    await page.waitForTimeout(200);

    const exitLabel = await button.getAttribute('aria-label');
    expect(exitLabel).toBe('Enter fullscreen');
  });

  test('handles multiple rapid fullscreen cycles without breaking', async ({ page }) => {
    const button = page.locator('.panorama-player__fullscreen-btn');

    for (let i = 0; i < 3; i++) {
      await button.click({ force: true });
      await page.waitForTimeout(300);

      let isFullscreen = await page.evaluate(() => !!document.fullscreenElement);
      expect(isFullscreen).toBe(true);

      await button.click({ force: true });
      await page.waitForTimeout(300);

      isFullscreen = await page.evaluate(() => !!document.fullscreenElement);
      expect(isFullscreen).toBe(false);
    }
  });

  test('button remains functional on small mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const button = page.locator('.panorama-player__fullscreen-btn');
    await expect(button).toBeVisible();

    await button.click({ force: true });
    await page.waitForTimeout(200);

    const isFullscreen = await page.evaluate(() => !!document.fullscreenElement);
    expect(isFullscreen).toBe(true);
  });
});
