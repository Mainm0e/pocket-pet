# Tamagot: architecture

Everything runs in **`app/index.html`** (~915 lines): CSS tokens, the page markup, and one classic `<script>` after the Three.js r128 scripts. There are no modules and no build step. All functions and state are global inside that script.

## Code map (line numbers in app/index.html)

| Lines | Section | What's there |
|---|---|---|
| 1–110 | `<style>` | Theme tokens (`:root` plus two dark blocks), stage, readout, growth strip, raising card |
| 110–215 | Markup | Header badges · `#stage` (3D canvas, mood bubble, view buttons) · care buttons · cards: Growing up, How you raise it, DNA, unique part, Born with / Right now, Lay a new egg |
| 219 | **1. GENOME** | `GENES`, `UQ`, `SYL/SUF`, `hash` (FNV-1a), `rng` (mulberry32), `pick`, **`decode(seed)`**, `shiftHue`, `mix` |
| 283 | **2. LIFE STAGES** | `STAGES`, `XP_AT`, `SHOWS_AT` (which gene appears at which stage), `LOOK` (size, eye scale, top, pattern, charm and unique scale per stage) |
| 293 | **2b. NURTURE** | `NURTURE_AT`, `FORMS`, `FORM_ORDER`, **`raisingStyle(state)`**, `heartShape`, `crescent` |
| 319 | **3. 3D BUILDER** | Primitives (`mat`, `blob`, `cone`, `arc`, `tube`, `extrude`, `starShape`), `lathe()` surface helpers, `profileFor(body)`, **`buildEgg(d)`**, **`buildPet(d, stage, nurture)`**, `disposeTree`, `addLights` |
| 500 | **4. STAGE** | `initStage` (renderer, camera, OrbitControls, pointer and tap handlers), `CAM_DIST`, `frontView` |
| 536 | **4b. MOTION** | The motion state `M`, `timers`/`after()`, `props`, particle `sparks`, `hop/kick/spin/walkTo/busy/faceYou`, textures, `emit/burst`, `makeApple/makeBall`, care scenes `doFeed/doPlay/doNap/doRefuse/warmPulse/celebrateMove`, idle AI `BEH/pickBehavior/startBehavior`, **`loop()`** |
| 711 | Model glue | `nurtureNow`, **`showModel(d, stage, {bounce, form})`** (rebuilds the model and resets motion), `thumbFor` (offscreen renders for thumbnails, with silhouette mode) |
| 736 | **5. LIFE** | `KEY`, `freshState`, `load/save`, `passTime`, `addXP` (stage-ups, Adult lock-in), celebrate/banner, `startHatch/finishHatch`, **`careAction(kind)`**, `poke` |
| 812 | **6. RENDER** | `render()`: redraws all readout cards from `state` and `dna` (uses the thumbnail cache) |
| ~870 | **7. WIRING** | Button listeners, `layEgg`, startup (load or lay `MOCHI-001`, `#seed` in the link), 15 s tick |

## Data flow

```
startup ─► load() or freshState(seed) ─► dna = decode(state.seed) ─► passTime() ─► showModel(dna, stage) ─► render()
                                                                                         │
every frame: loop() ─ timers ─ physics (M) ─ behavior AI ─ props ─ particles ─ controls.update ─ renderer.render
every 15 s : passTime() ─► save() ─► stage up? flushCelebrate() ─► render()
button     : careAction(kind) ─► state.care / hist / xp ─► doFeed|doPlay|doNap (animation) ─► save ─► render
             ─► form lean changed? showModel + "Leaning X" banner ─► flushCelebrate (stage up: rebuild + celebrate)
tap on pet : raycast ─► poke()
```

## Saved state (`localStorage["tamagot.pet.v1"]`)

```js
{
  seed: "MOCHI-001",          // normalized (trimmed, uppercased)
  stage: 0..4,                // Egg, Baby, Child, Teen, Adult
  xp: Number,                 // float; shown floored
  warmth: 0..100,             // egg only
  care: { fullness, joy, energy },          // 0..100
  hist: { feed, play, nap, night, neglect }, // raising history (neglect in minutes)
  form: null | "Sweet"|"Chonky"|"Sporty"|"Dreamy"|"Radiant"|"Scruffy",  // set once, at Adult
  moon: Boolean,              // frozen with form
  laid: ms, hatched: ms, last: ms           // timestamps; `last` drives passTime()
}
```
`load()` fills in a missing `hist` for older saves. Keep doing that for any new field.

