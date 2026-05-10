import { buildViewProjection } from '../../src/math/camera.js';
import type { View } from '../../src/types.js';

describe('buildViewProjection', () => {
  test('is deterministic', () => {
    const v: View = { yaw: 30, pitch: -10, fov: 75 };
    const a = Array.from(buildViewProjection(v, 16 / 9));
    const b = Array.from(buildViewProjection(v, 16 / 9));
    expect(a).toEqual(b);
  });

  test('different yaw produces different matrix', () => {
    const a = Array.from(buildViewProjection({ yaw: 0, pitch: 0, fov: 75 }, 1));
    const b = Array.from(buildViewProjection({ yaw: 45, pitch: 0, fov: 75 }, 1));
    expect(a).not.toEqual(b);
  });

  test('different pitch produces different matrix', () => {
    const a = Array.from(buildViewProjection({ yaw: 0, pitch: 0, fov: 75 }, 1));
    const b = Array.from(buildViewProjection({ yaw: 0, pitch: 30, fov: 75 }, 1));
    expect(a).not.toEqual(b);
  });

  test('different fov produces different matrix', () => {
    const a = Array.from(buildViewProjection({ yaw: 0, pitch: 0, fov: 60 }, 1));
    const b = Array.from(buildViewProjection({ yaw: 0, pitch: 0, fov: 90 }, 1));
    expect(a).not.toEqual(b);
  });

  test('aspect ratio scales m[0]', () => {
    const a = buildViewProjection({ yaw: 0, pitch: 0, fov: 60 }, 1);
    const b = buildViewProjection({ yaw: 0, pitch: 0, fov: 60 }, 2);
    expect(Math.abs(a[0]!)).toBeGreaterThan(Math.abs(b[0]!));
  });
});
