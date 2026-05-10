import {
  identity,
  multiply,
  perspective,
  rotationX,
  rotationY,
  transformVec3,
} from '../../src/math/mat4.js';

describe('mat4.identity', () => {
  test('produces identity matrix', () => {
    const m = identity();
    const expected = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    expect(Array.from(m)).toEqual(expected);
  });
});

describe('mat4.multiply', () => {
  test('A * I = A', () => {
    const a = rotationY(0.7);
    const r = multiply(a, identity());
    for (let i = 0; i < 16; i++) {
      expect(r[i]).toBeCloseTo(a[i]!, 6);
    }
  });

  test('I * A = A', () => {
    const a = rotationX(-0.4);
    const r = multiply(identity(), a);
    for (let i = 0; i < 16; i++) {
      expect(r[i]).toBeCloseTo(a[i]!, 6);
    }
  });
});

describe('mat4.perspective', () => {
  test('produces sensible projection (m[0] = m[5]/aspect)', () => {
    const m = perspective(Math.PI / 2, 2, 0.1, 100);
    expect(m[0]).toBeCloseTo(m[5]! / 2, 6);
    expect(m[11]).toBe(-1);
    expect(m[15]).toBe(0);
  });
});

describe('rotationY', () => {
  test('rotates +x axis toward -z (right-handed)', () => {
    const m = rotationY(Math.PI / 2);
    const [x, , z] = transformVec3(m, 1, 0, 0);
    expect(x).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-1, 6);
  });
});

describe('rotationX', () => {
  test('rotates +y axis toward +z', () => {
    const m = rotationX(Math.PI / 2);
    const [, y, z] = transformVec3(m, 0, 1, 0);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(1, 6);
  });
});
