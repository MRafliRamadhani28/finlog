/**
 * Membuat ikon PWA sebagai PNG, tanpa dependency.
 *
 * Ikonnya cuma persegi berwarna: latar kartu + tiga batang naik, mengikuti
 * grafik tren di tab Ringkasan. Bentuk sesederhana ini bisa digambar langsung
 * ke buffer piksel, jadi tidak perlu menyeret pustaka gambar hanya untuk
 * menghasilkan tiga berkas statis.
 *
 * Jalankan ulang kalau warnanya berubah:  node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [25, 28, 43]; // --card
const BAR = [79, 211, 154]; // --green
const BAR_DIM = [143, 149, 255]; // --blue

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** `draw(x, y)` mengembalikan `[r, g, b]` untuk tiap piksel. */
function png(size, draw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB

  // Tiap baris diawali satu byte filter (0 = none).
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = draw(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param size sisi ikon dalam piksel
 * @param inset bagian tepi yang dikosongkan (0–0.5). Ikon maskable butuh
 *   ruang aman karena launcher bisa memangkasnya jadi lingkaran.
 */
function ledgerIcon(size, inset) {
  const pad = size * inset;
  const inner = size - pad * 2;
  // Tiga batang naik, tinggi 45% / 70% / 100% dari area dalam.
  const bars = [0.45, 0.7, 1].map((h, i) => ({
    x0: pad + inner * (0.14 + i * 0.29),
    x1: pad + inner * (0.14 + i * 0.29 + 0.19),
    y0: pad + inner * (1 - h * 0.82),
    y1: pad + inner * 0.94,
    color: i === 2 ? BAR : BAR_DIM,
  }));

  return png(size, (x, y) => {
    for (const b of bars) {
      if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) return b.color;
    }
    return BG;
  });
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', ledgerIcon(192, 0.12));
writeFileSync('public/icon-512.png', ledgerIcon(512, 0.12));
// Ruang aman lebih lebar: launcher Android memangkas hingga ~20% tiap sisi.
writeFileSync('public/icon-maskable-512.png', ledgerIcon(512, 0.22));
console.log('ikon PWA dibuat di public/');
