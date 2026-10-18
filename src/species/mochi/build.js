// Mochi species art: DNA + stage + form + history -> a Three.js model.
// The genome decides WHAT the pet has; this file decides how it LOOKS.
import { THREE, furMat, softMat, glossMat, blob, torus, tube, starMesh, heartMesh, shade, mixHex, particleTex } from '../../three/kit.js';
import { sculpt } from '../sculptClient.js';
import { buildFxTail, buildWings, buildHeadPart, buildEgg, tongueMesh } from '../common.js';

const INK = '#2A2238';
// base = body, shade = deeper underside, accent = highlight/swirl, dust = powder specks, dip = spots & choco dip
export const FLAVORS = {
  plain: { base: '#FFF7EE', shade: '#EBD9C6', accent: '#FFFFFF', dust: '#E6C79A', dip: '#8A5A40', label: 'Rice' },
  sakura: { base: '#FFC7D8', shade: '#F2A2BC', accent: '#FFE6EE', dust: '#FFFFFF', dip: '#E07A9C', label: 'Sakura' },
  matcha: { base: '#BFE3A6', shade: '#98C97E', accent: '#E3F5D6', dust: '#FFFFFF', dip: '#6E9E55', label: 'Matcha' },
  yuzu: { base: '#FFE591', shade: '#F4CC5E', accent: '#FFF5CC', dust: '#FFFFFF', dip: '#E0A93A', label: 'Yuzu' },
  kinako: { base: '#EECC98', shade: '#D8AE73', accent: '#F8E4C2', dust: '#C9965A', dip: '#9A6A42', label: 'Kinako' },
  ube: { base: '#CDB8F4', shade: '#AE95E2', accent: '#ECE2FF', dust: '#FFFFFF', dip: '#8466C8', label: 'Ube' },
  sesame: { base: '#A6A4AD', shade: '#83818C', accent: '#CFCED4', dust: '#3C3A42', dip: '#4E4C56', label: 'Black sesame' },
  mango: { base: '#FFC680', shade: '#F5A552', accent: '#FFE3BC', dust: '#FFFFFF', dip: '#E07F2E', label: 'Mango' },
  choco: { base: '#A9765C', shade: '#87573F', accent: '#C99A80', dust: '#F2D9C8', dip: '#FFF1DC', label: 'Chocolate' },
  starry: { base: '#4150A0', shade: '#2D3878', accent: '#6C7CD0', dust: '#FFF6C8', dip: '#232B60', label: 'Starry night' },
};

// Bigger than the Shiba overall: a mochi is short, so it is scaled up to fill the room the same way.
const STAGE = {
  baby: { scale: 0.8, eye: 1.3 },
  teen: { scale: 1.02, eye: 1.1 },
  adult: { scale: 1.22, eye: 1 },
};
const SHOWN = { baby: new Set(['baby']), teen: new Set(['baby', 'teen']), adult: new Set(['baby', 'teen']) };

export function lookKey(look) {
  const g = look.genome;
  return [g.code, look.stage, look.form?.top, look.form?.second, (look.marks || []).join('.'),
    Math.round((look.vivid ?? 0.7) * 10), look.mood ?? '', look.hatchTaps ?? 0].join('|');
}

