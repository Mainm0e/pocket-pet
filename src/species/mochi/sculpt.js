// The Mochi, sculpted: one soft daifuku blob with everything (ears, spikes, feet, tail)
// melted into it, flat-bottomed like a real mochi, with the pattern painted on.
// Pure JS: runs in the sculpt worker.
import { ellipsoid, sphere, capsule, squash, roundBox, unionParts, smax, meshField, hitSurface, lin, mix3, sstep, hash3 } from '../../three/sdf.js';
import { stream } from '../../server/genome/core.js';

/** Body outline for each Shape gene. Returns { f, top } (top = height of the crown). */
function shapeOf(shape, w, h) {
  switch (shape) {
    case 'bean':
      return { parts: [[ellipsoid([0, 0.55 * h, 0], [0.43 * w, 0.57 * h, 0.41 * w]), 0]], top: 1.12 * h, faceY: 0.6 * h, r: 0.43 * w };
    case 'wide':
      return {
        parts: [[ellipsoid([0, 0.32 * h, 0], [0.66 * w, 0.34 * h, 0.58 * w]), 0], [ellipsoid([0, 0.5 * h, 0], [0.45 * w, 0.3 * h, 0.42 * w]), 0.16]],
        top: 0.8 * h, faceY: 0.42 * h, r: 0.6 * w,
      };
    case 'drop':
      return {
        parts: [[ellipsoid([0, 0.42 * h, 0], [0.52 * w, 0.44 * h, 0.48 * w]), 0], [capsule([0, 0.6 * h, 0], [0, 1.1 * h, -0.03], 0.3 * w, 0.03), 0.26]],
        top: 1.1 * h, faceY: 0.42 * h, r: 0.52 * w,
      };
    case 'cube':
      return { parts: [[roundBox([0, 0.43 * h, 0], [0.44 * w, 0.42 * h, 0.41 * w], 0.18), 0]], top: 0.85 * h, faceY: 0.45 * h, r: 0.44 * w };
    default:
      return { parts: [[ellipsoid([0, 0.44 * h, 0], [0.55 * w, 0.46 * h, 0.5 * w]), 0]], top: 0.9 * h, faceY: 0.44 * h, r: 0.55 * w };
  }
}

