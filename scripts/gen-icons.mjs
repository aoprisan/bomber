/*
 * Procedurally render the PWA PNG icons (no image libraries).
 * Draws the same night-sky + bomber motif as icon.svg into an RGBA buffer,
 * then encodes a PNG using only Node's zlib. Run: `node scripts/gen-icons.mjs`.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

function draw(size, maskable) {
  const buf = new Uint8Array(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = a / 255;
    buf[i] = buf[i] * (1 - ia) + r * ia;
    buf[i + 1] = buf[i + 1] * (1 - ia) + g * ia;
    buf[i + 2] = buf[i + 2] * (1 - ia) + b * ia;
    buf[i + 3] = 255;
  };
  const inTri = (px, py, ax, ay, bx, by, cx, cy) => {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  };

  const s = size / 512; // scale from the 512 reference design
  // Maskable icons need their content inside the safe zone (~80%); shrink art.
  const m = maskable ? 0.8 : 1;
  const cx = size / 2;
  const shift = maskable ? size * 0.06 : 0; // nudge motif toward center

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sky gradient.
      const t = y / size;
      const r = 5 + (10 - 5) * t;
      const g = 6 + (16 - 6) * t;
      const b = 13 + (36 - 13) * t;
      set(x, y, r, g, b);

      // Searchlight glow toward top.
      const gx = x - cx;
      const gy = y - 150 * s;
      const gd = Math.sqrt(gx * gx + gy * gy) / (150 * s);
      if (gd < 1) set(x, y, 255, 244, 194, (1 - gd) * 90);
    }
  }

  // Bomber silhouette, centered.
  const bx = cx;
  const by = 250 * s + shift;
  const poly = (pts, cr, cg, cb) => {
    // pts: flat [x,y,...] in reference space; triangulate as a fan.
    const P = [];
    for (let i = 0; i < pts.length; i += 2) {
      P.push([bx + pts[i] * s * m, by + pts[i + 1] * s * m]);
    }
    const minX = Math.floor(Math.min(...P.map((p) => p[0])));
    const maxX = Math.ceil(Math.max(...P.map((p) => p[0])));
    const minY = Math.floor(Math.min(...P.map((p) => p[1])));
    const maxY = Math.ceil(Math.max(...P.map((p) => p[1])));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        for (let i = 1; i < P.length - 1; i++) {
          if (inTri(x, y, P[0][0], P[0][1], P[i][0], P[i][1], P[i + 1][0], P[i + 1][1])) {
            set(x, y, cr, cg, cb);
            break;
          }
        }
      }
    }
  };
  poly([-84, 6, 84, 6, 52, 32, -52, 32], 170, 182, 214); // wings
  poly([0, -70, 20, -18, 20, 30, 10, 60, -10, 60, -20, 30, -20, -18], 215, 224, 245); // fuselage
  poly([-38, 52, 38, 52, 22, 70, -22, 70], 170, 182, 214); // tail

  // Orange blast spark (skip for maskable to keep it clean).
  if (!maskable) {
    const sx = 392 * s;
    const sy = 392 * s;
    for (let y = -30 * s; y <= 30 * s; y++) {
      for (let x = -30 * s; x <= 30 * s; x++) {
        const d = Math.sqrt(x * x + y * y) / s;
        if (d < 26) set(sx + x, sy + y, 255, 138, 43, (1 - d / 26) * 230);
        if (d < 12) set(sx + x, sy + y, 255, 210, 122);
      }
    }
  }

  return buf;
}

// Minimal PNG encoder (truecolor+alpha, filter 0 per row).
function encodePng(rgba, size) {
  const bpp = 4;
  const stride = size * bpp;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

const jobs = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
];
for (const [name, size, maskable] of jobs) {
  const png = encodePng(draw(size, maskable), size);
  writeFileSync(join(outDir, name), png);
  console.log(`wrote ${name} (${png.length} bytes)`);
}
