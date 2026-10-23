// Friendly volleyball, 1 vs 1. The server plays every touch of the ball; the
// player can only Cheer or Calm their pet (once per point), and whether the pet
// listens depends on their bond. Deterministic per seed, so a resumed match
// plays out exactly as it would have.
import { mulberry32, hashString, clamp, range } from './rng.js';
import { createPersonality } from './dna.js';
import { codeFromNumber, decode } from './genome/index.js';
import { TRAITS, MATCH_POINTS } from './constants.js';
import { playStats, obeyChance, rankTraits, title, traitTotal } from './pet.js';

export const COMMANDS = ['cheer', 'calm'];
const MAX_TOUCHES = 300; // safety net; real matches end long before

// Mood runs from -1 (panicking) through 0 (focused) to +1 (hyper).
export const moodLabel = (m) => (m < -0.55 ? 'Panicking' : m < -0.2 ? 'Nervous' : m <= 0.2 ? 'Focused' : m <= 0.55 ? 'Excited' : 'Hyper');
const START_MOOD = { bold: 0.05, shy: -0.05, cheerful: 0.05, stubborn: 0 };
const DRIFT = { bold: 0.01, shy: -0.01, cheerful: 0.01, stubborn: 0 }; // where each temperament leans

function player(pet, owner) {
  return {
    owner,
    name: pet.nickname || 'Pup',
    title: title(pet),
    stats: playStats(pet),
    temperament: pet.dna.temperament,
    obey: obeyChance(pet),
    mood: START_MOOD[pet.dna.temperament] ?? 0,
    commanded: false, // one command per point
    streak: 0,
  };
}

export function createBattle(id, you, foe, seed) {
  const a = player(you, 'you');
  const b = player(foe, 'foe');
  return {
    id,
    seed,
    touch: 0,
    score: { you: 0, foe: 0 },
    // the quicker pet serves first; after that the winner of each point serves
    rally: { hitter: a.stats.speed >= b.stats.speed ? 'you' : 'foe', incoming: null, shot: null, touches: 0 },
    you: a,
    foe: b,
    over: false,
    winner: null,
  };
}

const other = (s) => (s === 'you' ? 'foe' : 'you');
const nudge = (f, d) => (f.mood = clamp(f.mood + d, -1, 1));

function command(f, cmd, rng, events) {
  if (f.commanded || !COMMANDS.includes(cmd)) return;
  f.commanded = true;
  if (rng() >= f.obey) {
    // Not listening. A pet that doesn't trust you yet may sulk a little, too.
    const sulk = f.obey < 0.5 && rng() < 0.4;
    if (sulk) nudge(f, -0.15);
    events.push({ type: 'command', side: f.owner, cmd, ok: false, sulk, mood: f.mood });
    return;
  }
  if (cmd === 'cheer') nudge(f, 0.5);
  else f.mood *= 0.2; // calm: back toward focused, from either side
  events.push({ type: 'command', side: f.owner, cmd, ok: true, mood: f.mood });
}

function foeAI(f, rng, events) {
  if (!f.commanded && Math.abs(f.mood) > 0.4 && rng() < 0.5) command(f, f.mood < 0 ? 'cheer' : 'calm', rng, events);
}

/**
 * How hard a shot is to return: Power hits it hard, Focus puts it where the other pet isn't.
 * Excited pets hit harder, nervous ones softer.
 */
function shotPower(f, shot, rng, touches) {
  const kind = shot === 'spike' ? 1.25 : shot === 'serve' ? 0.62 : 0.6;
  const fatigue = 1 + Math.max(0, touches - 8) * 0.08; // long rallies get wilder
  const skill = 0.3 + f.stats.power / 140 + f.stats.focus / 180;
  return skill * (1 + 0.3 * f.mood) * kind * range(rng, 0.8, 1.2) * fatigue;
}

/** Chance to hit it out or into the net: over-excited pets get sloppy, focused ones stay clean. */
function faultChance(f, shot) {
  return clamp(0.03 + 0.3 * Math.max(0, f.mood) ** 2 + (shot === 'spike' ? 0.05 : 0) - f.stats.focus / 800, 0.01, 0.4);
}

/** Chance to get to an incoming ball. Nervous pets freeze up. */
function returnChance(f, incoming) {
  const reach = (f.stats.receive * 0.6 + f.stats.speed * 0.4) / 40;
  return clamp(1 - 0.6 * incoming ** 2 + (reach - 0.55) * 0.4 - 0.45 * Math.max(0, -f.mood) - 0.08 * Math.max(0, f.mood), 0.1, 0.99);
}

