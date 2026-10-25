// "Server" for the prototype. It runs in the browser for now, but the UI talks
// to it only through this async API and only ever receives read-only views.
// Moving to Supabase means porting these handlers to Edge Functions and
// swapping `storage` for Postgres; the client code stays the same.

import { hashString, mulberry32 } from './rng.js';
import {
  SEASON, BATTLES_PER_DAY, TRAIT_CAP, DAILY_TRAIT_GAIN, TALENT_MULT, DAY, BOND, MATCH_POINTS, bondLabel,
  WISHES, WISH_PATS, GREET_AWAY,
} from './constants.js';
import {
  newPet, catchUp, recordVisit, checkEvolution, act as petAct, hatchTap as petHatchTap,
  title, dnaString, playStats, obeyChance, moodModifier, growthProgress, traitTotal, dayKey,
  weatherFor, isNight, addMark, genomeOf, gainBond, freshDaily, wishFor, grantWish, forecast,
} from './pet.js';
import { decode, randomCode, nudgeCode, codeFromNumber, normalizeCode } from './genome/index.js';
import { createBattle, stepBattle, makeFriendPet } from './battle.js';
import { sanitizeRoom, DEFAULT_ROOM } from './room.js';

const KEY = 'pocketpet.db.v1';
const DB_VERSION = 3;
export const BADGES = {
  streak3: { label: 'Hot streak', desc: '3 wins in a row' },
  streak5: { label: 'Unstoppable', desc: '5 wins in a row' },
};

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

function freshDB() {
  return { version: DB_VERSION, pets: [], activeId: null, seedRegistry: [], battles: {}, devOffset: 0, nextId: 1 };
}

/** v1 saves had numeric seeds and 2D Mochi looks. Give them a seed code, keep personality and history. */
function migrate(db) {
  if ((db.version ?? 1) < 2) {
    for (const p of db.pets) {
      if (p.dna && !p.dna.code) {
        const { talent, temperament, quirk, seed } = p.dna;
        p.dna = { code: codeFromNumber(seed ?? 1, 'MO1'), talent, temperament, quirk }; // v1 pets were gen 1
        p.species = decode(p.dna.code).species;
      }
    }
    db.seedRegistry = db.pets.map((p) => p.dna.code);
    db.battles = {};
    db.version = 2;
  }
  if (db.version < 3) {
    // v3: the bond stat, and battles became volleyball matches (old fights can't resume).
    for (const p of db.pets) {
      const days = p.hatchedAt ? (p.lastUpdated - p.hatchedAt) / DAY : 0;
      p.bond ??= Math.round(Math.min(50, BOND.START + days * 4 + (p.visits?.streak ?? 0) * 2));
      p.daily = { ...freshDaily(p.daily?.day ?? null), ...p.daily };
    }
    db.battles = {};
    db.version = 3;
  }
  return db;
}

