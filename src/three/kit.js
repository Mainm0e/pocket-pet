// Small Three.js toolkit shared by species builders, the room and the viewers.
import * as THREE from 'three';

export { THREE };

const SPHERE = new THREE.SphereGeometry(1, 40, 28);
const SPHERE_LO = new THREE.SphereGeometry(1, 20, 14);

export const color = (hex) => new THREE.Color(hex);

/** Soft "flocked vinyl" fur: matte with a velvet sheen, like the reference toys. */
export function furMat(opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.75,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0xffe6cc).multiplyScalar(0.3),
    ...opts,
  });
}
/** Plain soft material (no gradient). */
export function softMat(hex, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color: color(hex), roughness: 0.7, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x553333), ...opts });
}
/** Glossy bits: eyes, nose, bell. */
export function glossMat(hex, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color: color(hex), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, ...opts });
}

/**
 * Ellipsoid with a vertical colour gradient baked into vertex colours.
 * `top` is used above `edge` (in unit-sphere y), `bottom` below, blended over `soft`.
 */
export function furBlob(mat, radii, top, bottom = top, { edge = 0.15, soft = 0.45, lo = false, front = null, frontEdge = 0.55 } = {}) {
  const geo = (lo ? SPHERE_LO : SPHERE).clone();
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const ct = color(top);
  const cb = color(bottom);
  const cf = front ? color(front) : null;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = THREE.MathUtils.smoothstep(y, edge - soft / 2, edge + soft / 2);
    c.copy(cb).lerp(ct, k);
    // optional front patch (e.g. the white chest/muzzle of a Shiba)
    if (cf) c.lerp(cf, THREE.MathUtils.smoothstep(z, frontEdge - 0.2, frontEdge + 0.15));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(...radii);
  return m;
}

/** Ellipsoid in one plain colour. */
export function blob(mat, radii) {
  const m = new THREE.Mesh(SPHERE, mat);
  m.scale.set(...radii);
  return m;
}

/**
 * Put `obj` on the surface of an ellipsoid (centre c, radii r) at the point seen
 * from direction (x, y) on its front, facing outward. `out` pushes it off the surface.
 */
export function onEllipsoid(obj, c, r, nx, ny, out = 0, side = 1) {
  const zz = Math.max(0.0001, 1 - nx * nx - ny * ny);
  const nz = Math.sqrt(zz) * side;
  const p = new THREE.Vector3(c[0] + nx * r[0], c[1] + ny * r[1], c[2] + nz * r[2]);
  const n = new THREE.Vector3(nx / r[0], ny / r[1], nz / r[2]).normalize();
  obj.position.copy(p).addScaledVector(n, out);
  obj.lookAt(obj.position.clone().add(n));
  return obj;
}

