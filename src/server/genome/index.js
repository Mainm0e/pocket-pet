// Pocket Pet genome: seed code -> DNA.
//
// A code names its own species and genome generation, e.g. "MO1-7F3A9C"
// (Mochi, gen 1) or "SH1-7F3A9C" (Shiba, gen 1). The generation's tables are frozen, so a code decodes to the
// same pet forever, even after new generations ship. Rules: docs/DNA.md.

import {
  hash, stream, streamFor, pickIndex, allelePoints, uniquePoints, tierFor, codon, CODE_ALPHABET,
} from './core.js';
import * as shibaG1 from './shiba-g1.js';
import * as mochiG1 from './mochi-g1.js';
import * as mochiG2 from './mochi-g2.js';

/** Every genome table that has ever shipped. Add new ones; never remove or edit old ones. */
export const GENERATIONS = [shibaG1, mochiG1, mochiG2];
const BY_PREFIX = Object.fromEntries(GENERATIONS.map((g) => [`${g.PREFIX}${g.GEN}`, g]));
/** What new eggs this season are laid with. */
export const CURRENT = mochiG2;
/**
 * Rare species that can turn up in a new egg instead of the current one.
 * The server rolls this once, when it issues the egg's code; after that the code's
 * prefix decides the species forever, like every other gene.
 */
export const SPAWN = [{ table: shibaG1, chance: 1 / 1_000_000 }];
const SPAWN_TOTAL = SPAWN.reduce((a, s) => a + s.chance, 0);
/** Chance that a new egg is this species (null for old species that no longer spawn). */
export function speciesOdds(T) {
  if (T.SPECIES === CURRENT.SPECIES) return 1 - SPAWN_TOTAL; // older generations of this season's species too
  return SPAWN.find((s) => s.table === T)?.chance ?? null;
}

const CODE_RE = /^([A-Z]{2})(\d{1,3})-(.+)$/;

/** Trim + uppercase. Text without a known prefix gets the current species/gen prefix. */
export function normalizeCode(input) {
  const s = String(input ?? '').trim().toUpperCase().replace(/\s+/g, '-');
  const m = s.match(CODE_RE);
  if (m && BY_PREFIX[m[1] + m[2]]) return s;
  return `${CURRENT.PREFIX}${CURRENT.GEN}-${s || '0'}`;
}

export function tableFor(code) {
  const m = normalizeCode(code).match(CODE_RE);
  return BY_PREFIX[m[1] + m[2]];
}

/** A fresh random code: usually the current season's species, very rarely a SPAWN species. */
export function randomCode(rand = Math.random) {
  let T = CURRENT;
  const r = rand();
  let acc = 0;
  for (const s of SPAWN) {
    acc += s.chance;
    if (r < acc) {
      T = s.table;
      break;
    }
  }
  let body = '';
  for (let i = 0; i < 6; i++) body += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return `${T.PREFIX}${T.GEN}-${body}`;
}

/** Next code after a collision: bump the body like an odometer. */
export function nudgeCode(code) {
  const [prefix, body] = [code.slice(0, code.indexOf('-')), code.slice(code.indexOf('-') + 1)];
  const chars = body.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    const k = CODE_ALPHABET.indexOf(chars[i]);
    if (k >= 0 && k < CODE_ALPHABET.length - 1) {
      chars[i] = CODE_ALPHABET[k + 1];
      return `${prefix}-${chars.join('')}`;
    }
    chars[i] = CODE_ALPHABET[0];
  }
  return `${prefix}-${CODE_ALPHABET[1]}${chars.join('')}`;
}

/**
 * Deterministic code from any number (used to migrate old saves and for simulated friends).
 * `prefix` pins the generation (old saves must keep decoding to the same pet).
 */
