// Parts shared by every species: rare wings, head parts, crystal/flame tails, and the egg.
import { THREE, softMat, glossMat, blob, onEllipsoid, cone, torus, tube, shape2d, starMesh, mixHex, particleTex } from '../three/kit.js';
import { streamFor } from '../server/genome/core.js';

export function buildFxTail(tail, kind, ts, parts) {
  if (kind === 'tail_crystal') {
    const curve = new THREE.CatmullRomCurve3([[0, 0.25, -0.08], [0.02, 0.38, -0.08], [0.04, 0.5, 0.02]].map((p) => new THREE.Vector3(...p).multiplyScalar(ts)));
    const cm = new THREE.MeshPhysicalMaterial({ color: 0x9fe8ff, roughness: 0.05, transmission: 0.6, thickness: 0.2, emissive: new THREE.Color(0x3aa0c8), emissiveIntensity: 0.35, clearcoat: 1 });
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.085 * ts * (1 - i * 0.1)), cm);
      c.position.copy(curve.getPoint(i / 4));
      c.rotation.set(i, i * 0.7, 0);
      c.scale.y = 1.4;
      tail.add(c);
    }
  } else {
    ['#FF7A2E', '#FFB13B', '#FFE36B'].forEach((c, i) => {
      const f = cone(new THREE.MeshPhysicalMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: 0.9, roughness: 0.5, transparent: true, opacity: 0.9 }), (0.13 - i * 0.033) * ts, (0.32 - i * 0.07) * ts, 20);
      f.position.set(0.02 * ts, (0.42 + i * 0.03) * ts, -0.08 * ts);
      tail.add(f);
      parts.flames.push(f);
    });
  }
}

export function buildWings(body, kind, us, at, parts) {
  const mats = {
    wings_feather: softMat('#FFFFFF'),
    wings_angel: softMat('#FFFFFF', { emissive: new THREE.Color('#FFF2C0'), emissiveIntensity: 0.35 }),
    wings_bat: softMat('#5B4378'),
    wings_butterfly: softMat('#FFB8E0', { transparent: true, opacity: 0.92 }),
  };
  const m = mats[kind];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(at[0] + s * 0.16, at[1], at[2]);
    pivot.userData.sx = s;
    const wing = new THREE.Group();
    if (kind === 'wings_feather' || kind === 'wings_angel') {
      const n = kind === 'wings_angel' ? 5 : 4;
      const len = kind === 'wings_angel' ? 0.44 : 0.32;
      for (let k = 0; k < n; k++) {
        const f = blob(m, [0.06, len * (1 - k * 0.14), 0.025]);
        f.position.set(s * (0.1 + k * 0.05), 0.04 + len * 0.45 - k * 0.07, 0);
        f.rotation.z = -s * (0.9 + k * 0.28);
        wing.add(f);
      }
    } else if (kind === 'wings_bat') {
      const w = shape2d(m, [[0, 0], [0.42, 0.22], [0.36, 0.02, 0.32, -0.06], [0.24, 0.02, 0.18, -0.08], [0.1, 0.0, 0.05, -0.06]], 0.02, 0.008);
      w.scale.x = s;
      wing.add(w);
    } else {
      const w1 = blob(m, [0.2, 0.15, 0.02]);
      w1.position.set(s * 0.18, 0.12, 0);
      w1.rotation.z = s * 0.5;
      const w2 = blob(mats.wings_butterfly, [0.13, 0.1, 0.02]);
      w2.position.set(s * 0.15, -0.06, 0);
      w2.rotation.z = -s * 0.4;
      wing.add(w1, w2);
      const spot = blob(softMat('#FFFFFF'), [0.045, 0.045, 0.025]);
      spot.position.set(s * 0.2, 0.13, 0.005);
      wing.add(spot);
    }
    wing.scale.setScalar(us);
    pivot.add(wing);
    pivot.rotation.y = s * 0.55;
    body.add(pivot);
    parts.wings.push(pivot);
  }
}

