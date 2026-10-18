// Pure JS (no Three.js), so it can run in a Web Worker.
// Sculpting with signed distance fields: shapes melt into each other (smooth union),
// then Surface Nets turns the field into ONE seamless mesh with smooth normals.
// This is what makes the pet look sculpted instead of "balls stuck together".

// ---------- primitives (p = [x,y,z]) ----------
// Each primitive carries a bounding sphere [centre, radius] so unions can skip
// shapes that are too far away to matter.
const withBound = (f, c, r) => Object.assign(f, { bound: [c, r] });

export function ellipsoid(c, r) {
  return withBound((x, y, z) => {
    const px = (x - c[0]) / r[0];
    const py = (y - c[1]) / r[1];
    const pz = (z - c[2]) / r[2];
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    const qx = px / r[0];
    const qy = py / r[1];
    const qz = pz / r[2];
    const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
  }, c, Math.max(...r));
}
export function sphere(c, r) {
  return withBound((x, y, z) => {
    const dx = x - c[0];
    const dy = y - c[1];
    const dz = z - c[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
  }, c, r);
}
/** Capsule from a to b with radius ra at a and rb at b (a "round cone"). */
export function capsule(a, b, ra, rb = ra) {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return withBound((x, y, z) => {
    const pax = x - a[0];
    const pay = y - a[1];
    const paz = z - a[2];
    const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / l2));
    const qx = pax - bax * h;
    const qy = pay - bay * h;
    const qz = paz - baz * h;
    return Math.sqrt(qx * qx + qy * qy + qz * qz) - (ra + (rb - ra) * h);
  }, mid, Math.sqrt(l2) / 2 + Math.max(ra, rb));
}
/** Flatten any shape along one axis around a centre (e.g. ears are flat cones). */
export function squash(f, c, s) {
  const m = Math.min(...s);
  const [ix, iy, iz] = [1 / s[0], 1 / s[1], 1 / s[2]];
  return (x, y, z) => f(c[0] + (x - c[0]) * ix, c[1] + (y - c[1]) * iy, c[2] + (z - c[2]) * iz) * m;
}
export function torusY(c, R, r) {
  return withBound((x, y, z) => {
    const q = Math.hypot(x - c[0], z - c[2]) - R;
    return Math.hypot(q, y - c[1]) - r;
  }, c, R + r);
}
/** Polynomial smooth union: k is how far apart shapes start to melt together. */
export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** Smooth-union a list of [shape, k] parts, skipping shapes too far away to change the result. */
export function unionParts(parts) {
  const n = parts.length;
  const fs = parts.map((p) => p[0]);
  const ks = Float64Array.from(parts.map((p) => p[1] || 0));
  const bx = new Float64Array(n);
  const by = new Float64Array(n);
  const bz = new Float64Array(n);
  const br = new Float64Array(n).fill(-1);
  parts.forEach(([g], i) => {
    if (!g.bound) return;
    [bx[i], by[i], bz[i]] = g.bound[0];
    br[i] = g.bound[1];
  });
  return (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < n; i++) {
      const k = ks[i];
      if (br[i] >= 0) {
        const dx = x - bx[i];
        const dy = y - by[i];
        const dz = z - bz[i];
        const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - br[i];
        if (lb - d >= k) continue;
      }
      const e = fs[i](x, y, z);
      const h = Math.max(k - Math.abs(d - e), 0) / k;
      d = Math.min(d, e) - h * h * k * 0.25;
    }
    return d;
  };
}
export function union(k, ...fs) {
  return (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < fs.length; i++) d = smin(d, fs[i](x, y, z), k);
    return d;
  };
}
/** Smoothly blend shapes, each with its own melt radius: [[f, k], ...] (first k unused). */
export function blend(list) {
  return (x, y, z) => {
    let d = list[0][0](x, y, z);
    for (let i = 1; i < list.length; i++) d = smin(d, list[i][0](x, y, z), list[i][1]);
    return d;
  };
}
export const subtract = (a, b, k = 0.02) => (x, y, z) => -smin(-a(x, y, z), b(x, y, z), k);

// ---------- meshing ----------
/**
 * Surface Nets: sample the field on a grid, put one vertex per surface cell,
 * connect neighbours with quads. Normals come from the field gradient, so the
 * surface is perfectly smooth. colorFn(x, y, z, nx, ny, nz) -> [r, g, b] (linear 0..1).
 */