export function codeFromNumber(n, prefix = `${CURRENT.PREFIX}${CURRENT.GEN}`) {
  let x = n >>> 0;
  let body = '';
  for (let i = 0; i < 6; i++) {
    body = CODE_ALPHABET[x % 32] + body;
    x = Math.floor(x / 32);
  }
  return `${prefix}-${body}`;
}

const cache = new Map();
function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

/** Decode a seed code into DNA. Pure and deterministic. */
export function decode(input) {
  const code = normalizeCode(input);
  const hit = cache.get(code);
  if (hit) return hit;
  const T = BY_PREFIX[code.match(CODE_RE).slice(1, 3).join('')];
  const h = hash(code);

  // ---- main stream: name, genes, unique part (in this exact order) ----
  const r = stream(h);
  const name =
    T.SYLLABLES[Math.floor(r() * T.SYLLABLES.length)] +
    T.SYLLABLES[Math.floor(r() * T.SYLLABLES.length)].toLowerCase() +
    T.SUFFIXES[Math.floor(r() * T.SUFFIXES.length)];
  const genes = {};
  const list = [];
  let points = 0;
  for (const g of T.GENES) {
    const i = pickIndex(g.alleles, r() * 100);
    const [value, label, w] = g.alleles[i];
    const p = allelePoints(w);
    points += p;
    genes[g.key] = value;
    list.push({ key: g.key, gene: g.name, value, label, odds: w, points: p, codon: codon(i), shows: g.shows });
  }
  const u1 = r() * 100;
  const u2 = r() * 100;
  const u3 = r() * 100;
  let unique = { value: 'none', slot: 'none', label: 'None', odds: 100 - T.UNIQUE_CHANCE, points: 0, codon: codon(0) };
  if (u1 < T.UNIQUE_CHANCE) {
    const si = pickIndex(T.UNIQUE.map((s) => [s.slot, s.name, s.weight]), u2);
    const S = T.UNIQUE[si];
    const vi = pickIndex(S.parts, u3);
    const odds = Math.round(((T.UNIQUE_CHANCE * S.weight * S.parts[vi][2]) / 10000) * 100) / 100;
    unique = {
      value: S.parts[vi][0], slot: S.slot, slotName: S.name, label: S.parts[vi][1], odds,
      points: uniquePoints(odds), codon: codon(si * 4 + vi + 1),
    };
    points += unique.points;
  }
  genes.unique = unique.value;
  list.push({ key: 'unique', gene: 'Unique part', value: unique.value, label: unique.label, odds: unique.odds, points: unique.points, codon: unique.codon, shows: 'teen' });

  // ---- fine stream: the fingerprint ----
  const f = streamFor(h, 'fine');
  const fine = {};
  for (const [key, lo, hi] of T.FINE) fine[key] = +(lo + f() * (hi - lo)).toFixed(3);
  fine.mark = T.BIRTHMARKS[Math.floor(f() * T.BIRTHMARKS.length)];
  fine.markSide = f() < 0.5 ? -1 : 1;
  fine.print = 'FP-' + Math.floor(f() * 0xffffff).toString(16).toUpperCase().padStart(6, '0');

  // ---- mutation stream ----
  const mu = streamFor(h, 'mutation');
  const mutations = T.MUTATIONS.filter(([, , pct]) => mu() * 100 < pct).map(([k]) => k);
  points += mutations.length * 3;

  // a species that almost never spawns is a rarity all by itself
  const sOdds = speciesOdds(T);
  const speciesPoints = sOdds !== null && sOdds <= 0.0001 ? 13 : 0;
  points += speciesPoints;

  const dna = {
    code,
    species: T.SPECIES,
    speciesOdds: sOdds,
    speciesLabel: T.LABEL,
    forms: T.FORMS,
    gen: T.GEN,
    hash: h,
    name,
    genes,
    list,
    unique,
    fine,
    mutations,
    points,
    tier: tierFor(points),
    strand: list.map((x) => x.codon).join(''),
  };
  deepFreeze(dna);
  cache.set(code, dna);
  return dna;
}
