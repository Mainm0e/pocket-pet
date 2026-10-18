import { describe, it, expect } from 'vitest';
import { decode, codeFromNumber } from '../server/genome/index.js';
import { SHOWCASE_BY_SPECIES } from '../server/genome/showcase.js';
import { buildPet as buildShiba } from './shiba/build.js';
import { buildPet as buildMochi } from './mochi/build.js';

// Builds real models (sculpting runs inline here) and checks every vertex is a real number.
// Catches paint/shape bugs that would render a pet black or invisible.
const TRAITS = ['tough', 'playful', 'strong', 'calm'];
function badValues(root) {
  let bad = 0;
  let meshes = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    for (const name of ['position', 'normal', 'color']) {
      const a = o.geometry.attributes[name];
      if (a) for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) bad++;
    }
  });
  return { bad, meshes };
}

describe.each([
  ['shiba', 'SH1', buildShiba, 'coat', 8],
  ['mochi', 'MO1', buildMochi, 'flavor', 10],
])('3D %s models', (species, prefix, buildPet, colourGene, colourCount) => {
  const codes = [...Object.values(SHOWCASE_BY_SPECIES[species]), ...Array.from({ length: 16 }, (_, i) => `${prefix}-${codeFromNumber(i * 104729 + 7).split('-')[1]}`)];
  it('build cleanly for many seeds, stages and forms', async () => {
    let n = 0;
    for (const [i, code] of codes.entries()) {
      const genome = decode(code);
      const top = TRAITS[i % 4];
      const second = TRAITS[(i + 1 + (i >> 2)) % 4] === top ? TRAITS[(i + 2) % 4] : TRAITS[(i + 1 + (i >> 2)) % 4];
      for (const stage of ['egg', 'baby', 'teen', 'adult']) {
        const look = { genome, stage, form: { top: stage === 'baby' || stage === 'egg' ? null : top, second: stage === 'adult' ? second : null }, marks: ['star', 'scar', 'sun', 'rainbow'], vivid: 0.8, mood: 'ok' };
        const m = await buildPet(look, { detail: 2.2 });
        const r = badValues(m.root);
        expect(r.meshes).toBeGreaterThan(stage === 'egg' ? 1 : 3);
        expect(r.bad, `${code} ${stage}`).toBe(0);
        n++;
      }
    }
    expect(n).toBe(codes.length * 4);
  }, 120000);
  it('every colour gene shows (no black faces)', async () => {
    const coats = new Set();
    for (let i = 0; coats.size < colourCount && i < 20000; i++) {
      const g = decode(`${prefix}-${codeFromNumber(i * 31 + 1).split('-')[1]}`);
      if (coats.has(g.genes[colourGene])) continue;
      coats.add(g.genes[colourGene]);
      const m = await buildPet({ genome: g, stage: 'adult', form: { top: 'tough', second: 'calm' }, marks: [], vivid: 0.8 }, { detail: 2.2 });
      let lum = 0;
      let count = 0;
      (m.parts.head ?? m.body).traverse((o) => {
        const c = o.isMesh && o.geometry.attributes.color;
        if (!c) return;
        for (let k = 0; k < c.array.length; k += 3) lum += c.array[k] + c.array[k + 1] + c.array[k + 2];
        count += c.array.length / 3;
      });
      expect(lum / count, g.genes[colourGene]).toBeGreaterThan(0.08);
    }
    expect(coats.size).toBe(colourCount);
  }, 60000);
});