export function buildHeadPart(head, kind, us, HC, HR) {
  const g = new THREE.Group();
  onEllipsoid(g, HC, HR, 0, 0.9, -0.01);
  g.rotateX(-Math.PI / 2);
  g.rotation.set(0, 0, 0);
  g.position.set(HC[0], HC[1] + HR[1] * 0.92, HC[2] + HR[2] * 0.15);
  if (kind === 'head_flower') {
    const cols = ['#FF8FB4', '#FFD34D', '#B9A3FF', '#7FD8B0', '#FF9F7A'];
    for (let k = 0; k < 5; k++) {
      const a = -1.2 + k * 0.6;
      const fl = new THREE.Group();
      fl.position.set(Math.sin(a) * 0.3, -Math.abs(Math.sin(a)) * 0.12, Math.cos(a) * 0.08);
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        const pet = blob(softMat(cols[k]), [0.035, 0.035, 0.02]);
        pet.position.set(Math.cos(pa) * 0.035, Math.sin(pa) * 0.035, 0);
        fl.add(pet);
      }
      fl.add(blob(softMat('#FFF6C8'), [0.022, 0.022, 0.025]));
      fl.rotation.x = -0.6;
      g.add(fl);
    }
  } else if (kind === 'head_star') {
    g.add(tube(softMat('#8A7CF0'), [[0, 0, 0], [0.02, 0.12, 0], [0.06, 0.22, 0]], 0.012));
    const st = starMesh(glossMat('#FFD34D', { emissive: new THREE.Color('#FFB000'), emissiveIntensity: 0.5 }), 0.07, 0.032, 0.03);
    st.position.set(0.06, 0.26, 0);
    g.add(st);
  } else if (kind === 'head_crystal') {
    const cm = new THREE.MeshPhysicalMaterial({ color: 0xc9b6ff, roughness: 0.05, transmission: 0.5, thickness: 0.2, emissive: new THREE.Color(0x7a5ae0), emissiveIntensity: 0.35, clearcoat: 1 });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), cm);
      c.scale.y = 2.2;
      c.position.set(s * 0.17, 0.06, 0.04);
      c.rotation.z = -s * 0.35;
      g.add(c);
    }
  } else if (kind === 'head_unicorn') {
    const hm = new THREE.MeshPhysicalMaterial({ color: 0xfff1f8, roughness: 0.25, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.5, sheen: 0.5 });
    const horn = cone(hm, 0.05, 0.26, 24);
    horn.position.set(0, 0.11, 0.17);
    horn.rotation.x = 0.35;
    g.add(horn);
    for (let k = 0; k < 3; k++) {
      const ring = torus(softMat('#FFD6EC'), 0.042 - k * 0.011, 0.007, Math.PI * 2, 20);
      ring.position.set(0, 0.03 + k * 0.06, 0.15 + k * 0.022);
      ring.rotation.x = Math.PI / 2 + 0.35;
      g.add(ring);
    }
  }
  g.scale.setScalar(us);
  head.add(g);
}

