import { clamp, wrapDeg, degToRad, radToDeg } from '../../src/utils/clamp.js';

describe('clamp', () => {
  test('returns value when inside range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  test('clamps below min', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });
  test('clamps above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  test('handles inverted range', () => {
    expect(clamp(5, 10, 0)).toBe(5);
    expect(clamp(-1, 10, 0)).toBe(0);
    expect(clamp(20, 10, 0)).toBe(10);
  });
  test('boundaries are inclusive', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('wrapDeg', () => {
  test('keeps value in (-180, 180]', () => {
    expect(wrapDeg(0)).toBe(0);
    expect(wrapDeg(179)).toBe(179);
    expect(wrapDeg(-179)).toBe(-179);
  });
  test('wraps positive overflow', () => {
    expect(wrapDeg(190)).toBe(-170);
    expect(wrapDeg(360)).toBe(0);
    expect(wrapDeg(720)).toBe(0);
  });
  test('wraps negative overflow', () => {
    expect(wrapDeg(-190)).toBe(170);
    expect(wrapDeg(-360)).toBe(0);
  });
});

describe('degToRad / radToDeg', () => {
  test('round trip', () => {
    expect(radToDeg(degToRad(45))).toBeCloseTo(45);
    expect(degToRad(180)).toBeCloseTo(Math.PI);
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
  });
});
