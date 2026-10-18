// Room furniture and room styles. Each item is a Group with userData:
//   kind, radius (collision footprint on the floor; 0 = walkable, like a rug)
// plus an invisible "hit" mesh so small things are easy to tap.
import { THREE, softMat, glossMat, blob, torus } from './kit.js';

export const RADIUS = { bed: 0.5, bowl: 0.3, ball: 0.12, plant: 0.24, lamp: 0.2, cushion: 0.32, toybox: 0.34, rug: 0 };

import { WALL_STYLES, RUG_STYLES } from './roomStyles.js';
export { WALL_STYLES, RUG_STYLES, LABELS } from './roomStyles.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function wallTexture(style) {
  const [a, b] = WALL_STYLES[style] ?? WALL_STYLES.pink;
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = a;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = b;
    for (let i = 0; i < 4; i++) g.fillRect(i * 64, 0, 32, 256);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6.6, 2);
  return t;
}

export function floorTexture(style) {
  const t = canvasTex(512, 512, (g) => {
    if (style === 'checker') {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? '#FFFFFF' : '#FFD3DF';
        g.fillRect(x * 64, y * 64, 64, 64);
      }
    } else if (style === 'tatami') {
      g.fillStyle = '#D9DDA0';
      g.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 4) {
        g.fillStyle = y % 8 ? 'rgba(150,160,80,.12)' : 'rgba(255,255,230,.18)';
        g.fillRect(0, y, 512, 2);
      }
      g.fillStyle = '#5E7A45';
      for (const [x, y, w, h] of [[0, 0, 512, 10], [0, 252, 512, 10], [252, 0, 10, 252], [0, 0, 10, 512]]) g.fillRect(x, y, w, h);
    } else {
      const maple = style === 'maple';
      g.fillStyle = maple ? '#F6DEB8' : '#F2CC9C';
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = maple ? (i % 2 ? '#F2D6AA' : '#F9E5C6') : i % 2 ? '#EDC28E' : '#F5D2A6';
        g.fillRect(0, i * 64, 512, 62);
        g.fillStyle = 'rgba(160,100,60,.16)';
        g.fillRect(0, i * 64 + 62, 512, 2);
        g.fillRect(((i * 197) % 400) + 40, i * 64, 2, 62);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4.6);
  return t;
}

const BALL_TEX = () =>
  canvasTex(128, 64, (g) => {
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#8C99FF';
    g.fillRect(0, 0, 128, 22);
    g.fillStyle = '#FF8FAB';
    g.fillRect(0, 42, 128, 22);
  });

/** Build one item. rugStyle only matters for rugs. */
export function buildItem(kind, { rugStyle = 'sky' } = {}) {
  const g = new THREE.Group();
  const parts = {};
  switch (kind) {
    case 'bed': {
      const cushion = torus(softMat('#C7B6F5'), 0.42, 0.16);
      cushion.rotation.x = Math.PI / 2;
      cushion.position.y = 0.15;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.12, 40), softMat('#EFE6FF'));
      pad.position.y = 0.07;
      g.add(cushion, pad);
      break;
    }
    case 'bowl': {
      const prof = [[0.16, 0], [0.23, 0.02], [0.27, 0.12], [0.24, 0.13], [0.2, 0.05], [0, 0.05]].map(([x, y]) => new THREE.Vector2(x, y));
      g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 40), glossMat('#FF8A65', { roughness: 0.35, side: THREE.DoubleSide })));
      parts.kibble = new THREE.Group();
      g.add(parts.kibble);
      break;
    }
    case 'ball': {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshPhysicalMaterial({ map: BALL_TEX(), roughness: 0.4, clearcoat: 0.6 }));
      ball.position.y = 0.12;
      g.add(ball);
      parts.ball = ball;
      break;
    }
    case 'plant': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 28), softMat('#E9967A'));
      pot.position.y = 0.16;
      g.add(pot);
      const leaves = new THREE.Group();
      const leafM = softMat('#7FCB5E');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const leaf = blob(leafM, [0.08, 0.26, 0.05]);
        leaf.position.set(Math.cos(a) * 0.09, 0.5, Math.sin(a) * 0.09);
        leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        leaves.add(leaf);
      }
      leaves.position.y = 0;
      g.add(leaves);
      parts.leaves = leaves;
      break;
    }
    case 'lamp': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 32), softMat('#FFF8F0'));
      base.position.y = 0.025;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.1, 12), softMat('#FFF8F0'));
      pole.position.y = 0.58;
      const shadeM = new THREE.MeshPhysicalMaterial({ color: '#FFE3B0', roughness: 0.6, emissive: new THREE.Color('#FFC777'), emissiveIntensity: 0 });
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.24, 0.26, 32, 1, true), shadeM);
      shade.material.side = THREE.DoubleSide;
      shade.position.y = 1.18;
      const light = new THREE.PointLight(0xffc98a, 0, 5, 1.6);
      light.position.y = 1.05;
      g.add(base, pole, shade, light);
      parts.light = light;
      parts.shade = shadeM;
      break;
    }
    case 'cushion': {
      const c = blob(softMat('#FFB3C7'), [0.3, 0.09, 0.3]);
      c.position.y = 0.09;
      const btn = blob(softMat('#FF8FAB'), [0.04, 0.02, 0.04]);
      btn.position.y = 0.175;
      g.add(c, btn);
      parts.seatY = 0.16;
      break;
    }
    case 'toybox': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.36), softMat('#8FD1FF'));
      box.position.y = 0.16;
      const lid = new THREE.Group();
      lid.position.set(0, 0.32, -0.18);
      const lidM = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.4), softMat('#FFD34D'));
      lidM.position.set(0, 0.03, 0.18);
      lid.add(lidM);
      const star = blob(softMat('#FFFFFF'), [0.06, 0.06, 0.01]);
      star.position.set(0, 0.16, 0.181);
      g.add(box, lid, star);
      parts.lid = lid;
      break;
    }
    case 'rug': {
      const [a, b] = RUG_STYLES[rugStyle] ?? RUG_STYLES.sky;
      const rug = new THREE.Mesh(new THREE.CircleGeometry(1.0, 64), new THREE.MeshStandardMaterial({ color: a, roughness: 1 }));
      rug.rotation.x = -Math.PI / 2;
      rug.scale.set(1, 0.72, 1);
      rug.position.y = 0.004;
      rug.receiveShadow = true;
      const edge = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 64), new THREE.MeshStandardMaterial({ color: b, roughness: 1 }));
      edge.rotation.x = -Math.PI / 2;
      edge.scale.set(1, 0.72, 1);
      edge.position.y = 0.006;
      g.add(rug, edge);
      parts.flat = true;
      break;
    }
    default:
      break;
  }
  g.traverse((o) => {
    if (o.isMesh && kind !== 'rug') o.castShadow = true;
  });
  // easy-to-tap invisible hit area
  const r = Math.max(RADIUS[kind] || 0.5, 0.22);
  const hitH = { lamp: 1.3, plant: 0.8, bed: 0.35, toybox: 0.45 }[kind] ?? 0.3;
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.1, kind === 'rug' ? 0.02 : hitH, 16), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = kind === 'rug' ? 0.01 : hitH / 2;
  if (kind === 'rug') hit.scale.set(1.0 / 0.5, 1, 0.72 / 0.5);
  g.add(hit);
  g.userData = { kind, radius: RADIUS[kind] ?? 0.3, parts, hit };
  return g;
}

/** A soft pulsing ring that marks the selected item while decorating. */
export function selectionRing() {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: '#FF8FAB', transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  ring.renderOrder = 2;
  return ring;
}
