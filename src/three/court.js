// The volleyball court: a little beach, a net, a ball and both pets.
// Like the room stage, it only SHOWS what the server decided: each server event
// (command, hit, miss, point, end) becomes a short animation, and `play()` tells
// the UI how long that takes so the next touch starts when the ball arrives.
// `play()` also gets the NEXT touch's events, so a ball that will be missed can be
// aimed just out of the receiver's reach (and one that will be returned, right at it).
import { THREE, addLights, addEnvironment, disposeTree, softMat, particleTex, tuneRenderer, precompile } from './kit.js';
import { loadSpecies } from '../species/index.js';

const LINE = { x: 2.4, z: 1.15 }; // court lines (half length, half width)
const READY = 1.35; // where each pet waits, from the net
const SCALE = 1.1;
const BALL_R = 0.17;
const DIR = { you: 1, foe: -1 }; // which way each side hits
const clamp = THREE.MathUtils.clamp;
const frac = (n) => n - Math.floor(n);
const angleLerp = (a, b, k) => {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * k;
};

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#7cc4f2');
  grad.addColorStop(0.6, '#bfe6ff');
  grad.addColorStop(1, '#fff3dc');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function netTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(40,40,60,0.85)';
  g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 128);
    g.moveTo(0, i);
    g.lineTo(128, i);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 1.5);
  return t;
}

function ballTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const cols = ['#ffffff', '#ffd23f', '#3f8efc', '#ffffff', '#ffd23f', '#3f8efc'];
  cols.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect((i * 256) / cols.length, 0, 256 / cols.length + 1, 128);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function createCourt(canvas, { onSound } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sound = (name, delay) => onSound?.(name, delay);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  tuneRenderer(renderer);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  addEnvironment(renderer, scene, 0.3);
  const { key } = addLights(scene, { strength: 1.05 });
  // the court is wider than the room: stretch the shadow camera to cover it
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  key.shadow.camera.updateProjectionMatrix();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  // a little to your side and above, so the net reads at an angle and the sand fills the phone
  camera.position.set(-1.6, 4.4, 6.2);
  const LOOK = new THREE.Vector3(-0.25, 0.95, 0);

  // ---------- the beach ----------
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: '#f1d9a4', roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(80, 14), new THREE.MeshStandardMaterial({ color: '#5fb8e8', roughness: 0.35 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, -16);
  scene.add(sea);
  const lineMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
  const line = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d), lineMat);
    m.position.set(x, 0.006, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  line(LINE.x * 2 + 0.06, 0.06, 0, LINE.z);
  line(LINE.x * 2 + 0.06, 0.06, 0, -LINE.z);
  line(0.06, LINE.z * 2, LINE.x, 0);
  line(0.06, LINE.z * 2, -LINE.x, 0);
  // the net
  const NET_W = (LINE.z + 0.2) * 2;
  const postMat = softMat('#e86a6a');
  for (const z of [-NET_W / 2, NET_W / 2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.12, 12), postMat);
    post.position.set(0, 0.56, z);
    post.castShadow = true;
    scene.add(post);
  }
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(NET_W, 0.4),
    new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false })
  );
  net.rotation.y = Math.PI / 2;
  net.position.set(0, 0.88, 0);
  scene.add(net);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, NET_W), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  band.position.set(0, 1.08, 0);
  scene.add(band);

  // ---------- the ball ----------
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.5 }));
  ball.castShadow = true;
  scene.add(ball);
  let flight = null; // { a, b, h, t0, dur, then, track }
  /**
   * Fly the ball to `to`. With `track` (a pet), the end point slides onto that pet's real head
   * as the ball arrives, so it always lands ON the head even if a jump or a run is a frame late.
   */
  function fly(to, dur, h, then, track = null) {
    flight = { a: ball.position.clone(), b: to.clone(), h, t0: now(), dur: Math.max(0.05, dur), then, track };
  }
  const SERVE_REST = new THREE.Vector3(0, 0.04, 0); // a hair above the surface, so breathing never sinks it in
  const endAt = new THREE.Vector3();

  // ---------- timing ----------
  const clock = new THREE.Clock();
  const now = () => clock.getElapsedTime();
  const timers = [];
  const after = (sec, fn) => timers.push({ at: now() + sec, fn });

  // ---------- particles ----------
  const sparks = [];
  function emit(kind, pos, { v = [0, 0.8, 0], spread = 0.25, life = 1.1, size = 0.14, g = -0.4, n = 1 } = {}) {
    if (reduced && kind !== 'puff') return;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: particleTex(kind), transparent: true, depthWrite: false }));
      s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + Math.random() * spread * 0.5, pos.z + (Math.random() - 0.5) * spread * 0.5);
      scene.add(s);
      sparks.push({ s, v: new THREE.Vector3(v[0] + (Math.random() - 0.5) * 0.4, v[1] * (0.7 + Math.random() * 0.5), v[2]), g, life: life * (0.8 + Math.random() * 0.4), age: 0, sz: size });
    }
  }
  const sandPuff = (n = 3) => emit('puff', new THREE.Vector3(ball.position.x, 0.1, ball.position.z), { n, size: 0.22, life: 0.6, v: [0, 0.5, 0] });

  // ---------- the pets ----------
  const homeX = (s) => -READY * DIR[s];
  const backX = (s) => -(LINE.x - 0.3) * DIR[s];
  const mkPet = (side) => ({
    side, model: null, holder: new THREE.Group(),
    x: homeX(side), z: 0, tx: homeX(side), tz: 0, speed: 2, vx: 0, vz: 0,
    y: 0, vy: 0, sq: 0, sv: 0, shake: 0, yaw: DIR[side] * 1, tilt: 0, tiltX: 0, tiltZ: 0,
    mood: 0, h: 1, r: 0.5, stepAt: 0,
  });
  const pets = { you: mkPet('you'), foe: mkPet('foe') };
  for (const p of Object.values(pets)) scene.add(p.holder);
  const other = (s) => (s === 'you' ? 'foe' : 'you');
  const headPos = (p, up = 0.1) => new THREE.Vector3(p.x, p.h + p.y + up, p.z);

  /** Run somewhere on its own half of the court. */
  function moveTo(p, x, z, speed = 2.2) {
    const d = DIR[p.side];
    p.tx = clamp(x * -d, 0.45, LINE.x + 0.35) * -d;
    p.tz = clamp(z, -LINE.z - 0.25, LINE.z + 0.25);
    p.speed = speed;
  }
  function hop(p, v = 2.2) {
    if (reduced || p.y > 0.001) return;
    p.vy = v;
    p.sv += 1.4;
  }
  const kick = (p, a) => (p.sv += a * 8);
  /** Tip over toward (dx, dz): a dive, a lunge. */
  function tip(p, dx, dz, amount = 0.6) {
    const l = Math.hypot(dx, dz) || 1;
    p.tiltX = (dz / l) * amount;
    p.tiltZ = (-dx / l) * amount;
    p.tilt = 1;
  }

  /**
   * Where the ball touches this pet: on the front of its head, toward the net,
   * resting against the surface (never inside it). `lift` = how high it has jumped.
   */
  function contactAt(p, x, z, lift = 0) {
    return new THREE.Vector3(x + DIR[p.side] * (p.r * 0.75 + BALL_R * 0.7), p.h * 0.84 + BALL_R * 0.7 + lift, z);
  }
  const JUMP_LIFT = 0.42; // about the top of a spike / serve jump

  /** Where a shot lands in the receiver's half: deterministic from the server's aim and power. */
  function landingSpot(e, recv) {
    const depth =
      e.shot === 'spike' ? 0.7 + frac(e.aim * 13.7 + 0.3) * 1.45 : e.shot === 'serve' ? 1.1 + frac(e.aim * 7.3 + 0.1) * 1.05 : 0.75 + frac(e.aim * 5.1 + 0.5) * 1.35;
    return { x: -DIR[recv] * depth, z: e.aim * (LINE.z - 0.15) };
  }

  /** The ball waits in front of the server, who walks back to the baseline. */
  function servePoint(s) {
    const p = pets[s];
    return contactAt(p, p.tx, p.tz).add(SERVE_REST);
  }
  function resetRally(server) {
    phaseTag = 'reset';
    const s = pets[server];
    const sx = backX(server);
    const sz = 0.25 * DIR[server];
    // lob the ball over everyone's heads first, then walk back to places
    fly(contactAt(s, sx, sz).add(SERVE_REST), 1.0, 1.2, null, s);
    after(0.5, () => {
      for (const p of Object.values(pets)) {
        if (p === s) moveTo(p, sx, sz, 1.8);
        else moveTo(p, homeX(p.side), 0, 1.6);
      }
    });
  }

  async function makeModel(look) {
    const { buildPet } = await loadSpecies(look.genome.species);
    const m = await buildPet(look);
    m.root.scale.setScalar(SCALE);
    m.root.traverse((o) => o.isMesh && (o.castShadow = true));
    return m;
  }

  // ---------- one server event -> one little scene ----------
  /**
   * Animate one step's events. `next` = the following step's events (to know if the
   * ball will be returned). `onEvent(e)` fires when each one visibly happens.
   * Returns ms until done.
   */
  function play(events, onEvent, next = []) {
    let t = 0; // seconds from now
    const at = (sec, fn) => (sec <= 0 ? fn() : after(sec, fn));
    for (const e of events) {
      const p = pets[e.side];
      at(t, () => (phaseTag = e.type === 'hit' ? (e.fault ?? e.shot) + (next.some((n) => n.type === 'miss') ? '>miss' : '') : e.type));
      switch (e.type) {
        case 'command': {
          at(t, () => {
            onEvent?.(e);
            if (e.ok && e.cmd === 'cheer') {
              kick(p, 0.6); // a proud stretch (no hop: the ball may be right at its head)
              emit('star', headPos(p), { n: 3, v: [0, 1.1, 0] });
              sound('cheer');
            } else if (e.ok) {
              kick(p, -0.4);
              emit('bubble', headPos(p), { n: 3, v: [0, 0.6, 0], g: 0.1, size: 0.12 });
              sound('calm');
            } else {
              p.shake = 1;
              if (e.sulk) emit('drop', headPos(p, 0.05), { v: [0.3 * DIR[e.side], 0.3, 0], g: -1.5, size: 0.1 });
              sound('refuse');
            }
          });
          // plays alongside the rally: the ball doesn't wait for it
          break;
        }
        case 'hit': {
          const dir = DIR[e.side];
          const recvSide = other(e.side);
          const r = pets[recvSide];
          // 1) get to the ball and up to where this pet hits it
          let windup = 0.05;
          let lift = 0;
          if (e.shot === 'serve') {
            windup = 0.5;
            lift = JUMP_LIFT;
            at(t, () => fly(contactAt(p, p.tx, p.tz, lift), 0.5, 0.5, null, p)); // toss
            at(t + 0.22, () => hop(p, 2.9));
          } else if (e.shot === 'spike') {
            // run up toward the net while the ball is set high, then jump and smash
            windup = 0.62;
            lift = JUMP_LIFT;
            const ax = -dir * 0.75;
            at(t, () => {
              const az = p.z * 0.6;
              fly(contactAt(p, ax, az, lift), 0.62, 0.85, null, p); // pop it up high first...
              sound('bump');
              after(0.12, () => moveTo(p, ax, az, 3.6)); // ...then run in under it
            });
            at(t + 0.3, () => hop(p, 2.9));
          } else at(t, () => kick(p, -0.5));
          // 2) contact, then the ball flies
          const contact = t + windup;
          const willMiss = !e.fault && next.some((n) => n.type === 'miss');
          const dur = e.fault === 'out' ? 1.05 : e.shot === 'spike' ? clamp(0.7 - (e.power - 1) * 0.15, 0.5, 0.8) : e.shot === 'serve' ? 1.15 : 1.2;
          at(contact, () => {
            onEvent?.(e);
            if (e.shot !== 'bump') tip(p, dir, 0, 0.35);
            sound(e.shot === 'spike' ? 'spike' : e.shot === 'serve' ? 'serve' : 'bump');
            if (e.shot === 'spike' && !e.fault) emit('sparkle', ball.position, { n: 3, spread: 0.2, size: 0.12 });
            if (e.fault === 'net') {
              fly(new THREE.Vector3(-dir * (BALL_R + 0.03), 0.8, e.aim * 0.6), 0.5, 0.3, () => {
                sound('thud');
                fly(new THREE.Vector3(-dir * 0.4, BALL_R, e.aim * 0.6), 0.4, 0.04, () => sandPuff(2));
              });
            } else if (e.fault === 'out') {
              // wide, off the sideline away from the receiver (a long ball would sail through it)
              const away = r.z > 0 ? -1 : 1;
              const depth = clamp(Math.abs(r.x) - 0.6, 0.5, LINE.x);
              fly(new THREE.Vector3(-DIR[recvSide] * depth, BALL_R, away * (LINE.z + 0.6)), dur, 1.3, () => {
                sound('thud');
                sandPuff(2);
              });
            } else {
              const spot = landingSpot(e, recvSide);
              if (!willMiss) {
                // runs to it and meets it with its head
                moveTo(r, spot.x, spot.z, Math.max(1.8, Math.hypot(spot.x - r.x, spot.z - r.z) / (dur * 0.75)));
                fly(contactAt(r, r.tx, r.tz), dur, e.shot === 'spike' ? 0.15 : e.shot === 'serve' ? 1.0 : 1.45, null, r);
              } else {
                // a drop shot: short (in front of it) and off to the side, so its path never crosses the pet
                const away = r.z > 0 ? -1 : 1;
                const depth = clamp(Math.abs(r.x) - 0.65, 0.55, LINE.x - 0.3);
                const land = new THREE.Vector3(-DIR[recvSide] * depth, BALL_R, clamp(r.z + away * 1.05, -LINE.z + 0.1, LINE.z - 0.1));
                const l = Math.hypot(land.x - r.x, land.z - r.z) || 1;
                const reach = r.r + BALL_R + 0.3; // stops just short...
                moveTo(r, land.x - ((land.x - r.x) / l) * reach, land.z - ((land.z - r.z) / l) * reach, Math.max(1.8, l / (dur * 0.8)));
                after(dur * 0.72, () => tip(r, land.x - r.x, land.z - r.z, 0.9)); // ...and dives
                fly(land, dur, e.shot === 'spike' ? 0.15 : e.shot === 'serve' ? 1.0 : 1.45);
              }
            }
            // the hitter drifts back to cover its half
            if (!e.fault) after(0.35, () => moveTo(p, homeX(e.side), p.z * 0.4, 1.4));
          });
          t = contact + dur;
          break;
        }
        case 'miss': {
          at(t, () => {
            onEvent?.(e);
            kick(p, -0.6);
            sound('thud');
            sandPuff(4);
            // a little bounce, away from the pet that missed it
            const away = Math.sign(ball.position.z - p.z) || 1;
            fly(new THREE.Vector3(ball.position.x + DIR[other(e.side)] * 0.15, BALL_R, clamp(ball.position.z + away * 0.35, -LINE.z - 0.4, LINE.z + 0.4)), 0.45, 0.25);
          });
          t += 0.5;
          break;
        }
        case 'point': {
          at(t, () => {
            onEvent?.(e);
            sound('whistle');
            sound(e.side === 'you' ? 'chime' : 'aww', 0.2);
            const w = pets[e.side];
            const l = pets[other(e.side)];
            hop(w, 2.6);
            after(0.45, () => hop(w, 2));
            emit('star', headPos(w), { n: 2, v: [0, 1.1, 0] });
            kick(l, -0.5);
          });
          if (!events.some((n) => n.type === 'end')) at(t + 0.9, () => resetRally(e.side));
          t += 1.8;
          break;
        }
        case 'end': {
          at(t, () => {
            onEvent?.(e);
            const w = pets[e.winner];
            hop(w, 2.8);
            after(0.6, () => hop(w, 2.4));
            emit('heart', headPos(w), { n: 4, v: [0, 1.1, 0] });
            emit('star', headPos(w), { n: 3, v: [0, 1.3, 0] });
          });
          t += 1.2;
          break;
        }
        default:
          at(t, () => onEvent?.(e));
      }
    }
    return Math.round(t * 1000);
  }

  // ---------- frame loop ----------
  let raf;
  let paused = false;
  let moodTimer = 0;
  let closest = Infinity; // what you see (after the safety net): never below 1
  let planned = Infinity; // before it: how well the choreography itself avoided the pets
  let phaseTag = 'start';
  const byPhase = {};
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h || canvas.width === Math.floor(w * renderer.getPixelRatio())) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // fit the court across a narrow phone (the far corners may crop a little)
    const halfW = LINE.x + 0.2;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(halfW / camera.position.distanceTo(LOOK) / camera.aspect, 0.3)));
    camera.updateProjectionMatrix();
    camera.lookAt(LOOK);
  }

  function animatePet(p, t, dt) {
    const m = p.model;
    if (!m) return;
    // run toward the target (a mochi hop-runs)
    const dx = p.tx - p.x;
    const dz = p.tz - p.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (reduced) {
      p.x = p.tx;
      p.z = p.tz;
    } else if (d > 0.02) {
      const step = Math.min(d, p.speed * dt);
      p.vx = (dx / d) * p.speed;
      p.vz = (dz / d) * p.speed;
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      moving = d > 0.12;
      if (moving && p.y <= 0.001 && t > p.stepAt) {
        hop(p, 1.3 + Math.min(1, p.speed / 3) * 0.6);
        p.stepAt = t + 0.12;
      }
    }
    if (p.y > 0 || p.vy > 0) {
      p.vy -= 9.8 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        if (p.vy < -1) kick(p, -Math.min(0.5, -p.vy * 0.12));
        p.vy = 0;
      }
    }
    p.sv += (-70 * p.sq - 8 * p.sv) * dt;
    p.sq += p.sv * dt;
    p.shake = Math.max(0, p.shake - dt * 1.6);
    p.tilt = Math.max(0, p.tilt - dt * 1.4);
    // face where it's running, otherwise the net (turned a little to the camera)
    const face = DIR[p.side] * (Math.PI / 2 - 0.55);
    const want = moving ? Math.atan2(p.vx, p.vz) : face;
    p.yaw = reduced ? face : angleLerp(p.yaw, want, Math.min(1, dt * 8));
    // nervous pets tremble
    const tremble = p.mood < -0.2 && !reduced ? Math.sin(t * 40) * 0.012 * -p.mood : 0;
    p.holder.position.set(p.x + tremble, p.y, p.z);
    const k = reduced ? 0 : Math.sin(Math.min(1, p.tilt) * Math.PI * 0.5);
    p.holder.rotation.set(p.tiltX * k, 0, p.tiltZ * k);
    m.root.rotation.y = p.yaw + (reduced ? 0 : Math.sin(p.shake * 14) * p.shake * 0.5);
    const breathe = reduced ? 0 : Math.sin(t * 2.4 + (p.side === 'foe' ? 1 : 0)) * 0.012;
    const sq = p.sq + breathe;
    m.body.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    const P = m.parts;
    if (!reduced) {
      if (P.tail) P.tail.rotation.z = Math.sin(t * (p.mood > 0.2 || moving ? 12 : 5)) * 0.25;
      P.wings?.forEach((w) => (w.rotation.y = w.userData.sx * (0.55 + Math.sin(t * (p.y > 0.05 ? 18 : 6)) * 0.25)));
      P.flames?.forEach((f, i) => f.scale.set(1, 1 + Math.sin(t * 11 + i) * 0.12, 1));
      if (P.halo) P.halo.rotation.z = t;
    }
    const blink = (t + (p.side === 'foe' ? 1.7 : 0)) % 4.2 > 4.07;
    P.blink?.forEach((l) => (l.scale.y = blink ? 0.12 : l.userData.rest ?? 1));
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (paused || document.hidden) return;
    resize();
    // Pets move by the real clock like the ball does, in small steps so the springs stay stable:
    // on a slow device they must still reach the ball in time.
    const dt = Math.min(0.25, clock.getDelta());
    const subs = Math.ceil(dt / 0.03);
    const t = now();
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].at <= t) {
        const fn = timers[i].fn;
        timers.splice(i, 1);
        fn();
      }
    }
    if (flight) {
      const k = clamp((t - flight.t0) / flight.dur, 0, 1);
      endAt.copy(flight.b);
      const tr = flight.track;
      if (tr?.model) endAt.lerp(contactAt(tr, tr.x, tr.z, tr.y).add(SERVE_REST), THREE.MathUtils.smoothstep(k, 0.55, 1));
      ball.position.lerpVectors(flight.a, endAt, k);
      ball.position.y += 4 * flight.h * k * (1 - k);
      if (!reduced) ball.rotation.z -= dt * 9;
      if (k >= 1) {
        const then = flight.then;
        flight = null;
        then?.();
      }
    }
    for (const p of Object.values(pets)) {
      for (let i = 0; i < subs; i++) animatePet(p, t, dt / subs);
      // a ball lying on the sand gets nudged along by a pet that walks into it
      if (p.model && !flight && ball.position.y < BALL_R + 0.05) {
        const dx = ball.position.x - p.x;
        const dz = ball.position.z - p.z;
        const d = Math.hypot(dx, dz) || 1e-3;
        const min = p.r * 0.95 + BALL_R;
        if (d < min) {
          ball.position.x = p.x + (dx / d) * min;
          ball.position.z = p.z + (dz / d) * min;
          ball.rotation.z -= (min - d) * 3;
        }
      }
      if (!p.model) continue;
      // Pets are solid. q = how close the ball is to the body (1 = just touching, < 1 = inside).
      const b = ball.position;
      const rx = p.r + BALL_R;
      const ry = p.h / 2 + BALL_R;
      const cy = p.y + p.h / 2;
      const ox = (b.x - p.x) / rx;
      const oy = (b.y - cy) / ry;
      const oz = (b.z - p.z) / rx;
      const q = Math.sqrt(ox * ox + oy * oy + oz * oz);
      // how well the moves were timed (before the safety net below)
      if (q < planned) planned = q;
      if (q < (byPhase[phaseTag + ':' + p.side] ?? Infinity)) byPhase[phaseTag + ':' + p.side] = +q.toFixed(3);
      // safety net: on a slow device a jump or a run can come a frame late; never let the ball sink in
      if (q < 1 && q > 1e-4) b.set(p.x + (ox / q) * rx, cy + (oy / q) * ry, p.z + (oz / q) * rx);
      if (Math.max(q, 1) < closest) closest = Math.max(q, 1);
    }
    // mood you can see: sweat when nervous, stars when excited
    moodTimer -= dt;
    if (moodTimer <= 0) {
      moodTimer = 1.1;
      for (const p of Object.values(pets)) {
        if (!p.model) continue;
        if (p.mood < -0.35) emit('drop', headPos(p, 0), { v: [0.25 * -DIR[p.side], 0.4, 0], g: -1.4, size: 0.09, life: 0.8 });
        else if (p.mood > 0.35) {
          emit('star', headPos(p), { v: [0, 0.8, 0], size: 0.1, life: 0.8 });
          if (p.mood > 0.6 && Math.random() < 0.5) hop(p, 1.4);
        }
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
      const k = q.age / q.life;
      q.s.material.opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      const sc = q.sz * (k < 0.15 ? 0.5 + k / 0.3 : 1);
      q.s.scale.set(sc, sc, sc);
    }
    renderer.render(scene, camera);
  }
  frame();

  const v3 = new THREE.Vector3();
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  return {
    /** Build both pets (looks from lookOf) and put the ball with the first server. */
    async setPets(youLook, foeLook, server) {
      const [a, b] = await Promise.all([makeModel(youLook), makeModel(foeLook)]);
      for (const [p, m] of [[pets.you, a], [pets.foe, b]]) {
        if (p.model) {
          p.holder.remove(p.model.root);
          disposeTree(p.model.root);
        }
        p.model = m;
        p.holder.add(m.root);
        // measure it, so the ball touches its head instead of going through it
        box.setFromObject(m.root).getSize(size);
        p.h = size.y;
        p.r = Math.max(size.x, size.z) / 2;
      }
      await precompile(renderer, scene, camera, scene);
      const s = pets[server];
      moveTo(s, backX(server), 0.25 * DIR[server], 2);
      s.x = s.tx;
      s.z = s.tz;
      ball.position.copy(servePoint(server));
    },
    play,
    setMoods({ you, foe }) {
      pets.you.mood = you;
      pets.foe.mood = foe;
    },
    /** Where a pet's head is on screen (CSS px from the canvas' top-left), for popups. */
    screenPos(side) {
      const p = pets[side];
      v3.copy(headPos(p, 0.25)).project(camera);
      return { x: ((v3.x + 1) / 2) * canvas.clientWidth, y: ((1 - v3.y) / 2) * canvas.clientHeight };
    },
    /**
     * For tests: the closest the ball came to a pet's body (1 = touching, below 1 = inside).
     * `closest` is what was shown; `planned` is before the safety net pushed the ball out.
     */
    debug: () => ({ closest: +closest.toFixed(3), planned: +planned.toFixed(3), byPhase, size: { you: [pets.you.r, pets.you.h], foe: [pets.foe.r, pets.foe.h] } }),
    setPaused(p) {
      paused = p;
      if (!p) clock.getDelta();
    },
    dispose() {
      cancelAnimationFrame(raf);
      for (const p of Object.values(pets)) if (p.model) disposeTree(p.model.root);
      disposeTree(scene);
      renderer.dispose();
    },
  };
}