export function meshField(f, min, max, step, colorFn) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const sxy = nx * ny;
  const field = new Float32Array(nx * ny * nz);
  const exact = new Uint8Array(nx * ny * nz);
  // 1) Sparse sampling: test each 4x4x4 block at its centre. Far blocks can't hold the
  //    surface and just take the centre value; near blocks are sampled finely.
  const BL = 4;
  const reach = BL * step * 0.87 * 1.6;
  const nearBlocks = [];
  for (let bk = 0; bk < nz - 1; bk += BL)
    for (let bj = 0; bj < ny - 1; bj += BL)
      for (let bi = 0; bi < nx - 1; bi += BL) {
        const i1 = Math.min(nx - 1, bi + BL);
        const j1 = Math.min(ny - 1, bj + BL);
        const k1 = Math.min(nz - 1, bk + BL);
        const dc = f(min[0] + ((bi + i1) / 2) * step, min[1] + ((bj + j1) / 2) * step, min[2] + ((bk + k1) / 2) * step);
        const near = Math.abs(dc) < reach;
        if (near) nearBlocks.push(bi, bj, bk, i1, j1, k1);
        for (let k = bk; k <= k1; k++) {
          const z = min[2] + k * step;
          for (let j = bj; j <= j1; j++) {
            const y = min[1] + j * step;
            let q = bi + nx * j + sxy * k;
            for (let i = bi; i <= i1; i++, q++) {
              if (exact[q]) continue;
              if (near) {
                field[q] = f(min[0] + i * step, y, z);
                exact[q] = 1;
              } else if (field[q] === 0) field[q] = dc;
            }
          }
        }
      }

  // 2) Surface Nets vertices: one per cell that the surface crosses (near blocks only).
  const off = [0, 1, nx, nx + 1, sxy, sxy + 1, sxy + nx, sxy + nx + 1];
  const E0 = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3];
  const E1 = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];
  const CX = [0, 1, 0, 1, 0, 1, 0, 1];
  const CY = [0, 0, 1, 1, 0, 0, 1, 1];
  const CZ = [0, 0, 0, 0, 1, 1, 1, 1];
  const cellVert = new Int32Array(nx * ny * nz).fill(-1); // indexed like the field (cell = its min corner)
  const pos = [];
  const cells = [];
  const v = new Float64Array(8);
  for (let b = 0; b < nearBlocks.length; b += 6) {
    const [bi, bj, bk, i1, j1, k1] = [nearBlocks[b], nearBlocks[b + 1], nearBlocks[b + 2], nearBlocks[b + 3], nearBlocks[b + 4], nearBlocks[b + 5]];
    for (let k = bk; k < k1; k++)
      for (let j = bj; j < j1; j++)
        for (let i = bi; i < i1; i++) {
          const q = i + nx * j + sxy * k;
          let mask = 0;
          for (let c = 0; c < 8; c++) {
            v[c] = field[q + off[c]];
            if (v[c] < 0) mask |= 1 << c;
          }
          if (mask === 0 || mask === 255) continue;
          let sx = 0;
          let sy = 0;
          let sz = 0;
          let n = 0;
          for (let e = 0; e < 12; e++) {
            const a0 = E0[e];
            const a1 = E1[e];
            if ((v[a0] < 0) === (v[a1] < 0)) continue;
            const t = v[a0] / (v[a0] - v[a1]);
            sx += CX[a0] + (CX[a1] - CX[a0]) * t;
            sy += CY[a0] + (CY[a1] - CY[a0]) * t;
            sz += CZ[a0] + (CZ[a1] - CZ[a0]) * t;
            n++;
          }
          cellVert[q] = pos.length / 3;
          cells.push(q, i, j, k);
          pos.push(min[0] + (i + sx / n) * step, min[1] + (j + sy / n) * step, min[2] + (k + sz / n) * step);
        }
  }

  // 3) Quads: each crossing grid edge from a cell's min corner joins the 4 cells around it.
  const index = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c);
    else index.push(a, b, c, a, c, d);
  };
  for (let t = 0; t < cells.length; t += 4) {
    const q = cells[t];
    const i = cells[t + 1];
    const j = cells[t + 2];
    const k = cells[t + 3];
    const inside = field[q] < 0;
    if (j > 0 && k > 0 && inside !== field[q + 1] < 0) quad(cellVert[q - nx - sxy], cellVert[q - sxy], cellVert[q], cellVert[q - nx], inside);
    if (i > 0 && k > 0 && inside !== field[q + nx] < 0) quad(cellVert[q - 1 - sxy], cellVert[q - 1], cellVert[q], cellVert[q - sxy], inside);
    if (i > 0 && j > 0 && inside !== field[q + sxy] < 0) quad(cellVert[q - 1 - nx], cellVert[q - nx], cellVert[q], cellVert[q - 1], inside);
  }

  // 4) Smooth normals from the field gradient (4 taps), colours from the paint function.
  const count = pos.length / 3;
  const nrm = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const e = step * 0.5;
  for (let q = 0; q < count; q++) {
    const x = pos[q * 3];
    const y = pos[q * 3 + 1];
    const z = pos[q * 3 + 2];
    const a = f(x + e, y - e, z - e);
    const b = f(x - e, y - e, z + e);
    const c = f(x - e, y + e, z - e);
    const d = f(x + e, y + e, z + e);
    let gx = a - b - c + d;
    let gy = -a - b + c + d;
    let gz = -a + b - c + d;
    const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    gx /= l;
    gy /= l;
    gz /= l;
    nrm[q * 3] = gx;
    nrm[q * 3 + 1] = gy;
    nrm[q * 3 + 2] = gz;
    const rgb = colorFn ? colorFn(x, y, z, gx, gy, gz) : null;
    col[q * 3] = rgb ? rgb[0] : 1;
    col[q * 3 + 1] = rgb ? rgb[1] : 1;
    col[q * 3 + 2] = rgb ? rgb[2] : 1;
  }
  // make every triangle face outward (agree with the field gradient)
  for (let t = 0; t < index.length; t += 3) {
    const i0 = index[t];
    const i1 = index[t + 1];
    const i2 = index[t + 2];
    const ax = pos[i1 * 3] - pos[i0 * 3], ay = pos[i1 * 3 + 1] - pos[i0 * 3 + 1], az = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];
    const bx = pos[i2 * 3] - pos[i0 * 3], by = pos[i2 * 3 + 1] - pos[i0 * 3 + 1], bz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];
    const dot = (ay * bz - az * by) * (nrm[i0 * 3] + nrm[i1 * 3] + nrm[i2 * 3]) + (az * bx - ax * bz) * (nrm[i0 * 3 + 1] + nrm[i1 * 3 + 1] + nrm[i2 * 3 + 1]) + (ax * by - ay * bx) * (nrm[i0 * 3 + 2] + nrm[i1 * 3 + 2] + nrm[i2 * 3 + 2]);
    if (dot < 0) {
      index[t + 1] = i2;
      index[t + 2] = i1;
    }
  }
  return { position: new Float32Array(pos), normal: nrm, color: col, index: count > 65535 ? new Uint32Array(index) : new Uint16Array(index) };
}