export function cone(mat, r, h, seg = 32) {
  return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
}
export function torus(mat, R, r, arc = Math.PI * 2, seg = 48) {
  return new THREE.Mesh(new THREE.TorusGeometry(R, r, 14, seg, arc), mat);
}
export function tube(mat, pts, r) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 10, false), mat);
}
export function shape2d(mat, pts, depth = 0.03, bevel = 0.012) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}
export function starMesh(mat, R, r = R * 0.45, depth = 0.03) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    p.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return shape2d(mat, p, depth, depth * 0.3);
}
export function heartMesh(mat, s, depth = 0.03) {
  const p = new THREE.Shape();
  p.moveTo(0, -s * 0.9);
  p.bezierCurveTo(s * 1.2, -s * 0.1, s * 0.7, s * 0.95, 0, s * 0.35);
  p.bezierCurveTo(-s * 0.7, s * 0.95, -s * 1.2, -s * 0.1, 0, -s * 0.9);
  const g = new THREE.ExtrudeGeometry(p, { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: depth * 0.3, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}

// ---------- colour helpers ----------
export function shade(hex, { hue = 0, light = 0, sat = 1 } = {}) {
  const c = color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL((hsl.h + hue / 360 + 1) % 1, Math.min(1, hsl.s * sat), Math.min(1, Math.max(0, hsl.l + light)));
  return '#' + c.getHexString();
}
export function mixHex(a, b, t) {
  return '#' + color(a).lerp(color(b), t).getHexString();
}

// ---------- particles ----------
const TEX = {};
function makeTex(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function particleTex(kind) {
  if (TEX[kind]) return TEX[kind];
  if (typeof document === 'undefined') return null; // no canvas (tests / workers)
  const draw = {
    heart: (g) => {
      g.fillStyle = '#FF6B9A';
      g.beginPath();
      g.moveTo(32, 54);
      g.bezierCurveTo(4, 36, 8, 10, 32, 22);
      g.bezierCurveTo(56, 10, 60, 36, 32, 54);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.beginPath();
      g.arc(22, 25, 5, 0, 7);
      g.fill();
    },
    z: (g) => {
      g.font = 'bold 46px Fredoka, ui-rounded, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 7;
      g.strokeStyle = '#fff';
      g.strokeText('Z', 32, 34);
      g.fillStyle = '#6A6FD8';
      g.fillText('Z', 32, 34);
    },
    note: (g) => {
      g.fillStyle = '#7C6CF0';
      g.beginPath();
      g.ellipse(22, 46, 10, 8, -0.4, 0, 7);
      g.fill();
      g.fillRect(29, 12, 5, 34);
      g.beginPath();
      g.moveTo(34, 12);
      g.quadraticCurveTo(54, 18, 48, 34);
      g.quadraticCurveTo(46, 22, 34, 23);
      g.fill();
    },
    star: (g) => {
      g.fillStyle = '#FFC94A';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 11 : 28;
        g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    },
    drop: (g) => {
      g.fillStyle = '#7CC8FF';
      g.beginPath();
      g.moveTo(32, 8);
      g.quadraticCurveTo(52, 36, 44, 46);
      g.arc(32, 42, 13, 0.3, Math.PI - 0.3);
      g.quadraticCurveTo(12, 36, 32, 8);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.beginPath();
      g.arc(26, 38, 4, 0, 7);
      g.fill();
    },
    puff: (g) => {
      const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,255,.95)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    },
    bubble: (g) => {
      g.strokeStyle = 'rgba(120,190,255,.95)';
      g.lineWidth = 4;
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath();
      g.arc(32, 32, 24, 0, 7);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.beginPath();
      g.arc(23, 23, 6, 0, 7);
      g.fill();
    },
    leaf: (g) => {
      g.fillStyle = '#7FCB5E';
      g.beginPath();
      g.ellipse(32, 32, 12, 24, 0.6, 0, 7);
      g.fill();
      g.strokeStyle = '#4F9A3A';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(20, 48);
      g.lineTo(44, 16);
      g.stroke();
    },
    // the anime "anger mark": four popping veins bulging toward the middle
    anger: (g) => {
      g.lineCap = 'round';
      for (const [w, col] of [[13, '#FFFFFF'], [7, '#E8303A']]) {
        g.lineWidth = w;
        g.strokeStyle = col;
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const cx = 32 + dx * 30;
          const cy = 32 + dy * 30;
          const mid = Math.atan2(-dy, -dx); // facing the middle
          g.beginPath();
          g.arc(cx, cy, 21, mid - 0.62, mid + 0.62);
          g.stroke();
        }
      }
    },
    sparkle: (g) => {
      g.fillStyle = '#FFF4B8';
      g.beginPath();
      g.moveTo(32, 2);
      g.quadraticCurveTo(36, 28, 62, 32);
      g.quadraticCurveTo(36, 36, 32, 62);
      g.quadraticCurveTo(28, 36, 2, 32);
      g.quadraticCurveTo(28, 28, 32, 2);
      g.fill();
    },
  }[kind];
  TEX[kind] = makeTex(draw);
  return TEX[kind];
}

/** Dispose every geometry/material in a tree (shared unit spheres are skipped). */
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.isMesh || o.isSprite) {
      if (o.geometry && o.geometry !== SPHERE && o.geometry !== SPHERE_LO) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) if (m && !m.userData.shared) m.dispose();
    }
  });
}

import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Production settings: Three's synchronous shader-error check stalls the page while shaders compile. */
export function tuneRenderer(renderer) {
  renderer.debug.checkShaderErrors = !!import.meta.env?.DEV;
  return renderer;
}

/** Compile a new model's shaders in the background before it is first drawn. */
export async function precompile(renderer, obj, camera, scene) {
  try {
    await renderer.compileAsync(obj, camera, scene);
  } catch {
    /* older drivers: just compile on first draw */
  }
}

/** Soft studio reflections so gloss, metal and sheen read like vinyl toys. */
export function addEnvironment(renderer, scene, intensity = 0.35) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = intensity;
  pm.dispose();
}

export function addLights(scene, { shadows = true, strength = 1 } = {}) {
  const hemi = new THREE.HemisphereLight(0xfff8f2, 0xd9c2d8, 1.5 * strength);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff3e6, 2.4 * strength);
  key.position.set(2.2, 4.6, 3.6);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
    key.shadow.radius = 6;
    key.shadow.bias = -0.0006;
  }
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe0ee, 1.1 * strength);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.6 * strength);
  fill.position.set(-3, 1.5, 3);
  scene.add(fill);
  return { hemi, key, rim, fill };
}
