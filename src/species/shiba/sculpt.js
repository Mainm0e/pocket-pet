// The Shiba, sculpted: each part is a signed distance field, blended smoothly into the
// next, then meshed into one seamless surface with colours painted on (no glued-on balls).
// Three pieces (body, head, tail) so the head can nod and the tail can wag.
// Pure JS: runs in a Web Worker (sculpt.worker.js) so the page never freezes.
import { ellipsoid, sphere, capsule, squash, torusY, unionParts, meshField, hitSurface, lin, mix3, sstep } from '../../three/sdf.js';

const memo = (key, fn) => fn();

/** params: everything the shape depends on, as plain numbers/strings (also the cache key). */
export function sculptBody(P) {
  return memo('body|' + JSON.stringify(P), () => {
    const { bw, bh, ls, paw, chubby, ruff, mask } = P;
    const parts = [];
    const add = (f, k) => parts.push([f, k]);
    const ch = chubby ? 1.15 : 1;
    add(ellipsoid([0, 0.25 * bh, -0.05], [0.37 * bw * ch, 0.26 * bh, 0.35 * bw * ch]), 0);
    add(ellipsoid([0, 0.43 * bh, 0], [0.26 * bw, 0.27 * bh, 0.26 * bw]), 0.16);
    const chest = ellipsoid([0, 0.45 * bh, 0.12 * bw], [0.2 * bw, 0.23 * bh, 0.16 * bw]);
    add(chest, 0.1);
    if (chubby) add(ellipsoid([0, 0.26 * bh, 0.14 * bw], [0.26 * bw, 0.19 * bh, 0.21 * bw]), 0.1);
    add(ellipsoid([0, 0.68 * bh, 0.03], [0.19 * bw, 0.12, 0.18 * bw]), 0.08); // neck
    const fl = [];
    for (const s of [-1, 1]) {
      const leg = capsule([s * 0.11 * bw, 0.36 * bh, 0.2 * bw], [s * 0.115 * bw, 0.07, 0.27 * bw], 0.068 * ls, 0.064 * ls);
      fl.push(leg);
      add(leg, 0.035);
      add(ellipsoid([s * 0.115 * bw, 0.048, 0.31 * bw], [0.072 * paw, 0.05 * paw, 0.088 * paw]), 0.03);
      add(ellipsoid([s * 0.22 * bw, 0.16 * bh, -0.06], [0.14 * bw, 0.16 * bh, 0.2]), 0.07); // haunch
      add(ellipsoid([s * 0.25 * bw, 0.04, 0.1], [0.065 * paw, 0.04 * paw, 0.09 * paw]), 0.03);
    }
    if (ruff) {
      // fluffy lion ruff: a scalloped ring around the neck
      add(torusY([0, 0.66 * bh, 0.03], 0.2 * bw, 0.085), 0.08);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        add(sphere([Math.sin(a) * 0.27 * bw, 0.64 * bh + Math.cos(a * 3) * 0.02, 0.03 + Math.cos(a) * 0.25 * bw], 0.075), 0.05);
      }
    }
    const f = unionParts(parts);
    const C = palette(P);
    const chestS = mask === 'wide' ? 1.25 : mask === 'little' ? 0.75 : 1;
    const paint = (x, y, z, nx, ny, nz) => {
      // coat everywhere, a little darker along the back and top
      let c = mix3(C.base, C.top, sstep(-0.1, 0.8, ny * 0.5 - nz * 0.6 + (y / bh) * 0.3));
      // white bib on the front of the chest only
      const ex = x / (0.17 * bw * chestS);
      const ey = (y - 0.47 * bh) / (0.24 * bh * chestS);
      const bib = sstep(1.15, 0.75, Math.hypot(ex, ey)) * sstep(0.1, 0.45, nz);
      c = mix3(c, C.mask, bib);
      if (chubby) c = mix3(c, C.mask, sstep(0.2 * bw, 0.12 * bw, Math.abs(x)) * sstep(0.35, 0.6, nz) * sstep(0.45 * bh, 0.3 * bh, y));
      // white toes; socks make the white go higher
      const front = Math.min(fl[0](x, y, z), fl[1](x, y, z));
      const isFront = z > 0.16 * bw;
      const sock = isFront ? P.sockFront : P.sockBack;
      c = mix3(c, C.mask, sstep(sock ? 0.2 : 0.075, sock ? 0.14 : 0.04, y) * (isFront || P.sockBack ? 1 : 0.85));
      if (sock && isFront && front < 0.02) c = mix3(c, C.mask, sstep(0.24, 0.16, y));
      if (ruff) c = mix3(c, C.mask, sstep(0.55 * bh, 0.62 * bh, y) * sstep(0.8 * bh, 0.7 * bh, y) * 0.85);
      return c;
    };
    const mesh = meshField(f, [-0.5 * bw - 0.1, -0.02, -0.45 * bw - 0.1], [0.5 * bw + 0.1, 0.9 * bh, 0.45 * bw + 0.15], 0.016 * (P.detail ?? 1), paint);
    const side = (sx, y) => hitSurface(f, [sx * 1.5, y, 0], [-sx, 0, 0]);
    const spots = {
      sideL: side(-1, 0.32 * bh),
      sideR: side(1, 0.32 * bh),
      birth: hitSurface(f, [P.markSide * 1.5, (0.15 + P.markY * 0.25) * bh, -0.1], [-P.markSide, 0, 0]),
    };
    return { mesh, spots };
  });
}

