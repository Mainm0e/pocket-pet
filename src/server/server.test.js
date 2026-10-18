import { describe, it, expect } from 'vitest';
import { createServer } from './index.js';
import { createPersonality, QUIZ } from './dna.js';
import { codeFromNumber } from './genome/index.js';
import { newPet, catchUp, act, gainTrait, checkEvolution, dnaString, title, traitTotal } from './pet.js';
import { createBattle, stepBattle, makeFriendPet } from './battle.js';
import { HOUR, DAY, TRAIT_CAP, DAILY_TRAIT_GAIN, CARE_FLOOR, BATTLES_PER_DAY } from './constants.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const T0 = new Date(2026, 9, 18, 9, 0).getTime();

function hatched(seed = 42, answers = []) {
  const p = newPet({ id: 'x', code: codeFromNumber(seed), answers, now: T0 });
  p.stage = 'baby';
  p.hatchedAt = T0;
  return p;
}

describe('personality', () => {
  it('is deterministic per code', () => {
    expect(createPersonality('SH1-ABC', [0, 1, 0, 1, 0, 1])).toEqual(createPersonality('SH1-ABC', [0, 1, 0, 1, 0, 1]));
  });
  it('quiz answers nudge odds', () => {
    let rainLovers = 0;
    let baseline = 0;
    for (let s = 1; s <= 2000; s++) {
      if (createPersonality(codeFromNumber(s), [1]).quirk === 'loves_rain') rainLovers++;
      if (createPersonality(codeFromNumber(s), [0]).quirk === 'loves_rain') baseline++;
    }
    expect(rainLovers).toBeGreaterThan(baseline * 2);
  });
  it('has 4-6 quiz questions', () => {
    expect(QUIZ.length).toBeGreaterThanOrEqual(4);
    expect(QUIZ.length).toBeLessThanOrEqual(6);
  });
});

describe('care', () => {
  it('never drops below the floor, even after weeks away', () => {
    const p = hatched();
    catchUp(p, T0 + 30 * DAY);
    for (const v of Object.values(p.care)) expect(v).toBeGreaterThanOrEqual(CARE_FLOOR);
    expect(p.vivid).toBeLessThan(0.3);
  });
  it('overfeeding is refused', () => {
    const p = hatched();
    expect(act(p, 'feed', null, T0).ok).toBe(true);
    act(p, 'feed', null, T0 + 1000);
    act(p, 'feed', null, T0 + 2000);
    expect(act(p, 'feed', null, T0 + 3000).say).toBe('Too full...');
  });
  it('messes appear after eating and can be cleaned', () => {
    const p = hatched();
    act(p, 'feed', null, T0);
    catchUp(p, T0 + 4 * HOUR);
    expect(p.poops.length).toBe(1);
    expect(act(p, 'clean', p.poops[0].id, T0 + 4 * HOUR).ok).toBe(true);
    expect(p.poops.length).toBe(0);
  });
  it('worn-out pets doze off, but stay up after the player wakes them', () => {
    const p = hatched();
    p.dna.quirk = 'snack_lover';
    p.care.energy = 17;
    catchUp(p, T0 + 2 * HOUR);
    expect(p.asleep).toBe(true);
    p.care.energy = 10;
    act(p, 'sleep', null, T0 + 2 * HOUR); // wake up
    catchUp(p, T0 + 3 * HOUR);
    expect(p.asleep).toBe(false);
  });
  it('hates_baths quirk lowers happiness', () => {
    const p = hatched();
    p.dna.quirk = 'hates_baths';
    const before = p.care.happiness;
    act(p, 'bath', null, T0);
    expect(p.care.happiness).toBeLessThan(before);
  });
});

describe('growth', () => {
  it('daily trait gain is capped (talent grows 1.5x)', () => {
    const p = hatched();
    p.dna.talent = 'playful';
    for (let i = 0; i < 50; i++) gainTrait(p, 'tough', 2.5, T0);
    expect(p.traits.tough).toBeCloseTo(DAILY_TRAIT_GAIN);
    const q = hatched();
    q.dna.talent = 'playful';
    for (let i = 0; i < 50; i++) gainTrait(q, 'playful', 2.5, T0);
    expect(q.traits.playful).toBeCloseTo(DAILY_TRAIT_GAIN * 1.5);
  });
  it('all traits share a total cap', () => {
    const p = hatched();
    for (let d = 0; d < 40; d++) for (let i = 0; i < 10; i++) gainTrait(p, 'strong', 2.5, T0 + d * DAY);
    expect(traitTotal(p)).toBeCloseTo(TRAIT_CAP);
  });
  it('evolves by playstyle: top trait = body, second = feature', () => {
    const p = hatched();
    p.traits = { tough: 5, playful: 10, strong: 20, calm: 0 };
    expect(checkEvolution(p, T0 + 12 * HOUR)).toEqual([]); // too young
    checkEvolution(p, T0 + DAY);
    expect(p.stage).toBe('teen');
    expect(p.form.top).toBe('strong');
    p.traits = { tough: 5, playful: 30, strong: 40, calm: 0 };
    checkEvolution(p, T0 + 3 * DAY);
    expect(p.stage).toBe('adult');
    expect(p.form.second).toBe('playful');
    expect(title(p)).toMatch(/Bouncy Spikeling$/);
    expect(dnaString(p)).toBe(`adult-strong-playful-${codeFromNumber(42)}`);
  });
});