export async function buildPet(look, { detail = 1 } = {}) {
  if (look.stage === 'egg') {
    const fl = FLAVORS[look.genome.genes.flavor];
    return buildEgg(look, { base: fl.base, top: fl.shade });
  }
  return buildMochi(look, detail);
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
const stick = (obj, hit, out = 0) => {
  if (!hit) return obj;
  const n = V(hit.n);
  obj.position.copy(V(hit.p)).addScaledVector(n, out);
  obj.lookAt(obj.position.clone().add(n));
  return obj;
};

async function buildMochi(look, detail) {
  const g = look.genome;
  const G = g.genes;
  const F = g.fine;
  const S = STAGE[look.stage];
  const show = SHOWN[look.stage];
  const has = (gene) => show.has(g.list.find((x) => x.key === gene).shows);
  const baby = look.stage === 'baby';
  const form = baby ? null : look.form?.top;
  const feature = look.stage === 'adult' ? look.form?.second : null;
  const uScale = look.stage === 'adult' ? 1 : look.stage === 'teen' ? 0.62 : 0;
  const uq = uScale ? g.unique : { slot: 'none', value: 'none' };

  // colours: flavour + fine hue, faded by poor care
  const vivid = look.vivid ?? 0.7;
  const tone = { hue: F.hue, light: F.light + (1 - vivid) * 0.04, sat: 0.55 + vivid * 0.5 };
  const fl = FLAVORS[G.flavor];
  const col = (hex) => shade(hex, tone);
  const colours = { base: col(fl.base), shade: col(fl.shade), accent: col(fl.accent), dust: col(fl.dust), dip: col(fl.dip), belly: mixHex(col(fl.base), '#FFFFFF', 0.55) };

  let w = F.width;
  let h = F.height;
  if (form === 'tough') w *= 1.18;
  if (form === 'calm') {
    h *= 1.18;
    w *= 0.94;
  }
  const r2 = (x) => Math.round(x * 1000) / 1000;
  const sc = await sculpt('mochi:body', {
    shape: baby ? 'round' : G.shape, // every baby starts as a plain round mochi
    w: r2(w), h: r2(baby ? 0.95 : h), form, feature, top: has('top') ? G.top : 'none',
    uniqueTail: uq.slot === 'tail' && (uq.value === 'tail_puff' || uq.value === 'tail_curl') ? uq.value : null,
    earTilt: r2(F.earTilt), earSize: r2(F.earSize), gap: r2(F.gap), cheek: r2(F.cheek), cheeks: G.cheeks,
    pattern: has('pattern') ? G.pattern : 'plain', flavor: G.flavor, spotSeed: F.spotSeed, markSide: F.markSide, markY: F.markY,
    detail, ...colours,
  });
  const sp = sc.spots;

  const shinyMut = g.mutations.includes('shiny');
  const skin = furMat({
    roughness: 0.55,
    sheen: 0.8,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color(0xffffff).multiplyScalar(0.35),
    clearcoat: 0.25,
    clearcoatRoughness: 0.6,
    ...(shinyMut ? { iridescence: 0.6, iridescenceIOR: 1.6 } : {}),
  });

  const root = new THREE.Group();
  const body = new THREE.Group(); // squash, stretch and jelly lean act on this
  root.add(body);
  const parts = { ears: [], eyes: [], legs: [], wings: [], flames: [], sparkles: [], blink: [], jelly: true, locomotion: 'hop', squish: F.squish, bounce: F.bounce };
  body.add(new THREE.Mesh(toGeo(sc.mesh), skin));

  // ---- face ----
  const inkMat = softMat(INK, { sheen: 0 });
  const eyeS = S.eye * F.eye * 1.15;
  const hetero = g.mutations.includes('hetero');
  sp.eyes.forEach((hit, i) => {
    const s = i ? 1 : -1;
    const eg = stick(new THREE.Group(), hit, -0.012);
    body.add(eg);
    const lid = new THREE.Group();
    eg.add(lid);
    if (G.eyes === 'happy') {
      const a = torus(inkMat, 0.045 * eyeS, 0.012 * eyeS, Math.PI);
      a.position.z = 0.014;
      lid.add(a);
    } else if (G.eyes === 'star') {
      const st = starMesh(glossMat(INK), 0.062 * eyeS, 0.03 * eyeS, 0.02);
      st.position.z = 0.014;
      lid.add(st);
    } else {
      lid.add(blob(glossMat(INK), [0.052 * eyeS, 0.062 * eyeS, 0.034 * eyeS]));
      if (hetero) {
        const iris = blob(glossMat(s < 0 ? '#3AA0E8' : '#E8A93A'), [0.042 * eyeS, 0.05 * eyeS, 0.02 * eyeS]);
        iris.position.z = 0.024 * eyeS;
        lid.add(iris);
        const pupil = blob(glossMat(INK), [0.021 * eyeS, 0.026 * eyeS, 0.012 * eyeS]);
        pupil.position.z = 0.035 * eyeS;
        lid.add(pupil);
      }
      const hi = blob(glossMat('#ffffff', { emissive: new THREE.Color(0x555555) }), [0.018 * eyeS, 0.02 * eyeS, 0.01]);
      hi.position.set(0.015 * eyeS, 0.021 * eyeS, 0.03 * eyeS);
      lid.add(hi);
      if (G.eyes === 'sparkle') {
        const hi2 = blob(glossMat('#ffffff'), [0.009 * eyeS, 0.009 * eyeS, 0.006]);
        hi2.position.set(-0.017 * eyeS, -0.019 * eyeS, 0.032 * eyeS);
        lid.add(hi2);
      }
      if (G.eyes === 'sleepy') lid.userData.rest = 0.55;
    }
    if (look.mood === 'sad') {
      const b = tube(inkMat, [[-0.034, 0, 0], [0.034, -s * 0.018, 0]], 0.007);
      b.position.set(0, 0.085 * eyeS, 0.02);
      b.rotation.z = s * 0.35;
      eg.add(b);
    }
    parts.eyes.push(eg);
    parts.blink.push(lid);
  });
  const mouth = stick(new THREE.Group(), sp.mouth, 0.002);
  body.add(mouth);
  parts.mouth = mouth;
  if (G.mouth === 'smile') {
    const m = torus(inkMat, 0.032, 0.008, Math.PI);
    m.rotation.z = Math.PI;
    mouth.add(m);
  } else if (G.mouth === 'open') {
    const o = blob(softMat('#C24A63'), [0.03, 0.026, 0.012]);
    mouth.add(o);
  } else {
    for (const s of [-1, 1]) {
      const m = torus(inkMat, 0.021, 0.008, Math.PI);
      m.rotation.z = Math.PI;
      m.position.x = s * 0.021;
      mouth.add(m);
    }
    if (G.mouth === 'tongue') {
      const tg = tongueMesh(1.45);
      tg.position.set(0.006, -0.01, 0.006);
      tg.rotation.z = -0.08; // a little cheeky tilt
      mouth.add(tg);
    }
  }

  const crown = sp.crown ? V(sp.crown.p) : new THREE.Vector3(0, sp.top, 0);
  // ---- top extras that aren't part of the sculpt ----
  if (has('top') && G.top === 'antenna' && uq.slot !== 'head') {
    const ant = new THREE.Group();
    ant.position.copy(crown);
    ant.add(tube(softMat(colours.shade), [[0, 0, 0], [0.02, 0.1, 0], [0.05, 0.18, 0]], 0.012));
    const ball = blob(glossMat(colours.accent === '#ffffff' ? '#FF8FB4' : '#FF8FB4'), [0.04, 0.04, 0.04]);
    ball.position.set(0.05, 0.2, 0);
    ant.add(ball);
    body.add(ant);
  }
  if (((has('top') && G.top === 'sprout') || form === 'calm') && uq.slot !== 'head') {
    const sprout = new THREE.Group();
    sprout.position.copy(crown).add(new THREE.Vector3(0, -0.01, 0));
    sprout.add(tube(softMat('#4F9A3A'), [[0, 0, 0], [0.01, 0.07, 0], [0.03, 0.13, 0]], 0.014));
    for (const s of [-1, 1]) {
      const leaf = blob(softMat('#7FCB5E'), [0.075, 0.03, 0.036]);
      leaf.position.set(0.03 + s * 0.065, 0.14, 0);
      leaf.rotation.z = s * 0.4;
      sprout.add(leaf);
    }
    body.add(sprout);
  }
  // topper (a little treat on top, like an ichigo daifuku)
  if (has('topper') && G.topper !== 'none' && sp.topper && form !== 'strong') {
    const tp = new THREE.Group();
    tp.position.copy(V(sp.topper.p));
    if (G.topper === 'strawberry') {
      const berry = blob(glossMat('#F2455C', { roughness: 0.35 }), [0.075, 0.09, 0.075]);
      berry.position.y = 0.07;
      tp.add(berry);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const lf = blob(softMat('#5DBB5A'), [0.04, 0.012, 0.022]);
        lf.position.set(Math.cos(a) * 0.035, 0.155, Math.sin(a) * 0.035);
        lf.rotation.y = -a;
        tp.add(lf);
      }
      for (let k = 0; k < 8; k++) {
        const a = k * 2.4;
        const seed = blob(softMat('#FFE48A'), [0.007, 0.01, 0.005]);
        seed.position.set(Math.cos(a) * 0.072, 0.04 + (k % 3) * 0.03, Math.sin(a) * 0.072);
        tp.add(seed);
      }
    } else if (G.topper === 'leaf') {
      const lf = blob(softMat('#7DB35A'), [0.16, 0.02, 0.09]);
      lf.position.set(-0.03, 0.03, 0);
      lf.rotation.set(0.2, 0.4, -0.25);
      tp.add(lf);
    } else if (G.topper === 'bean') {
      const b = blob(glossMat('#7A2E34', { roughness: 0.4 }), [0.06, 0.04, 0.05]);
      b.position.y = 0.03;
      tp.add(b);
    } else if (G.topper === 'cherry') {
      const c = blob(glossMat('#E8233F', { roughness: 0.2 }), [0.06, 0.06, 0.06]);
      c.position.y = 0.06;
      tp.add(c, tube(softMat('#5B8A3A'), [[0, 0.11, 0], [0.02, 0.17, 0], [0.06, 0.22, 0]], 0.008));
    }
    body.add(tp);
  }
  // base (sits under the mochi and bounces with it)
  if (has('base') && G.base !== 'none') {
    const R = sp.radius * 1.02;
    if (G.base === 'cup') {
      const geo = new THREE.CylinderGeometry(R * 1.04, R * 0.82, 0.17, 48, 1, true);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const a = Math.atan2(pos.getZ(i), pos.getX(i));
        const k = 1 + Math.cos(a * 24) * 0.025;
        pos.setX(i, pos.getX(i) * k);
        pos.setZ(i, pos.getZ(i) * k);
      }
      geo.computeVertexNormals();
      const cup = new THREE.Mesh(geo, softMat(mixHex(colours.base, '#FFFFFF', 0.6), { side: THREE.DoubleSide, sheen: 0.2 }));
      cup.position.y = 0.075;
      body.add(cup);
    } else if (G.base === 'leafwrap') {
      const lf = blob(softMat('#7DB35A'), [R * 1.2, 0.025, R * 1.05]);
      lf.position.set(0, 0.012, -0.05);
      body.add(lf);
    } else {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.35, R * 1.2, 0.04, 48), glossMat('#FFFFFF', { roughness: 0.3 }));
      plate.position.y = -0.005;
      body.add(plate);
    }
  }
  // charm
  if (has('charm') && G.charm !== 'none') {
    const cm = softMat('#FF6B8A', { sheen: 0.4 });
    if (G.charm === 'bow' && sp.upperL) {
      const bow = stick(new THREE.Group(), sp.upperL, 0.01);
      for (const s of [-1, 1]) {
        const wng = blob(cm, [0.055, 0.035, 0.022]);
        wng.position.x = s * 0.05;
        wng.rotation.z = s * 0.4;
        bow.add(wng);
      }
      bow.add(blob(cm, [0.024, 0.024, 0.024]));
      body.add(bow);
    } else if (G.charm === 'ribbon' && sp.sideR) {
      const rr = Math.abs(sp.sideR.p[0]);
      const band = torus(softMat('#7FB8FF', { sheen: 0.4 }), rr * 1.0, 0.024, Math.PI * 2, 64);
      band.rotation.x = Math.PI / 2;
      band.position.y = sp.sideR.p[1] - 0.06; // below the mouth, so a tongue can hang over it
      band.scale.set(1, 0.92, 1);
      body.add(band);
    } else if (G.charm === 'bell' && sp.front) {
      const bell = stick(blob(glossMat('#F2C14E', { metalness: 0.7, roughness: 0.25 }), [0.05, 0.05, 0.05]), sp.front, 0.03);
      body.add(bell);
    }
  }

  // ---- rare parts ----
  if (uq.slot === 'wings') buildWings(body, uq.value, uScale, [0, sp.top * 0.55, -sp.radius * 0.7], parts);
  if (uq.slot === 'head') buildHeadPart(body, uq.value, uScale, [0, sp.top * 0.55, 0], [sp.radius, sp.top * 0.45, sp.radius * 0.9]);
  const tail = new THREE.Group();
  if (sp.back) tail.position.copy(V(sp.back.p));
  body.add(tail);
  parts.tail = tail;
  if (uq.value === 'tail_crystal' || uq.value === 'tail_flame') {
    tail.position.y -= 0.25;
    buildFxTail(tail, uq.value, 0.9, parts);
  }
  if (feature === 'calm') {
    const halo = torus(glossMat('#FFD34D', { emissive: new THREE.Color('#FFB000'), emissiveIntensity: 0.6 }), 0.17, 0.022);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, crown.y + (form === 'playful' ? 0.55 : 0.22), 0);
    body.add(halo);
    parts.halo = halo;
  }

  // ---- memory marks + birthmark ----
  const marks = new Set(look.marks || []);
  if (marks.has('star') && sp.upperR) body.add(stick(starMesh(glossMat('#FFD34D', { emissive: new THREE.Color('#996600'), emissiveIntensity: 0.3 }), 0.045, 0.02, 0.014), sp.upperR, 0.004));
  if (marks.has('scar') && sp.upperL && G.charm !== 'bow') {
    for (const s of [-1, 1]) body.add(stick(tube(softMat('#C2566F'), [[-0.032, -0.032 * s, 0], [0.032, 0.032 * s, 0]], 0.008), sp.upperL, 0.004));
  }
  if (marks.has('sun') && sp.sideL) body.add(stick(new THREE.Mesh(new THREE.CircleGeometry(0.032, 20), softMat('#FFA53A', { side: THREE.DoubleSide })), sp.sideL, 0.003));
  if (marks.has('rainbow') && sp.sideR) {
    const rb = new THREE.Group();
    ['#FF6B8A', '#FFD34D', '#5CC8FF'].forEach((c, k) => rb.add(torus(softMat(c), 0.045 - k * 0.012, 0.006, Math.PI, 20)));
    body.add(stick(rb, sp.sideR, 0.003));
  }
  if (marks.has('aura')) {
    const tex = particleTex('puff');
    if (tex) {
      const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(colours.accent), transparent: true, opacity: 0.5, depthWrite: false }));
      aura.scale.set(2, 2, 1);
      aura.position.set(0, 0.5, -0.4);
      aura.renderOrder = -1;
      root.add(aura);
      parts.aura = aura;
    }
  }
  if (F.mark !== 'none' && !baby && sp.birth) {
    const mm = softMat(mixHex(colours.base, '#FFFFFF', 0.6));
    const m = F.mark === 'heart' ? heartMesh(mm, 0.03, 0.01) : F.mark === 'star' ? starMesh(mm, 0.035, 0.016, 0.01) : blob(mm, [0.026, 0.026, 0.008]);
    body.add(stick(m, sp.birth, 0.002));
  }
  if (shinyMut) {
    const tex = particleTex('sparkle');
    for (let k = 0; tex && k < 5; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.scale.setScalar(0.12);
      s.userData.a = (k / 5) * Math.PI * 2;
      root.add(s);
      parts.sparkles.push(s);
    }
  }

  // wide shapes (pudding, chubby) shrink a little so every mochi fits the room
  const scale = S.scale * Math.min(1, 0.6 / sp.radius);
  root.scale.setScalar(scale);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  parts.topY = crown.y * scale;
  parts.headY = sp.faceY * scale;
  return { root, body, parts, stage: look.stage };
}

