import { mulberry32, hashString, clamp } from './rng.js';
import { createPersonality } from './dna.js';
import { decode } from './genome/index.js';
import {
  HOUR, DAY, CARE_KEYS, CARE_FLOOR, CARE_MAX, TRAITS, TRAIT_CAP, DAILY_TRAIT_GAIN, TALENT_MULT,
  HATCH_TAPS, TEEN_AGE, TEEN_TRAITS, ADULT_AGE, ADULT_TRAITS, MAX_CATCHUP, MAX_POOPS, FORMS, SEASON,
} from './constants.js';

// ---------- time helpers (player's local day) ----------
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isNight(ts) {
  const h = new Date(ts).getHours();
  return h >= 20 || h < 6;
}
export function weatherFor(ts) {
  const r = hashString('weather:' + dayKey(ts)) % 100;
  return r < 25 ? 'rain' : r < 45 ? 'cloudy' : 'sun';
}

// ---------- creation ----------
/** The pet's full DNA, recomputed from its seed code (never stored, so it can't be edited). */
export const genomeOf = (pet) => decode(pet.dna.code);

export function newPet({ id, code, answers, now }) {
  return {
    id,
    species: decode(code).species,
    season: SEASON.id,
    nickname: '',
    createdAt: now,
    hatchedAt: null,
    stage: 'egg',
    hatchTaps: 0,
    dna: { code: decode(code).code, ...createPersonality(code, answers) },
    care: { happiness: 80, comfort: 80, health: 85, fitness: 60, energy: 90 },
    traits: { tough: 0, playful: 0, strong: 0, calm: 0 },
    vivid: 0.6,
    asleep: false,
    sleepStart: null,
    wokeAt: null,
    lastFed: now,
    lastBath: 0,
    feedLog: [],
    nextPoopAt: null,
    poops: [],
    poopCount: 0,
    marks: [],
    badges: [],
    form: { top: null, second: null },
    evolvedAt: {},
    battle: { wins: 0, losses: 0, streak: 0, bestStreak: 0, played: 0, seasonWins: 0 },
    daily: { day: null, traitGain: 0, battles: 0 },
    visits: { lastDay: null, streak: 0 },
    lastUpdated: now,
  };
}

// ---------- traits ----------
export const traitTotal = (pet) => TRAITS.reduce((s, t) => s + pet.traits[t], 0);

export function rankTraits(traits, talent) {
  return [...TRAITS].sort((a, b) => {
    const d = traits[b] - traits[a];
    if (Math.abs(d) > 1e-9) return d;
    if (a === talent) return -1;
    if (b === talent) return 1;
    return TRAITS.indexOf(a) - TRAITS.indexOf(b);
  });
}

function ensureDay(pet, t) {
  const key = dayKey(t);
  if (pet.daily.day !== key) pet.daily = { day: key, traitGain: 0, battles: 0 };
}

/** Grow a trait within the daily gate and the shared total cap. Returns amount gained. */
export function gainTrait(pet, trait, base, t) {
  if (pet.stage === 'egg') return 0;
  ensureDay(pet, t);
  const mult = pet.dna.talent === trait ? TALENT_MULT : 1;
  const dailyLeft = Math.max(0, DAILY_TRAIT_GAIN - pet.daily.traitGain);
  const capLeft = Math.max(0, TRAIT_CAP - traitTotal(pet));
  const give = Math.min(base * mult, dailyLeft * mult, capLeft);
  if (give <= 0) return 0;
  pet.traits[trait] += give;
  pet.daily.traitGain += give / mult;
  return give;
}

// ---------- care ----------
function clampCare(pet) {
  for (const k of CARE_KEYS) pet.care[k] = clamp(pet.care[k], CARE_FLOOR, CARE_MAX);
}
const careAvg = (pet) => CARE_KEYS.reduce((s, k) => s + pet.care[k], 0) / CARE_KEYS.length;

