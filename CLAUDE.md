# Pocket Pet: guide for future development

A casual, mobile-first 3D virtual pet game. A pet hatches from a seed code. Its DNA decides its looks, and how it is raised decides its Teen and Adult forms. It lives in a 3D room you can decorate, and it battles friends' pets. Season 1 species: **Mochi**. Shiba ships as a 1-in-a-million rare spawn.

- Game rules and layout: [README.md](README.md)
- The DNA system (codes, gene tables, uniqueness, how to change DNA safely): [docs/DNA.md](docs/DNA.md). **Read it before touching anything in `src/server/genome/`.**
- `referent/tamagot-handoff/` is the older Tamagot prototype, kept as reference only. Don't edit it, and don't import from it.

## Commands

```bash
npm install
npm run dev       # Vite dev server on the LAN (open on a phone)
npm test          # Vitest: game rules, genome, room layout, 3D model sanity (~80 tests)
npm run build     # production build -> dist/ (PWA)
npm run preview   # serve dist/ on :4173
npm run smoke     # after a build: plays the whole game in headless phone Chromium (scripts/smoke.mjs)
```

Dev URLs: `/?dev` shows the DEV panel (move the game clock forward, reset the save). `/?lab` opens the Seed Lab (any seed, any stage or form, a turntable view and the gene list). `/?lab&dev` adds "Hatch this seed". `/?lab&seed=MO1-3E&stage=adult&top=playful&second=calm&yaw=0.5` gives a fixed view for screenshots.

## Architecture

```
src/server/        THE GAME RULES. The only code that changes game state.
  index.js         async API (createServer): getState, act, startEgg, battle*, saveRoom, dev*; storage + save migration
  pet.js           care decay replayed from timestamps, care actions, traits, evolution, titles, DNA string
  battle.js        1v1 volleyball, one touch per step; mood + Cheer/Calm obeyed by bond; simulated friends
  room.js          room layout: item catalog, limits, bounds, sanitizeRoom()
  dna.js           hatching quiz -> personality (talent/temperament/quirk)
  constants.js     tuning knobs (decay, caps, stage gates, marks, quirks)
  genome/          seed code -> DNA. FROZEN tables per species+generation (see docs/DNA.md)
src/lib/           api.js (the ONLY door from UI to server), game.svelte.js (reactive UI store),
                   sound.js (sfx(name) + mute pref) -> synth.js (Web Audio, lazy chunk loaded on first tap),
                   reminders.js (notifications: forecast -> service worker; lazy)
src/components/    Svelte 5 UI: Room, sheets, PetCard, Quiz, Evolution, Battle, Decorate, SeedLab, DevPanel
src/species/       species art, lazy-loaded per species
  <species>/sculpt.js   pure-JS SDF sculpt (runs in sculpt.worker.js; NO Three.js imports)
  <species>/build.js    async buildPet(look) -> { root, body, parts }; accessories, eyes, marks
  common.js        shared parts (wings, head parts, fx tails, egg, tongue)
  index.js         loadSpecies(id) + lookOf(petView)
src/three/         Three.js: kit (materials/helpers), sdf (field + Surface Nets mesher),
                   stage (3D room, motion, care scenes, furniture, decorate mode), court (volleyball match),
                   furniture, roomStyles (plain data), viewer (turntable), thumbs (offscreen stills)
```

Data flow: UI → `api.*()` → server mutates `db` → returns `{ state, events, result }` (deep-cloned, read-only) → `game.apply()` → components → `stage.setPet / setRoom / setLayout / play(fx)`.

## Rules you must keep

1. **The server is authoritative.** Components and the 3D stage only display what they're given. Every change to game state goes through `src/server/index.js` and gets validated there. The server runs in the browser for now, but everything is shaped so it can move to Supabase Edge Functions. Keep `src/server/` free of DOM and Three.js imports.
2. **No background timers for game logic.** Time passes by replaying since `lastUpdated` (`catchUp`). Don't add `setInterval` game rules.
3. **DNA determinism** (details in docs/DNA.md):
   - Never reorder, remove or reweight released alleles, never reorder `GENES`, and never change `core.js` (hash, stream, `STREAMS`, alphabet).
   - New genes go at the end of the table, or come from a new stream. Changed odds mean a new generation file (`mochi-g2.js`).
   - Don't change `SPAWN` odds once a species has spawned for players.
   - The locked codes in `genome.test.js` must keep passing.
4. **The save is never stored as DNA.** Pets store `dna.code` plus personality, and the genome is recomputed from the code. Saves are backward compatible: bump `DB_VERSION` and add a step in `migrate()` (server/index.js).
5. **Anti-cheat by design:**
   - Daily caps, battles counted when they start, and unfinished battles resumed rather than re-rolled.
   - Cosmetic-only rewards.
   - Don't add anything that pauses game time or lets the client choose its seed outside dev mode.
6. **Sculpt code stays pure JS** (`src/three/sdf.js`, `species/*/sculpt.js`), because it runs in the worker. Return plain arrays, and pass hit points as `{ p: [x, y, z], n: [x, y, z] }` (arrays, not Vector3).
7. **Three.js stays lazy.** UI components must not statically import anything that imports `three` (put plain data in files like `roomStyles.js`). Check that `npm run build` keeps the main `index-*.js` around 47 KB gzipped.
8. **Mobile and accessibility:**
   - Must work at phone width (390×844 is the reference).
   - Respect `prefers-reduced-motion` (stage, viewer and CSS all check it).
   - Support light and dark mode with the CSS tokens in `app.css`.
   - Use real `<button>`s with `aria-label`s, and touch targets of at least 44 px.

## Adding things

