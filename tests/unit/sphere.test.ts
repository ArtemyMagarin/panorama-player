import { buildSphere } from '../../src/renderer/sphere.js';

describe('buildSphere', () => {
  test('vertex count is (lat+1) * (lon+1)', () => {
    const g = buildSphere(8, 16);
    expect(g.vertexCount).toBe((8 + 1) * (16 + 1));
    expect(g.positions.length).toBe(g.vertexCount * 3);
    expect(g.uvs.length).toBe(g.vertexCount * 2);
  });

  test('index count is lat * lon * 6', () => {
    const g = buildSphere(8, 16);
    expect(g.indexCount).toBe(8 * 16 * 6);
    expect(g.indices.length).toBe(g.indexCount);
  });

  test('UVs are within [0, 1]', () => {
    const g = buildSphere(4, 8);
    for (let i = 0; i < g.uvs.length; i++) {
      expect(g.uvs[i]).toBeGreaterThanOrEqual(0);
      expect(g.uvs[i]).toBeLessThanOrEqual(1);
    }
  });

  test('all vertices lie on unit sphere', () => {
    const g = buildSphere(8, 16, 1);
    for (let i = 0; i < g.vertexCount; i++) {
      const x = g.positions[i * 3]!;
      const y = g.positions[i * 3 + 1]!;
      const z = g.positions[i * 3 + 2]!;
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
    }
  });

  test('all indices reference valid vertices', () => {
    const g = buildSphere(4, 8);
    for (let i = 0; i < g.indices.length; i++) {
      expect(g.indices[i]).toBeLessThan(g.vertexCount);
    }
  });
});
