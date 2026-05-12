import { PanoramaPlayer } from '../../src/index.js';

describe('PanoramaPlayer events', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('initializes without events', () => {
    const player = new PanoramaPlayer();

    expect(() => player.destroy()).not.toThrow();
  });

  it('calls onUnmount on destroy', () => {
    const onUnmount = jest.fn();
    const player = new PanoramaPlayer({ events: { onUnmount } });

    player.destroy();

    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it('catches and logs callback errors without breaking caller flow', () => {
    const onRotate = jest.fn(() => {
      throw new Error('Test error');
    });
    const player = new PanoramaPlayer({ events: { onRotate } });

    expect(() => player.setView({ yaw: 45 })).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'panorama-player: event handler error',
      expect.any(Error),
    );
    player.destroy();
  });

  it('emits onRotate for setView with clamped view and zero deltas', () => {
    const onRotate = jest.fn();
    const player = new PanoramaPlayer({ events: { onRotate } });

    player.setView({ yaw: 405, pitch: 120, fov: 10 });

    expect(onRotate).toHaveBeenCalledWith({
      view: { yaw: 45, pitch: 89, fov: 30 },
      deltaX: 0,
      deltaY: 0,
    });
    player.destroy();
  });

  it('merges updateEvents handlers and preserves existing handlers', () => {
    const onUnmount = jest.fn();
    const onRotate = jest.fn();
    const player = new PanoramaPlayer({ events: { onUnmount } });

    player.updateEvents({ onRotate });
    player.setView({ yaw: 90 });
    player.destroy();

    expect(onRotate).toHaveBeenCalledWith({
      view: { yaw: 90, pitch: 0, fov: 75 },
      deltaX: 0,
      deltaY: 0,
    });
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it('preserves event handlers when configure is called', () => {
    const onRotate = jest.fn();
    const player = new PanoramaPlayer({ events: { onRotate } });

    player.configure({ fovRange: [40, 90] });
    player.setView({ fov: 20 });

    expect(onRotate).toHaveBeenCalledWith({
      view: { yaw: 0, pitch: 0, fov: 40 },
      deltaX: 0,
      deltaY: 0,
    });
    player.destroy();
  });
});
