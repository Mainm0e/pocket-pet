# Handoff prompt

Copy everything inside the box below into a new agent session, and attach this whole folder (or the zip).

---

```text
You are taking over "Tamagot", a 3D virtual-pet web app (a Tamagotchi-style game). The full project is in the attached folder `tamagot-handoff/`. Read these files before changing anything, in this order:

1. README.md: what it is and the folder map
2. docs/DESIGN.md: the game rules (genome, unique parts, life stages, raising styles, motion, visual style)
3. docs/ARCHITECTURE.md: code map of app/index.html, the saved-state schema and the invariants you must keep
4. docs/ROADMAP.md: suggested next steps and known issues
5. docs/HISTORY.md: what the owner asked for so far, in their words

THE PRODUCT is app/index.html: one self-contained file (HTML + CSS + vanilla JS). It uses Three.js r128 from jsDelivr (classic <script> build plus examples/js/controls/OrbitControls.js) and Google Fonts (Fredoka, JetBrains Mono). There is no build step, framework or server. The pet saves in localStorage under the key "tamagot.pet.v1".

Core idea, in one paragraph: a seed (any text) is uppercased and trimmed, then hashed with FNV-1a. That hash seeds a mulberry32 random stream, which rolls 9 weighted genes plus a 10th "unique part" gene (a chance inside a chance: 40% get one, then tail 45 / wings 35 / mystic ears 20, then four versions at 50/30/15/5). A second stream seeded with hash^0xA11CE rolls "fine DNA" (small hue, size, eye, ear-tilt and birthmark differences), so every seed looks a little different. The pet goes Egg → Baby → Child → Teen → Adult. Each stage shows more of the DNA. How it is raised (counts of Feed / Play / Nap, care at night, time neglected) decides its adult form, which locks in at Adult: Sweet, Chonky, Sporty, Dreamy, Radiant or Scruffy. A motion system adds bouncy physics, walking, temper-based idle behaviors, care scenes (apple, ball, nap), particles and tap-to-tickle.

Rules for working on it:
- Never change the order or number of random rolls in decode(), the gene tables, or the hash/RNG. That would change every existing pet. Add new randomness only from a NEW stream (for example rng(hash ^ 0xSOMETHING)) or by appending rolls at the very end. Run `node tests/genome.test.js` after any genome change. Known seeds must still give the same pets.
- src/genome.js is a copy of sections 1, 2 and 2b of app/index.html's script. If you change the genome in the app, copy it over again, or refactor so both share one file.
- Keep the saved state backward compatible. Old saves must still load: add new fields with defaults in load(), as `hist` is handled now.
- Keep it working with prefers-reduced-motion, at phone width, and in light and dark mode. Always use real <button>s with aria-labels for icon buttons.
- Keep the visual style: soft pastel toy look, Fredoka plus JetBrains Mono, rounded cards, no emoji in the UI. Pet faces use ink #2A2238.
- After changes, run `node tests/render-check.js` (setup is in its header). It must report no page errors. Look at the screenshots in screenshots/.
- The design-canvas/ boards are the older 2D concept. They do not have life stages, fine DNA or raising styles. The app is the source of truth.

Your first task: [WRITE THE NEXT TASK HERE, for example "add sound effects for eating, giggling and hatching, with a mute button", or "add breeding: two adult pets make an egg", or "move the app to a Vite + TypeScript project without changing behavior"].

Before you start coding, reply with a short plan: which files and functions you will touch, and how you will check that existing seeds still produce the same pets.
```

---

## Ideas for the first task

The top picks from `docs/ROADMAP.md`:

1. **Sound:** chomp, giggle, squeak, hatch crack, level-up jingle, with a mute toggle (Web Audio, made in code, no files).
2. **Breeding:** two Adults make an egg. Each gene comes from one parent, with a 2% chance of mutation per gene. The child seed is written as `A×B`.
3. **Pet room:** a small 3D room with a bed, a food bowl and toys the pet walks to.
4. **Accounts and a global registry:** save pets online, and register each Adult's fingerprint plus its raising history, so no two owners can have the same pet.
5. **Project setup:** move to Vite + TypeScript + Three.js modules, and split the app into genome / builder / motion / ui files.
