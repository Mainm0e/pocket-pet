// Shiba, genome generation 1 (Season 1). FROZEN once released:
// - never reorder, remove or reweight alleles, and never reorder GENES;
// - to add a gene that existing pets also get, APPEND it to the end of GENES
//   (rolled after everything else, so earlier rolls are untouched);
// - to change odds or replace alleles, make shiba-g2.js and register it as a new gen.
// See docs/DNA.md.

export const SPECIES = 'shiba';
export const PREFIX = 'SH';
export const GEN = 1;
export const LABEL = 'Shiba';

// [value, label, weight %]
export const GENES = [
  { key: 'coat', name: 'Coat', shows: 'baby', alleles: [
    ['red', 'Red', 38], ['cream', 'Cream', 18], ['blacktan', 'Black & tan', 15], ['sesame', 'Sesame', 14],
    ['white', 'White', 9], ['peach', 'Peach', 3], ['mint', 'Mint', 2], ['lavender', 'Lavender', 1],
  ] },
  { key: 'mask', name: 'Mask', shows: 'baby', alleles: [
    ['classic', 'Classic', 50], ['wide', 'Wide', 30], ['little', 'Little', 20],
  ] },
  { key: 'eyes', name: 'Eyes', shows: 'baby', alleles: [
    ['bead', 'Bead', 35], ['sparkle', 'Sparkle', 30], ['sleepy', 'Sleepy', 15], ['happy', 'Happy', 12], ['star', 'Star', 8],
  ] },
  { key: 'mouth', name: 'Mouth', shows: 'baby', alleles: [
    ['smile', 'Smile', 40], ['tongue', 'Tongue out', 25], ['kitty', 'Kitty', 25], ['fang', 'Little fang', 10],
  ] },
  { key: 'cheeks', name: 'Cheeks', shows: 'baby', alleles: [
    ['blush', 'Blush', 55], ['plain', 'Plain', 30], ['freckles', 'Freckles', 15],
  ] },
  { key: 'brows', name: 'Brows', shows: 'baby', alleles: [
    ['none', 'None', 50], ['dots', 'Brow dots', 35], ['bold', 'Bold brows', 10], ['hearts', 'Heart brows', 5],
  ] },
  { key: 'ears', name: 'Ears', shows: 'teen', alleles: [
    ['pointy', 'Pointy', 45], ['round', 'Round', 25], ['folded', 'Folded tips', 20], ['big', 'Big', 10],
  ] },
  { key: 'tail', name: 'Tail', shows: 'teen', alleles: [
    ['curl', 'Curl', 55], ['sickle', 'Sickle', 25], ['plume', 'Plume', 15], ['bob', 'Bob', 5],
  ] },
  { key: 'socks', name: 'Socks', shows: 'teen', alleles: [
    ['none', 'None', 45], ['front', 'Front socks', 25], ['four', 'Four socks', 20], ['odd', 'Odd sock', 10],
  ] },
  { key: 'collar', name: 'Collar', shows: 'teen', alleles: [
    ['red', 'Red', 32], ['sky', 'Sky', 20], ['mint', 'Mint', 16], ['lemon', 'Lemon', 14], ['grape', 'Grape', 12], ['gold', 'Gold', 6],
  ] },
  { key: 'charm', name: 'Charm', shows: 'teen', alleles: [
    ['plain', 'Plain', 45], ['bell', 'Bell', 25], ['bandana', 'Bandana', 18], ['bow', 'Bow', 12],
  ] },
];

// Unique part: a chance inside a chance. Rolled right after GENES.
export const UNIQUE_CHANCE = 35;
export const UNIQUE = [
  { slot: 'tail', name: 'Tail', weight: 40, parts: [
    ['tail_fox', 'Fox plume', 50], ['tail_double', 'Double curl', 30], ['tail_crystal', 'Crystal tail', 15], ['tail_flame', 'Flame tail', 5],
  ] },
  { slot: 'wings', name: 'Wings', weight: 35, parts: [
    ['wings_feather', 'Feather wings', 50], ['wings_bat', 'Bat wings', 30], ['wings_butterfly', 'Butterfly wings', 15], ['wings_angel', 'Angel wings', 5],
  ] },
  { slot: 'head', name: 'Head', weight: 25, parts: [
    ['head_flower', 'Flower crown', 50], ['head_star', 'Star antenna', 30], ['head_crystal', 'Crystal horns', 15], ['head_unicorn', 'Unicorn horn', 5],
  ] },
];

export const SYLLABLES = ['Ko', 'Ta', 'Mo', 'Ki', 'Ha', 'Ru', 'Shi', 'Po', 'Mi', 'Yu', 'Chi', 'Ba', 'Ku', 'Ni', 'Fu', 'Ro'];
export const SUFFIXES = ['', 'ko', 'maru', 'chan', 'ta', 'mi'];

// Fine DNA ranges: [min, max]. Rolled from the "fine" stream in this order.
export const FINE = [
  ['hue', -6, 6],
  ['light', -0.04, 0.04],
  ['head', 0.95, 1.06],
  ['bodyW', 0.94, 1.06],
  ['bodyH', 0.94, 1.06],
  ['eye', 0.9, 1.12],
  ['gap', 0.92, 1.08],
  ['earTilt', -0.14, 0.14],
  ['earSize', 0.9, 1.12],
  ['tailSize', 0.9, 1.15],
  ['muzzle', 0.9, 1.12],
  ['cheek', 0.85, 1.2],
  ['markY', 0, 1],
];
export const BIRTHMARKS = ['heart', 'star', 'dot', 'none'];

export const MUTATIONS = [
  ['shiny', 'Shiny', 1.5],
  ['hetero', 'Heterochromia', 1.5],
];

// Display names for raising forms (display only, not rolled).
export const FORMS = {
  strong: { noun: 'Lionpup', adj: 'Mighty', bodyDesc: 'Fluffy lion ruff', featureDesc: 'Little horns' },
  playful: { noun: 'Bunpup', adj: 'Bouncy', bodyDesc: 'Long bunny ears', featureDesc: 'Pom-pom tail' },
  tough: { noun: 'Pudgepup', adj: 'Chunky', bodyDesc: 'Round and chubby', featureDesc: 'Big paws' },
  calm: { noun: 'Sproutpup', adj: 'Dreamy', bodyDesc: 'Tall with a sprout', featureDesc: 'Halo' },
};
