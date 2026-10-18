import { describe, it, expect } from 'vitest';
import { decode, normalizeCode, nudgeCode, codeFromNumber, randomCode, GENERATIONS, SPAWN } from './index.js';
import { hash, stream } from './core.js';
import { SHOWCASE_BY_SPECIES } from './showcase.js';

// LOCKED: these codes must decode to exactly these pets forever.
// If this test fails, a change broke existing pets. Revert it, or ship it as a new generation.
const LOCKED = {
  'SH1-000001': { name: 'Miruta', strand: 'AGAAAAAGATAAATAAAGACAAAA', print: 'FP-0FDCFC', coat: 'blacktan', ears: 'round', socks: 'four' },
  'SH1-7F3A9C': { name: 'Kutami', strand: 'AAAAAAAAAAAAAAAAAAAGAAAA', print: 'FP-5483FE', coat: 'red', ears: 'pointy', collar: 'mint' },
  'SH1-POCHI': { name: 'Mochichan', strand: 'AAAAAAAAAAAAAGAGAATTATAA', print: 'FP-641491', tail: 'plume', collar: 'gold', charm: 'bell' },
  'SH1-SHIBA1': { name: 'Koromaru', strand: 'ACATAAAGAAATATAAATAAATAA', print: 'FP-2C119C', coat: 'sesame', brows: 'dots' },
  'SH1-ZZZZZZ': { name: 'Tabachan', strand: 'TAATACAAAGATAAAAATAAAGAA', print: 'FP-0738C4', coat: 'white', eyes: 'happy' },
  'MO1-000001': { name: 'Pifipo', strand: 'AAAAATATAAATAAAAAAAGAA', print: 'FP-4EBCD9', flavor: 'plain', shape: 'round' },
  'MO1-DAIFUKU': { name: 'Chizupo', strand: 'ATAAATATAAAGAAAGAAAGAA', print: 'FP-B1F6E2', flavor: 'sakura', topper: 'leaf' },
  'MO1-MOCHI2': { name: 'Mipami', strand: 'AAAGAAAAAAAAATATATAAAA', print: 'FP-493F15', shape: 'wide', topper: 'strawberry' },
  'MO1-ICHIGO': { name: 'Nupami', strand: 'ACAAAAAGAAATAATAAAAGAA', print: 'FP-5CA8D3', flavor: 'yuzu', topper: 'cherry' },
  'MO1-ZZZZZZ': { name: 'Chichichi', strand: 'TTACAGAAAGAAATAAAAAAAA', print: 'FP-43EFB4', flavor: 'ube', shape: 'drop' },
};

describe('core math is frozen', () => {
  it('hash and stream match Tamagot', () => {
    expect(hash('MOCHI-001')).toBe(hash('MOCHI-001'));
    expect(hash('')).toBe(2166136261);
    const r = stream(1);
    expect([r(), r()].map((x) => x.toFixed(8))).toEqual(['0.62707394', '0.00273572']);
  });
});

describe('locked seeds', () => {
  for (const [code, want] of Object.entries(LOCKED)) {
    it(`${code} is still ${want.name}`, () => {
      const d = decode(code);
      expect(d.name).toBe(want.name);
      expect(d.strand).toBe(want.strand);
      expect(d.fine.print).toBe(want.print);
      for (const [k, v] of Object.entries(want)) if (!['name', 'strand', 'print'].includes(k)) expect(d.genes[k]).toBe(v);
    });
  }
  for (const showcase of Object.values(SHOWCASE_BY_SPECIES))
    for (const [value, code] of Object.entries(showcase)) {
      it(`${code} shows ${value}`, () => {
        const d = decode(code);
        expect(d.genes.unique === value || d.mutations.includes(value) || Object.values(d.genes).includes(value)).toBe(true);
      });
    }
});

