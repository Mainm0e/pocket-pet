// Still pictures of pets (cards, lists, battles), from one shared offscreen renderer.
import { THREE, addLights, addEnvironment, disposeTree, tuneRenderer, precompile } from './kit.js';
import { loadSpecies } from '../species/index.js';

let R = null;
const cache = new Map();
let queue = Promise.resolve();

function setup() {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  tuneRenderer(renderer);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const L = addLights(scene);
  L.key.shadow.mapSize.set(512, 512);
  addEnvironment(renderer, scene);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  return { renderer, scene, camera };
}

/**
 * Render a pet to a PNG data URL. yaw turns the pet (0 = facing you).
 * Cached by look + options, and rendered one at a time.
 */
export async function thumb(look, { size = 240, yaw = 0.35, silhouette = false } = {}) {
  const { lookKey } = await loadSpecies(look.genome.species);
  const key = `${lookKey(look)}|${size}|${yaw}|${silhouette}`;
  if (cache.has(key)) return cache.get(key);
  // one at a time, with a breather between renders so the page stays responsive
  const job = (queue = queue.then(() => render(look, size, yaw, silhouette)).then((u) => new Promise((r) => setTimeout(() => r(u), 16))));
  cache.set(key, job);
  return job;
}

async function render(look, size, yaw, silhouette) {
  R ??= setup();
  const { buildPet } = await loadSpecies(look.genome.species);
  const m = await buildPet(look, { detail: 1.6 }); // coarser mesh: thumbnails are small
  m.root.rotation.y = yaw;
  if (silhouette) m.root.traverse((o) => o.isMesh && (o.material = new THREE.MeshBasicMaterial({ color: 0xb9b6c8 })));
  R.scene.add(m.root);
  R.renderer.setSize(size, size, false);
  const h = m.parts.topY;
  R.camera.position.set(0, h * 0.62 + 0.25, 2.1 + h * 1.55);
  R.camera.lookAt(0, h * 0.5, 0);
  await precompile(R.renderer, m.root, R.camera, R.scene);
  R.renderer.render(R.scene, R.camera);
  // encode off the main thread (toDataURL would block)
  const blob = await new Promise((r) => R.renderer.domElement.toBlob(r, 'image/webp', 0.9));
  R.scene.remove(m.root);
  disposeTree(m.root);
  return URL.createObjectURL(blob);
}
