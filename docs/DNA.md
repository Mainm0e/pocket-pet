# Pocket Pet DNA

How a pet is born from a seed, why no two pets are the same, and how to change or extend the DNA without breaking pets that already exist.

Code: [src/server/genome/](../src/server/genome/). Tests: [genome.test.js](../src/server/genome/genome.test.js). Explore any seed in the **Seed Lab** (`/?lab`).

The method comes from the Tamagot prototype (same hash and random stream, chance-inside-chance unique parts, rarity points, codons). The gene tables are new and designed for Pocket Pet.

---

## 1. From seed code to pet

```
"MO1-7F3A9C"
 │└┴─ species + genome generation (MO = Mochi, 1 = gen 1; SH1 = Shiba gen 1)
 │         └── body: 6 chars from 0-9 A-Z without I L O U
 ▼
trim + UPPERCASE ─► FNV-1a 32-bit hash ─► independent random streams (mulberry32)
```

| Stream | Seeded with | Decides |
|---|---|---|
| genes | `hash` | suggested name, 11 genes, unique part (in that exact order) |
| fine | `hash ^ 0xF1E5` | the fingerprint: 13 small continuous differences + birthmark + `FP-` code |
| mutation | `hash ^ 0x5417A` | shiny 1.5%, heterochromia 1.5% |
| personality | `hash ^ 0x9E7A1` | talent, temperament, quirk (odds nudged by the hatching quiz) |
| egg | `hash ^ 0x5EED` | egg speckles |

Each stream is separate, so adding a stream never changes what another stream rolls.

**Who decides what**

| Comes from | Examples | Changes over life? |
|---|---|---|
| Seed code (nature) | coat, mask, eyes, ears, tail, collar, unique part, fingerprint | No, fixed forever |
| Quiz + seed | talent, temperament, quirk | No |
| How it's raised (nurture) | Teen body (top trait), Adult feature (second trait), colour vividness | Locks in at Teen/Adult |
| History | memory marks (star, rival scar, aura, sun, rainbow), badges | Only grows |

The server stores only `dna.code` plus the personality. The full DNA is recomputed from the code on every request, so nobody can edit their pet's genes in the save.

## 2. Species tables

| Code | Species | Status | Table |
|---|---|---|---|
| `MO2` | Mochi gen 2 | **current** (Season 1, from Oct 2026): new eggs get this. Same genes as gen 1, but ears are very rare | [mochi-g2.js](../src/server/genome/mochi-g2.js) |
| `MO1` | Mochi gen 1 | shipped, kept forever (the first Season 1 eggs) | [mochi-g1.js](../src/server/genome/mochi-g1.js) |
| `SH1` | Shiba gen 1 | shipped, kept forever; ready for a future season | [shiba-g1.js](../src/server/genome/shiba-g1.js) |

Text without a known prefix gets the current one (`daifuku` → `MO1-DAIFUKU`). An `SH1-…` code always decodes to the same Shiba.

**Rare species spawn.** When the server issues a new egg's code, it first rolls the species: `SPAWN` in [genome/index.js](../src/server/genome/index.js) gives the Shiba a **1 in 1,000,000** chance, otherwise the egg is the current species. Only that issuing roll is random. After it, the code's prefix decides the species forever. A species with spawn odds of 1 in 10,000 or rarer adds 13 rarity points, which makes it Legendary on its own. It also gets a golden egg, a toast when laid and hatched, and a "1 in 1,000,000 Shiba" chip on its pet card. Treat `SPAWN` odds like gene weights: once a species has spawned for players, don't change its odds, because that changes its rarity points.

### Mochi gen 1

| Gene | Alleles | Shows at |
|---|---|---|
| Flavour | Rice 22 · Sakura 18 · Matcha 16 · Yuzu 12 · Kinako 10 · Ube 8 · Black sesame 6 · Mango 5 · Chocolate 2 · Starry night 1 | Baby |
| Shape | Round 40 · Bean 25 · Pudding 20 · Droplet 12 · Cube 3 | Teen (every baby is a plain round mochi) |
| Eyes | Bead 35 · Sparkle 30 · Sleepy 15 · Happy 12 · Star 8 | Baby |
| Mouth | Smile 40 · Kitty 25 · Gasp 20 · Bleh 15 | Baby |
| Cheeks | Blush 55 · Plain 30 · Freckles 15 | Baby |
| Top | Bare 30 · Bun ears 22 · Cat ears 18 · Antenna 14 · Sprout 10 · Tiny horns 6 | Teen |
| Pattern | Plain 35 · Powder dust 25 · Spots 18 · Swirl 12 · Choco dip 10 | Teen |
| Topper | None 45 · Strawberry 20 · Sakura leaf 15 · Red bean 12 · Cherry 8 | Teen |
| Base | None 55 · Paper cup 25 · Leaf wrap 15 · Little plate 5 | Teen |
| Charm | None 45 · Bow 25 · Ribbon 18 · Bell 12 | Teen |
| Unique part | Tail: Bunny puff · Curly tail · Crystal tail · Flame tail. Wings: Feather · Bat · Butterfly · Angel. Head: Flower crown · Star antenna · Crystal horns · Unicorn horn | Teen (62%), Adult |

**Mochi gen 2** changes only the Top gene's odds: Bare 46 · Antenna 24 · Sprout 18 · Tiny horns 10 · **Bun ears 1 · Cat ears 1**. So about 1 Mochi in 50 has ears, and ears now score 4 rarity points. Gen 1 codes still decode exactly as before (their pets keep their ears). Old v1 saves migrate to `MO1` codes (`codeFromNumber(n, 'MO1')`), never to the current generation.

