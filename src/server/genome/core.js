// Genome core: the math every species and every genome version shares.
// FROZEN. Changing anything here changes every pet that has ever hatched.
// (Same hash + stream as Tamagot, so the two projects agree on the basics.)

/** FNV-1a 32-bit. */
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 stream: returns () => float in [0, 1). */
export function stream(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Independent random streams, one per purpose, all derived from the seed hash.
 * A stream never affects another, so a new stream can be added at any time
 * without changing existing pets. NEVER reuse or change a value.
 */
export const STREAMS = {
  genes: 0x00000, // main genes + unique part (the "main" stream is the plain hash)
  fine: 0xf1e5, // fine DNA: small continuous differences (the fingerprint)
  mutation: 0x5417a, // rare mutations: shiny, heterochromia
  personality: 0x9e7a1, // talent / temperament / quirk (nudged by the quiz)
  egg: 0x5eed, // egg speckles
};
export const streamFor = (h, key) => stream((h ^ STREAMS[key]) >>> 0);

/** Weighted pick. list items are [value, label, weight]; weights sum to 100. Returns the index. */
export function pickIndex(list, roll100) {
  let acc = 0;
  for (let i = 0; i < list.length; i++) {
    acc += list[i][2];
    if (roll100 < acc) return i;
  }
  return list.length - 1;
}

/** Rarity points for one allele, by its odds in percent. */
export const allelePoints = (w) => (w <= 5 ? 4 : w <= 8 ? 3 : w <= 12 ? 2 : w <= 16 ? 1 : 0);
/** Rarity points for a unique part, by its overall odds in percent. */
export const uniquePoints = (p) => (p <= 1 ? 5 : p <= 3 ? 4 : p <= 6 ? 3 : p <= 12 ? 2 : 1);
export const tierFor = (pts) =>
  pts >= 13 ? 'Legendary' : pts >= 10 ? 'Epic' : pts >= 7 ? 'Rare' : pts >= 4 ? 'Uncommon' : 'Common';

/** Each gene result is written as two bases, so the DNA can be shown as a strand. */
const BASES = 'ATGC';
export const codon = (i) => BASES[(i >> 2) & 3] + BASES[i & 3];

/** Crockford-style alphabet for seed codes: no I, L, O or U, so codes are easy to read aloud. */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
