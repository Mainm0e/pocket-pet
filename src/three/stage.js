// The 3D room: renderer, furniture, lighting by time of day, pet motion, care scenes and particles.
// The stage only DISPLAYS what the server decided. It never changes game state.
import { THREE, addLights, addEnvironment, disposeTree, softMat, glossMat, blob, torus, particleTex, tuneRenderer, precompile } from './kit.js';
import { loadSpecies } from '../species/index.js';
import { buildItem, wallTexture, floorTexture, selectionRing } from './furniture.js';
import { ROOM_BOUNDS, DEFAULT_ROOM } from '../server/room.js';

// where the pet may wander
const BOUNDS = { x: 1.15, zMin: -1.45, zMax: 0.9 };
const clamp = THREE.MathUtils.clamp;

export async function createStage(canvas, { onTapPet, onTapPoop, onTapItem, onAnchor, onSelect, onItemMoved, onSound } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  tuneRenderer(renderer);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#FFE9EF');
  addEnvironment(renderer, scene, 0.3);
  const L = addLights(scene);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);

  // ---------- room ----------
  const room = new THREE.Group();
  scene.add(room);
  const floorTex = floorTexture('oak');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 14), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 5;
  floor.receiveShadow = true;
  room.add(floor);
  const wallTex = wallTexture('pink');
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }));
  wall.position.set(0, 4.5, -2);
  wall.receiveShadow = true;
  room.add(wall);
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(12, 0.16, 0.06), softMat('#FFF8F0'));
  skirting.position.set(0, 0.08, -1.97);
  room.add(skirting);

  // window with a live sky
  const sky = document.createElement('canvas');
  sky.width = 256;
  sky.height = 208;
  const skyTex = new THREE.CanvasTexture(sky);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.22), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false }));
  pane.position.set(0, 2.15, -1.985);
  room.add(pane);
  const frameM = softMat('#FFF8F0');
  for (const [w, h, x, y] of [[1.66, 0.09, 0, 0.65], [1.66, 0.09, 0, -0.65], [0.09, 1.38, -0.79, 0], [0.09, 1.38, 0.79, 0], [0.05, 1.22, 0, 0], [1.5, 0.05, 0, 0.05]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), frameM);
    b.position.set(x, 2.15 + y, -1.96);
    b.castShadow = true;
    room.add(b);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.07, 0.22), frameM);
  sill.position.set(0, 1.47, -1.9);
  room.add(sill);

  // ---------- furniture (built from the saved room layout) ----------
  const items = new Map(); // id -> { group, data }
  let layout = null;
  const ring = selectionRing();
  ring.visible = false;
  scene.add(ring);
  const ballState = { vel: new THREE.Vector3(), active: false };
  const itemsOf = (kind) => [...items.values()].filter((it) => it.data.kind === kind);
  const first = (kind) => itemsOf(kind)[0] ?? null;
  function applyLayout(next) {
    const prev = layout;
    layout = next;
    if (!prev || prev.wall !== next.wall) {
      wall.material.map?.dispose();
      wall.material.map = wallTexture(next.wall);
      wall.material.needsUpdate = true;
    }
    if (!prev || prev.floor !== next.floor) {
      floor.material.map?.dispose();
      floor.material.map = floorTexture(next.floor);
      floor.material.needsUpdate = true;
    }
    const rugChanged = prev && prev.rug !== next.rug;
    const ids = new Set(next.items.map((i) => i.id));
    for (const [id, it] of items) {
      if (!ids.has(id) || (rugChanged && it.data.kind === 'rug')) {
        room.remove(it.group);
        disposeTree(it.group);
        items.delete(id);
        if (selectedId === id) select(null);
      }
    }
    for (const d of next.items) {
      let it = items.get(d.id);
      if (!it) {
        const group = buildItem(d.kind, { rugStyle: next.rug });
        group.userData.id = d.id;
        group.position.set(d.x, 0, d.z);
        group.rotation.y = d.rot;
        room.add(group);
        it = { group, data: {} };
        items.set(d.id, it);
      } else if (it.data.x !== d.x || it.data.z !== d.z || it.data.rot !== d.rot) {
        it.group.position.set(d.x, 0, d.z);
        it.group.rotation.y = d.rot;
        if (d.kind === 'ball') ballState.active = false;
      }
      it.data = { ...d };
    }
  }

  // ---------- state ----------
  let model = null;
  let currentKey = '';
  let roomState = { asleep: false, night: false, weather: 'sun', poops: [] };
  const poopObjs = new Map();
  const M = {};
  const timers = [];
  const sparks = [];
  const clock = new THREE.Clock();
  const now = () => clock.getElapsedTime();
  const after = (sec, fn) => timers.push({ at: now() + sec, fn });
  let paused = false;
  let disposed = false;
  let camYaw = 0;
  let camYawTarget = 0;
  let lastDrag = 0;

  function resetMotion(keepPos = true) {
    Object.assign(M, {
      x: keepPos ? M.x ?? 0 : 0, z: keepPos ? M.z ?? 0.2 : 0.2, yaw: M.yaw ?? 0, tYaw: 0, y: 0, vy: 0, sq: 0, sv: 0,
      tiltX: 0, tiltZ: 0, tTiltX: 0, tTiltZ: 0, phase: 0, target: null, speed: 0.55, onArrive: null,
      behUntil: now() + 1.5, busyUntil: 0, closed: 0, shake: 0, headShake: 0, spinStart: null, spinDur: 0.8,
      sleeping: false, chomp: 0, flap: 0, wag: 0.3, tWag: 0.3, headPitch: 0, tHeadPitch: 0, headYaw: 0, tHeadYaw: 0,
      headTilt: 0, tHeadTilt: 0, lower: 0, tLower: 0, chase: false,
    });
    timers.length = 0;
  }
  resetMotion(false);

  // Movement sounds only for things the player caused: the pet's own idle wandering stays quiet.
  const MOVE_SOUNDS = new Set(['jump', 'pat', 'step']);
  const sound = (name, delay) => {
    if (MOVE_SOUNDS.has(name) && now() < (M.idleUntil ?? 0)) return;
    onSound?.(name, delay);
  };
  // `sfx` plays on push-off (null: silent, e.g. the small hops of a mochi's walk)
  const hop = (p = 2, sfx = 'jump') => {
    if (M.y <= 0.001) {
      M.vy = p;
      M.sv += 1.4;
      if (sfx) sound(sfx);
    }
  };
  const kick = (a) => (M.sv += a * 8);
  const spin = (d = 0.8) => {
    M.spinStart = now();
    M.spinDur = d;
  };
  const busy = (sec) => {
    M.idleUntil = 0;
    M.busyUntil = now() + sec;
    M.behUntil = M.busyUntil;
  };
  function walkTo(x, z, speed = 0.55, onArrive = null) {
    x = clamp(x, -ROOM_BOUNDS.x, ROOM_BOUNDS.x);
    z = clamp(z, ROOM_BOUNDS.zMin, BOUNDS.zMax);
    M.bestD = Infinity;
    M.bestT = now();
    if (reduced) {
      M.x = x;
      M.z = z;
      onArrive?.();
      return;
    }
    M.target = new THREE.Vector2(x, z);
    M.speed = speed;
    M.onArrive = onArrive;
  }
  const camAngle = () => Math.atan2(camera.position.x - M.x, camera.position.z - M.z);
  const faceYou = () => (M.tYaw = camAngle());
  const facePoint = (x, z) => (M.tYaw = Math.atan2(x - M.x, z - M.z));
  const angleLerp = (a, b, k) => {
    const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return a + d * k;
  };

  // ---------- particles ----------
  function emit(kind, pos, { v = [0, 0.8, 0], spread = 0.3, life = 1.4, size = 0.16, g = -0.4, n = 1, wob = true } = {}) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: particleTex(kind), transparent: true, depthWrite: false }));
      s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + Math.random() * spread * 0.5, pos.z + (Math.random() - 0.5) * spread * 0.5);
      scene.add(s);
      sparks.push({ s, v: new THREE.Vector3(v[0] + (Math.random() - 0.5) * 0.4, v[1] * (0.7 + Math.random() * 0.5), v[2]), g, life: life * (0.8 + Math.random() * 0.4), age: 0, sz: size, wob });
    }
  }
  const headPos = (up = 0) => new THREE.Vector3(M.x, (model?.parts.topY ?? 1) + up, M.z);

  // ---------- collision: the pet walks around furniture, never through it ----------
  let petR = 0.3;
  function obstacles() {
    const out = [];
    for (const it of items.values()) {
      const r0 = it.group.userData.radius;
      if (r0 > 0 && it.data.kind !== 'ball') out.push({ id: it.data.id, kind: it.data.kind, x: it.group.position.x, z: it.group.position.z, r: r0 });
    }
    return out;
  }
  const blocked = (x, z, pad = 0) => obstacles().some((o) => Math.hypot(x - o.x, z - o.z) < o.r + petR + pad);
  function freeSpot() {
    for (let i = 0; i < 24; i++) {
      const x = (Math.random() * 2 - 1) * BOUNDS.x;
      const z = BOUNDS.zMin + 0.3 + Math.random() * (BOUNDS.zMax - BOUNDS.zMin - 0.3);
      if (!blocked(x, z, 0.06)) return [x, z];
    }
    return [0, 0.3];
  }
  /** A spot right next to an item, on the side the pet is coming from. */
  function besideOf(it, gap = 0.04) {
    const p = it.group.position;
    let dx = M.x - p.x;
    let dz = M.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    const rr = it.group.userData.radius + petR + gap;
    return [clamp(p.x + dx * rr, -BOUNDS.x - 0.1, BOUNDS.x + 0.1), clamp(p.z + dz * rr, BOUNDS.zMin - 0.2, BOUNDS.zMax)];
  }
  function resolvePet() {
    for (const o of obstacles()) {
      if (o.id === M.enterId) continue;
      const dx = M.x - o.x;
      const dz = M.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + petR;
      if (d < min) {
        const nx = d < 1e-4 ? 0 : dx / d;
        const nz = d < 1e-4 ? 1 : dz / d;
        M.x = o.x + nx * min;
        M.z = o.z + nz * min;
      }
    }
    M.x = clamp(M.x, -BOUNDS.x - 0.15, BOUNDS.x + 0.15);
    M.z = clamp(M.z, BOUNDS.zMin - 0.25, BOUNDS.zMax);
  }

  // ---------- model ----------
  let buildToken = 0;
  async function setPet(look, { bounce = true } = {}) {
    const { buildPet, lookKey } = await loadSpecies(look.genome.species);
    const key = lookKey(look);
    if (key === currentKey) return;
    currentKey = key;
    const mine = ++buildToken;
    const next = await buildPet(look);
    if (mine !== buildToken || disposed) return disposeTree(next.root); // superseded
    await precompile(renderer, next.root, camera, scene);
    if (mine !== buildToken || disposed) return disposeTree(next.root);
    const wasEgg = model?.stage === 'egg';
    const grew = model && model.stage !== look.stage;
    if (model) {
      scene.remove(model.root);
      disposeTree(model.root);
    }
    model = next;
    scene.add(model.root);
    if (editing) ghostPet(true);
    const box = new THREE.Box3().setFromObject(model.body);
    petR = clamp((box.max.x - box.min.x) * 0.36, 0.16, 0.45);
    if (look.stage === 'egg') {
      M.x = 0;
      M.z = 0.15;
    }
    if (grew && bounce) {
      emit('puff', headPos(-0.4), { n: 10, spread: 0.9, size: 0.45, v: [0, 0.6, 0], life: 1 });
      emit('star', headPos(), { n: 6, spread: 0.8, v: [0, 1.4, 0] });
      kick(0.6);
      if (wasEgg) hop(2.4);
    }
    if (roomState.asleep && look.stage !== 'egg') goToBed(true);
  }

  // ---------- poops ----------
  const poopMat = softMat('#9A6B4F');
  function syncPoops(list) {
    const ids = new Set(list.map((p) => p.id));
    for (const [id, obj] of poopObjs) {
      if (!ids.has(id)) {
        emit('puff', obj.position.clone().setY(0.2), { n: 6, spread: 0.4, size: 0.3, v: [0, 0.5, 0], life: 0.8 });
        emit('sparkle', obj.position.clone().setY(0.3), { n: 3, spread: 0.4, size: 0.12 });
        scene.remove(obj);
        disposeTree(obj);
        poopObjs.delete(id);
      }
    }
    for (const p of list) {
      if (poopObjs.has(p.id)) continue;
      const g = new THREE.Group();
      [[0.13, 0.07, 0], [0.095, 0.06, 0.1], [0.06, 0.05, 0.18]].forEach(([r, h, y]) => {
        const b = blob(poopMat, [r, h, r]);
        b.position.y = y + h;
        g.add(b);
      });
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 12), poopMat);
      tip.position.y = 0.3;
      g.add(tip);
      for (const s of [-1, 1]) {
        const e = blob(glossMat('#FFFFFF'), [0.025, 0.03, 0.015]);
        e.position.set(s * 0.04, 0.16, 0.09);
        const pu = blob(glossMat('#2A2238'), [0.012, 0.015, 0.01]);
        pu.position.set(s * 0.04, 0.155, 0.105);
        g.add(e, pu);
      }
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.15;
      g.add(hit);
      g.userData.poopId = p.id;
      g.position.set(-1.3 + (p.x / 100) * 2.6, 0, -0.25 + p.y * 1.05);
      g.rotation.y = (p.x % 7) * 0.4;
      g.scale.setScalar(0.01);
      g.userData.grow = 0;
      g.traverse((o) => o.isMesh && (o.castShadow = true));
      scene.add(g);
      poopObjs.set(p.id, g);
    }
  }

  // ---------- sky + lighting ----------
  function drawSky() {
    const g = sky.getContext('2d');
    const d = new Date();
    const hour = d.getHours() + d.getMinutes() / 60;
    const phase = hour >= 5 && hour < 7 ? 'dawn' : hour >= 7 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
    const grey = roomState.weather !== 'sun' && phase === 'day';
    const grads = { day: grey ? ['#9FB6C8', '#D6E2EA'] : ['#7EC8FF', '#CDEEFF'], dawn: ['#FFB6C8', '#FFE2B0'], dusk: ['#7E6BD6', '#FF9E7A'], night: ['#141844', '#2C2E6E'] };
    const gr = g.createLinearGradient(0, 0, 0, 208);
    gr.addColorStop(0, grads[phase][0]);
    gr.addColorStop(1, grads[phase][1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 208);
    const p = phase === 'night' ? ((hour + 4) % 24) / 9 : (hour - 5) / 15;
    const c = Math.min(1, Math.max(0, p));
    const sx = 26 + c * 204;
    const sy = 150 - Math.sin(c * Math.PI) * 110;
    if (phase === 'night') {
      g.fillStyle = '#fff';
      for (let i = 0; i < 18; i++) g.fillRect((i * 67) % 256, (i * 41) % 140, 2, 2);
      g.fillStyle = '#FFF6CF';
      g.beginPath();
      g.arc(sx, sy, 18, 0, 7);
      g.fill();
      g.fillStyle = '#2C2E6E';
      g.beginPath();
      g.arc(sx + 8, sy - 5, 15, 0, 7);
      g.fill();
    } else {
      g.fillStyle = phase === 'day' ? 'rgba(255,211,77,.35)' : 'rgba(255,154,77,.35)';
      g.beginPath();
      g.arc(sx, sy, 30, 0, 7);
      g.fill();
      g.fillStyle = phase === 'day' ? '#FFD34D' : '#FF9A4D';
      g.beginPath();
      g.arc(sx, sy, 20, 0, 7);
      g.fill();
    }
    if (roomState.weather !== 'sun') {
      g.fillStyle = phase === 'night' ? 'rgba(160,160,200,.55)' : 'rgba(255,255,255,.92)';
      const off = (performance.now() / 120) % 300;
      for (const [x, y, w] of [[20, 40, 110], [140, 70, 90]]) {
        const xx = ((x + off) % 380) - 60;
        g.beginPath();
        g.ellipse(xx, y, w / 2, 16, 0, 0, 7);
        g.ellipse(xx + w * 0.2, y - 12, w / 3, 16, 0, 0, 7);
        g.fill();
      }
    }
    if (roomState.weather === 'rain') {
      g.strokeStyle = 'rgba(255,255,255,.75)';
      g.lineWidth = 2;
      const t = performance.now() / 6;
      for (let i = 0; i < 22; i++) {
        const x = (i * 53) % 256;
        const y = ((i * 37 + t) % 230) - 20;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 5, y + 14);
        g.stroke();
      }
    }
    g.fillStyle = phase === 'night' ? '#2F5A3A' : phase === 'dusk' ? '#6A9A5A' : '#8FD16A';
    g.beginPath();
    g.ellipse(70, 225, 150, 60, 0, 0, 7);
    g.ellipse(220, 235, 130, 60, 0, 0, 7);
    g.fill();
    skyTex.needsUpdate = true;
    return phase;
  }
  let skyPhase = drawSky();
  let lastSky = 0;

  function applyLighting(dt) {
    const off = roomState.asleep;
    const night = skyPhase === 'night' || skyPhase === 'dusk';
    const targets = {
      hemi: off ? 0.35 : night ? 0.95 : 1.5,
      key: off ? 0.25 : night ? 1.1 : 2.4,
      rim: off ? 0.5 : 1.1,
      lamp: off ? 0 : night ? 2.2 : 0.35,
      env: off ? 0.08 : night ? 0.22 : 0.3,
    };
    const k = Math.min(1, dt * 2.5);
    L.hemi.intensity += (targets.hemi - L.hemi.intensity) * k;
    L.key.intensity += (targets.key - L.key.intensity) * k;
    L.rim.intensity += (targets.rim - L.rim.intensity) * k;
    for (const it of itemsOf('lamp')) {
      const P = it.group.userData.parts;
      const want = it.data.on === false ? 0 : targets.lamp;
      P.light.intensity += (want - P.light.intensity) * k;
      P.shade.emissiveIntensity = Math.min(1, P.light.intensity / 1.5);
    }
    scene.environmentIntensity += (targets.env - scene.environmentIntensity) * k;
    L.rim.color.set(off ? '#7F8CFF' : '#FFE0EE');
    scene.background.lerp(new THREE.Color(off ? '#3A3360' : night ? '#E9D3E4' : '#FFE9EF'), k);
  }

  // ---------- behaviours ----------
  let look = null;
  const BEH = {
    bold: { walk: 3, hop: 2, look: 1, wag: 2, sit: 1, sniff: 1 },
    shy: { sit: 3, look: 2, hide: 2, walk: 1, wag: 1 },
    stubborn: { sit: 2, sniff: 2, walk: 2, flop: 1, look: 1 },
    cheerful: { hop: 3, wag: 3, walk: 2, spin: 1, look: 1 },
  };
  let temperament = 'cheerful';
  let mood = { energy: 80, happiness: 80 };
  function pickBehavior() {
    if (mood.energy < 20) return Math.random() < 0.5 ? 'yawn' : 'flop';
    if (mood.happiness < 30 && Math.random() < 0.5) return 'droop';
    const w = BEH[temperament] ?? BEH.cheerful;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [k, v] of Object.entries(w)) if ((r -= v) <= 0) return k;
    return 'sit';
  }
  function startBehavior(b) {
    let dur = 1.6 + Math.random() * 2.2;
    M.idleUntil = Infinity; // set to the real end below
    if (b !== 'walk' && b !== 'hide' && b !== 'look' && b !== 'sniff') faceYou();
    switch (b) {
      case 'walk': {
        const s = model.stage === 'baby' ? 0.32 : temperament === 'bold' ? 0.7 : temperament === 'shy' ? 0.42 : 0.55;
        const [wx, wz] = freeSpot();
        walkTo(wx, wz, s, faceYou);
        dur = 3.4;
        break;
      }
      case 'hop':
        hop(2 + Math.random());
        after(0.5, () => hop(1.6));
        M.tWag = 1;
        after(1.4, () => (M.tWag = 0.3));
        break;
      case 'wag':
        M.tWag = 1;
        M.tHeadTilt = (Math.random() < 0.5 ? -1 : 1) * 0.3;
        after(1.6, () => {
          M.tWag = 0.3;
          M.tHeadTilt = 0;
        });
        break;
      case 'look':
        M.tHeadYaw = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.4);
        M.tHeadTilt = (Math.random() - 0.5) * 0.4;
        after(1.4, () => {
          M.tHeadYaw = 0;
          M.tHeadTilt = 0;
        });
        break;
      case 'hide':
        M.tYaw = camAngle() + Math.PI * 0.85;
        after(1.6, faceYou);
        dur = 2.6;
        break;
      case 'sniff': {
        const a = Math.random() * Math.PI * 2;
        walkTo(M.x + Math.cos(a) * 0.4, M.z + Math.sin(a) * 0.3, 0.3, () => {
          M.tHeadPitch = 0.45;
          after(0.4, () => (M.tHeadPitch = 0.2));
          after(0.8, () => (M.tHeadPitch = 0.45));
          after(1.4, () => {
            M.tHeadPitch = 0;
            faceYou();
          });
        });
        dur = 3.4;
        break;
      }
      case 'flop':
        M.tLower = 1;
        M.closed = 1.2;
        after(2, () => (M.tLower = 0));
        dur = 3;
        break;
      case 'spin':
        spin(0.9);
        hop(1.8);
        break;
      case 'yawn':
        M.closed = 1.2;
        M.chomp = 1.6;
        M.tHeadPitch = -0.25;
        after(1.2, () => (M.tHeadPitch = 0));
        break;
      case 'droop':
        M.tHeadPitch = 0.35;
        M.tWag = 0;
        after(2, () => {
          M.tHeadPitch = 0;
          M.tWag = 0.3;
        });
        emit('drop', headPos(0.05), { v: [0, 0.2, 0], g: -1.2, size: 0.1 });
        break;
      default:
        break;
    }
    M.behUntil = now() + dur;
    M.idleUntil = M.behUntil + 1; // a little extra: the last hop of a walk can land late
  }

  // ---------- care scenes ----------
  function goToBed(instant = false) {
    if (!model || model.stage === 'egg') return;
    const bed = first('bed');
    const BED = bed ? bed.group.position : new THREE.Vector3(0, 0, -1);
    M.enterId = bed?.data.id ?? null; // allowed inside the bed
    const done = () => {
      M.sleeping = true;
      M.tLower = 1;
      M.tYaw = 0.5;
      M.tHeadPitch = 0.3;
    };
    if (instant || reduced) {
      M.x = BED.x;
      M.z = BED.z;
      M.target = null;
      done();
    } else walkTo(BED.x, BED.z, 0.45, done);
    busy(1e6);
    M.idleUntil = Infinity; // a sleepy shuffle to bed, no footstep sounds (it often goes by itself)
  }
  function wakeUp() {
    M.sleeping = false;
    M.tLower = 0;
    M.tHeadPitch = -0.2;
    after(0.6, () => (M.tHeadPitch = 0));
    hop(2);
    const bed = first('bed');
    after(0.4, () => {
      const [x, z] = bed ? besideOf(bed, 0.12) : freeSpot();
      walkTo(x, z, 0.5, () => {
        M.enterId = null;
        faceYou();
      });
    });
    busy(2.5);
  }

  function play(fx) {
    if (!model) return;
    M.idleUntil = 0;
    switch (fx) {
      case 'wobble':
        M.shake = 1;
        kick(-0.3);
        emit('puff', new THREE.Vector3(0, 0.3, 0.3), { n: 3, size: 0.25, life: 0.6 });
        break;
      case 'hatch':
        emit('sparkle', headPos(), { n: 8, spread: 1, v: [0, 1.2, 0] });
        break;
      case 'squish':
        kick(-0.5);
        M.lvx = (M.lvx ?? 0) + (Math.random() - 0.5) * 5; // tickle wobble
        M.lvz = (M.lvz ?? 0) + (Math.random() - 0.5) * 3;
        M.tWag = 1;
        after(1.2, () => (M.tWag = 0.3));
        emit('heart', headPos(), { n: 2, v: [0, 1, 0] });
        sound('squish');
        if (!M.sleeping) {
          hop(1.4);
          sound('giggle', 0.15);
        }
        break;
      case 'eat': {
        busy(5);
        const bowlIt = first('bowl');
        if (!bowlIt) break;
        const kibble = bowlIt.group.userData.parts.kibble;
        const BOWL = bowlIt.group.position;
        for (let i = 0; i < 7; i++) {
          const k = blob(softMat(i % 2 ? '#C0784A' : '#D99360'), [0.04, 0.03, 0.04]);
          k.position.set((Math.random() - 0.5) * 0.2, 0.5 + i * 0.12, (Math.random() - 0.5) * 0.2);
          k.userData.vy = 0;
          k.castShadow = true;
          kibble.add(k);
        }
        const [ex, ez] = besideOf(bowlIt, 0.02);
        walkTo(ex, ez, 0.75, () => {
          facePoint(BOWL.x, BOWL.z);
          let bites = 0;
          const bite = () => {
            M.tHeadPitch = 0.5;
            M.chomp = 1;
            if (!model.parts.head) kick(-0.35); // no neck: the whole mochi chomps
            after(0.25, () => (M.tHeadPitch = 0.15));
            for (let n = 0; n < 2 && kibble.children.length; n++) {
              const k = kibble.children[kibble.children.length - 1];
              kibble.remove(k);
              k.material.dispose();
            }
            emit('puff', BOWL.clone().setY(0.2), { n: 1, size: 0.12, life: 0.4, v: [0, 0.4, 0] });
            sound('chomp');
            if (++bites < 3) after(0.55, bite);
            else
              after(0.5, () => {
                kibble.clear();
                M.tHeadPitch = 0;
                sound('gulp');
                faceYou();
                hop(1.8);
                M.tWag = 1;
                emit('heart', headPos(), { n: 3, v: [0, 1, 0] });
                sound('giggle', 0.25);
                after(1.2, () => (M.tWag = 0.3));
              });
          };
          after(0.3, bite);
        });
        break;
      }
      case 'jump': {
        busy(5);
        const bi = first('ball');
        if (!bi) {
          // no ball in the room: a happy dance instead
          spin(0.8);
          hop(2.4);
          after(0.6, () => hop(2));
          emit('note', headPos(), { n: 3, v: [0, 1, 0] });
          break;
        }
        ballState.active = true;
        const tx = (Math.random() * 2 - 1) * BOUNDS.x * 0.8;
        ballState.vel.set((tx - bi.group.position.x) * 0.9, 3, 1.4);
        sound('boing');
        M.chase = true;
        M.tWag = 1;
        after(3.2, () => {
          M.chase = false;
          M.target = null;
          faceYou();
          spin(0.8);
          hop(2.4);
          sound('giggle');
          emit('note', headPos(), { n: 3, v: [0, 1, 0] });
          emit('star', headPos(), { n: 2, v: [0, 1.2, 0] });
          after(1, () => (M.tWag = 0.3));
        });
        break;
      }
      case 'train': {
        busy(3);
        faceYou();
        let n = 0;
        const rep = () => {
          kick(-0.6);
          sound('hup');
          after(0.15, () => hop(2.6));
          emit('drop', headPos(0.1), { v: [0.6, 0.6, 0], g: -2, size: 0.1, life: 0.8 });
          if (++n < 3) after(0.75, rep);
          else after(0.7, () => (emit('star', headPos(), { n: 3, v: [0, 1.2, 0] }), sound('sparkle')));
        };
        rep();
        break;
      }
      case 'bath': {
        busy(3.6);
        faceYou();
        for (let i = 0; i < 6; i++)
          after(i * 0.2, () => {
            sound('bubble');
            emit('bubble', new THREE.Vector3(M.x, 0.4, M.z), { n: 2, spread: 0.8, size: 0.18, v: [0, 0.7, 0], g: 0.1, life: 1.6 });
          });
        after(1.6, () => {
          M.shake = 1.4; // the dog shake!
          sound('splash');
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            emit('drop', new THREE.Vector3(M.x, 0.6, M.z), { v: [Math.cos(a) * 1.2, 1, Math.sin(a) * 0.6], g: -3, size: 0.09, life: 0.8, spread: 0.1, wob: false });
          }
        });
        after(2.8, () => (emit('sparkle', headPos(), { n: 4, spread: 0.8 }), sound('sparkle')));
        break;
      }
      case 'refuse':
        M.headShake = 1;
        sound('refuse');
        emit('drop', headPos(0.05), { v: [0.3, 0.3, 0], g: -1.5, size: 0.1 });
        break;
      // sleep / wake follow the server state through setRoom()
      case 'clean':
        M.tWag = 0.8;
        sound('sparkle');
        after(1, () => (M.tWag = 0.3));
        break;
      default:
        break;
    }
  }

  // ---------- interactions with furniture ----------
  function interact(it, point) {
    if (!model || model.stage === 'egg' || M.sleeping || editing) return;
    M.idleUntil = 0;
    const kind = it ? it.data.kind : point ? 'floor' : 'window';
    const free = now() >= M.busyUntil;
    switch (kind) {
      case 'plant': {
        it.group.userData.rustle = 1;
        sound('rustle');
        for (let i = 0; i < 4; i++) emit('leaf', it.group.position.clone().setY(0.6), { v: [(Math.random() - 0.5) * 0.6, 0.3, 0.2], g: -0.6, size: 0.12, life: 1.6 });
        if (free) {
          busy(3);
          const [x, z] = besideOf(it, 0.03);
          walkTo(x, z, 0.6, () => {
            facePoint(it.group.position.x, it.group.position.z);
            M.tHeadPitch = 0.35;
            kick(-0.25);
            after(0.5, () => (M.tHeadPitch = 0));
            after(1.2, faceYou);
          });
        }
        break;
      }
      case 'toybox': {
        it.group.userData.open = 1.6;
        sound('pop');
        sound('sparkle', 0.1);
        emit('star', it.group.position.clone().setY(0.5), { n: 4, spread: 0.4, v: [0, 1.4, 0] });
        emit('note', it.group.position.clone().setY(0.5), { n: 2, v: [0, 1, 0] });
        if (free) {
          busy(3);
          const [x, z] = besideOf(it, 0.03);
          walkTo(x, z, 0.85, () => {
            facePoint(it.group.position.x, it.group.position.z);
            M.tWag = 1;
            hop(2.2);
            after(1.3, () => (M.tWag = 0.3));
            after(1.4, faceYou);
          });
        }
        break;
      }
      case 'cushion': {
        if (!free) break;
        busy(6);
        M.enterId = it.data.id;
        walkTo(it.group.position.x, it.group.position.z, 0.6, () => {
          M.seatY = it.group.userData.parts.seatY ?? 0.15;
          faceYou();
          sound('squish');
          kick(-0.4);
          emit('heart', headPos(), { n: 2, v: [0, 1, 0] });
          after(3.5, () => {
            M.seatY = 0;
            hop(1.6);
            const [x, z] = besideOf(it, 0.1);
            walkTo(x, z, 0.5, () => {
              M.enterId = null;
              faceYou();
            });
          });
        });
        break;
      }
      case 'window':
        if (!free) break;
        busy(4);
        walkTo(0, ROOM_BOUNDS.zMin + 0.25, 0.6, () => {
          facePoint(0, -3);
          M.tHeadPitch = -0.3;
          hop(1.3);
          after(2.2, () => {
            M.tHeadPitch = 0;
            faceYou();
          });
        });
        break;
      case 'floor':
        if (!free) break;
        busy(2.5);
        walkTo(point.x, point.z, 0.65, faceYou);
        break;
      case 'lamp':
        sound('click');
        emit('sparkle', it.group.position.clone().setY(1.2), { n: 3, spread: 0.3, size: 0.12 });
        break;
      default:
        break;
    }
  }

  /** While decorating, the pet turns see-through so it never hides the furniture. */
  function ghostPet(on) {
    model?.root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (on) {
          m.userData.ghost ??= { t: m.transparent, o: m.opacity, d: m.depthWrite };
          m.transparent = true;
          m.opacity = 0.28;
          m.depthWrite = false;
        } else if (m.userData.ghost) {
          m.transparent = m.userData.ghost.t;
          m.opacity = m.userData.ghost.o;
          m.depthWrite = m.userData.ghost.d;
          delete m.userData.ghost;
        }
        m.needsUpdate = true;
      }
    });
  }

  // ---------- input (normal play and decorating) ----------
  const ray = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let down = null;
  let editing = false;
  let editT = 0;
  let selectedId = null;
  let drag = null;
  function select(id) {
    selectedId = id;
    ring.visible = !!id;
    onSelect?.(id);
  }
  function aim(e) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  }
  function itemAt() {
    const all = [...items.values()];
    const hitList = (list) => ray.intersectObjects(list.map((it) => it.group.userData.hit), false);
    const h = hitList(all.filter((it) => it.data.kind !== 'rug'))[0] ?? hitList(all.filter((it) => it.data.kind === 'rug'))[0];
    return h ? all.find((it) => it.group.userData.hit === h.object) : null;
  }
  const floorPoint = () => {
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(floorPlane, p) ? p : null;
  };
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: camYawTarget };
    if (!editing) return;
    aim(e);
    const it = itemAt();
    if (!it) return;
    select(it.data.id);
    const p = floorPoint() ?? it.group.position.clone();
    drag = { it, ox: it.group.position.x - p.x, oz: it.group.position.z - p.z, moved: false };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    if (editing) {
      if (!drag) return;
      aim(e);
      const p = floorPoint();
      if (!p) return;
      drag.it.group.position.x = clamp(p.x + drag.ox, -ROOM_BOUNDS.x, ROOM_BOUNDS.x);
      drag.it.group.position.z = clamp(p.z + drag.oz, ROOM_BOUNDS.zMin, ROOM_BOUNDS.zMax);
      drag.moved = true;
      return;
    }
    if (reduced) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 8) {
      camYawTarget = clamp(down.yaw - dx * 0.006, -0.6, 0.6);
      lastDrag = performance.now();
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (editing) {
      if (drag) {
        const { it } = drag;
        if (drag.moved) onItemMoved?.(it.data.id, +it.group.position.x.toFixed(3), +it.group.position.z.toFixed(3));
        drag = null;
      } else if (moved < 8) select(null);
      return;
    }
    if (moved > 8 || !quick) return;
    aim(e);
    const poopHits = ray.intersectObjects([...poopObjs.values()], true);
    if (poopHits.length) {
      let o = poopHits[0].object;
      while (o && !o.userData.poopId) o = o.parent;
      if (o) return onTapPoop?.(o.userData.poopId);
    }
    if (model && ray.intersectObject(model.root, true).length) return onTapPet?.();
    const it = itemAt();
    if (it && it.data.kind !== 'rug') {
      interact(it);
      return onTapItem?.(it.data.kind, it.data.id);
    }
    if (ray.intersectObject(pane).length) {
      interact(null);
      return onTapItem?.('window');
    }
    const p = floorPoint();
    if (p && p.z < 3) {
      interact(null, p);
      onTapItem?.('floor');
    }
  });

  // ---------- loop ----------
  let lastT = 0;
  let lastAnchor = { x: -1, y: -1 };
  const v3 = new THREE.Vector3();
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  function placeCamera() {
    // keep the play area (±1.6 wide) in view on narrow phones
    // keep the play area in view on narrow phones, but stay close so the pet is the star
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(4.4, 1.32 / (halfV * Math.min(1, camera.aspect)));
    const play = new THREE.Vector3(Math.sin(camYaw) * dist, 0.95 + dist * 0.2, Math.cos(camYaw) * dist);
    const playLook = new THREE.Vector3(0, 0.62 + (dist - 4.4) * 0.12, 0);
    if (editT < 0.001) {
      if (camera.view?.enabled) camera.clearViewOffset();
      camera.position.copy(play);
      camera.lookAt(playLook);
      return;
    }
    // decorating: look down on the whole floor
    const ed = Math.max(5.5, 1.75 / (halfV * Math.min(1, camera.aspect)));
    const edit = new THREE.Vector3(0, ed * 0.82, ed * 0.5 - 0.3);
    const editLook = new THREE.Vector3(0, 0, -0.35);
    const k = editT * editT * (3 - 2 * editT);
    camera.position.lerpVectors(play, edit, k);
    camera.lookAt(playLook.lerp(editLook, k));
    // shift the picture up so the whole floor sits above the decorating panel
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.setViewOffset(w, h, 0, h * 0.2 * k, w, h);
  }

  // adaptive quality: if frames are slow, render fewer pixels
  let slow = 0;
  let ratio = renderer.getPixelRatio();
  function frame() {
    raf = requestAnimationFrame(frame);
    if (paused) return;
    resize();
    const t = now();
    const dt = Math.min(0.05, t - lastT);
    if (t - lastT > 0.034 && t > 2) slow++;
    else slow = Math.max(0, slow - 0.5);
    if (slow > 45 && ratio > 1) {
      ratio = Math.max(1, ratio - 0.5);
      renderer.setPixelRatio(ratio);
      slow = 0;
    }
    lastT = t;
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].at <= t) {
        const f = timers[i].fn;
        timers.splice(i, 1);
        f();
      }
    }
    if (performance.now() - lastDrag > 3500 || editing) camYawTarget *= 0.97;
    camYaw += (camYawTarget - camYaw) * Math.min(1, dt * 6);
    editT = clamp(editT + (editing ? dt : -dt) * 2.2, 0, 1);
    placeCamera();
    const sel = selectedId && items.get(selectedId);
    if (sel) {
      const rr = sel.data.kind === 'rug' ? 1.04 : Math.max(sel.group.userData.radius, 0.2) * 1.35;
      ring.position.set(sel.group.position.x, 0.012, sel.group.position.z);
      ring.scale.set(rr, rr * (sel.data.kind === 'rug' ? 0.72 : 1), rr);
      ring.material.opacity = 0.55 + Math.sin(t * 5) * 0.35;
    }
    if (performance.now() - lastSky > (roomState.weather === 'sun' ? 30000 : 120)) {
      skyPhase = drawSky();
      lastSky = performance.now();
    }
    applyLighting(dt);

    if (model) animatePet(t, dt);
    animateProps(dt);
    for (const g of poopObjs.values()) {
      if (g.userData.grow < 1) {
        g.userData.grow = Math.min(1, g.userData.grow + dt * 3);
        const k = g.userData.grow;
        g.scale.setScalar(k < 0.7 ? k * 1.5 : 1.05 - (k - 0.7) * 0.17);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const q = sparks[i];
      q.age += dt;
      if (q.age >= q.life) {
        scene.remove(q.s);
        q.s.material.dispose();
        sparks.splice(i, 1);
        continue;
      }
      q.v.y += q.g * dt;
      q.s.position.addScaledVector(q.v, dt);
      if (q.wob) q.s.position.x += Math.sin(q.age * 6) * 0.004;
      const k = q.age / q.life;
      q.s.material.opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      const sc = q.sz * (k < 0.15 ? 0.5 + k / 0.3 : 1);
      q.s.scale.set(sc, sc, sc);
    }
    renderer.render(scene, camera);

    if (model && onAnchor) {
      v3.set(M.x, model.parts.topY + M.y + 0.12, M.z).project(camera);
      const x = ((v3.x + 1) / 2) * canvas.clientWidth;
      const y = ((1 - v3.y) / 2) * canvas.clientHeight;
      if (Math.abs(x - lastAnchor.x) > 0.5 || Math.abs(y - lastAnchor.y) > 0.5) {
        lastAnchor = { x, y };
        onAnchor(lastAnchor);
      }
    }
  }

  // Jelly: the top of a mochi lags behind its bottom (a spring-driven shear), and
  // squash & stretch is stronger. Softer mochis (fine DNA "squish") wobble longer.
  const shear = new THREE.Matrix4();
  function jellyPose(t, dt, idle, yaw) {
    const P = model.parts;
    const b = model.body;
    const soft = P.squish ?? 1;
    const vx = (M.x - (M.px ?? M.x)) / Math.max(dt, 1e-4);
    const vz = (M.z - (M.pz ?? M.z)) / Math.max(dt, 1e-4);
    M.px = M.x;
    M.pz = M.z;
    // world velocity -> pet-local, then lean the top the other way
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const lvx = vx * c - vz * sn;
    const lvz = vx * sn + vz * c;
    const tx = THREE.MathUtils.clamp(-lvx * 0.1 * soft, -0.3, 0.3);
    const tz = THREE.MathUtils.clamp(-lvz * 0.1 * soft, -0.3, 0.3);
    const k = 70 / soft;
    const damp = 5.5 / Math.sqrt(soft);
    M.lx ??= 0;
    M.lz ??= 0;
    M.lvx ??= 0;
    M.lvz ??= 0;
    M.lvx += (-k * (M.lx - tx) - damp * M.lvx) * dt;
    M.lvz += (-k * (M.lz - tz) - damp * M.lvz) * dt;
    M.lx += M.lvx * dt;
    M.lz += M.lvz * dt;
    const wob = M.shake > 0 ? Math.sin(t * 26) * 0.22 * M.shake : 0; // bath wiggle
    const melt = M.lower; // sleeping / flopping: melt into a puddle
    const sq = (M.sq + (M.sleeping ? Math.sin(t * 1.6) * 0.025 : idle)) * soft;
    b.matrixAutoUpdate = false;
    b.position.set(0, M.y, 0);
    b.rotation.set(0, 0, 0);
    b.scale.set((1 - sq * 0.7) * (1 + melt * 0.16), (1 + sq) * (1 - melt * 0.24), (1 - sq * 0.7) * (1 + melt * 0.12));
    b.updateMatrix();
    shear.set(1, M.lx + wob, 0, 0, 0, 1, 0, 0, 0, M.lz, 1, 0, 0, 0, 0, 1);
    b.matrix.multiply(shear);
  }

  let zTimer = 0;
  let zCount = 0;
  function animatePet(t, dt) {
    const P = model.parts;
    const b = model.body;
    const root = model.root;
    // physics: gravity hops and a spring for squash & stretch
    if (M.y > 0 || M.vy > 0) {
      M.vy -= 9.8 * dt;
      M.y += M.vy * dt;
      if (M.y <= 0) {
        M.y = 0;
        if (M.vy < -1) {
          kick(-Math.min(0.5, -M.vy * 0.12));
          sound('pat');
        }
        M.vy = 0;
      }
    }
    M.sv += (-70 * M.sq - 8 * M.sv) * dt;
    M.sq += M.sv * dt;
    M.shake = Math.max(0, M.shake - dt * 1.2);
    M.headShake = Math.max(0, M.headShake - dt * 1.1);

    if (P.egg) {
      root.position.set(M.x, 0, M.z);
      const amp = reduced ? 0 : 0.04;
      b.rotation.z = Math.sin(t * 2.6) * amp * (Math.sin(t * 0.9) > 0.3 ? 1 : 0.35) + Math.sin(t * 30) * 0.15 * M.shake;
      b.position.y = M.y;
      b.scale.set(1 - M.sq * 0.5, 1 + M.sq, 1 - M.sq * 0.5);
      P.sparkles.forEach((s, i) => {
        const a = s.userData.a + t * 0.8;
        s.position.set(Math.cos(a) * 0.75, 0.5 + Math.sin(t * 2 + i) * 0.25, Math.sin(a) * 0.75);
      });
      if (!reduced && t > M.behUntil) {
        M.behUntil = t + 3 + Math.random() * 3;
        hop(0.9, null);
        M.shake = 0.4;
      }
      return;
    }

    if (!reduced && !M.sleeping && t > M.behUntil && t > M.busyUntil) startBehavior(pickBehavior());

    // chase the ball while playing
    const bi = first('ball');
    if (M.chase && bi) {
      const bp = bi.group.position;
      const d = Math.hypot(bp.x - M.x, bp.z - M.z);
      if (d > 0.35) {
        M.target = new THREE.Vector2(bp.x, bp.z);
        M.speed = 1.1;
      }
    }
    let moving = false;
    const hopper = P.locomotion === 'hop';
    if (M.target) {
      const dx = M.target.x - M.x;
      const dz = M.target.y - M.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.04) {
        M.tYaw = Math.atan2(dx, dz);
        if (Math.abs(angleLerp(M.yaw, M.tYaw, 1) - M.yaw) < 0.9) {
          if (hopper && M.y <= 0.001 && !reduced) {
            // a mochi gets around by hopping: push off, travel while airborne, squish on landing
            if (t > (M.nextHop ?? 0)) {
              hop((1.35 + M.speed * 0.6) * (P.bounce ?? 1), null);
              M.nextHop = t + 0.06 + 0.1 * (P.squish ?? 1);
            }
          } else {
            const step = Math.min(d, M.speed * (hopper ? 1.25 : 1) * dt);
            M.x += (dx / d) * step;
            M.z += (dz / d) * step;
            moving = true;
          }
        }
      } else {
        M.target = null;
        const cb = M.onArrive;
        M.onArrive = null;
        cb?.();
      }
    }
    resolvePet();
    // blocked by furniture for a while? Give up and count it as arrived.
    if (M.target) {
      const d = Math.hypot(M.target.x - M.x, M.target.y - M.z);
      if (d < M.bestD - 0.02) {
        M.bestD = d;
        M.bestT = t;
      } else if (t - M.bestT > 1.6 && !M.chase) {
        M.target = null;
        const cb = M.onArrive;
        M.onArrive = null;
        cb?.();
      }
    }
    M.yaw = angleLerp(M.yaw, M.tYaw, Math.min(1, dt * 6));
    if (moving) {
      M.phase += dt * (6 + M.speed * 12);
      const step = Math.floor(M.phase / Math.PI); // a footstep every half stride
      if (!hopper && step !== M.step) sound('step'); // hoppers get a pat on each landing instead
      M.step = step;
    }
    let spinA = 0;
    if (M.spinStart != null) {
      const k = (t - M.spinStart) / M.spinDur;
      if (k >= 1) M.spinStart = null;
      else spinA = (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) * Math.PI * 2;
    }
    const bedIt = first('bed');
    const inBed = M.sleeping && bedIt && Math.hypot(M.x - bedIt.group.position.x, M.z - bedIt.group.position.z) < 0.25;
    const sitY = inBed ? 0.13 : M.seatY ?? 0;
    M.bedY = (M.bedY ?? 0) + (sitY - (M.bedY ?? 0)) * Math.min(1, dt * 5);
    root.position.set(M.x, M.bedY, M.z);
    root.rotation.y = M.yaw + spinA;

    const lerp = (a, b2, k) => a + (b2 - a) * Math.min(1, dt * k);
    M.lower = lerp(M.lower, M.tLower, 4);
    M.wag = lerp(M.wag, M.tWag, 4);
    M.headPitch = lerp(M.headPitch, M.tHeadPitch, 7);
    M.headYaw = lerp(M.headYaw, M.tHeadYaw, 5);
    M.headTilt = lerp(M.headTilt, M.tHeadTilt, 5);

    const idle = reduced || M.sleeping ? 0 : Math.sin(t * 2.4) * 0.012;
    const dogShake = M.shake > 0 ? Math.sin(t * 38) * 0.35 * M.shake : 0;
    if (P.jelly) {
      jellyPose(t, dt, idle, root.rotation.y);
    } else {
      const waddle = moving ? Math.sin(M.phase) * 0.06 : 0;
      const curl = M.sleeping ? 1 : 0;
      b.matrixAutoUpdate = true;
      b.rotation.set(M.lower * 0.12, dogShake * 0.6, waddle + dogShake * 0.15 + curl * 0.5);
      b.position.y = M.y + (moving ? Math.abs(Math.sin(M.phase)) * 0.04 : 0) - M.lower * 0.12 - curl * 0.06;
      const sq = M.sq + (M.sleeping ? Math.sin(t * 1.6) * 0.02 : idle);
      b.scale.set(1 - sq * 0.6 + M.lower * 0.06, 1 + sq - M.lower * 0.12, 1 - sq * 0.6);
    }

    P.legs.forEach((leg, i) => {
      leg.rotation.x = moving ? Math.sin(M.phase + (i ? Math.PI : 0)) * 0.7 : M.lower * -1.1;
    });
    if (P.head) {
      P.head.rotation.set(M.headPitch, M.headYaw + Math.sin(t * 24) * 0.3 * M.headShake, M.headTilt + dogShake * 0.4);
    }
    // ears: little twitches
    P.ears.forEach((e, i) => {
      e.userData.base ??= e.rotation.x;
      const tw = !reduced && (t + i * 0.7) % 5.3 < 0.18 ? -0.25 : 0;
      e.rotation.x = e.userData.base + tw + (moving ? Math.sin(M.phase * 2) * 0.05 : 0);
    });
    if (P.tail) {
      const sp = 4 + M.wag * 12;
      P.tail.rotation.y = reduced ? 0 : Math.sin(t * sp) * (0.12 + M.wag * 0.45);
      P.tail.rotation.z = reduced ? 0 : Math.sin(t * sp * 0.5) * 0.05;
    }
    M.closed = Math.max(0, M.closed - dt);
    const closed = M.sleeping || M.closed > 0 || t % 4.2 > 4.07;
    P.blink.forEach((l) => (l.scale.y = closed ? 0.12 : l.userData.rest ?? 1));
    if (P.mouth) {
      M.chomp = Math.max(0, M.chomp - dt * 3);
      P.mouth.scale.set(1, 1 + Math.sin(Math.min(1, M.chomp) * Math.PI) * 1.6, 1);
    }
    const flap = M.y > 0.05 ? 18 : M.sleeping ? 1.5 : 6;
    P.wings.forEach((w) => (w.rotation.y = w.userData.sx * (0.55 + (reduced ? 0 : Math.sin(t * flap) * (M.y > 0.05 ? 0.6 : 0.25)))));
    P.flames.forEach((f, i) => f.scale.set(1 + Math.sin(t * 14 + i * 2) * 0.08, 1 + Math.sin(t * 11 + i) * 0.14, 1));
    P.sparkles.forEach((s, i) => {
      const a = s.userData.a + t * 0.7;
      s.position.set(Math.cos(a) * 0.7, 0.5 + Math.sin(t * 1.6 + i) * 0.35, Math.sin(a) * 0.7);
    });
    if (P.halo) P.halo.rotation.z = t * 0.8;
    if (P.aura) P.aura.material.opacity = 0.35 + Math.sin(t * 2) * 0.15;

    if (M.sleeping) {
      zTimer -= dt;
      if (zTimer <= 0) {
        zTimer = 1.6;
        if (zCount++ % 3 === 0) sound('snore');
        emit('z', headPos(0.05), { v: [0.15, 0.35, 0], g: 0, size: 0.16, life: 2.2 });
      }
    }
  }

  function animateProps(dt) {
    const t = now();
    // kibble falls into the bowl
    const kib = first('bowl')?.group.userData.parts.kibble;
    kib?.children.forEach((k) => {
      if (k.position.y > 0.08) {
        k.userData.vy -= 9.8 * dt;
        k.position.y = Math.max(0.08, k.position.y + k.userData.vy * dt);
      }
    });
    // plants rustle, toy boxes pop open
    for (const it of items.values()) {
      const u = it.group.userData;
      if (u.rustle > 0) {
        u.rustle = Math.max(0, u.rustle - dt * 0.9);
        u.parts.leaves.rotation.z = Math.sin(t * 28) * 0.18 * u.rustle;
        u.parts.leaves.rotation.x = Math.cos(t * 23) * 0.12 * u.rustle;
      }
      if (u.parts.lid) {
        u.open = Math.max(0, (u.open ?? 0) - dt);
        const want = u.open > 0 ? -1.1 : 0;
        u.parts.lid.rotation.x += (want - u.parts.lid.rotation.x) * Math.min(1, dt * 8);
      }
    }
    // the toy ball: bounces, rolls, and bumps off furniture
    const bi = first('ball');
    if (bi && ballState.active) {
      const g = bi.group;
      const mesh = g.userData.parts.ball;
      const v = ballState.vel;
      v.y -= 9.8 * dt;
      g.position.x += v.x * dt;
      g.position.z += v.z * dt;
      mesh.position.y += v.y * dt;
      if (mesh.position.y < 0.12) {
        mesh.position.y = 0.12;
        v.y = Math.abs(v.y) * 0.62;
        v.x *= 0.93;
        v.z *= 0.93;
      }
      if (Math.abs(g.position.x) > ROOM_BOUNDS.x + 0.15) {
        g.position.x = Math.sign(g.position.x) * (ROOM_BOUNDS.x + 0.15);
        v.x *= -0.8;
      }
      if (g.position.z < ROOM_BOUNDS.zMin - 0.15 || g.position.z > ROOM_BOUNDS.zMax + 0.1) {
        g.position.z = clamp(g.position.z, ROOM_BOUNDS.zMin - 0.15, ROOM_BOUNDS.zMax + 0.1);
        v.z *= -0.8;
      }
      for (const o of obstacles()) {
        const dx = g.position.x - o.x;
        const dz = g.position.z - o.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        if (d < o.r + 0.12 && mesh.position.y < 0.5) {
          const nx = dx / d;
          const nz = dz / d;
          g.position.x = o.x + nx * (o.r + 0.12);
          g.position.z = o.z + nz * (o.r + 0.12);
          const dot = v.x * nx + v.z * nz;
          if (dot < 0) {
            v.x -= 1.7 * dot * nx;
            v.z -= 1.7 * dot * nz;
          }
        }
      }
      const dx = g.position.x - M.x;
      const dz = g.position.z - M.z;
      const d = Math.hypot(dx, dz) || 1;
      if (M.chase && d < petR + 0.12 && mesh.position.y < 0.4) v.set((dx / d) * 2, 2, (dz / d) * 2);
      mesh.rotation.x += v.z * dt * 5;
      mesh.rotation.z -= v.x * dt * 5;
      if (!M.chase && Math.hypot(v.x, v.z) < 0.15 && mesh.position.y <= 0.121) ballState.active = false;
    }
  }

  let raf = requestAnimationFrame(frame);
  const onVis = () => {
    paused = document.hidden;
    if (!paused) clock.getDelta();
  };
  document.addEventListener('visibilitychange', onVis);

  return {
    setPet(lk, opts) {
      look = lk;
      setPet(lk, opts);
    },
    setRoom(next) {
      const wasAsleep = roomState.asleep;
      roomState = { ...roomState, ...next };
      if (next.temperament) temperament = next.temperament;
      if (next.care) mood = next.care;
      if (next.poops) syncPoops(next.poops);
      if (next.weather) lastSky = 0;
      if (next.asleep !== undefined && next.asleep !== wasAsleep && model && model.stage !== 'egg') {
        if (next.asleep) goToBed(next.instant);
        else if (M.sleeping) wakeUp();
      }
    },
    play,
    setPaused(p) {
      paused = p;
    },
    /** Show a room layout (from the server, or the draft while decorating). */
    setLayout(next) {
      applyLayout(next ?? DEFAULT_ROOM);
    },
    /** Decorate mode: the pet waits, the camera looks down, furniture can be dragged. */
    setEditMode(on) {
      if (editing === on) return;
      editing = on;
      drag = null;
      select(null);
      if (on) {
        M.target = null;
        M.chase = false;
        busy(1e6);
        faceYou();
      } else busy(0.8);
      ghostPet(on);
    },
    select,
    /** Dev/test helpers: where an item is on screen, and where the pet is. */
    screenPosOf(id) {
      const it = items.get(id);
      if (!it) return null;
      const v = it.group.position.clone().setY(0.15).project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    debugPet() {
      return { x: M.x, z: M.z, r: petR, enterId: M.enterId ?? null, obstacles: obstacles() };
    },
    /** A free floor spot for a new item of this kind. */
    spotFor(kind) {
      const rr = { bed: 0.5, toybox: 0.34, cushion: 0.32, rug: 0, lamp: 0.2, plant: 0.24, bowl: 0.3, ball: 0.12 }[kind] ?? 0.3;
      for (let i = 0; i < 60; i++) {
        const x = (Math.random() * 2 - 1) * (ROOM_BOUNDS.x - 0.1);
        const z = ROOM_BOUNDS.zMin + 0.1 + Math.random() * (ROOM_BOUNDS.zMax - ROOM_BOUNDS.zMin - 0.2);
        const clear = [...items.values()].every((it) => it.data.kind === 'rug' || kind === 'rug' || Math.hypot(x - it.group.position.x, z - it.group.position.z) > it.group.userData.radius + rr + 0.05);
        if (clear) return [+x.toFixed(3), +z.toFixed(3)];
      }
      return [0, 0];
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      if (model) disposeTree(model.root);
      disposeTree(scene);
      renderer.dispose();
    },
  };
}


