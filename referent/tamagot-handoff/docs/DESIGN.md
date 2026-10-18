# Tamagot: design

## 1. Product in one line

A cute 3D virtual pet. Its looks come from **nature** (DNA from a seed) plus **nurture** (how you raise it). It hatches from an egg, grows through five stages and acts on its own.

**Pillars**
1. **Same seed, same DNA, forever.** A seed is a shareable code. The same seed gives the same DNA on any device.
2. **Every pet is one of a kind.** Main genes, plus fine DNA, plus raising history.
3. **Growing is discovery.** Each stage shows more of the DNA. Rare traits stay hidden until Teen.
4. **It feels alive.** It squashes, bounces, waddles and has moods. It reacts to you.

---

## 2. Genome (nature)

### 2.1 From seed to DNA
```
seed text ──trim + UPPERCASE──► FNV-1a 32-bit hash ──► mulberry32 stream r()
r() rolls, in this exact order:
  1-3. name: syllable, syllable, suffix
  4-12. nine genes (weighted)
  13-15. stats: appetite, stamina, charm (each 3–10)
  16-18. unique part: lucky? / which part / which version
second stream rng(hash ^ 0xA11CE) rolls the fine DNA
```
**Never reorder these rolls.** Add new randomness from a new stream or after the last roll.

- **Name:** two of `Mo Pi Nu Ki Lu Bo Ta Fi Zu Po Mi Ru Ko Yu Chi Pa`, plus a suffix from `'' chi po n ko mi`. Examples: Nupi, Kipoko, Ruchipo.
- **Codon:** each gene result's slot number `i` is written as two bases, `ATGC[(i>>2)&3] + ATGC[i&3]`. Slot 0 = AA, 1 = AT, 2 = AG, 3 = AC, 4 = TA and so on. Ten genes make a 20-base DNA strand.

### 2.2 The ten genes
Odds are percent. "Pts" are the rarity points an allele gives: ≤5% gives 4, ≤8% gives 3, ≤12% gives 2, ≤16% gives 1, otherwise 0.

| # | Gene | Alleles (odds) | Shows at |
|---|---|---|---|
| 1 | Body | Mochi 35 · Bean 25 · Pudding 25 · Droplet 15 | Child |
| 2 | Color | Peach 18 · Mint 18 · Sky 16 · Lilac 16 · Lemon 12 · Rose 12 · Cocoa 6 · Midnight 2 | Baby |
| 3 | Top | Bare 20 · Cat ears 22 · Bunny ears 20 · Antenna 16 · Sprout 14 · Tiny horns 8 | Child |
| 4 | Eyes | Dot 30 · Sparkle 28 · Sleepy 18 · Wink 16 · Star 8 | Baby |
| 5 | Mouth | Smile 35 · Kitty 25 · Gasp 20 · Bleh 20 | Baby |
| 6 | Cheeks | Blush 50 · Freckles 30 · Plain 20 | Baby |
| 7 | Pattern | Solid 40 · Belly 30 · Spots 20 · Stripes 10 | Teen |
| 8 | Charm | None 55 · Bow 25 · Crown 15 · Halo 5 | Teen |
| 9 | Temper | Playful · Dreamy · Curious · Brave · Shy (20 each) | Baby (drives behavior) |
| 10 | Unique part | see 2.3 | Teen (bud), Adult (full) |

Color hex values: Peach #FFB59A, Mint #93E2BE, Sky #98C6FF, Lilac #C7B0FF, Lemon #FFE07A, Rose #FFA3C2, Cocoa #C99E82, Midnight #6C78E0.

### 2.3 Unique parts: a chance inside a chance
1. **Lucky?** 40% get a part. The rest get none, with codon AA.
2. **Which part?** Tail 45 · Wings 35 · Mystic ears 20.
3. **Which version?** 50 / 30 / 15 / 5.

| Part | Version (in-part odds → overall odds, rarity pts, example seed) |
|---|---|
| Tail | Fluffy 50 → 9% (+2, FLUFF-12) · Curly 30 → 5.4% (+3, CURL-7) · Lightning 15 → 2.7% (+4, ZAP-12) · Flame 5 → 0.9% (+5, EMBER-81) |
| Wings | Feather 50 → 7% (+2, FEATHER-20) · Bat 30 → 4.2% (+3, BAT-3) · Butterfly 15 → 2.1% (+4, FLUTTER-19) · Angel 5 → 0.7% (+5, ANGEL-66) |
| Mystic ears | Fox 50 → 4% (+3, FOX-32) · Elf 30 → 2.4% (+4, ELF-76) · Crystal horns 15 → 1.2% (+4, GEM-55) · Unicorn horn 5 → 0.4% (+5, UNI-14) |

