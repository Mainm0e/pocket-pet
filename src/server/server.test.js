import { describe, it, expect } from 'vitest';
import { createServer } from './index.js';
import { createPersonality, QUIZ } from './dna.js';
import { codeFromNumber } from './genome/index.js';
import { newPet, catchUp, act, gainTrait, checkEvolution, dnaString, title, traitTotal, gainBond, obeyChance, recordVisit, wishFor, grantWish, dayKey } from './pet.js';
import { createBattle, stepBattle, makeFriendPet } from './battle.js';
import { HOUR, DAY, TRAIT_CAP, DAILY_TRAIT_GAIN, CARE_FLOOR, BATTLES_PER_DAY, BOND, MATCH_POINTS, WISHES, WISH_PATS, GREET_AWAY } from './constants.js';

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

const playMatch = (bt, strategy = () => null) => {
  const log = [];
  while (!bt.over) log.push(...stepBattle(bt, strategy(bt)));
  return log;
};
// a sensible owner: cheer a nervous pet, calm an over-excited one
const smart = (bt) => (bt.you.commanded ? null : bt.you.mood < -0.2 ? 'cheer' : bt.you.mood > 0.2 ? 'calm' : null);
function build(main, total, bond = 50) {
  const p = hatched(7);
  p.dna.temperament = 'stubborn';
  p.care = { happiness: 70, comfort: 70, health: 70, fitness: 70, energy: 70 };
  for (const k in p.traits) p.traits[k] = main === 'even' ? total / 4 : k === main ? total * 0.7 : total * 0.1;
  p.bond = bond;
  return p;
}
const winRate = (a, b, n, strategy) => {
  let w = 0;
  for (let s = 1; s <= n; s++) if (playMatch(createBattle('t', a, b, s * 7919), strategy).at(-1).winner === 'you') w++;
  return w / n;
};

describe('volleyball match', () => {
  it('is deterministic for the same seed and commands', () => {
    const a = hatched(1);
    const b = makeFriendPet(a, '2026-10-18', 0);
    const run = () => playMatch(createBattle('t', a, b, 99), (bt) => (bt.touch === 2 ? 'cheer' : null));
    expect(run()).toEqual(run());
  });
  it('ends when a side reaches the match points', () => {
    const a = hatched(1);
    const bt = createBattle('t', a, makeFriendPet(a, 'd', 1), 3);
    const log = playMatch(bt);
    expect(Math.max(bt.score.you, bt.score.foe)).toBe(MATCH_POINTS);
    expect(log.filter((e) => e.type === 'point')).toHaveLength(bt.score.you + bt.score.foe);
    expect(log.at(-1)).toEqual({ type: 'end', winner: bt.winner });
  });
  it('allows one command per point', () => {
    const a = hatched(1);
    const bt = createBattle('t', a, makeFriendPet(a, 'd', 0), 5);
    const e1 = stepBattle(bt, 'cheer');
    const mine = (es) => es.filter((e) => e.type === 'command' && e.side === 'you');
    expect(mine(e1)).toHaveLength(1);
    if (!e1.some((e) => e.type === 'point')) expect(mine(stepBattle(bt, 'calm'))).toHaveLength(0);
  });
  it('a closer bond means the pet listens more', () => {
    const listened = (bond) => {
      const p = build('even', 70, bond);
      let ok = 0;
      let asked = 0;
      for (let s = 1; s <= 200; s++) {
        const bt = createBattle('t', p, build('even', 70), s);
        for (const e of stepBattle(bt, 'cheer')) if (e.type === 'command' && e.side === 'you') (asked++, e.ok && ok++);
      }
      return ok / asked;
    };
    expect(listened(10)).toBeLessThan(0.45);
    expect(listened(90)).toBeGreaterThan(0.8);
  });
  it('good commands with a strong bond help, spamming Cheer backfires', () => {
    const foe = build('even', 70);
    const none = winRate(build('even', 70, 90), foe, 300);
    expect(winRate(build('even', 70, 90), foe, 300, smart)).toBeGreaterThan(none + 0.05);
    expect(winRate(build('even', 70, 90), foe, 300, (bt) => (bt.you.commanded ? null : 'cheer'))).toBeLessThan(none);
  });
  it('focused builds stay balanced against each other (about 40-60%)', () => {
    const B = ['strong', 'playful', 'tough', 'calm', 'even'];
    for (const T of [70, 150]) {
      for (const x of B) {
        for (const y of B) {
          if (x >= y) continue;
          // both directions, so the foe's own commands don't skew it
          const r = (winRate(build(x, T), build(y, T), 300) + 1 - winRate(build(y, T), build(x, T), 300)) / 2;
          expect(r, `${x} vs ${y} at ${T}`).toBeGreaterThan(0.35);
          expect(r, `${x} vs ${y} at ${T}`).toBeLessThan(0.65);
        }
      }
    }
  });
});