/** March a ray onto the surface: where to stick eyes, nose, marks. Returns { p, n } or null. */
export function hitSurface(f, origin, dir, maxT = 3) {
  const l = Math.hypot(...dir);
  const d = dir.map((v) => v / l);
  let t = 0;
  for (let i = 0; i < 128 && t < maxT; i++) {
    const x = origin[0] + d[0] * t;
    const y = origin[1] + d[1] * t;
    const z = origin[2] + d[2] * t;
    const s = f(x, y, z);
    if (s < 0.0005) {
      const e = 0.002;
      const n = [f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)];
      const nl = Math.hypot(...n) || 1;
      return { p: [x, y, z], n: n.map((v) => v / nl) };
    }
    t += Math.max(s * 0.9, 0.001);
  }
  return null;
}

// ---------- colour helpers for paint functions ----------
/** '#RRGGBB' (sRGB) -> linear RGB, like THREE.Color does. */
export const lin = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const to = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [to((n >> 16) & 255), to((n >> 8) & 255), to(n & 255)];
};
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- more shapes ----------
/** Rounded box: half-size b, corner radius r. */
export function roundBox(c, b, r) {
  return withBound((x, y, z) => {
    const qx = Math.abs(x - c[0]) - b[0] + r;
    const qy = Math.abs(y - c[1]) - b[1] + r;
    const qz = Math.abs(z - c[2]) - b[2] + r;
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    const oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
  }, c, Math.hypot(...b));
}
/** Smooth intersection (e.g. flatten a blob's bottom with a rounded edge). */
export function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}
/** Cheap deterministic 3D hash in [0,1) for speckles. */
export function hash3(x, y, z, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed | 0, 974711)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
