// Shiba species art: DNA + stage + form + history -> a Three.js model.
// The genome decides WHAT the pet has; this file decides how it LOOKS.
// Art can change freely without breaking DNA (codes never change).
import {
  THREE, furMat, softMat, glossMat, blob, onEllipsoid, cone, torus, tube, shape2d,
  starMesh, heartMesh, shade, mixHex, particleTex,
} from '../../three/kit.js';
import { streamFor } from '../../server/genome/core.js';
import { sculpt } from '../sculptClient.js';
import { buildFxTail, buildWings, buildHeadPart, buildEgg, tongueMesh } from '../common.js';

const INK = '#2A2238';
export const COATS = {
  red: { top: '#C8601C', base: '#E98E3E', mask: '#FFF3E2', ear: '#F9C9A6', label: 'Red' },
  cream: { top: '#DDAA6A', base: '#F0CD98', mask: '#FFFAF1', ear: '#FBE1CC', label: 'Cream' },
  blacktan: { top: '#33292F', base: '#4E3F46', mask: '#FFF3E2', ear: '#D99A63', tan: '#D99A5C', label: 'Black & tan' },
  sesame: { top: '#6E3A1E', base: '#DA8640', mask: '#FFF3E2', ear: '#F7C6A3', label: 'Sesame' },
  white: { top: '#EFE6DA', base: '#FFFCF6', mask: '#FFFFFF', ear: '#FFC6CF', label: 'White' },
  peach: { top: '#FF9A86', base: '#FFC3B1', mask: '#FFF6F1', ear: '#FFD7CF', label: 'Peach' },
  mint: { top: '#5FC7A2', base: '#A3EACD', mask: '#F3FFF9', ear: '#D3F6E8', label: 'Mint' },
  lavender: { top: '#9A80E6', base: '#C8B6FF', mask: '#FBF8FF', ear: '#E5DBFF', label: 'Lavender' },
};
export const COLLARS = { red: '#E8434F', sky: '#4FA3EE', mint: '#34C394', lemon: '#F4C43C', grape: '#9468DE', gold: '#E2A92E' };

const STAGE = {
  baby: { scale: 0.6, head: 1.3, body: 0.84, ear: 0.72, legs: 0.82, eye: 1.3, tail: 0.7, muzzle: 0.82 },
  teen: { scale: 0.82, head: 1.18, body: 0.98, ear: 0.92, legs: 0.95, eye: 1.12, tail: 0.95, muzzle: 0.95 },
  adult: { scale: 1, head: 1.12, body: 1.04, ear: 1, legs: 1, eye: 1.05, tail: 1, muzzle: 1 },
};
const SHOWN = { baby: new Set(['baby']), teen: new Set(['baby', 'teen']), adult: new Set(['baby', 'teen']) };

/** Everything a model depends on, as a short string (for caching thumbnails). */
export function lookKey(look) {
  const g = look.genome;
  return [g.code, look.stage, look.form?.top, look.form?.second, (look.marks || []).join('.'),
    Math.round((look.vivid ?? 0.7) * 10), look.mood ?? '', look.hatchTaps ?? 0].join('|');
}

/** Build a model. Async: the sculpting happens in a worker. detail > 1 = coarser (thumbnails). */
export async function buildPet(look, { detail = 1 } = {}) {
  return look.stage === 'egg' ? buildEgg(look, COATS[look.genome.genes.coat]) : buildShiba(look, detail);
}

function toGeo(m) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(m.color, 3));
  geo.setIndex(new THREE.BufferAttribute(m.index, 1));
  geo.computeBoundingSphere();
  return geo;
}
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// --------------------------------------------------------------------------------------------
function palette(look) {
  const g = look.genome;
  const vivid = look.vivid ?? 0.7;
  const sat = 0.5 + vivid * 0.55;
  const tone = { hue: g.fine.hue, light: g.fine.light + (1 - vivid) * 0.05, sat };
  const coat = COATS[g.genes.coat];
  const t = (hex) => shade(hex, tone);
  return {
    top: t(coat.top), base: t(coat.base), mask: t(coat.mask), ear: t(coat.ear), tan: coat.tan ? t(coat.tan) : null,
    collar: shade(COLLARS[g.genes.collar], { sat: 0.6 + vivid * 0.45 }),
    dark: g.genes.coat === 'blacktan',
    pale: g.genes.coat === 'white' || g.genes.coat === 'cream',
  };
}