function spawnPoop(pet, t) {
  const rng = mulberry32(genomeOf(pet).hash + pet.poopCount * 7919);
  pet.poopCount++;
  pet.poops.push({ id: `p${pet.poopCount}`, x: Math.round(10 + rng() * 80), y: +rng().toFixed(2), t });
  pet.nextPoopAt = t + (3 + rng() * 2) * HOUR;
}

function step(pet, t, h, events) {
  const c = pet.care;
  const q = pet.dna.quirk;
  const night = isNight(t);
  const rain = weatherFor(t) === 'rain';
  const hungry = t - pet.lastFed > 8 * HOUR;
  const mess = pet.poops.length * h * (q === 'neat_freak' ? 2 : 1);

  if (pet.asleep) {
    c.energy += 14 * h * (q === 'sleepyhead' ? 1.3 : 1);
    c.happiness -= 0.8 * h;
    c.comfort -= 0.8 * h + mess;
    c.fitness -= 0.6 * h;
    c.health -= (hungry ? 1.2 : 0.2) * h;
    gainTrait(pet, 'calm', 0.5 * h, t); // restful sleep builds Calm
    const slept = t - pet.sleepStart;
    if (c.energy >= CARE_MAX && (!night || slept > 10 * HOUR)) {
      pet.asleep = false;
      pet.sleepStart = null;
      pet.wokeAt = t;
      events.push({ type: 'woke' });
    }
  } else {
    c.energy -= 2.5 * h * (q === 'sleepyhead' ? 1.25 : 1) * (q === 'night_owl' && night ? 0.6 : 1);
    c.happiness -= 2 * h * (q === 'loves_rain' && rain ? 0.5 : 1) + (c.energy < 20 ? h : 0);
    c.comfort -= 1.5 * h + mess;
    c.fitness -= h;
    c.health -= (hungry ? 1.5 : 0.4) * h + (c.comfort < 25 ? 0.5 * h : 0);
    // Pets put themselves to bed when worn out, so nobody comes back to a wreck.
    if (c.energy <= 15 && t - (pet.wokeAt ?? 0) > 2 * HOUR) {
      pet.asleep = true;
      pet.sleepStart = t;
    }
  }

  if (pet.nextPoopAt && t >= pet.nextPoopAt) {
    if (pet.poops.length < MAX_POOPS && t - pet.lastFed < 12 * HOUR) spawnPoop(pet, t);
    else pet.nextPoopAt = t + 3 * HOUR;
  }

  clampCare(pet);
  // Colour vividness follows care quality slowly (~2 day time constant).
  pet.vivid = clamp(pet.vivid + (careAvg(pet) / 100 - pet.vivid) * Math.min(1, h / 48), 0, 1);
}

/** Apply everything that happened since the last sync. No timers run anywhere. */
export function catchUp(pet, now) {
  const events = [];
  if (pet.stage === 'egg') {
    pet.lastUpdated = now;
    return events;
  }
  let t = Math.max(pet.lastUpdated, now - MAX_CATCHUP);
  const STEP = HOUR / 6;
  while (t < now) {
    const dt = Math.min(STEP, now - t);
    step(pet, t, dt / HOUR, events);
    t += dt;
  }
  pet.lastUpdated = Math.max(pet.lastUpdated, now);
  return events;
}

export function recordVisit(pet, now) {
  const events = [];
  if (pet.stage === 'egg') return events;
  const key = dayKey(now);
  if (pet.visits.lastDay === key) return events;
  pet.visits.streak = pet.visits.lastDay === dayKey(now - DAY) ? pet.visits.streak + 1 : 1;
  pet.visits.lastDay = key;
  if (pet.visits.streak >= 3) addMark(pet, 'sun', events);
  if (pet.visits.streak >= 7) addMark(pet, 'rainbow', events);
  return events;
}

export function addMark(pet, mark, events) {
  if (pet.marks.includes(mark)) return;
  pet.marks.push(mark);
  events?.push({ type: 'mark', mark });
}

