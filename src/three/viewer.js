// A turntable viewer: one pet on a soft pedestal, drag to turn, pinch to zoom.
import { THREE, addLights, addEnvironment, disposeTree, tuneRenderer, precompile } from './kit.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadSpecies } from '../species/index.js';

export async function createViewer(canvas, { spin = true, yaw = 0.25 } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  tuneRenderer(renderer);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  addLights(scene);
  addEnvironment(renderer, scene);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(Math.sin(yaw) * 4.1, 1.25, Math.cos(yaw) * 4.1);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.7, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 2.2;
  controls.maxDistance = 6;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.autoRotate = spin && !reduced;
  controls.autoRotateSpeed = 1.2;
  canvas.addEventListener('pointerdown', () => (controls.autoRotate = false));

  let model = null;
  let raf;
  let token = 0;
  // don't draw when the viewer is scrolled off screen or the tab is hidden
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);
  const clock = new THREE.Clock();
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    resize();
    const t = clock.getElapsedTime();
    if (model && !reduced) {
      const P = model.parts;
      model.body.scale.set(1 + Math.sin(t * 2.4) * 0.012, 1 - Math.sin(t * 2.4) * 0.015, 1);
      if (P.tail) P.tail.rotation.z = Math.sin(t * 5) * 0.25;
      const blink = t % 4 > 3.88;
      P.blink.forEach((l) => (l.scale.y = blink ? 0.12 : l.userData.rest ?? 1));
      P.wings.forEach((w) => (w.rotation.y = w.userData.sx * (0.55 + Math.sin(t * 6) * 0.25)));
      P.flames.forEach((f, i) => f.scale.set(1, 1 + Math.sin(t * 11 + i) * 0.12, 1));
      P.sparkles.forEach((s, i) => {
        const a = s.userData.a + t * 0.8;
        s.position.set(Math.cos(a) * 0.75, 0.6 + Math.sin(t * 2 + i) * 0.3, Math.sin(a) * 0.75);
      });
      if (P.halo) P.halo.rotation.z = t;
      if (P.egg) model.body.rotation.z = Math.sin(t * 2.6) * 0.05;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  return {
    async setLook(look) {
      const mine = ++token;
      const { buildPet } = await loadSpecies(look.genome.species);
      const next = await buildPet(look);
      if (mine !== token) return disposeTree(next.root); // a newer look arrived meanwhile
      await precompile(renderer, next.root, camera, scene);
      if (mine !== token) return disposeTree(next.root);
      if (model) {
        scene.remove(model.root);
        disposeTree(model.root);
      }
      model = next;
      scene.add(model.root);
      controls.target.set(0, model.parts.headY * 0.75, 0);
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      controls.dispose();
      if (model) disposeTree(model.root);
      renderer.dispose();
    },
  };
}