export function sculptMochi(P) {
  const { w, h, form, feature, top: topGene, uniqueTail, earTilt, earSize } = P;
  const S = shapeOf(P.shape, w, h);
  const parts = S.parts.slice();
  const add = (f, k) => parts.push([f, k]);
  const T = S.top;
  const ears = [];
  const horns = [];
  const s2 = [-1, 1];

  // ---- top gene (from Teen) ----
  const earTop = topGene;
  if (earTop === 'nubs') for (const s of s2) add(sphere([s * 0.24 * w, T - 0.08, 0], 0.11 * earSize), 0.07);
  if (earTop === 'cat')
    for (const s of s2) {
      const base = [s * 0.25 * w, T - 0.1, -0.02];
      const tip = [s * (0.33 * w + earTilt * 0.2), T + 0.2 * earSize, -0.01];
      const e = squash(capsule(base, tip, 0.13, 0.025), base, [1, 1, 0.5]);
      ears.push(e);
      add(e, 0.06);
    }
  // ---- Playful Teen: a bouncy curl springing from the crown (like a cowlick) ----
  if (form === 'playful') {
    const k = earSize; // the fingerprint makes every curl a little different
    const tilt = earTilt * 0.5;
    const pts = [
      [0, T - 0.05, 0.02],
      [0.01 + tilt * 0.2, T + 0.09 * k, 0],
      [0.035 + tilt * 0.4, T + 0.18 * k, 0.02],
      [0.085 + tilt * 0.5, T + 0.21 * k, 0.06],
      [0.12 + tilt * 0.5, T + 0.16 * k, 0.09],
      [0.1 + tilt * 0.4, T + 0.1 * k, 0.1],
      [0.065 + tilt * 0.3, T + 0.115 * k, 0.085],
    ];
    const sc = 1.2; // a touch bigger and plumper than a hair, so it reads as a curl
    const P0 = pts.map(([x, y, z]) => [x * sc, T + (y - T) * sc, z * sc]);
    for (let i = 0; i < P0.length - 1; i++) {
      const r0 = 0.07 - i * 0.0065;
      add(capsule(P0[i], P0[i + 1], r0, r0 - 0.0065), i === 0 ? 0.07 : 0.014);
    }
  }
  if (topGene === 'horns' || feature === 'strong')
    for (const s of s2) {
      const hn = capsule([s * 0.15 * w, T - 0.04, 0.08], [s * 0.19 * w, T + 0.11, 0.1], 0.055, 0.016);
      horns.push(hn);
      add(hn, 0.035);
    }
  // ---- Teen body forms ----
  if (form === 'strong')
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.6;
      const r0 = 0.2 * w;
      add(capsule([Math.sin(a) * r0, T - 0.1, Math.cos(a) * r0], [Math.sin(a) * r0 * 1.5, T + 0.13, Math.cos(a) * r0 * 1.5], 0.09, 0.02), 0.07);
    }
  // ---- Adult features ----
  if (feature === 'tough') for (const s of s2) add(ellipsoid([s * 0.21 * w, 0.06, 0.33 * w], [0.13, 0.075, 0.12]), 0.05);
  const tailKind = uniqueTail || (feature === 'playful' ? 'tail_curl' : null);
  let tailPuff = null;
  if (tailKind === 'tail_puff') {
    tailPuff = sphere([0, 0.3 * h, -S.r * 0.92], 0.14);
    add(tailPuff, 0.05);
  } else if (tailKind === 'tail_curl') {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const a = t * Math.PI * 2.2;
      const rr = 0.13 * (1 - t * 0.6);
      pts.push([Math.sin(a) * rr * 0.4, 0.3 * h + Math.cos(a) * rr, -S.r * 0.95 - 0.05 - Math.sin(a) * rr * 0.6]);
    }
    for (let i = 0; i < pts.length - 1; i++) add(capsule(pts[i], pts[i + 1], 0.05 * (1 - (i / 10) * 0.5), 0.05 * (1 - ((i + 1) / 10) * 0.5)), 0.03);
  }

  const blobF = unionParts(parts);
  // flat squishy bottom with a soft edge, like a mochi resting on a plate
  const f = (x, y, z) => smax(blobF(x, y, z), -y, 0.12);

  // ---- face + attachment points, found on the real surface ----
  const fy = S.faceY;
  const spots = {
    eyes: s2.map((s) => hitSurface(f, [s * 0.17 * P.gap * Math.min(1, w), fy + 0.05, 2], [0, 0, -1])),
    mouth: hitSurface(f, [0, fy - 0.06, 2], [0, 0, -1]),
    blush: s2.map((s) => hitSurface(f, [s * 0.29 * w, fy - 0.03, 2], [0, 0, -1])),
    crown: hitSurface(f, [0, 3, 0], [0, -1, 0]),
    topper: hitSurface(f, [0.12 * w, 3, -0.04], [0, -1, 0]),
    front: hitSurface(f, [0, 0.24 * h, 2], [0, 0, -1]),
    back: hitSurface(f, [0, 0.3 * h, -2], [0, 0, 1]),
    sideL: hitSurface(f, [-2, 0.3 * h, -0.05], [1, 0, 0]),
    sideR: hitSurface(f, [2, 0.3 * h, -0.05], [-1, 0, 0]),
    upperR: hitSurface(f, [2, fy + 0.12, 0.12], [-1, 0, -0.3]),
    upperL: hitSurface(f, [-2, fy + 0.14, 0.1], [1, 0, -0.3]),
    birth: hitSurface(f, [P.markSide * 2, (0.15 + P.markY * 0.3) * h, -0.15], [-P.markSide, 0, 0]),
    top: T,
    faceY: fy,
    radius: S.r,
  };

  // ---- paint ----
  const C = {
    base: lin(P.base), shade: lin(P.shade), accent: lin(P.accent), dust: lin(P.dust), dip: lin(P.dip), belly: lin(P.belly),
    horn: lin('#FFF0D2'), pink: lin('#FF8FB4'), ink: lin('#2A2238'), star: lin('#FFF6C8'),
  };
  // spots pattern: directions from the fingerprint, so every pet's spots are its own
  const rs = stream(Math.floor(P.spotSeed * 1e9));
  const spotDirs = Array.from({ length: 6 }, () => {
    const a = rs() * Math.PI * 2;
    const yy = rs() * 1.2 - 0.3;
    return [Math.cos(a), yy, Math.sin(a), 0.16 + rs() * 0.12];
  });
  const cy = T * 0.5;
  const paint = (x, y, z, nx, ny, nz) => {
    // soft shading baked in: a touch deeper near the floor, lighter on the crown
    let c = mix3(C.shade, C.base, sstep(0.0, T * 0.45, y));
    c = mix3(c, C.accent, sstep(T * 0.7, T, y) * 0.25);
    if (form === 'tough') c = mix3(c, C.belly, sstep(1.1, 0.75, Math.hypot(x / (0.3 * w), (y - 0.3 * h) / (0.26 * h))) * sstep(0.2, 0.6, nz));
    const P2 = P.pattern;
    if (P2 === 'dust') {
      const q = 70;
      if (hash3(x * q, y * q, z * q, 7) > 0.9) c = mix3(c, C.dust, 0.75 * sstep(T * 0.25, T * 0.7, y));
    } else if (P2 === 'spots') {
      const l = Math.hypot(x, y - cy, z) || 1;
      for (const [sx, sy, sz, r] of spotDirs) {
        const d = Math.acos(Math.max(-1, Math.min(1, (x * sx + (y - cy) * sy + z * sz) / (l * Math.hypot(sx, sy, sz)))));
        if (d < r && nz < 0.85) c = mix3(c, C.dip, sstep(r, r * 0.8, d) * 0.85);
      }
    } else if (P2 === 'swirl') {
      if (y > T * 0.55) {
        const a = Math.atan2(z, x);
        const rr = Math.hypot(x, z);
        c = mix3(c, C.accent, sstep(0.55, 0.8, Math.sin(a + rr * 26)) * sstep(T * 0.55, T * 0.7, y));
      }
    } else if (P2 === 'dipped') {
      const a = Math.atan2(z, x);
      c = mix3(c, C.dip, sstep(0.3 * h + 0.025 * Math.sin(a * 5), 0.28 * h + 0.025 * Math.sin(a * 5), y));
    }
    if (P.flavor === 'starry') {
      const q = 55;
      const n = hash3(x * q, y * q, z * q, 3);
      if (n > 0.965) c = mix3(c, C.star, 0.9);
    }
    for (const hn of horns) c = mix3(c, C.horn, sstep(0.02, -0.005, hn(x, y, z)));
    for (const e of ears) if (y > T - 0.02) c = mix3(c, C.pink, 0.42 * sstep(0.3, 0.75, nz) * sstep(0.012, 0, e(x, y, z)) * sstep(T - 0.02, T + 0.08, y));
    if (tailPuff) c = mix3(c, C.accent, sstep(0.03, -0.01, tailPuff(x, y, z)) * 0.8);
    if (feature === 'tough' && y < 0.13 && z > 0.2 * w) c = mix3(c, C.shade, 0.35);
    // face paint: blush, freckles
    for (const b of spots.blush)
      if (b) {
        const d = Math.hypot((x - b.p[0]) * 0.8, y - b.p[1], z - b.p[2]);
        if (P.cheeks === 'blush') c = mix3(c, C.pink, 0.5 * sstep(0.075 * P.cheek, 0.025, d));
        if (P.cheeks === 'freckles') for (const [ox, oy] of [[0, 0.02], [0.03, -0.01], [-0.03, -0.012]]) c = mix3(c, C.dip, 0.8 * sstep(0.013, 0.007, Math.hypot(x - b.p[0] - ox, y - b.p[1] - oy, z - b.p[2])));
      }
    return c;
  };
  const mesh = meshField(f, [-0.8 * w - 0.1, -0.02, -0.75 * w - 0.25], [0.8 * w + 0.1, T + (form === 'playful' ? 0.36 : earTop === 'cat' ? 0.28 : 0.2), 0.75 * w + 0.15], 0.015 * (P.detail ?? 1), paint);
  return { mesh, spots };
}
