// Generates simple placeholder PNG icons (a rounded "note" glyph on a colored
// background) at 16/48/128px. Run with: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// --- tiny PNG encoder (RGBA, no external deps) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, pixels /* Uint8Array RGBA */) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rows with filter byte 0
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.subarray(y * stride, y * stride + stride).forEach((v, i) => {
      raw[y * (stride + 1) + 1 + i] = v;
    });
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// brand indigo background, off-white "note page" with lines
const BG = [79, 70, 229, 255]; // #4F46E5
const PAGE = [248, 250, 252, 255]; // #F8FAFC
const LINE = [148, 163, 184, 255]; // #94A3B8

function render(size) {
  const px = new Uint8Array(size * size * 4);
  const set = (x, y, c) => {
    const i = (y * size + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  };
  const m = Math.round(size * 0.22); // page margin
  const lineH = Math.max(1, Math.round(size * 0.09));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let c = BG;
      if (x >= m && x < size - m && y >= m && y < size - m) c = PAGE;
      set(x, y, c);
    }
  }
  // three text lines on the page
  for (let l = 0; l < 3; l++) {
    const y0 = m + Math.round(size * 0.14) + l * Math.round(size * 0.18);
    const w = l === 2 ? Math.round((size - 2 * m) * 0.55) : size - 2 * m - Math.round(size * 0.12);
    for (let y = y0; y < y0 + lineH && y < size - m; y++) {
      for (let x = m + Math.round(size * 0.06); x < m + Math.round(size * 0.06) + w && x < size - m; x++) {
        set(x, y, LINE);
      }
    }
  }
  return encodePng(size, px);
}

for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), render(size));
  console.log(`wrote icons/icon${size}.png`);
}
