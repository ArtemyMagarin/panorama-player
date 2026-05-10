import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../fixtures/pano.png');

const W = 512;
const H = 256;

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function buildIHDR(w, h) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(w, 0);
  b.writeUInt32BE(h, 4);
  b[8] = 8; // bit depth
  b[9] = 2; // color type RGB
  b[10] = 0; // compression
  b[11] = 0; // filter
  b[12] = 0; // interlace
  return b;
}

function hsv2rgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function buildPixels(w, h) {
  // 1 filter byte per row + 3 bytes per pixel
  const stride = 1 + w * 3;
  const buf = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * stride;
    buf[rowStart] = 0; // filter: None
    const v = 0.4 + 0.6 * (1 - y / (h - 1));
    for (let x = 0; x < w; x++) {
      const hue = x / w;
      const [r, g, b] = hsv2rgb(hue, 0.85, v);
      const o = rowStart + 1 + x * 3;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
    // black grid every 32px
    if (y % 32 === 0 || y === h - 1) {
      for (let x = 0; x < w; x++) {
        const o = rowStart + 1 + x * 3;
        buf[o] = 0;
        buf[o + 1] = 0;
        buf[o + 2] = 0;
      }
    }
    for (let x = 0; x < w; x += 32) {
      const o = rowStart + 1 + x * 3;
      buf[o] = 0;
      buf[o + 1] = 0;
      buf[o + 2] = 0;
    }
  }
  return buf;
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = chunk('IHDR', buildIHDR(W, H));
const idat = chunk('IDAT', deflateSync(buildPixels(W, H)));
const iend = chunk('IEND', Buffer.alloc(0));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([sig, ihdr, idat, iend]));
process.stdout.write(`wrote ${OUT}\n`);
