import { test, expect } from '@playwright/test';

test.describe('PanoramaPlayer Events E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/pages/events.html');
  });

  test('should call onMount when player is mounted', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).toContain('onMount');
  });

  test('should call onUnmount when player is destroyed', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const destroyButton = page.locator('#destroy-button');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);
    await destroyButton.click();
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).toContain('onUnmount');
  });

  test('should call onRotateStart and onRotateEnd during drag', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const canvas = page.locator('canvas');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);

    // Simulate drag
    await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    await page.waitForTimeout(50);
    await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 110, clientY: 100 });
    await page.waitForTimeout(50);
    await canvas.dispatchEvent('pointerup', { pointerId: 1 });
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).toContain('onRotateStart');
    expect(log).toContain('onRotateEnd');
  });

  test('should not call onRotateEnd for click without drag', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const canvas = page.locator('canvas');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);

    await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    await canvas.dispatchEvent('pointerup', { pointerId: 1 });
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).not.toContain('onRotateStart');
    expect(log).not.toContain('onRotateEnd');
  });

  test('should call onRotate during drag (throttled)', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const canvas = page.locator('canvas');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);

    // Simulate drag
    await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    await page.waitForTimeout(50);
    await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 110, clientY: 100 });
    await page.waitForTimeout(50);
    await canvas.dispatchEvent('pointerup', { pointerId: 1 });
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).toContain('onRotate');
  });

  test('should call onWheelZoom when wheel is scrolled', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const canvas = page.locator('canvas');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);

    // Simulate wheel zoom
    await canvas.dispatchEvent('wheel', { deltaY: -100, ctrlKey: true });
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).toContain('onWheelZoom');
  });

  test('should call onPinchZoom when pinch gesture is performed', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const canvas = page.locator('canvas');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);

    // Simulate pinch
    await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    await canvas.dispatchEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 100 });
    await page.waitForTimeout(50);
    await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 90, clientY: 100 });
    await canvas.dispatchEvent('pointermove', { pointerId: 2, clientX: 210, clientY: 100 });
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).toContain('onPinchZoom');
    expect(log).not.toContain('onRotateEnd');
  });

  test('should call onResize when container is resized', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const container = page.locator('#player-container');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);

    // Resize container
    await container.evaluate((el) => {
      el.style.width = '500px';
      el.style.height = '400px';
    });
    await page.waitForTimeout(200);

    const log = await eventLog.textContent();
    expect(log).toContain('onResize');
  });

  test('should call onLoad when image is loaded successfully', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const loadButton = page.locator('#load-button');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);
    await loadButton.click();
    await page.waitForTimeout(1000);

    const log = await eventLog.textContent();
    expect(log).toContain('onLoad');
  });

  test('should call onError when image fails to load', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const loadInvalidButton = page.locator('#load-invalid-button');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);
    await loadInvalidButton.click();
    await page.waitForTimeout(500);

    const log = await eventLog.textContent();
    expect(log).toContain('onError');
  });

  test('should call onRotate when setView is called', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const setViewButton = page.locator('#set-view-button');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);
    await setViewButton.click();
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).toContain('onRotate');
  });

  test('should update events with updateEvents', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const updateEventsButton = page.locator('#update-events-button');
    const canvas = page.locator('canvas');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);
    await updateEventsButton.click();
    await page.waitForTimeout(100);

    // Simulate drag
    await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    await page.waitForTimeout(50);
    await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 110, clientY: 100 });
    await page.waitForTimeout(50);
    await canvas.dispatchEvent('pointerup', { pointerId: 1 });
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).toContain('onRotate (updated)');
  });

  test('should preserve events when configure is called', async ({ page }) => {
    const mountButton = page.locator('#mount-button');
    const configureButton = page.locator('#configure-button');
    const canvas = page.locator('canvas');
    const eventLog = page.locator('#event-log');

    await mountButton.click();
    await page.waitForTimeout(100);
    await configureButton.click();
    await page.waitForTimeout(100);

    // Simulate drag
    await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    await page.waitForTimeout(50);
    await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 110, clientY: 100 });
    await page.waitForTimeout(50);
    await canvas.dispatchEvent('pointerup', { pointerId: 1 });
    await page.waitForTimeout(100);

    const log = await eventLog.textContent();
    expect(log).toContain('onRotate');
  });
});