// ---------- growth ----------
export function checkEvolution(pet, now) {
  const age = pet.hatchedAt ? now - pet.hatchedAt : 0;
  const total = traitTotal(pet);
  const ranked = rankTraits(pet.traits, pet.dna.talent);
  if (pet.stage === 'baby' && age >= TEEN_AGE && total >= TEEN_TRAITS) {
    pet.stage = 'teen';
    pet.form.top = ranked[0];
    pet.evolvedAt.teen = now;
    return [{ type: 'evolved', from: 'baby', to: 'teen' }];
  }
  if (pet.stage === 'teen' && age >= ADULT_AGE && total >= ADULT_TRAITS) {
    pet.stage = 'adult';
    pet.form.second = ranked.find((t) => t !== pet.form.top);
    pet.evolvedAt.adult = now;
    const events = [{ type: 'evolved', from: 'teen', to: 'adult' }];
    if (pet.vivid >= 0.75) addMark(pet, 'aura', events);
    return events;
  }
  return [];
}

export function growthProgress(pet, now) {
  if (pet.stage === 'egg') return { next: 'baby', taps: pet.hatchTaps, need: HATCH_TAPS };
  if (pet.stage === 'adult') return null;
  const age = now - pet.hatchedAt;
  const [needAge, needTraits, next] =
    pet.stage === 'baby' ? [TEEN_AGE, TEEN_TRAITS, 'teen'] : [ADULT_AGE, ADULT_TRAITS, 'adult'];
  return {
    next,
    age: Math.min(1, age / needAge),
    traits: Math.min(1, traitTotal(pet) / needTraits),
    readyIn: Math.max(0, needAge - age),
    traitsNeeded: Math.max(0, Math.ceil(needTraits - traitTotal(pet))),
  };
}

// ---------- identity ----------
export function title(pet) {
  const g = genomeOf(pet);
  const shiny = g.mutations.includes('shiny') ? 'Shiny ' : '';
  if (pet.stage === 'egg') return `${g.speciesLabel} egg`;
  if (pet.stage === 'baby') return `${shiny}Baby ${g.speciesLabel}`;
  const forms = g.forms ?? FORMS;
  if (pet.stage === 'teen') return `${shiny}${forms[pet.form.top].noun}`;
  return `${shiny}${forms[pet.form.second].adj} ${forms[pet.form.top].noun}`;
}

export function dnaString(pet) {
  const g = genomeOf(pet);
  const parts = [pet.stage];
  if (pet.form.top) parts.push(pet.form.top);
  if (pet.form.second) parts.push(pet.form.second);
  parts.push(g.code, ...g.mutations, ...pet.marks);
  return parts.join('-').toLowerCase().replace(g.code.toLowerCase(), g.code);
}

// ---------- mood & battle stats ----------
export function moodModifier(pet) {
  let m = clamp(((careAvg(pet) - 60) / 40) * 0.1, -0.1, 0.1);
  if (pet.dna.temperament === 'cheerful' && m > 0) m *= 2;
  return +m.toFixed(3);
}

export function battleStats(pet) {
  const t = pet.traits;
  const mood = 1 + moodModifier(pet);
  const temp = pet.dna.temperament;
  return {
    hp: Math.round(100 + t.tough * 1.15 + t.calm * 0.5),
    atk: +((14 + t.strong * 0.2 + t.playful * 0.1) * (temp === 'bold' ? 1.1 : 1) * mood).toFixed(1),
    def: +((10 + t.calm * 0.26 + t.tough * 0.05) * (temp === 'shy' ? 1.15 : 1) * mood).toFixed(1),
    spd: +(10 + t.playful * 0.3 + t.strong * 0.03).toFixed(1),
  };
}

// ---------- care actions ----------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleepingReply = { ok: false, say: 'Zzz...', fx: 'sleep' };