describe('battle', () => {
  it('is deterministic for the same seed and moves', () => {
    const a = hatched(1);
    const b = makeFriendPet(a, '2026-10-18', 0);
    const run = () => {
      const bt = createBattle('t', a, b, 99);
      const log = [];
      while (!bt.over) log.push(...stepBattle(bt, bt.turn === 2 ? 'cheer' : null));
      return log;
    };
    expect(run()).toEqual(run());
  });
  it('weaker pets can sometimes win', () => {
    const strong = hatched(1);
    strong.traits = { tough: 20, playful: 10, strong: 30, calm: 10 };
    const weak = hatched(2);
    weak.traits = { tough: 15, playful: 10, strong: 22, calm: 10 };
    weak.dna.temperament = strong.dna.temperament = 'stubborn';
    let upsets = 0;
    for (let s = 0; s < 300; s++) {
      const bt = createBattle('t', weak, strong, s);
      while (!bt.over) {
        const y = bt.you;
        const mv = y.moves.snack && y.hp < y.stats.hp * 0.4 ? 'snack' : bt.turn === 1 ? 'cheer' : bt.turn === 4 ? 'shield' : null;
        stepBattle(bt, mv);
      }
      if (bt.winner === 'you') upsets++;
    }
    expect(upsets).toBeGreaterThan(10);
    expect(upsets).toBeLessThan(150);
  });
  it('moves are one-time only', () => {
    const a = hatched(1);
    const bt = createBattle('t', a, makeFriendPet(a, 'd', 0), 5);
    const e1 = stepBattle(bt, 'snack');
    const e2 = stepBattle(bt, 'snack');
    expect(e1.some((e) => e.type === 'move')).toBe(true);
    expect(e2.some((e) => e.type === 'move' && e.side === 'you')).toBe(false);
  });
});

describe('server API', () => {
  it('runs the full loop: egg -> hatch -> care -> battle limit', async () => {
    let clock = T0;
    const s = createServer({ storage: memStorage(), clock: () => clock });
    let r = await s.startEgg([0, 1, 0, 1, 0, 1]);
    expect(r.state.pet.stage).toBe('egg');
    expect((await s.startEgg([])).error).toBeTruthy(); // one egg per season
    for (let i = 0; i < 5; i++) r = await s.hatchTap();
    expect(r.state.pet.stage).toBe('baby');
    r = await s.act('feed');
    expect(r.result.ok).toBe(true);
    for (let i = 0; i < BATTLES_PER_DAY; i++) {
      const st = await s.startBattle(0);
      expect(st.error).toBeFalsy();
      let res;
      do res = await s.battleStep(st.battle.id, null);
      while (!res.rewards);
    }
    expect((await s.startBattle(0)).error).toMatch(/No battles left/);
  });
  it('never gives two pets the same seed', async () => {
    const st = memStorage();
    const seeds = new Set();
    const orig = Math.random;
    Math.random = () => 0.5; // force collisions
    try {
      for (let i = 0; i < 5; i++) {
        st.setItem('pocketpet.db.v1', JSON.stringify({ ...JSON.parse(st.getItem('pocketpet.db.v1') || 'null'), pets: [] }));
        const s = createServer({ storage: st, clock: () => T0 });
        const r = await s.startEgg([]);
        seeds.add(r.state.pet.dna.code);
      }
    } finally {
      Math.random = orig;
    }
    expect(seeds.size).toBe(5);
  });
  it('migrates v1 saves (numeric seed) without losing the pet', async () => {
    const st = memStorage();
    const old = newPet({ id: 'pet1', code: 'SH1-X', answers: [], now: T0 });
    old.dna = { seed: 900917, hue: 284, spots: [], mutations: [], talent: 'calm', temperament: 'stubborn', quirk: 'sleepyhead' };
    old.stage = 'baby';
    old.hatchedAt = T0;
    old.nickname = 'Bobo';
    st.setItem('pocketpet.db.v1', JSON.stringify({ version: 1, pets: [old], activeId: 'pet1', seedRegistry: [900917], battles: {}, nextId: 2 }));
    const s = createServer({ storage: st, clock: () => T0 });
    const v = (await s.getState()).state.pet;
    expect(v.nickname).toBe('Bobo');
    expect(v.dna).toMatchObject({ code: codeFromNumber(900917), talent: 'calm', quirk: 'sleepyhead' });
    expect(v.genome.species).toBe('mochi'); // old 2D Mochi pets become 3D Mochi
  });
  it('the client cannot mutate server state through returned views', async () => {
    const s = createServer({ storage: memStorage(), clock: () => T0 });
    const r = await s.startEgg([]);
    r.state.pet.traits.strong = 9999;
    expect((await s.getState()).state.pet.traits.strong).toBe(0);
  });
});