Fine DNA (13 values) includes **squish** and **bounce**: how soft the jelly wobble is and how high it hops. So even twins with the same genes move a little differently. Raising forms: Teen body from the top trait (Strong: soft spikes, Playful: a bouncy curl on top, Tough: chubby with a belly, Calm: tall with a leaf) and Adult feature from the second (horns, curly tail, chunky feet, halo).

### Shiba gen 1

Coat (8 colours), mask, eyes, mouth, cheeks, brows, ears, tail, socks, collar, charm, plus the same unique-part structure (fox plume, double curl, wings, flower crown, unicorn horn…). See the table file.

**Rarity:** each allele gives points by its odds (≤5% → 4, ≤8% → 3, ≤12% → 2, ≤16% → 1). Unique parts give 1–5 points, and each mutation gives 3. Total: 0–3 Common · 4–6 Uncommon · 7–9 Rare · 10–12 Epic · 13+ Legendary. Epic and Legendary eggs glow and have sparkles.

**Codons:** each result's index becomes two bases (`ATGC`), so a pet has a strand (22 bases for Mochi, 24 for Shiba), shown on the pet card and in the Seed Lab. Showcase codes for every rare result are in [showcase.js](../src/server/genome/showcase.js), for example `MO1-3E` has a unicorn horn and `MO1-F4E` is Starry night.

## 3. Why every pet is unique

1. **Codes never repeat.** The server keeps a registry of every code it has issued. A new egg gets a random code, and if it is taken, the code is bumped (`nudgeCode`) until it is free. That makes the DNA unique by construction. With 32⁶ ≈ 1 billion codes per generation, collisions are rare anyway.
2. **The fingerprint makes even similar pets look different.** 13 continuous values (hue ±6°, lightness, head size, body width and height, eye size and spacing, ear tilt and size, tail size, muzzle, cheek fluff, birthmark spot) mean two pets with the same 11 genes still look a little different.
3. **Raising adds the rest.** Body form, feature, vividness and memory marks come from play, so the full look string (for example `adult-calm-playful-SH1-484YG3-sun`) also records history.

About 7.2 million Mochi gene combinations (8.8 million for Shiba) × 13 unique-part outcomes × mutations × the continuous fingerprint × 12 raising forms × marks.

Today the registry lives in the in-browser prototype server. When the backend arrives, put a `unique` constraint on `pets.code` in Postgres and keep `nudgeCode` as the retry.

## 4. Changing DNA safely

The golden rule: **a released code must always decode to the same pet.** [genome.test.js](../src/server/genome/genome.test.js) locks sample codes to their exact DNA, and CI should fail if they change.

| You want to… | Do this | Existing pets |
|---|---|---|
| Change how something **looks** (model, colours, proportions) | Edit `src/species/shiba/build.js` only | Same DNA, new art (fine) |
| Add a gene that **every** pet gets, old ones too | Append it to the **end** of `GENES` in the current table. It is rolled after everything else, so earlier rolls don't move. Add its art and a `shows` stage. | Gain the new gene ("everyone discovers a new trait") |
| Add something rolled independently (e.g. voice pitch) | Add a new entry in `STREAMS` in [core.js](../src/server/genome/core.js) with a fresh constant and roll it from that stream | Gain it, nothing else changes |
| Add an allele, or change odds or the unique-part table | **New generation.** Copy `shiba-g1.js` to `shiba-g2.js`, change it, add it to `GENERATIONS`, and set `CURRENT` to it | Unchanged (still gen 1). New eggs are gen 2 (`SH2-…`) |
| Add a new species (season 2) | New table file with its own `PREFIX` (e.g. `SP1` for Sprout), a builder in `src/species/<id>/build.js`, register both (`GENERATIONS`, `src/species/index.js`) and set `CURRENT` | Unchanged |
| Rename an allele's label | Fine: labels are display only. Never change the **value** key or weight. | Unchanged |

Never: reorder `GENES`, remove or reorder alleles, change a weight in a released table, change `hash`, `stream`, `CODE_ALPHABET` or any `STREAMS` value, or reuse a stream constant.

**Checklist for a DNA change**
1. Make the change following the table above.
2. `npm test`. Locked codes must still pass. If you made a new generation, add locked codes for it too.
3. Find showcase codes for new rare results with a short loop over `decode()` (try `SH1-0`, `SH1-1`, … until each result appears) and add them to `showcase.js`.
4. Open `/?lab`, look at the new results at every stage, then at random litters.
5. Note it in the changelog: "Gen 2: new coat Honey. Gen 1 pets unchanged."

**Changelog**
- Oct 2026, Mochi gen 2 (`MO2`): ears (Bun ears, Cat ears) are very rare, 1% each. Gen 1 pets unchanged. Art only (all Mochi): the Playful Teen body is a bouncy curl instead of bunny ears ("Boingling", was "Bunbun").

## 5. Saves

`pocketpet.db.v1` holds `{ version, pets, seedRegistry, … }`. Version 1 saves (2D Mochi with numeric seeds) are migrated on load: the numeric seed becomes an `MO1` code (`codeFromNumber`), so old Mochi pets stay Mochi and the personality, name, care, traits and history are kept. Add future migrations in `migrate()` in [server/index.js](../src/server/index.js) and bump `DB_VERSION`.