## Model structure

```
model.root  (Group: stage size scale, rests on the ground at y = -1.06; walking moves its x/z, turning sets rotation.y)
└── model.body  (Group: bob, hop height, squash/stretch scale, tilt for nap and droop)
    ├── torso (LatheGeometry from profileFor(body) × fine-DNA width/height × form)
    ├── feet[2] (blobs; userData.base)       ├── arms[2] (pivot groups; userData.sx)
    ├── eyes[] (userData.base, follow the pointer) ├── mouth (scaled for chomping)
    ├── pattern, cheeks, birthmark, top ears, charm, unique part, form extras
model.parts = { blink[], eyes[], feet[], arms[], wings[] (pivots), tail, halo, flames[], sparkles[], mouth, topY, egg?, crack? }
```
Placing features on the body: `lathe(profile)` returns `rAt(y)` (radius at a height), `yAtR(r)` and `onSurface(obj, y, azimuth, out)`. That last one puts an object on the body surface facing outward. **Call it before adding the object to a parent** (it uses lookAt in local space). Azimuth 0 = the front (+z).

## Invariants: don't break these

1. **Determinism.** `decode()` must give identical output for every existing seed. Don't reorder the rolls in `decode()`, don't edit or reorder alleles in `GENES` or `UQ`, and don't change `hash`, `rng`, the syllables or the 0xA11CE stream. To extend it, append rolls after the unique-part rolls, or use a new stream `rng(hash ^ NEW_CONST)`. `tests/genome.test.js` guards this.
2. **One genome.** `src/genome.js` is an exact copy of sections 1, 2 and 2b. Update both, or refactor so the app imports one shared file.
3. **The Adult form is permanent** once `state.form` is set.
4. **Save compatibility.** Never rename `KEY` without migrating old saves.
5. **Accessibility:** reduced motion, real buttons with labels, light and dark themes, phone width.

## How to…

- **Add an allele to an existing gene:** changing weights or adding alleles shifts outcomes for existing seeds. If you must, bump the generation ("Gen 2") and keep the Gen 1 tables for old pets, for example `decode(seed, gen)`.
- **Add a new gene:** roll it from a new stream, show it in `SHOWS_AT`, draw it in `buildPet` (gate it by `LOOK[stage]`), and add a card in `render()`.
- **Add a unique part:** add one to a new stream or a new "Gen". Then draw it in `buildPet` under `if(k>0)` and animate it in `loop()`.
- **Add a raising form:** add it to `FORMS` and `FORM_ORDER`, add a rule in `raisingStyle()`, and add looks in `buildPet` (color, profile W/H, extras under `if(nk>=.5)`).
- **Add a behavior:** add a weight in `BEH[temper]` and a `case` in `startBehavior()`. Drive it through `M` fields and `after()` timers, and set the duration `dur`.
- **Add a care action:** add a button, a branch in `careAction()` (meters, XP, refuse rule, `hist` count), and a `doX()` scene in the motion section.
- **Slow down growth:** change `XP_AT`, the `passTime()` rates and the egg warmth rate.

## Testing

- `node tests/genome.test.js`: determinism for the known seeds, the odds of unique parts, and the raising-style rules.
- `tests/render-check.js`: runs headless Chromium with Three.js from `node_modules` and web fonts skipped. It hatches, raises the pet, renders all stages for 3 seeds and all 6 forms, and fails on any page error. Software WebGL works with `--use-angle=swiftshader`.
- Testing by hand from the browser console: `state.xp=230; addXP(20); flushCelebrate(); render()` jumps to Adult. `dna=decode('UNI-14'); showModel(dna,4)` previews any seed without saving it.

## Known technical debt

- The app is one large file with global state. Split it into modules if it keeps growing.
- It uses Three.js r128 with the legacy `examples/js` OrbitControls. Upgrading to r150+ means ES modules, `colorSpace` instead of `encoding`, and `SRGBColorSpace`.
- `render()` rebuilds card HTML with `innerHTML` on every change. That's fine at this size. Thumbnails are cached by seed, stage, form, moon and silhouette.
- `showModel()` calls `resetMotion()`, which removes props. A stage-up in the middle of a feed scene cancels the apple.