export function act(pet, action, arg, now) {
  const c = pet.care;
  const q = pet.dna.quirk;
  ensureDay(pet, now);
  let res;
  switch (action) {
    case 'feed': {
      if (pet.asleep) return sleepingReply;
      pet.feedLog = pet.feedLog.filter((ts) => now - ts < 3 * HOUR);
      if (pet.feedLog.length >= 3) {
        c.health -= 4;
        c.happiness -= 2;
        res = { ok: false, say: 'Too full...', fx: 'refuse' };
        break;
      }
      c.health += 10;
      c.energy += 6;
      c.happiness += q === 'snack_lover' ? 10 : 4;
      pet.lastFed = now;
      pet.feedLog.push(now);
      if (!pet.nextPoopAt || pet.nextPoopAt < now) pet.nextPoopAt = now + 3 * HOUR;
      const g = gainTrait(pet, 'tough', 2.5, now);
      res = { ok: true, say: pick(['Yum!', 'Nom nom!', 'Delicious!']), fx: 'eat', gain: { tough: g } };
      break;
    }
    case 'play': {
      if (pet.asleep) return sleepingReply;
      if (c.energy < 15) return { ok: false, say: 'Too tired...', fx: 'refuse' };
      c.happiness += 14;
      c.fitness += 6;
      c.energy -= 10;
      c.comfort -= 2;
      const g = gainTrait(pet, 'playful', 2.5, now);
      res = { ok: true, say: pick(['Wheee!', 'Again! Again!', 'So fun!']), fx: 'jump', gain: { playful: g } };
      break;
    }
    case 'train': {
      if (pet.asleep) return sleepingReply;
      if (c.energy < 20) return { ok: false, say: 'Need a nap first...', fx: 'refuse' };
      c.fitness += 12;
      c.energy -= 14;
      c.health += 2;
      c.happiness += pet.dna.temperament === 'bold' ? 2 : -2;
      const g = gainTrait(pet, 'strong', 2.5, now);
      res = { ok: true, say: pick(['Hup! Hup!', 'Feel the burn!', 'One more!']), fx: 'train', gain: { strong: g } };
      break;
    }
    case 'bath': {
      if (pet.asleep) return sleepingReply;
      if (now - pet.lastBath < 2 * HOUR) return { ok: false, say: 'Already squeaky clean!', fx: 'refuse' };
      pet.lastBath = now;
      c.comfort += 25;
      c.health += 4;
      const hates = q === 'hates_baths';
      c.happiness += hates ? -8 : 4;
      const g = gainTrait(pet, 'calm', 2, now);
      res = { ok: true, say: hates ? 'Hmph! I hate baths!' : 'Bubbles!', fx: 'bath', gain: { calm: g } };
      break;
    }
    case 'sleep': {
      if (pet.asleep) {
        pet.asleep = false;
        pet.sleepStart = null;
        pet.wokeAt = now;
        if (c.energy < 50) {
          c.happiness -= 5;
          res = { ok: true, say: 'Five more minutes...', fx: 'wake' };
        } else res = { ok: true, say: 'Good morning!', fx: 'wake' };
        break;
      }
      if (c.energy > 90) return { ok: false, say: 'Not sleepy!', fx: 'refuse' };
      pet.asleep = true;
      pet.sleepStart = now;
      res = { ok: true, say: 'Zzz...', fx: 'sleep' };
      break;
    }
    case 'clean': {
      const i = pet.poops.findIndex((p) => p.id === arg);
      if (i < 0) return { ok: false };
      pet.poops.splice(i, 1);
      c.comfort += 6;
      if (q === 'neat_freak') c.happiness += 4;
      const g = gainTrait(pet, 'calm', 1, now);
      res = { ok: true, say: q === 'neat_freak' ? 'Ahh, tidy!' : null, fx: 'clean', gain: { calm: g } };
      break;
    }
    default:
      return { ok: false };
  }
  clampCare(pet);
  return res;
}

export function hatchTap(pet, now) {
  if (pet.stage !== 'egg') return { events: [] };
  pet.hatchTaps++;
  if (pet.hatchTaps < HATCH_TAPS) return { events: [{ type: 'crack', taps: pet.hatchTaps }] };
  pet.stage = 'baby';
  pet.hatchedAt = now;
  pet.lastUpdated = now;
  pet.lastFed = now;
  pet.daily = { day: dayKey(now), traitGain: 0, battles: 0 };
  return { events: [{ type: 'hatched' }, ...recordVisit(pet, now)] };
}