function scorePoint(b, side, how, events) {
  const w = b[side];
  const l = b[other(side)];
  b.score[side]++;
  w.streak++;
  l.streak = 0;
  // Winning lifts the mood (a streak lifts it more), losing makes nerves. Focus keeps both steady.
  nudge(w, (0.14 + 0.06 * Math.min(3, w.streak - 1)) * (1 - w.stats.focus / 150) + DRIFT[w.temperament]);
  nudge(l, -0.28 * (1 - l.stats.focus / 150) + DRIFT[l.temperament]);
  for (const f of [w, l]) {
    f.mood *= 0.92; // and everyone settles a little between points
    f.commanded = false;
  }
  b.rally = { hitter: side, incoming: null, shot: null, touches: 0 };
  events.push({ type: 'point', side, how, score: { ...b.score }, mood: { you: b.you.mood, foe: b.foe.mood } });
  if (b.score[side] >= MATCH_POINTS) {
    b.over = true;
    b.winner = side;
    events.push({ type: 'end', winner: side });
  }
}

/** Play one touch of the ball. `cmd` is the player's command for this touch, if any. */
export function stepBattle(b, cmd) {
  if (b.over) return [];
  const rng = mulberry32(b.seed + b.touch * 101);
  const events = [];
  if (cmd) command(b.you, cmd, rng, events);
  foeAI(b.foe, rng, events);

  const r = b.rally;
  const side = r.hitter;
  const h = b[side];
  b.touch++;
  r.touches++;
  let shot = 'serve';
  if (r.incoming != null) {
    // receive first: miss it and the other side scores
    if (rng() >= returnChance(h, r.incoming)) {
      events.push({ type: 'miss', side });
      scorePoint(b, other(side), r.shot === 'serve' ? 'ace' : r.shot === 'spike' ? 'kill' : 'drop', events);
      return events;
    }
    // a clean receive lets it set itself up for a spike, a scramble only bumps it back
    shot = rng() < 0.25 + h.stats.speed / 200 + (1 - r.incoming) * 0.3 ? 'spike' : 'bump';
  }
  if (rng() < faultChance(h, shot)) {
    const fault = rng() < 0.5 ? 'net' : 'out';
    events.push({ type: 'hit', side, shot, fault, aim: +range(rng, -1, 1).toFixed(2) });
    scorePoint(b, other(side), fault, events);
    return events;
  }
  const power = shotPower(h, shot, rng, r.touches);
  events.push({ type: 'hit', side, shot, power: +power.toFixed(2), aim: +range(rng, -1, 1).toFixed(2) });
  b.rally = { hitter: other(side), incoming: power, shot, touches: r.touches };
  if (b.touch >= MAX_TOUCHES && !b.over) {
    b.over = true;
    b.winner = b.score.you > b.score.foe ? 'you' : 'foe';
    events.push({ type: 'end', winner: b.winner });
  }
  return events;
}

// ---------- simulated friends (until real friends arrive with the backend) ----------
const FRIENDS = ['Kai', 'Mina', 'Jules', 'Rio', 'Noor', 'Sam', 'Lumi', 'Teo', 'Ada', 'Yuki'];
const PET_NAMES = ['Puff', 'Bean', 'Dumpling', 'Pip', 'Taro', 'Boba', 'Nori', 'Squish', 'Jelly', 'Tofu'];

export function makeFriendPet(pet, day, i) {
  const seed = hashString(`${pet.id}:${day}:${i}`) % 999999 + 1;
  const rng = mulberry32(seed ^ 0x5eed);
  const code = codeFromNumber(seed);
  const dna = { code, ...createPersonality(code, []) };
  const total = traitTotal(pet) * range(rng, 0.85, 1.15);
  const w = TRAITS.map((t) => rng() + (t === dna.talent ? 0.6 : 0));
  const ws = w.reduce((s, x) => s + x, 0);
  const traits = Object.fromEntries(TRAITS.map((t, k) => [t, (total * w[k]) / ws]));
  const ranked = rankTraits(traits, dna.talent);
  const care = Object.fromEntries(
    ['happiness', 'comfort', 'health', 'fitness', 'energy'].map((k) => [k, Math.round(range(rng, 50, 95))])
  );
  return {
    id: `friend-${seed}`,
    owner: FRIENDS[(seed >> 3) % FRIENDS.length],
    nickname: PET_NAMES[(seed >> 7) % PET_NAMES.length],
    species: decode(code).species,
    stage: pet.stage,
    dna,
    traits,
    care,
    bond: Math.round(range(rng, 35, 85)),
    vivid: range(rng, 0.45, 0.95),
    asleep: false,
    marks: rng() < 0.4 && pet.stage !== 'baby' ? ['star'] : [],
    form: {
      top: pet.stage === 'baby' ? null : ranked[0],
      second: pet.stage === 'adult' ? ranked[1] : null,
    },
  };
}