describe('codes', () => {
  it('normalizes text and adds the current prefix', () => {
    expect(normalizeCode('  daifuku ')).toBe('MO1-DAIFUKU');
    expect(normalizeCode('sh1-abc')).toBe('SH1-ABC'); // older species keep their prefix
    expect(normalizeCode('my mochi')).toBe('MO1-MY-MOCHI');
    expect(decode('daifuku')).toBe(decode('MO1-DAIFUKU'));
    expect(decode('SH1-POCHI').species).toBe('shiba');
  });
  it('nudges past collisions', () => {
    expect(nudgeCode('SH1-00000Z')).toBe('SH1-000010');
    expect(nudgeCode('SH1-ABC')).toBe('SH1-ABD');
  });
  it('makes stable codes from numbers', () => {
    expect(codeFromNumber(1)).toBe('MO1-000001');
    expect(codeFromNumber(900917)).toBe(codeFromNumber(900917));
    expect(randomCode()).toMatch(/^MO1-[0-9A-HJKMNP-TV-Z]{6}$/);
  });
  it('decoded DNA is read-only', () => {
    const d = decode('MO1-DAIFUKU');
    expect(() => {
      d.genes.coat = 'gold';
    }).toThrow();
  });
});

describe.each(GENERATIONS.map((T) => [T.PREFIX + T.GEN, T]))('odds match the %s table', (prefix, T) => {
  const N = 20000;
  const pets = Array.from({ length: N }, (_, i) => decode(`${prefix}-${codeFromNumber(i * 7919 + 13).split('-')[1]}`));
  it('every gene allele appears close to its weight', () => {
    for (const g of T.GENES) {
      for (const [value, , w] of g.alleles) {
        const got = (pets.filter((p) => p.genes[g.key] === value).length / N) * 100;
        expect(Math.abs(got - w)).toBeLessThan(Math.max(1.2, w * 0.2));
      }
    }
  });
  it('about 35% have a unique part, mutations are rare', () => {
    const uq = (pets.filter((p) => p.unique.slot !== 'none').length / N) * 100;
    expect(uq).toBeGreaterThan(33);
    expect(uq).toBeLessThan(37);
    const shiny = (pets.filter((p) => p.mutations.includes('shiny')).length / N) * 100;
    expect(shiny).toBeGreaterThan(1);
    expect(shiny).toBeLessThan(2);
  });
  it('fingerprints practically never repeat', () => {
    const prints = new Set(pets.map((p) => p.fine.print));
    expect(prints.size).toBeGreaterThan(N * 0.99);
  });
});

describe('rare species spawn', () => {
  it('a new egg is a Shiba only 1 in a million times', () => {
    expect(SPAWN[0].table.SPECIES).toBe('shiba');
    expect(SPAWN[0].chance).toBe(1 / 1_000_000);
    let calls = 0;
    // the very first roll decides the species
    expect(randomCode(() => (calls++ === 0 ? 0.0000005 : 0.5))).toMatch(/^SH1-/);
    expect(randomCode(() => 0.0000011)).toMatch(/^MO1-/);
    expect(randomCode(() => 0.5)).toMatch(/^MO1-/);
  });
  it('rare species are Legendary and say how rare they are', () => {
    const d = decode('SH1-POCHI');
    expect(d.speciesOdds).toBe(1 / 1_000_000);
    expect(d.tier).toBe('Legendary');
    expect(decode('MO1-DAIFUKU').speciesOdds).toBeCloseTo(1 - 1 / 1_000_000);
  });
  it('the server announces a rare egg', async () => {
    const { createServer } = await import('../index.js');
    const m = new Map();
    const orig = Math.random;
    Math.random = () => 0.0000001; // force the 1-in-a-million roll
    try {
      const s = createServer({ storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }, clock: () => 0 });
      const r = await s.startEgg([]);
      expect(r.state.pet.genome.species).toBe('shiba');
      expect(r.events.some((e) => e.type === 'rareSpecies')).toBe(true);
    } finally {
      Math.random = orig;
    }
  });
});
