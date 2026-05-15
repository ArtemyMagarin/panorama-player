export interface SphereGeometry {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  vertexCount: number;
  indexCount: number;
}

/**
 * Build a sphere geometry with fixed subdivision
 */
export function buildSphere(latBands = 32, lonBands = 64, radius = 1): SphereGeometry {
  const vertCount = (latBands + 1) * (lonBands + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  let p = 0;
  let u = 0;
  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let lon = 0; lon <= lonBands; lon++) {
      const phi = (lon * 2 * Math.PI) / lonBands;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const x = cosP * sinT;
      const y = cosT;
      const z = sinP * sinT;

      positions[p++] = radius * x;
      positions[p++] = radius * y;
      positions[p++] = radius * z;

      uvs[u++] = lon / lonBands;
      uvs[u++] = lat / latBands;
    }
  }

  const idxCount = latBands * lonBands * 6;
  const indices = new Uint16Array(idxCount);
  let i = 0;
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const a = lat * (lonBands + 1) + lon;
      const b = a + lonBands + 1;
      indices[i++] = a;
      indices[i++] = b;
      indices[i++] = a + 1;
      indices[i++] = b;
      indices[i++] = b + 1;
      indices[i++] = a + 1;
    }
  }

  return {
    positions,
    uvs,
    indices,
    vertexCount: vertCount,
    indexCount: idxCount,
  };
}

/**
 * Build a zoom-aware sphere geometry for tile-based rendering
 * At zoom level z, creates 2*2^z latitude bands and 4*2^z longitude bands
 * Each grid cell maps to exactly one tile
 */
export function buildZoomAwareSphere(zoom: number, radius = 1): SphereGeometry {
  const latBands = 2 * Math.pow(2, zoom);
  const lonBands = 4 * Math.pow(2, zoom);
  return buildSphere(latBands, lonBands, radius);
}