export function sculptHead(P) {
  return memo('head|' + JSON.stringify(P), () => {
    const { mz, earKind, earTilt, earSize, mask, baby } = P;
    const parts = [];
    const add = (f, k) => parts.push([f, k]);
    const skull = ellipsoid([0, 0.35, 0], [0.37, 0.36, 0.35]);
    add(skull, 0);
    const cheekC = [-1, 1].map((s) => [s * 0.22, 0.19, 0.06]);
    for (const c of cheekC) add(ellipsoid(c, [0.21, 0.155, 0.19]), 0.09); // cheek fluff
    add(ellipsoid([0, 0.1, 0.12], [0.18, 0.1, 0.16]), 0.08); // chin
    const muzzle = ellipsoid([0, 0.17, 0.29 + (mz - 1) * 0.05], [0.13 * mz, 0.1, 0.12 * mz]);
    add(muzzle, 0.05);
    const whiteCheeks = [-1, 1].map((s) => ellipsoid([s * 0.17, 0.12, 0.17], [0.18, 0.12, 0.17]));
    // ears: flat rounded cones melted into the skull
    const ears = [];
    const inner = [];
    for (const s of [-1, 1]) {
      const sz = earSize;
      let base = [s * 0.2, 0.52, -0.04];
      let tip;
      let ra = 0.15 * sz;
      let rb = 0.035 * sz;
      if (earKind === 'round' || earKind === 'baby') {
        tip = [s * 0.27, 0.64 + (earKind === 'baby' ? -0.03 : 0), -0.03];
        ra = 0.12 * sz;
        rb = 0.06 * sz;
      } else if (earKind === 'big') tip = [s * 0.35, 0.86, -0.04];
      else if (earKind === 'long') {
        base = [s * 0.17, 0.52, -0.05];
        tip = [s * 0.27, 1.0, -0.08];
        ra = 0.115 * sz;
        rb = 0.08 * sz;
      } else if (earKind === 'folded') tip = [s * 0.29, 0.76, 0.1];
      else tip = [s * 0.31, 0.84, -0.02];
      tip = [base[0] + (tip[0] - base[0]) * sz + s * earTilt * 0.25, base[1] + (tip[1] - base[1]) * sz, tip[2]];
      const ear = squash(capsule(base, tip, ra, rb), base, [1, 1, earKind === 'long' ? 0.6 : 0.42]);
      ears.push(ear);
      add(ear, 0.045);
      inner.push({ base, tip, ra: ra * 0.55, rb: rb * 0.4 });
    }
    const f = unionParts(parts);
    // where the face details go (found on the real surface)
    const eyeY = baby ? 0.27 : 0.285;
    const spots = {
      eyes: [-1, 1].map((s) => hitSurface(f, [s * 0.165 * P.gap, eyeY, 1], [0, 0, -1])),
      brows: [-1, 1].map((s) => hitSurface(f, [s * 0.12 * P.gap, eyeY + 0.1, 1], [0, 0, -1])),
      nose: hitSurface(f, [0, 0.235, 1], [0, -0.2, -1]),
      mouth: hitSurface(f, [0, 0.13, 1], [0, 0, -1]),
      blush: [-1, 1].map((s) => hitSurface(f, [s * 0.27, 0.21, 1], [0, 0, -1])),
      crown: hitSurface(f, [0, 2, 0], [0, -1, 0]),
      cheekR: hitSurface(f, [1, 0.42, 0.18], [-1, 0, 0]),
      cheekL: hitSurface(f, [-1, 0.46, 0.12], [1, 0, 0]),
      horns: [-1, 1].map((s) => hitSurface(f, [s * 0.14, 2, 0.08], [0, -1, 0])),
    };
    const C = palette(P);
    const maskGrow = mask === 'wide' ? 0.035 : mask === 'little' ? -0.03 : 0;
    const innerEar = (x, y, z, e) => capsule(e.base, e.tip, e.ra, e.rb)(x, y, z);
    const paint = (x, y, z, nx, ny, nz) => {
      let c = mix3(C.base, C.top, sstep(0.28, 0.62, y + nz * -0.05 + ny * 0.05));
      if (C.tan) c = mix3(c, C.tan, sstep(0.3, 0.24, y) * sstep(-0.1, 0.2, nz));
      // urajiro: white muzzle, lower cheeks and chin
      const m1 = sstep(0.035, 0.005, muzzle(x, y, z));
      const m2 = Math.max(...whiteCheeks.map((w) => sstep(0.02 + maskGrow, -0.01 + maskGrow, w(x, y, z))));
      const m3 = sstep(0.12, 0.06, y) * sstep(-0.2, 0.2, nz); // chin + throat
      c = mix3(c, C.mask, Math.max(m1, m2, m3));
      // inner ears
      if (y > 0.45) {
        for (const e of inner) {
          const w = sstep(0.025, -0.01, innerEar(x, y, z, e)) * sstep(0.1, 0.4, nz);
          c = mix3(c, C.ear, w);
        }
      }
      // brow dots ("maro"), blush, freckles
      for (const b of spots.brows) if (b && P.brows !== 'none') {
        const r = P.brows === 'bold' ? 0.05 : 0.036;
        const dx = (x - b.p[0]) * (P.brows === 'bold' ? 0.7 : 1);
        c = mix3(c, P.brows === 'hearts' ? lin('#FF9AB8') : C.brow, sstep(r, r * 0.6, Math.hypot(dx, y - b.p[1], z - b.p[2])));
      }
      for (const b of spots.blush) if (b && P.cheeks === 'blush') c = mix3(c, lin('#FF8FB4'), 0.55 * sstep(0.065, 0.02, Math.hypot((x - b.p[0]) * 0.8, y - b.p[1], z - b.p[2])));
      if (P.cheeks === 'freckles') for (const b of spots.blush) if (b) for (const [ox, oy] of [[0, 0.02], [0.03, -0.01], [-0.03, -0.012]]) c = mix3(c, C.top, sstep(0.012, 0.006, Math.hypot(x - b.p[0] - ox, y - b.p[1] - oy, z - b.p[2])));
      return c;
    };
    const mesh = meshField(f, [-0.55, -0.05, -0.42], [0.55, earKind === 'long' ? 1.12 : 0.98, 0.45], 0.014 * (P.detail ?? 1), paint);
    return { mesh, spots };
  });
}