Unique-part points by overall odds: ≤1% gives 5, ≤3% gives 4, ≤6% gives 3, ≤12% gives 2, otherwise 1. Mystic ears replace the Top gene from Teen on, and the Top card then reads "Covered". Unique codon index: 0 = none, otherwise `slot*4 + version + 1`.

### 2.4 Rarity tier
The sum of all rarity points sets the tier: 0–3 Common · 4–6 Uncommon · 7–9 Rare · 10–12 Epic · 13+ Legendary. Epic and Legendary eggs glow and have orbiting gold sparkles: a hint before hatching.

Combinations: about 12 million gene mixes, about 18 billion with names. Fine DNA makes the looks effectively continuous on top of that.

### 2.5 Fine DNA (the fingerprint)
These come from the second stream. Values are uniform within each range.

| Trait | Range |
|---|---|
| Hue shift | −10° … +10° |
| Lightness | −5% … +5% |
| Body width / height | 0.94 … 1.06 each |
| Eye size | 0.90 … 1.12 |
| Eye spacing | 0.92 … 1.08 |
| Ear tilt | −0.12 … +0.12 rad |
| Blush size | 0.85 … 1.20 |
| Birthmark | heart, star or dot, at a fixed spot on the side or back (never on the face) |
| Code | `FP-XXXXXX` (6 hex) |

**Twins:** two eggs from the same seed have identical DNA. They only grow apart through how they are raised.

---

## 3. Life cycle

| Stage | How you reach it | Model size | What shows |
|---|---|---|---|
| Egg | Lay one from a seed | — | A shell tinted by Color, seed-random speckles, glow if Epic+. The name and stats are hidden. |
| Baby | Hatch: warmth reaches 100% | 0.58 | A round baby body, eyes ×1.4, a hair tuft, Color, Eyes, Mouth, Cheeks, Temper, name, stats |
| Child | 40 XP | 0.74 | The real Body shape, Top at 62%, raising style at 50% strength |
| Teen | 120 XP | 0.87 | Pattern, Charm, rarity tier, unique part at 62%, raising style at 80% |
| Adult | 240 XP | 1.00 | Everything at full size. The raising style **locks in for life**. |

**The egg:** each Warm tap adds 12%. It also warms by itself at 2.5% per minute. From 60% it shows a crack and wobbles more. At 100% it shakes for 1.4 s, hatches, and a "Meet ‹name›" banner appears.

**Care** (only after hatching). A repeat of the same action within 3.5 s gives a quarter of the XP and doesn't count toward the raising style.

| Action | Effect | XP | Refuses when |
|---|---|---|---|
| Feed | fullness +24, energy −4, joy +4 | 10 | fullness ≥ 95 |
| Play | joy +22, energy −14, fullness −10 | 12 | energy < 15 |
| Nap | energy +30, fullness −6 | 6 | energy ≥ 95 |
| Tap (tickle) | joy +1 | 0 | — |

**Time passing** (worked out on load and every 15 s, capped at 3 days): fullness −0.5/min, joy −0.6/min, energy −0.3/min. If the average of the three meters is above 40, the pet gains +0.5 XP/min, so a happy pet grows while you're away. If the average is below 30, neglect builds up.

Growth speed is tuned for a quick demo. To slow it down, change `XP_AT` and the time rates.

---

## 4. Nurture: raising styles

The history is tracked in `state.hist`: `feed`, `play` and `nap` counts, `night` (care given between 9 pm and 6 am) and `neglect` (minutes with the average meters below 30; each care action takes off 10).

