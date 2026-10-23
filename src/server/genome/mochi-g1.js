// Mochi, genome generation 1 (Season 1). FROZEN once released:
// - never reorder, remove or reweight alleles, and never reorder GENES;
// - to add a gene that existing pets also get, APPEND it to the end of GENES;
// - to change odds or replace alleles, make mochi-g2.js and register it as a new gen.
// See docs/DNA.md.

export const SPECIES = 'mochi';
export const PREFIX = 'MO';
export const GEN = 1;
export const LABEL = 'Mochi';

// [value, label, weight %]
export const GENES = [
  { key: 'flavor', name: 'Flavour', shows: 'baby', alleles: [
    ['plain', 'Rice', 22], ['sakura', 'Sakura', 18], ['matcha', 'Matcha', 16], ['yuzu', 'Yuzu', 12], ['kinako', 'Kinako', 10],
    ['ube', 'Ube', 8], ['sesame', 'Black sesame', 6], ['mango', 'Mango', 5], ['choco', 'Chocolate', 2], ['starry', 'Starry night', 1],
  ] },
  { key: 'shape', name: 'Shape', shows: 'teen', alleles: [
    ['round', 'Round', 40], ['bean', 'Bean', 25], ['wide', 'Pudding', 20], ['drop', 'Droplet', 12], ['cube', 'Cube', 3],
  ] },
  { key: 'eyes', name: 'Eyes', shows: 'baby', alleles: [
    ['bead', 'Bead', 35], ['sparkle', 'Sparkle', 30], ['sleepy', 'Sleepy', 15], ['happy', 'Happy', 12], ['star', 'Star', 8],
  ] },
  { key: 'mouth', name: 'Mouth', shows: 'baby', alleles: [
    ['smile', 'Smile', 40], ['kitty', 'Kitty', 25], ['open', 'Gasp', 20], ['tongue', 'Bleh', 15],
  ] },
  { key: 'cheeks', name: 'Cheeks', shows: 'baby', alleles: [
    ['blush', 'Blush', 55], ['plain', 'Plain', 30], ['freckles', 'Freckles', 15],
  ] },
  { key: 'top', name: 'Top', shows: 'teen', alleles: [
    ['none', 'Bare', 30], ['nubs', 'Bun ears', 22], ['cat', 'Cat ears', 18], ['antenna', 'Antenna', 14], ['sprout', 'Sprout', 10], ['horns', 'Tiny horns', 6],
  ] },
  { key: 'pattern', name: 'Pattern', shows: 'teen', alleles: [
    ['plain', 'Plain', 35], ['dust', 'Powder dust', 25], ['spots', 'Spots', 18], ['swirl', 'Swirl', 12], ['dipped', 'Choco dip', 10],
  ] },
  { key: 'topper', name: 'Topper', shows: 'teen', alleles: [
    ['none', 'None', 45], ['strawberry', 'Strawberry', 20], ['leaf', 'Sakura leaf', 15], ['bean', 'Red bean', 12], ['cherry', 'Cherry', 8],
  ] },
  { key: 'base', name: 'Base', shows: 'teen', alleles: [
    ['none', 'None', 55], ['cup', 'Paper cup', 25], ['leafwrap', 'Leaf wrap', 15], ['plate', 'Little plate', 5],
  ] },
  { key: 'charm', name: 'Charm', shows: 'teen', alleles: [
    ['none', 'None', 45], ['bow', 'Bow', 25], ['ribbon', 'Ribbon', 18], ['bell', 'Bell', 12],
  ] },
];

// Unique part: a chance inside a chance. Rolled right after GENES.
export const UNIQUE_CHANCE = 35;
export const UNIQUE = [
  { slot: 'tail', name: 'Tail', weight: 40, parts: [
    ['tail_puff', 'Bunny puff', 50], ['tail_curl', 'Curly tail', 30], ['tail_crystal', 'Crystal tail', 15], ['tail_flame', 'Flame tail', 5],
  ] },
  { slot: 'wings', name: 'Wings', weight: 35, parts: [
    ['wings_feather', 'Feather wings', 50], ['wings_bat', 'Bat wings', 30], ['wings_butterfly', 'Butterfly wings', 15], ['wings_angel', 'Angel wings', 5],
  ] },
  { slot: 'head', name: 'Head', weight: 25, parts: [
    ['head_flower', 'Flower crown', 50], ['head_star', 'Star antenna', 30], ['head_crystal', 'Crystal horns', 15], ['head_unicorn', 'Unicorn horn', 5],
  ] },
];

export const SYLLABLES = ['Mo', 'Pi', 'Nu', 'Ki', 'Lu', 'Bo', 'Ta', 'Fi', 'Zu', 'Po', 'Mi', 'Ru', 'Ko', 'Yu', 'Chi', 'Pa'];
export const SUFFIXES = ['', 'chi', 'po', 'n', 'ko', 'mi'];

// Fine DNA ranges: [min, max]. Rolled from the "fine" stream in this order.
// squish and bounce change how it MOVES, so twins with different fine DNA even jiggle differently.
export const FINE = [
  ['hue', -8, 8],
  ['light', -0.04, 0.04],
  ['width', 0.94, 1.06],
  ['height', 0.94, 1.06],
  ['eye', 0.9, 1.12],
  ['gap', 0.92, 1.08],
  ['squish', 0.8, 1.2],
  ['bounce', 0.85, 1.15],
  ['cheek', 0.85, 1.2],
  ['earTilt', -0.14, 0.14],
  ['earSize', 0.9, 1.12],
  ['markY', 0, 1],
  ['spotSeed', 0, 1],
];
export const BIRTHMARKS = ['heart', 'star', 'dot', 'none'];

export const MUTATIONS = [
  ['shiny', 'Shiny', 1.5],
  ['hetero', 'Heterochromia', 1.5],
];

// Display names for raising forms (Teen body from top trait, Adult feature from second trait).
export const FORMS = {
  strong: { noun: 'Champling', adj: 'Mighty', bodyDesc: 'Sharp, determined brows', featureDesc: 'Fighting spirit (gets fired up 💢)' },
  playful: { noun: 'Boingling', adj: 'Bouncy', bodyDesc: 'Happy brows, sparkly eyes', featureDesc: 'Curly tail' },
  tough: { noun: 'Pudgeling', adj: 'Chunky', bodyDesc: 'Chubby, with puffy cheeks', featureDesc: 'Chunky feet' },
  calm: { noun: 'Dozeling', adj: 'Dreamy', bodyDesc: 'Tall, with a serene face', featureDesc: 'Halo' },
};