- **Species or season:**
  1. Add the gene table in `genome/<species>-g1.js` and register it in `GENERATIONS`; set `CURRENT` or add it to `SPAWN`.
  2. Add `species/<id>/sculpt.js` and `build.js`, and register them in `species/index.js`, `sculpt.worker.js` and `sculptClient.js`.
  3. Add showcase codes to `genome/showcase.js`, add the species to `build.test.js`, and update docs/DNA.md.
- **Gene:** append it to the table, render it in `build.js` (gated by the stage in `shows`), add locked codes, and update docs/DNA.md.
- **Care action:** add a case in `pet.js act()` (with caps and a refusal rule), a button or furniture hook in `Room.svelte`, and a scene in `stage.js play()`. Time its sounds inside the scene with `sound(name, delay)`.
- **Sound:** add a recipe to `SOUNDS` in `lib/synth.js` and call `sfx(name)` from the UI or `sound(name)` from the stage. Never import `synth.js` statically (it stays out of the main bundle).
- **Furniture:** add an entry to `ROOM_ITEMS` (server/room.js), then `buildItem` and `RADIUS` (three/furniture.js), the icon in `Decorate.svelte`, and `interact()` and `spotFor()` in stage.js.
- **Volleyball or balance changes:** re-simulate win rates (focused builds should stay around 40–60% against each other; the "focused builds" test in `server.test.js` checks it) and keep the bond meaningful (smart commands at high bond should beat no commands). The court (`three/court.js`) only animates server events; `play()` returns how long they take.

## Checking your work

1. `npm test` must pass, including `species/build.test.js`, which builds real models for about 30 seeds per species and fails on any invalid vertex value.
2. `npm run build` must finish with no errors, and the main bundle must stay small (rule 7).
3. `npm run build && npm run smoke` must print "All checks passed". [scripts/smoke.mjs](scripts/smoke.mjs) plays the game in a 390×844 phone Chromium:
   - It covers the quiz, hatching, care, sleep, growing up with the dev clock, a collision check, furniture taps, a battle, decorating with a reload, and the Seed Lab.
   - It fails on any page or console error. **Look at the screenshots in `screenshots/`**, because they catch what the checks can't.
   - It uses the real GPU by default (`--use-angle=gl-egl`). `npm run smoke -- --software` forces SwiftShader, which runs at about 4 fps and turns GPU stalls into fake main-thread freezes, so don't measure performance with it.
   - With `?dev`, `window.__stage` exposes `screenPosOf(id)` and `debugPet()` for tapping furniture and checking collisions. Extend the smoke test when you add a feature.

## Gotchas we already hit

- **Blink timing:** the Seed Lab viewer blinks at about t = 3.9 s, so screenshots taken at 4 s show "closed eyes". Wait 5.5 s.
- **Effect loops:** Svelte effects that read and write the same `$state` (e.g. arrays of hearts) loop forever. Wrap side work in `untrack`.
- **Hot-path speed:** `Math.hypot` and array destructuring are slow in SDF hot loops. Use plain `Math.sqrt` and flat arrays (see `unionParts`).
- **NaN colours:** a NaN in vertex colours renders a part solid black. The build test checks for this.
- **Shader stalls:** `renderer.debug.checkShaderErrors` is off outside dev (`tuneRenderer`), and new models are compiled with `compileAsync` (`precompile`) to avoid stalls.
- **Thumbnails** use `toBlob` (async), not `toDataURL`, and render one at a time when scrolled into view (`PetThumb`).
- **Furniture moves:** furniture positions only change in the stage when the layout value changes, so the toy ball doesn't snap home on every state refresh.
- **Volleyball court:** `Battle.svelte` fetches one touch ahead, so `court.play(events, onEvent, next)` knows if the ball will be missed (then it lands just out of reach, beside or in front of the receiver, never behind it, or a flat ball flies through the pet). Ball contacts use each pet's measured size. The smoke test checks `window.__court.debug().closest` (1 = touching, below 1 = the ball went inside a pet), and `byPhase` says where.
- **Service worker:** `public/sw.js` caches the app. Bump `CACHE` when a change must reach installed PWAs.

## Roadmap (not built yet)

1. **Real backend (Supabase):** move `src/server/*` handlers to Edge Functions, store `db` in Postgres with a unique constraint on `pets.code`, add auth, and keep `lib/api.js` as the only client change.
2. **Real friends:** friend list, visits ("friends can visit and feed each other's pets"), real volleyball matches instead of simulated friends, and friends-only leaderboards.
3. **Push notifications:** best effort is done. Reminders (More → 🔔) come from `forecast()` in pet.js; `lib/reminders.js` saves them for `public/sw.js`, which shows what's due when Chrome wakes the installed app (Periodic Background Sync) or while the page is alive in the background. Next: real Web Push from the backend (send the same forecast list; works on iPhone Home Screen apps too).
4. ~~**Sound**~~ (done): Web Audio sounds for care, hatching, evolving and battles, with a mute toggle in More. Next: optional background music.
5. **Season 2:** turn Shiba (or Sprout, Ember pup, Puddle or Pebble) into a full season species, with lazy-loaded art.
6. **Fusion:** two adults make a hybrid egg. Use a new code generation that takes both parents' DNA, and allow one fusion per pet per season.
7. **Enchant:** materials earned from care and battles buy visual effects and stat *redistribution* (never more total power). Add a rare "awakening" look.
8. **Pet Dash:** a side-runner mini-game where traits affect the run, with friend high scores only.
9. **Vacation mode:** if wanted, a limited pause such as once a day for a few hours, enforced on the server. Never a free pause.
10. **Art:** an artist-made glTF base model per species could replace `build.js`, with DNA driving recolours, blend shapes and accessories. Codes don't change.
11. **CI:** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs `npm test`, `npm run build` and `npm run smoke -- --software` on every push and PR (screenshots are uploaded as an artifact). Keep it green.