async function buildShiba(look, detail) {
  const g = look.genome;
  const G = g.genes;
  const F = g.fine;
  const S = STAGE[look.stage];
  const show = SHOWN[look.stage];
  const has = (gene) => show.has(g.list.find((x) => x.key === gene).shows);
  const top = look.form?.top;
  const second = look.stage === 'adult' ? look.form?.second : null;
  const uScale = look.stage === 'adult' ? 1 : look.stage === 'teen' ? 0.62 : 0;
  const uq = uScale ? g.unique : { slot: 'none', value: 'none' };
  const P = palette(look);
  const shinyMut = g.mutations.includes('shiny');
  const fur = furMat(shinyMut ? { iridescence: 0.5, iridescenceIOR: 1.6, sheenColor: new THREE.Color(0xfff0ff) } : {});

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const parts = { ears: [], eyes: [], legs: [], wings: [], flames: [], sparkles: [], blink: [] };

  // ---- proportions ----
  let bw = F.bodyW * S.body;
  let bh = F.bodyH * S.body;
  if (top === 'calm') {
    bh *= 1.14;
    bw *= 0.95;
  }
  const r2 = (x) => Math.round(x * 1000) / 1000;
  const colours = { top: P.top, base: P.base, mask: P.mask, ear: P.ear, tan: P.tan, brow: P.dark ? P.tan : P.pale ? shade(P.top, { light: -0.06 }) : P.mask };
  const socks = has('socks') ? G.socks : 'none';

  // ---- sculpt body, head and tail (in the worker, all at once) ----
  const earKind = look.stage === 'baby' ? 'baby' : top === 'playful' ? 'long' : G.ears;
  const ts = r2(S.tail * F.tailSize);
  const tailKind = look.stage === 'baby' ? 'curl' : uq.slot === 'tail' ? uq.value : second === 'playful' ? 'pom' : G.tail;
  const fxTail = tailKind === 'tail_crystal' || tailKind === 'tail_flame';
  const [B, H, T] = await Promise.all([
    sculpt('shiba:body', {
      bw: r2(bw), bh: r2(bh), ls: S.legs, paw: second === 'tough' ? 1.4 : 1, chubby: top === 'tough', ruff: top === 'strong',
      mask: G.mask, sockFront: socks === 'front' || socks === 'four' || socks === 'odd', sockBack: socks === 'four',
      markSide: F.markSide, markY: F.markY, detail, ...colours,
    }),
    sculpt('shiba:head', {
      mz: r2(S.muzzle * F.muzzle), earKind, earTilt: r2(F.earTilt), earSize: r2(S.ear * F.earSize), gap: r2(F.gap), mask: G.mask,
      baby: look.stage === 'baby', brows: G.brows === 'none' && !P.dark ? 'none' : G.brows === 'none' ? 'dots' : G.brows, cheeks: G.cheeks, detail, ...colours,
    }),
    sculpt('shiba:tail', { kind: fxTail ? 'base' : tailKind, ts, detail, ...colours }),
  ]);
  body.add(new THREE.Mesh(toGeo(B.mesh), fur));

  // ---- head: one sculpted piece on a neck pivot ----
  const hs = S.head * F.head;
  const head = new THREE.Group();
  head.position.set(0, 0.6 * bh, 0.07);
  head.scale.setScalar(hs);
  body.add(head);
  parts.head = head;
  head.add(new THREE.Mesh(toGeo(H.mesh), fur));
  const sp = H.spots;
  const stick = (obj, hit, out = 0) => {
    if (!hit) return obj;
    const n = V(hit.n);
    obj.position.copy(V(hit.p)).addScaledVector(n, out);
    obj.lookAt(obj.position.clone().add(n));
    return obj;
  };

  // nose + mouth
  const nose = blob(glossMat(INK), [0.05, 0.034, 0.03]);
  stick(nose, sp.nose, -0.006);
  head.add(nose);
  const inkMat = softMat(INK, { sheen: 0 });
  const mouth = new THREE.Group();
  stick(mouth, sp.mouth, 0.002);
  head.add(mouth);
  parts.mouth = mouth;
  if (G.mouth === 'smile') {
    const m = torus(inkMat, 0.035, 0.008, Math.PI);
    m.rotation.z = Math.PI;
    mouth.add(m);
  } else {
    for (const s of [-1, 1]) {
      const m = torus(inkMat, 0.022, 0.008, Math.PI);
      m.rotation.z = Math.PI;
      m.position.x = s * 0.022;
      mouth.add(m);
    }
  }
  if (G.mouth === 'tongue') {
    const tg = tongueMesh(1);
    tg.position.set(0.006, -0.012, 0.004);
    tg.rotation.z = -0.08;
    mouth.add(tg);
  }
  if (G.mouth === 'fang') {
    const fg = cone(softMat('#ffffff'), 0.01, 0.024, 10);
    fg.rotation.x = Math.PI;
    fg.position.set(0.026, -0.03, 0);
    mouth.add(fg);
  }

  // eyes
  const eyeS = S.eye * F.eye;
  const hetero = g.mutations.includes('hetero');
  sp.eyes.forEach((hit, i) => {
    const s = i ? 1 : -1;
    const eg = stick(new THREE.Group(), hit, -0.012);
    head.add(eg);
    const lid = new THREE.Group();
    eg.add(lid);
    if (G.eyes === 'happy') {
      const a = torus(inkMat, 0.045 * eyeS, 0.012 * eyeS, Math.PI);
      a.position.z = 0.014;
      lid.add(a);
    } else if (G.eyes === 'star') {
      const st = starMesh(glossMat(INK), 0.065 * eyeS, 0.032 * eyeS, 0.02);
      st.position.z = 0.014;
      lid.add(st);
    } else {
      lid.add(blob(glossMat(INK), [0.055 * eyeS, 0.064 * eyeS, 0.036 * eyeS]));
      if (hetero) {
        const iris = blob(glossMat(s < 0 ? '#3AA0E8' : '#E8A93A'), [0.044 * eyeS, 0.052 * eyeS, 0.02 * eyeS]);
        iris.position.z = 0.024 * eyeS;
        lid.add(iris);
        const pupil = blob(glossMat(INK), [0.022 * eyeS, 0.028 * eyeS, 0.012 * eyeS]);
        pupil.position.z = 0.036 * eyeS;
        lid.add(pupil);
      }
      const hi = blob(glossMat('#ffffff', { emissive: new THREE.Color(0x555555) }), [0.019 * eyeS, 0.021 * eyeS, 0.01]);
      hi.position.set(0.016 * eyeS, 0.022 * eyeS, 0.032 * eyeS);
      lid.add(hi);
      if (G.eyes === 'sparkle') {
        const hi2 = blob(glossMat('#ffffff'), [0.01 * eyeS, 0.01 * eyeS, 0.006]);
        hi2.position.set(-0.018 * eyeS, -0.02 * eyeS, 0.034 * eyeS);
        lid.add(hi2);
      }
      if (G.eyes === 'sleepy') lid.userData.rest = 0.55;
    }
    if (look.mood === 'sad') {
      const b = tube(inkMat, [[-0.035, 0, 0], [0.035, -s * 0.018, 0]], 0.007);
      b.position.set(0, 0.09 * eyeS, 0.02);
      b.rotation.z = s * 0.35;
      eg.add(b);
    }
    parts.eyes.push(eg);
    parts.blink.push(lid);
  });

  // ---- teen/adult extras ----
  if (top === 'calm' && uq.slot !== 'head' && sp.crown) {
    const sprout = new THREE.Group();
    sprout.position.copy(V(sp.crown.p)).add(new THREE.Vector3(0, -0.01, 0));
    sprout.add(tube(softMat('#4F9A3A'), [[0, 0, 0], [0.01, 0.06, 0], [0.03, 0.11, 0]], 0.013));
    for (const s of [-1, 1]) {
      const leaf = blob(softMat('#7FCB5E'), [0.065, 0.028, 0.032]);
      leaf.position.set(0.03 + s * 0.055, 0.12, 0);
      leaf.rotation.z = s * 0.4;
      sprout.add(leaf);
    }
    head.add(sprout);
  }
  if (second === 'strong' && uq.slot !== 'head') {
    for (const [i, s] of [-1, 1].entries()) {
      const hit = sp.horns[i];
      const h = cone(softMat('#FFEBC8'), 0.055, 0.15, 24);
      if (hit) h.position.copy(V(hit.p)).add(new THREE.Vector3(0, 0.05, 0));
      h.rotation.z = -s * 0.25;
      head.add(h);
    }
  }
  if (second === 'calm') {
    const halo = torus(glossMat('#FFD34D', { emissive: new THREE.Color('#FFB000'), emissiveIntensity: 0.6 }), 0.17, 0.022);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, (sp.crown?.p[1] ?? 0.64) + 0.2 + (earKind === 'long' ? 0.25 : 0.1), 0);
    head.add(halo);
    parts.halo = halo;
  }
  if (uq.slot === 'head') buildHeadPart(head, uq.value, uScale, [0, 0.31, 0], [0.4, 0.33, 0.35]);

  // ---- collar & charm (from Teen) ----
  const neckY = 0.66 * bh;
  if (has('collar')) {
    const metal = G.collar === 'gold';
    const cm = metal ? glossMat(P.collar, { metalness: 0.6, roughness: 0.3 }) : softMat(P.collar, { sheen: 0.3 });
    const collar = torus(cm, 0.22 * bw, 0.036);
    collar.position.set(0, neckY + 0.01, 0.05);
    collar.rotation.x = Math.PI / 2 - 0.3;
    body.add(collar);
    const front = [0, neckY - 0.05, 0.05 + 0.22 * bw];
    if (G.charm === 'bell') {
      const bell = blob(glossMat('#F2C14E', { metalness: 0.7, roughness: 0.25 }), [0.05, 0.05, 0.05]);
      bell.position.set(...front);
      body.add(bell);
    } else if (G.charm === 'bandana') {
      const bd = cone(softMat(P.collar, { sheen: 0.4 }), 0.15 * bw, 0.18, 3);
      bd.rotation.set(Math.PI + 0.35, Math.PI / 6, 0);
      bd.scale.z = 0.35;
      bd.position.set(front[0], front[1] - 0.03, front[2] - 0.03);
      body.add(bd);
    } else if (G.charm === 'bow') {
      const bm = softMat(P.collar, { sheen: 0.4 });
      for (const s of [-1, 1]) {
        const w = blob(bm, [0.06, 0.04, 0.028]);
        w.position.set(front[0] + s * 0.055, front[1] + 0.02, front[2]);
        w.rotation.z = s * 0.4;
        body.add(w);
      }
      const knot = blob(bm, [0.026, 0.026, 0.026]);
      knot.position.set(front[0], front[1] + 0.02, front[2] + 0.01);
      body.add(knot);
    }
  }

  // ---- tail ----
  const tail = new THREE.Group();
  tail.position.set(0, 0.32 * bh, -0.31 * bw);
  body.add(tail);
  parts.tail = tail;
  tail.add(new THREE.Mesh(toGeo(T.mesh), fur));
  if (fxTail) buildFxTail(tail, tailKind, ts, parts);

  // ---- wings ----
  if (uq.slot === 'wings') buildWings(body, uq.value, uScale, [0, 0.55 * bh, -0.22 * bw], parts);

  // ---- memory marks + birthmark ----
  const marks = new Set(look.marks || []);
  if (marks.has('star') && sp.cheekR) {
    const st = stick(starMesh(glossMat('#FFD34D', { emissive: new THREE.Color('#996600'), emissiveIntensity: 0.3 }), 0.045, 0.02, 0.014), sp.cheekR, 0.004);
    head.add(st);
  }
  if (marks.has('scar') && sp.cheekL) {
    for (const s of [-1, 1]) {
      const sc = tube(softMat('#C2566F'), [[-0.032, -0.032 * s, 0], [0.032, 0.032 * s, 0]], 0.008);
      head.add(stick(sc, sp.cheekL, 0.004));
    }
  }
  if (marks.has('sun')) {
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.032, 20), softMat('#FFA53A', { side: THREE.DoubleSide }));
    body.add(stick(sun, B.spots.sideL, 0.003));
  }
  if (marks.has('rainbow')) {
    const rb = new THREE.Group();
    ['#FF6B8A', '#FFD34D', '#5CC8FF'].forEach((c, k) => rb.add(torus(softMat(c), 0.045 - k * 0.012, 0.006, Math.PI, 20)));
    body.add(stick(rb, B.spots.sideR, 0.003));
  }
  if (marks.has('aura')) {
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: particleTex('puff'), color: new THREE.Color(P.collar).lerp(new THREE.Color('#ffffff'), 0.4), transparent: true, opacity: 0.5, depthWrite: false }));
    aura.scale.set(2.2, 2.2, 1);
    aura.position.set(0, 0.75, -0.4);
    aura.renderOrder = -1;
    root.add(aura);
    parts.aura = aura;
  }
  if (F.mark !== 'none' && look.stage !== 'baby') {
    const mm = softMat(P.dark || !P.pale ? P.mask : shade(P.top, { light: -0.1 }));
    const m = F.mark === 'heart' ? heartMesh(mm, 0.03, 0.01) : F.mark === 'star' ? starMesh(mm, 0.035, 0.016, 0.01) : blob(mm, [0.026, 0.026, 0.008]);
    body.add(stick(m, B.spots.birth, 0.002));
  }
  if (shinyMut) {
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: particleTex('sparkle'), transparent: true, depthWrite: false }));
      s.scale.setScalar(0.12);
      s.userData.a = (k / 5) * Math.PI * 2;
      root.add(s);
      parts.sparkles.push(s);
    }
  }

  root.scale.setScalar(S.scale);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const crownY = sp.crown ? sp.crown.p[1] : 0.64;
  parts.topY = (head.position.y + crownY * hs) * S.scale;
  parts.headY = (head.position.y + 0.3 * hs) * S.scale;
  return { root, body, parts, stage: look.stage };
}

