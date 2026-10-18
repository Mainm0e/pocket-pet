import { mulberry32, hashString, clamp, range } from './rng.js';
import { createPersonality } from './dna.js';
import { codeFromNumber, decode } from './genome/index.js';
import { TRAITS } from './constants.js';
import { battleStats, rankTraits, title, traitTotal } from './pet.js';

const MAX_TURNS = 40;
export const MOVES = ['cheer', 'shield', 'snack'];

function fighter(pet, owner) {
  const stats = battleStats(pet);
  return {
    owner,
    name: pet.nickname || 'Pup',
    title: title(pet),
    stats,
    hp: stats.hp,
    moves: { cheer: true, shield: true, snack: true },
    cheered: false,
    shielded: false,
    stubbornGrumpy: pet.dna.temperament === 'stubborn' && pet.care.happiness < 40,
  };
}

export function createBattle(id, you, foe, seed) {
  const a = fighter(you, 'you');
  const b = fighter(foe, 'foe');
  return {
    id,
    seed,
    turn: 0,
    first: a.stats.spd >= b.stats.spd ? 'you' : 'foe',
    you: a,
    foe: b,
    over: false,
    winner: null,
  };
}

function useMove(f, move, rng, events) {
  if (!f.moves[move]) return;
  f.moves[move] = false;
  if (move === 'cheer') {
    if (f.stubbornGrumpy && rng() < 0.5) {
      events.push({ type: 'move', side: f.owner, move, ignored: true });
      return;
    }
    f.cheered = true;
  } else if (move === 'shield') {
    f.shielded = true;
  } else if (move === 'snack') {
    const heal = Math.round(f.stats.hp * 0.3);
    f.hp = Math.min(f.stats.hp, f.hp + heal);
    events.push({ type: 'move', side: f.owner, move, heal, hp: f.hp });
    return;
  }
  events.push({ type: 'move', side: f.owner, move });
}

function foeAI(f, rng, events) {
  if (f.moves.snack && f.hp < f.stats.hp * 0.4 && rng() < 0.6) useMove(f, 'snack', rng, events);
  else if (f.moves.shield && rng() < 0.12) useMove(f, 'shield', rng, events);
  else if (f.moves.cheer && rng() < 0.15) useMove(f, 'cheer', rng, events);
}

function attack(att, def, rng, events, turn) {
  const cheer = att.cheered;
  att.cheered = false;
  if (def.shielded) {
    def.shielded = false;
    events.push({ type: 'block', side: att.owner });
    return;
  }
  const dodge = clamp(0.08 + (def.stats.spd - att.stats.spd) * 0.003, 0.04, 0.22);
  if (rng() < dodge) {
    events.push({ type: 'miss', side: att.owner });
    return;
  }
  const crit = rng() < clamp(0.12 + (att.stats.spd - def.stats.spd) * 0.003, 0.06, 0.25);
  const raw = att.stats.atk * range(rng, 0.65, 1.35) * (crit ? 1.6 : 1) * (cheer ? 1.6 : 1);
  // Fatigue: long fights get punchier so nobody stalls out.
  const fatigue = 1 + Math.max(0, turn - 16) * 0.1;
  const dmg = Math.max(1, Math.round(((raw * 40) / (40 + def.stats.def)) * fatigue));
  def.hp = Math.max(0, def.hp - dmg);
  events.push({ type: 'hit', side: att.owner, dmg, crit, cheer, hp: def.hp });
}

/** Advance one attack. `move` is the player's queued one-time move, if any. */
export function stepBattle(b, move) {
  if (b.over) return [];
  const rng = mulberry32(b.seed + b.turn * 101);
  const events = [];
  if (move && MOVES.includes(move)) useMove(b.you, move, rng, events);

  const attackerSide = (b.turn % 2 === 0) === (b.first === 'you') ? 'you' : 'foe';
  if (attackerSide === 'foe') foeAI(b.foe, rng, events);
  const att = b[attackerSide];
  const def = b[attackerSide === 'you' ? 'foe' : 'you'];
  attack(att, def, rng, events, b.turn);
  b.turn++;

  if (b.you.hp <= 0 || b.foe.hp <= 0 || b.turn >= MAX_TURNS) {
    b.over = true;
    const yp = b.you.hp / b.you.stats.hp;
    const fp = b.foe.hp / b.foe.stats.hp;
    b.winner = yp === fp ? 'foe' : yp > fp ? 'you' : 'foe';
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
    vivid: range(rng, 0.45, 0.95),
    asleep: false,
    marks: rng() < 0.4 && pet.stage !== 'baby' ? ['star'] : [],
    form: {
      top: pet.stage === 'baby' ? null : ranked[0],
      second: pet.stage === 'adult' ? ranked[1] : null,
    },
  };
}