// --------------------------------------------------------------------------------------------
export function buildEgg(look, coat) {
  const g = look.genome;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const prof = [];
  for (let i = 0; i <= 56; i++) {
    const t = i / 56;
    const ph = t * Math.PI;
    prof.push(new THREE.Vector2(Math.max(0, Math.sin(ph) * 0.5 * (1 + 0.13 * Math.cos(ph))), 0.66 - Math.cos(ph) * 0.66));
  }
  const rare = g.tier === 'Epic' || g.tier === 'Legendary';
  const golden = g.speciesOdds !== null && g.speciesOdds < 0.001; // a 1-in-a-million species
  const shellCol = golden ? '#FFE49A' : mixHex(coat.base, '#FFFFFF', 0.72);
  const shell = new THREE.Mesh(
    new THREE.LatheGeometry(prof, 72),
    new THREE.MeshPhysicalMaterial({ color: shellCol, roughness: 0.35, clearcoat: 0.9, sheen: 0.3, emissive: new THREE.Color(rare ? '#FFD27A' : '#000000'), emissiveIntensity: golden ? 0.45 : rare ? 0.2 : 0, metalness: golden ? 0.35 : 0 })
  );
  body.add(shell);
  // speckles: from the egg stream, tinted by the coat inside
  const r = streamFor(g.hash, 'egg');
  const rAt = (y) => {
    for (let i = 1; i < prof.length; i++) if (prof[i].y >= y) return prof[i].x;
    return 0;
  };
  const spotM = golden ? glossMat('#E9A825', { metalness: 0.6, roughness: 0.3 }) : softMat(mixHex(coat.top, '#FFFFFF', 0.25));
  for (let i = 0; i < 12; i++) {
    const y = 0.18 + r() * 0.95;
    const az = r() * Math.PI * 2;
    const s = 0.04 + r() * 0.06;
    const sp = blob(spotM, [s, s * 0.85, 0.015]);
    const rr = rAt(y);
    sp.position.set(Math.sin(az) * rr, y, Math.cos(az) * rr);
    sp.lookAt(new THREE.Vector3(Math.sin(az) * 3, y, Math.cos(az) * 3));
    body.add(sp);
  }
  // cracks appear as the player taps
  const crackM = softMat('#6B5A4A', { sheen: 0 });
  const zig = (y0, az0, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const y = y0 + (i % 2 ? 0.05 : -0.03);
      const az = az0 + i * 0.13;
      const rr = rAt(y) + 0.004;
      pts.push([Math.sin(az) * rr, y, Math.cos(az) * rr]);
    }
    return tube(crackM, pts, 0.008);
  };
  const cracks = [zig(0.75, -0.4, 5), zig(0.55, 0.2, 4), zig(0.9, 0.5, 4), zig(0.62, -1.1, 4)];
  cracks.forEach((c, i) => {
    c.visible = i < (look.hatchTaps ?? 0);
    body.add(c);
  });
  const parts = { egg: true, cracks, sparkles: [], ears: [], eyes: [], legs: [], wings: [], flames: [], blink: [], topY: 1.32, headY: 1 };
  if (rare) {
    for (let i = 0; i < (golden ? 12 : 6); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: particleTex('sparkle'), transparent: true, depthWrite: false }));
      sp.scale.setScalar(0.14);
      sp.userData.a = (i / (golden ? 12 : 6)) * Math.PI * 2;
      root.add(sp);
      parts.sparkles.push(sp);
    }
  }
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { root, body, parts, stage: 'egg' };
}

/**
 * A proper little tongue: a rounded, slightly cupped U that curls out of a dark mouth
 * opening, glossy, with a groove down the middle. Faces +z, top at y = 0.
 */
export function tongueMesh(size = 1) {
  const g = new THREE.Group();
  const open = blob(softMat('#6E2438', { sheen: 0 }), [0.03 * size, 0.013 * size, 0.008 * size]);
  open.position.set(0, -0.006 * size, -0.002);
  g.add(open);
  const w = 0.024 * size;
  const L = 0.052 * size;
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(-w, -L + w);
  shape.absarc(0, -L + w, w, Math.PI, 0, false);
  shape.lineTo(w, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.006 * size, bevelEnabled: true, bevelThickness: 0.006 * size, bevelSize: 0.006 * size, bevelSegments: 4, curveSegments: 18 });
  // curl it outward as it goes down, and cup it slightly across
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) + (y * y) / (0.11 * size) - ((x * x) / (w * w)) * 0.004 * size);
  }
  geo.computeVertexNormals();
  const tongue = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#FF6F96', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.3 }));
  tongue.position.y = -0.004 * size;
  g.add(tongue);
  const groove = tube(softMat('#E04E73', { sheen: 0 }), [[0, -0.01 * size, 0.012 * size], [0, -0.025 * size, 0.017 * size], [0, -0.038 * size, 0.026 * size]], 0.0028 * size);
  g.add(groove);
  // a tiny highlight sells the wet, glossy look
  const hi = blob(glossMat('#FFFFFF'), [0.006 * size, 0.004 * size, 0.002 * size]);
  hi.position.set(-0.009 * size, -0.022 * size, 0.022 * size);
  g.add(hi);
  return g;
}
