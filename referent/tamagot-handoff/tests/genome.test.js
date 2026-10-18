// Run: node tests/genome.test.js
// Locks in known seed -> pet results so genome changes don't silently alter existing pets.
const assert = require('assert');
const g = require('../src/genome.js');

const KNOWN = {
  'MOCHI-001':  { name: 'Nupi',   tier: 'Rare', unique: 'Feather wings',  fp: 'FP-9CC89B', body: 'drop',  hue: '#93E2BE' },
  'UNI-14':     { name: 'Kipoko', tier: 'Rare', unique: 'Unicorn horn',   fp: 'FP-AD987F' },
  'ANGEL-66':   { name: 'Bonun',  tier: 'Rare', unique: 'Angel wings',    fp: 'FP-D6D179' },
  'EMBER-81':   { name: 'Luyumi', tier: 'Rare', unique: 'Flame tail',     fp: 'FP-E6D2F1' },
  'LUNA-7F3A':  { name: 'Kipon',  tier: 'Epic', unique: 'Lightning tail', fp: 'FP-FD6787' },
};

for (const [seed, want] of Object.entries(KNOWN)) {
  const d = g.decode(seed);
  assert.strictEqual(d.name, want.name, `${seed} name`);
  assert.strictEqual(d.tier, want.tier, `${seed} tier`);
  assert.strictEqual(d.unique.label, want.unique, `${seed} unique part`);
  assert.strictEqual(d.micro.code, want.fp, `${seed} fingerprint`);
  if (want.body) assert.strictEqual(d.genes.body, want.body, `${seed} body`);
  if (want.hue) assert.strictEqual(d.genes.hue, want.hue, `${seed} hue`);
  assert.strictEqual(d.list.length, 10, 'ten genes');
}

// Seeds are case- and whitespace-insensitive.
assert.strictEqual(g.decode('  mochi-001 ').name, 'Nupi');

// Odds sanity: about 40% of pets get a unique part (tail 18%, wings 14%, ears 8%).
const n = 50000, count = { none: 0, tail: 0, wing: 0, ear: 0 };
for (let i = 0; i < n; i++) count[g.decode('T' + i).unique.slot]++;
const pct = k => count[k] / n * 100;
assert(Math.abs(pct('none') - 60) < 1.5, 'none ~60%');
assert(Math.abs(pct('tail') - 18) < 1.5, 'tail ~18%');
assert(Math.abs(pct('wing') - 14) < 1.5, 'wings ~14%');
assert(Math.abs(pct('ear') - 8) < 1.5, 'ears ~8%');

// Raising styles.
const base = { feed: 0, play: 0, nap: 0, night: 0, neglect: 0 };
const style = h => g.raisingStyle({ hist: Object.assign({}, base, h) }).form;
assert.strictEqual(style({}), 'Sweet');
assert.strictEqual(style({ feed: 8, play: 2, nap: 2 }), 'Chonky');
assert.strictEqual(style({ feed: 2, play: 9, nap: 1 }), 'Sporty');
assert.strictEqual(style({ feed: 1, play: 2, nap: 8 }), 'Dreamy');
assert.strictEqual(style({ feed: 5, play: 5, nap: 4 }), 'Radiant');
assert.strictEqual(style({ feed: 5, play: 5, nap: 4, neglect: 200 }), 'Scruffy');
assert.strictEqual(g.raisingStyle({ hist: Object.assign({}, base, { feed: 3, play: 3, night: 6 }) }).moon, true);
// A locked adult keeps its form.
assert.strictEqual(g.raisingStyle({ form: 'Dreamy', moon: false, hist: Object.assign({}, base, { play: 50 }) }).form, 'Dreamy');

console.log('genome tests passed', count);