| Form | Rule (checked in this order) | Look |
|---|---|---|
| Scruffy | neglect ≥ 180 min | Duller (mixed with #9C9AA8), 8% smaller, droopier ears, band-aid on cheek, worried brows, matte skin |
| Chonky | at least 4 actions and Feed ≥ 50% | 16% wider, 5% shorter, soft belly patch |
| Sporty | at least 4 actions and Play ≥ 50% | 10% taller, 7% slimmer, red sweatband |
| Dreamy | at least 4 actions and Nap ≥ 50% | Paler (mixed 28% with white), blue nightcap with pompom |
| Radiant | at least 12 actions and each of Feed, Play and Nap ≥ 22% | Glossy and slightly glowing skin, 6 orbiting sparkles, unique part ×1.15 |
| Sweet | anything else | Pure DNA |

**Moon mark:** if at least 6 actions were given and half or more of them at night, the pet grows a glowing crescent on its forehead (from Child).

**Strength:** the style shows at 0 for Baby, 0.5 for Child, 0.8 for Teen and 1 for Adult. When the pet reaches Adult, `state.form` and `state.moon` are frozen. While it is still growing, the UI shows "Leaning ‹form›…" and redraws the pet whenever the lean changes. The "How you raise it" card shows all six possible adults as grey silhouettes. "Show future stages" reveals them, and you can tap one to preview it in 3D.

---

## 5. Motion and personality

**Physics:** hops use gravity (9.8). A spring (k 70, damping 8) drives squash and stretch: landings squash it, take-offs stretch it. The pet walks to target points inside a 0.9-radius circle. While walking its feet step, its arms swing, its body waddles and its tail wags faster.

**Idle behaviors** are picked every 1.5–3.6 s, weighted by temper:

| Temper | Weights |
|---|---|
| Playful | hop 3, dance 2, walk 2, look 1, wave 1, idle 1 |
| Dreamy | yawn 3, idle 3, walk 1, look 1, doze 1 |
| Curious | look 3, walk 3, hop 1, wave 1, idle 1 |
| Brave | walk 3, hop 2, wave 1, look 1, idle 1 (walks faster) |
| Shy | idle 3, look 2, hide 2, wave 1, walk 1 (walks slower) |

Mood and age change what it picks:
- **Energy < 20:** it dozes.
- **Fullness < 25:** half the time it shows a tummy rumble with a sweat drop.
- **Joy < 25:** half the time it droops and sheds a tear.
- **Babies:** they toddle slowly and sometimes plop forward.
- **Pets with wings:** they also flutter-hop.

The pet turns toward the camera when it starts any move except walk, look or hide.

**Care scenes:**
- **Feed:** an apple drops between the pet and you. The pet walks to it and takes three chomps (mouth stretch, crumbs), then hops with hearts.
- **Play:** a striped ball bounces in, and the pet chases it. The pet nudges the ball when close, and the ball bounces off an invisible wall at radius 1.35. It ends with a spin, stars and notes.
- **Nap:** it tips onto its side, Z's float up, and it breathes slowly. Then it stretches awake.
- **Refuse:** it shakes its head, with a sweat drop.

**Particles** are sprites drawn on a canvas: heart, Z, note, star, drop, puff, crumb.

**You:** its eyes follow the pointer. A quick tap (under 6 px of movement and 350 ms) on the pet tickles it. Dragging turns the camera, and pinching or scrolling zooms. Auto-spin is on until you drag. `prefers-reduced-motion` turns off idle behaviors, bobbing and wobble.

---

## 6. Visual style

- **Feel:** a soft pastel toy, like vinyl collectibles. Chunky rounded type, glossy clearcoat plastic, soft shadows.
- **Fonts:** Fredoka (display and UI) and JetBrains Mono (codes, labels, numbers).
- **Page tokens (light / dark):** bg #F1F2F7 / #13141C · surface #FFFFFF / #1D1F2D · chip #F4F5FA / #262839 · ink #1B1D2A / #ECEDF5 · muted #5A5F78 / #A6ABC4 · line #DADDEA / #30334A · accent #5B4BE0 / #A99EFF.
- **Pet palette:** face ink #2A2238, blush #FF8FB4, gold #FFC94A, button colors Feed #FF8A65, Play #8C99FF, Nap #5FCDA9, Warm #FFC94A. The DNA base chips are A #FFB199, T #9FE3C9, G #B9C2FF, C #FFE08A.
- **Tier chips:** Common #E3E6EE, Uncommon #CDEFD9, Rare #D3E2FF, Epic #E6D6FF, Legendary #FFE39A, each with a dark ink of its own hue.
- **Stage:** a square rounded screen with a radial pastel gradient made from the pet's color, a soft ground shadow, and three lights: a hemisphere light, a key light with soft shadows, and a pink rim light. Tone mapping is ACES.
- **Rules:** no emoji in the UI, icons are inline stroke SVG, real buttons with labels, touch targets ≥ 44 px, works at phone width and in both themes.
