// Each species' art is its own chunk (with Three.js), fetched only when needed.
const loaders = {
  mochi: () => import('./mochi/build.js'),
  shiba: () => import('./shiba/build.js'),
};
const cache = {};
export function loadSpecies(id) {
  cache[id] ??= (loaders[id] ?? loaders.mochi)();
  return cache[id];
}

/** What the art needs to know about a pet (works for your pet, friends' pets and Seed Lab previews). */
export function lookOf(pet) {
  const c = pet.care;
  const avg = c ? (c.happiness + c.comfort + c.health + c.fitness + c.energy) / 5 : 70;
  return {
    genome: pet.genome,
    stage: pet.stage,
    form: pet.form ?? {},
    marks: pet.marks ?? [],
    vivid: pet.vivid ?? 0.7,
    hatchTaps: pet.hatchTaps ?? 0,
    mood: avg < 35 ? 'sad' : 'ok',
  };
}