export function createServer({ storage, clock = () => Date.now() } = {}) {
  let db;
  try {
    db = migrate({ ...freshDB(), version: 1, ...JSON.parse(storage.getItem(KEY)) });
    if (!storage.getItem(KEY)) db.version = DB_VERSION;
  } catch {
    db = freshDB();
  }
  const now = () => clock() + (db.devOffset || 0);
  const save = () => {
    try {
      storage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* storage full or blocked: keep playing in memory */
    }
  };
  const active = () => db.pets.find((p) => p.id === db.activeId) || null;

  function sync(pet, t) {
    if (!pet) return [];
    return [...catchUp(pet, t), ...recordVisit(pet, t), ...checkEvolution(pet, t)];
  }

  function viewPet(pet, t) {
    if (!pet) return null;
    const v = clone(pet);
    delete v.feedLog;
    delete v.nextPoopAt;
    delete v.poopCount;
    v.title = title(pet);
    v.dnaString = dnaString(pet);
    v.traitTotal = traitTotal(pet);
    v.traitCap = TRAIT_CAP;
    v.dailyTraitLeft = Math.max(0, DAILY_TRAIT_GAIN - (pet.daily.day === dayKey(t) ? pet.daily.traitGain : 0));
    v.talentMult = TALENT_MULT;
    v.playStats = pet.stage === 'egg' ? null : playStats(pet);
    v.bondLabel = bondLabel(pet.bond);
    v.obey = obeyChance(pet);
    if (pet.stage !== 'egg') {
      const kind = wishFor(pet, dayKey(t));
      const done = pet.daily.day === dayKey(t) && pet.daily.wishDone;
      v.wish = { kind, ...WISHES[kind], done, pats: kind === 'pat' ? Math.min(WISH_PATS, pet.daily.day === dayKey(t) ? pet.daily.pats : 0) : null, need: WISH_PATS };
    }
    delete v.lastSeen;
    v.mood = moodModifier(pet);
    v.growth = growthProgress(pet, t);
    v.battlesLeft = BATTLES_PER_DAY - (pet.daily.day === dayKey(t) ? pet.daily.battles : 0);
    v.ageMs = pet.hatchedAt ? t - pet.hatchedAt : 0;
    v.genome = genomeOf(pet);
    return v;
  }

  function state(t = now()) {
    return {
      now: t,
      season: SEASON,
      matchPoints: MATCH_POINTS,
      weather: weatherFor(t),
      night: isNight(t),
      pet: viewPet(active(), t),
      pets: db.pets.map((p) => ({ id: p.id, title: title(p), nickname: p.nickname, stage: p.stage })),
      canStartEgg: !db.pets.some((p) => p.season === SEASON.id),
      room: db.room ?? DEFAULT_ROOM,
      devOffset: db.devOffset,
    };
  }

  /** The player was here (the dev clock skipping ahead doesn't count). */
  function seen(pet = active()) {
    if (pet && pet.stage !== 'egg') pet.lastSeen = now();
  }

  function respond(events = [], extra = {}) {
    save();
    return Promise.resolve(clone({ state: state(), events, ...extra }));
  }

  function uniqueCode(wanted) {
    let code = wanted ? normalizeCode(wanted) : randomCode();
    // Never hand out the same DNA twice: nudge the code until it is free.
    while (db.seedRegistry.includes(code)) code = nudgeCode(code);
    db.seedRegistry.push(code);
    return code;
  }

  function addEgg(answers, code) {
    const t = now();
    const answerIdx = Array.isArray(answers) ? answers.map((a) => (a === 1 ? 1 : 0)) : [];
    const pet = newPet({ id: `pet${db.nextId++}`, code: uniqueCode(code), answers: answerIdx, now: t });
    db.pets.push(pet);
    db.activeId = pet.id;
    return pet;
  }

  return {
    getState() {
      const pet = active();
      const t = now();
      const events = sync(pet, t);
      // Back after a while? The pet greets you (how warmly depends on the bond).
      if (pet && pet.stage !== 'egg') {
        if (pet.lastSeen && t - pet.lastSeen >= GREET_AWAY && !pet.asleep) events.push({ type: 'greet', away: t - pet.lastSeen, bond: pet.bond });
        seen(pet);
      }
      return respond(events);
    },

    startEgg(answers) {
      if (!state().canStartEgg) return respond([], { error: 'You already have this season’s egg.' });
      const pet = addEgg(answers);
      const g = genomeOf(pet);
      const events = [{ type: 'egg' }];
      if (g.speciesOdds !== null && g.speciesOdds < 0.001) events.push({ type: 'rareSpecies', species: g.speciesLabel, odds: g.speciesOdds });
      return respond(events);
    },

    hatchTap() {
      const pet = active();
      if (!pet) return respond();
      const events = petHatchTap(pet, now()).events;
      seen(pet);
      return respond(events);
    },

    rename(name) {
      const pet = active();
      const clean = String(name ?? '').replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 14);
      if (pet && clean) pet.nickname = clean;
      return respond();
    },

    act(action, arg) {
      const pet = active();
      if (!pet || pet.stage === 'egg') return respond();
      const t = now();
      const events = sync(pet, t);
      const result = petAct(pet, action, arg, t);
      if (result?.ok) events.push(...grantWish(pet, action, t));
      seen(pet);
      events.push(...checkEvolution(pet, t));
      return respond(events, { result });
    },

    opponents() {
      const pet = active();
      if (!pet || pet.stage === 'egg') return Promise.resolve({ friends: [], board: [] });
      const t = now();
      const day = dayKey(t);
      const friends = [0, 1, 2].map((i) => {
        const f = makeFriendPet(pet, day, i);
        return { ...f, title: title(f), playStats: playStats(f), genome: genomeOf(f) };
      });
      // Friends-only seasonal leaderboard (simulated friends for now).
      const board = friends
        .map((f) => ({ name: `${f.owner}'s ${f.nickname}`, wins: Math.floor(mulberry32(hashString(`${f.owner}:${SEASON.id}`))() * 12) }))
        .concat([{ name: `${pet.nickname || genomeOf(pet).name} (you)`, wins: pet.battle.seasonWins, you: true }])
        .sort((a, b) => b.wins - a.wins);
      return Promise.resolve(clone({ friends, board }));
    },

    startBattle(friendIndex) {
      const pet = active();
      if (!pet || pet.stage === 'egg') return respond([], { error: 'Hatch your egg first!' });
      const t = now();
      const events = sync(pet, t);
      // Resume an unfinished battle instead of letting the player re-roll it.
      const existing = Object.values(db.battles).find((b) => b.petId === pet.id);
      if (existing) return respond(events, { battle: existing.battle, foe: existing.foe });
      if (pet.asleep) return respond(events, { error: 'Shh... your pet is sleeping.' });
      if (pet.daily.battles >= BATTLES_PER_DAY) return respond(events, { error: 'No matches left today. Come back tomorrow!' });
      const idx = Math.max(0, Math.min(2, friendIndex | 0));
      const foePet = makeFriendPet(pet, dayKey(t), idx);
      pet.daily.battles++;
      pet.battle.played++;
      const id = `b${t}`;
      const battle = createBattle(id, pet, foePet, (Math.random() * 2 ** 31) | 0);
      battle.you.name = pet.nickname || genomeOf(pet).name;
      const foe = { ...foePet, title: title(foePet), genome: genomeOf(foePet) };
      db.battles[id] = { petId: pet.id, battle, foe };
      return respond(events, { battle, foe });
    },

    /** Play one touch of the match. `cmd` ('cheer' | 'calm') is the player's only input. */
    battleStep(id, cmd) {
      const entry = db.battles[id];
      if (!entry) return respond([], { error: 'Match not found' });
      const { battle } = entry;
      const events = stepBattle(battle, cmd);
      let rewards = null;
      if (battle.over) {
        delete db.battles[id];
        const pet = db.pets.find((p) => p.id === entry.petId);
        const t = now();
        sync(pet, t);
        rewards = { marks: [], badges: [] };
        const markEvents = [];
        const b = pet.battle;
        if (battle.winner === 'you') {
          b.wins++;
          b.seasonWins++;
          b.streak++;
          b.bestStreak = Math.max(b.bestStreak, b.streak);
          pet.care.happiness = Math.min(100, pet.care.happiness + 6);
          if (b.wins >= 1) addMark(pet, 'star', markEvents);
          if (b.wins >= 3) addMark(pet, 'scar', markEvents);
          for (const [badge, n] of [['streak3', 3], ['streak5', 5]]) {
            if (b.streak >= n && !pet.badges.includes(badge)) {
              pet.badges.push(badge);
              rewards.badges.push(badge);
            }
          }
        } else {
          b.losses++;
          b.streak = 0;
          pet.care.happiness = Math.max(5, pet.care.happiness - 3);
        }
        pet.care.energy = Math.max(5, pet.care.energy - 6);
        rewards.bond = gainBond(pet, BOND.MATCH, t);
        rewards.wish = grantWish(pet, 'match', t).length > 0;
        rewards.marks = markEvents.map((e) => e.mark);
        rewards.winner = battle.winner;
        rewards.record = clone(b);
      }
      return respond(events, { battle, rewards });
    },

    /** What the pet will need next (for reminders). Read-only: it replays the rules on a copy. */
    forecast() {
      const pet = active();
      if (!pet || pet.stage === 'egg') return respond([], { forecast: [] });
      const t = now();
      const events = sync(pet, t);
      const wish = pet.stage !== 'egg' ? WISHES[wishFor(pet, dayKey(t))] : null;
      // the clock the forecast uses (dev mode can move it); the device needs real times
      const shift = db.devOffset || 0;
      return respond(events, {
        forecast: forecast(pet, t).map((r) => ({ ...r, at: r.at - shift })),
        name: pet.nickname || genomeOf(pet).name,
        wish: wish?.label ?? null,
      });
    },

    /** Save the room layout (cosmetic). Anything invalid is fixed, never stored as-is. */
    saveRoom(layout) {
      db.room = sanitizeRoom(layout);
      return respond();
    },

    // Prototype-only helpers (hidden behind ?dev in the UI).
    devWarp(ms) {
      const pet = active();
      if (pet) sync(pet, now()); // settle the present before jumping
      db.devOffset = (db.devOffset || 0) + ms;
      return respond(sync(active(), now()));
    },
    /** Seed Lab helper: adopt a specific code as a fresh egg (replaces the season pet). */
    devAdopt(code, answers = []) {
      db.pets = db.pets.filter((p) => p.season !== SEASON.id);
      db.seedRegistry = db.seedRegistry.filter((c) => db.pets.some((p) => p.dna.code === c));
      addEgg(answers, code);
      return respond([{ type: 'egg' }]);
    },
    devReset() {
      db = freshDB();
      return respond();
    },
    DAY,
  };
}