describe('bond', () => {
  it('grows with care and visits, within a daily cap', () => {
    const p = hatched(1);
    const start = p.bond;
    act(p, 'feed', null, T0 + HOUR);
    expect(p.bond).toBe(start + BOND.CARE);
    for (let i = 0; i < 40; i++) act(p, 'pat', null, T0 + 2 * HOUR);
    expect(p.bond - start).toBeLessThanOrEqual(BOND.DAILY_CAP);
    expect(p.daily.pats).toBe(BOND.PATS_PER_DAY);
    recordVisit(p, T0 + DAY);
    expect(p.daily.bond).toBe(BOND.VISIT); // a new day, a fresh cap
  });
  it('fades when the pet is neglected', () => {
    const p = hatched(1);
    p.bond = 60;
    p.lastUpdated = T0;
    catchUp(p, T0 + 4 * DAY);
    expect(p.bond).toBeLessThan(60);
  });
  it('drives the obey chance, and stubborn unhappy pets listen less', () => {
    const p = hatched(1);
    p.dna.temperament = 'cheerful';
    p.bond = 0;
    const low = obeyChance(p);
    p.bond = 100;
    expect(obeyChance(p)).toBeGreaterThan(low + 0.5);
    p.dna.temperament = 'stubborn';
    p.care.happiness = 20;
    expect(obeyChance(p)).toBeLessThan(0.7);
    expect(gainBond(p, 50, T0)).toBe(0); // already at 100
  });
});

describe('daily wish', () => {
  it('is one fixed wish per pet per day, and personality tips it', () => {
    const p = hatched(3);
    expect(wishFor(p, '2026-10-20')).toBe(wishFor(p, '2026-10-20'));
    const seen = new Set();
    for (let d = 1; d <= 28; d++) seen.add(wishFor(p, `2026-11-${String(d).padStart(2, '0')}`));
    expect(seen.size).toBeGreaterThan(3); // it changes from day to day
    const count = (quirk, kind) => {
      const q = hatched(3);
      q.dna.quirk = quirk;
      let n = 0;
      for (let d = 0; d < 300; d++) if (wishFor(q, `day${d}`) === kind) n++;
      return n;
    };
    expect(count('hates_baths', 'bath')).toBe(0);
    expect(count('snack_lover', 'feed')).toBeGreaterThan(count('night_owl', 'feed') * 2);
  });
  it('is granted once, by the right action, for bond and happiness', () => {
    const p = hatched(3);
    const day = dayKey(T0 + HOUR);
    const kind = wishFor(p, day);
    const wrong = Object.keys(WISHES).find((k) => k !== kind && k !== 'pat');
    expect(grantWish(p, wrong, T0 + HOUR)).toEqual([]);
    if (kind === 'pat') p.daily.pats = WISH_PATS;
    const bond = p.bond;
    expect(grantWish(p, kind, T0 + HOUR)).toEqual([{ type: 'wish', kind, bond: BOND.WISH }]);
    expect(p.bond).toBe(bond + BOND.WISH);
    expect(grantWish(p, kind, T0 + 2 * HOUR)).toEqual([]); // once a day
  });
  it('a pat wish needs a few pats', () => {
    const p = hatched(3);
    let day = 0;
    while (wishFor(p, dayKey(T0 + day * DAY)) !== 'pat') day++;
    const t = T0 + day * DAY;
    for (let i = 1; i < WISH_PATS; i++) {
      act(p, 'pat', null, t);
      expect(grantWish(p, 'pat', t)).toEqual([]);
    }
    act(p, 'pat', null, t);
    expect(grantWish(p, 'pat', t)).toHaveLength(1);
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
    expect((await s.startBattle(0)).error).toMatch(/No matches left/);
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
    expect(v.bond).toBeGreaterThanOrEqual(BOND.START); // v3: pets get a bond
    expect(v.bondLabel).toBeTruthy();
  });
  it('greets you when you come back after a while, and shows today\'s wish', async () => {
    let clock = T0;
    const s = createServer({ storage: memStorage(), clock: () => clock });
    await s.startEgg([]);
    for (let i = 0; i < 5; i++) await s.hatchTap();
    let r = await s.getState();
    expect(r.state.pet.wish).toMatchObject({ done: false });
    expect(WISHES[r.state.pet.wish.kind]).toBeTruthy();
    clock += 10 * 60_000;
    r = await s.getState();
    expect(r.events.some((e) => e.type === 'greet')).toBe(false); // only 10 minutes
    clock += GREET_AWAY;
    r = await s.getState();
    expect(r.events.find((e) => e.type === 'greet')).toMatchObject({ bond: r.state.pet.bond });
  });
  it('the client cannot mutate server state through returned views', async () => {
    const s = createServer({ storage: memStorage(), clock: () => T0 });
    const r = await s.startEgg([]);
    r.state.pet.traits.strong = 9999;
    expect((await s.getState()).state.pet.traits.strong).toBe(0);
  });
});