const TAILS = {
  curl: [[0, 0, 0], [0.02, 0.13, -0.1], [0.05, 0.27, -0.13], [0.08, 0.38, -0.06], [0.09, 0.39, 0.05], [0.08, 0.3, 0.09], [0.06, 0.22, 0.04]],
  sickle: [[0, 0, 0], [0.01, 0.2, -0.12], [0.03, 0.37, -0.09], [0.05, 0.47, 0.03]],
  plume: [[0, 0, 0], [0.01, 0.2, -0.13], [0.04, 0.38, -0.1], [0.07, 0.49, 0.02]],
  tail_fox: [[0, 0, 0], [0.02, 0.22, -0.16], [0.06, 0.44, -0.14], [0.1, 0.6, -0.02]],
  base: [[0, 0, 0], [0.01, 0.18, -0.1], [0.02, 0.3, -0.08]],
};

export function sculptTail(P) {
  return memo('tail|' + JSON.stringify(P), () => {
    const { kind, ts } = P;
    const segs = [];
    const chain = (pts, r0, r1, xOff = 0) => {
      const sp = pts.map((p) => [(p[0] + xOff) * ts, p[1] * ts, p[2] * ts]);
      for (let i = 0; i < sp.length - 1; i++) {
        const t0 = i / (sp.length - 1);
        const t1 = (i + 1) / (sp.length - 1);
        segs.push(capsule(sp[i], sp[i + 1], (r0 + (r1 - r0) * t0) * ts, (r0 + (r1 - r0) * t1) * ts));
      }
      return sp[sp.length - 1];
    };
    let tipAt;
    if (kind === 'bob') segs.push(sphere([0, 0.02, -0.02], 0.11 * ts));
    else if (kind === 'pom') {
      chain(TAILS.sickle.slice(0, 3), 0.075, 0.07);
      tipAt = [0.03 * ts, 0.42 * ts, -0.06 * ts];
      segs.push(sphere(tipAt, 0.18 * ts));
    } else if (kind === 'tail_double') {
      tipAt = chain(TAILS.curl, 0.08, 0.055, -0.08);
      chain(TAILS.curl, 0.08, 0.055, 0.08);
    } else if (kind === 'base') chain(TAILS.base, 0.08, 0.07);
    else {
      const big = kind === 'plume' || kind === 'tail_fox';
      tipAt = chain(TAILS[kind] ?? TAILS.curl, big ? 0.11 : 0.105, big ? (kind === 'tail_fox' ? 0.14 : 0.12) : 0.075);
    }
    const f = unionParts(segs.map((g) => [g, 0.06 * ts]));
    const C = palette(P);
    const paint = (x, y, z, nx, ny) => {
      let c = mix3(C.base, C.top, sstep(-0.3, 0.6, ny));
      c = mix3(c, C.mask, sstep(-0.55, -0.9, ny) * 0.6); // a hint of pale underside
      if (tipAt && kind !== 'pom') c = mix3(c, C.mask, sstep(0.12 * ts, 0.04 * ts, Math.hypot(x - tipAt[0], y - tipAt[1], z - tipAt[2])));
      if (kind === 'pom' || kind === 'bob') c = mix3(c, C.mask, sstep(0, -0.5, ny));
      return c;
    };
    const mesh = meshField(f, [-0.3 * ts, -0.2 * ts, -0.36 * ts], [0.34 * ts, 0.8 * ts, 0.4 * ts], 0.014 * Math.max(0.7, ts) * (P.detail ?? 1), paint);
    return { mesh };
  });
}

function palette(P) {
  return {
    top: lin(P.top), base: lin(P.base), mask: lin(P.mask), ear: lin(P.ear), paw: lin(P.pawCol ?? P.base),
    tan: P.tan ? lin(P.tan) : null, brow: lin(P.brow ?? P.mask),
  };
}
