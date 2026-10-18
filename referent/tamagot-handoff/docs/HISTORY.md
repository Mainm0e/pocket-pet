# Tamagot: project history

The owner's requests are quoted as they were written, followed by what was built for each. Dates are Helsinki time.

---

### 1. "Generate 3d cute tamagot pet and idea of dna and unique seed that help to create own tamagot" (2026-10-18 06:02)
**Built:** a Claude Design canvas (`design-canvas/`) with four boards:
- **Hatchery:** an interactive egg-shaped handheld with Feed / Play / Nap, a seed input, a DNA strand and gene cards.
- **Pet:** an SVG pet with 3D-style radial shading.
- **Seed gallery:** eight example seeds.
- **Genome:** how a seed becomes a pet.

**Key decisions:**
- Seeds are hashed (FNV-1a), then rolled with a seeded random stream (mulberry32).
- There are 9 weighted genes, each written as a 2-base codon.
- Rarity points add up to a tier.

### 2. "and can it have like unique part like have some change to get it like wing or ears or tail and then in that part have change to get it"
**Built:** gene 10, the unique part, as a chance inside a chance: 40% get a part, then tail 45 / wings 35 / mystic ears 20, then four versions at 50/30/15/5. There are 12 parts in total.
- The rolls come after all existing ones, so old seeds kept their looks.
- Example seeds were found by brute force, for example UNI-14 for the unicorn horn.

### 3. "how i can create web app that generate this cute pet"
**Built:** a standalone single-file web app (vanilla JS, SVG pet) published as an artifact. It has share links (`#SEED`), recent pets and hosting instructions (Netlify Drop, GitHub Pages).

### 4. "Can it be 3d model that user can see all angles"
**Built:** the app was rebuilt with Three.js r128:
- **Body:** a turned (lathe) shape for each body type.
- **Features:** placed on the body surface.
- **Unique parts:** all 12 modeled in 3D.
- **View:** orbit controls, auto-spin, soft shadows, and 3D thumbnails for recent pets.

Checked in headless Chromium from the front and back. The unicorn horn, flame tail and crystal horns were made bigger, and the lightning tail was turned to face backwards.

### 5. "Idea is anyway tamagot that need to grow so it need to have egg state, baby state, ... Adult state"
**Built:** the life cycle Egg → Baby → Child → Teen → Adult.
- **The egg:** warmed by tapping and over time. It wobbles, cracks and glows if rare.
- **Growing:** care gives XP, time keeps passing while you're away, and the pet saves in localStorage.
- **Showing the DNA:** genes appear stage by stage, and hidden ones show "???".
- **UI:** a growth strip with stage previews, a "Show future stages" toggle, and a confirmation before replacing a pet.

### 6. "How we can made every is unique pet and how they look is base how they raise"
**Built:**
- **Fine DNA:** a second stream with hue, size, eye, ear-tilt and blush differences, plus a birthmark and an `FP-` code.
- **Raising forms:** Sweet, Chonky, Sporty, Dreamy, Radiant and Scruffy, based on the Feed / Play / Nap mix and neglect. A moon mark appears for night care. The form shows from Child and locks in at Adult.
- **UI:** a "How you raise it" card with silhouettes of all six possible adults.
- **Twins:** the same seed gives the same DNA, but different raising gives different pets.

**Noted limit:** true global uniqueness needs a server registry.

### 7. "Can u add animation and some movement animations"
**Built:** a motion system:
- **Physics:** gravity hops and spring squash and stretch.
- **Moving around:** walking with stepping feet, swinging arms and a waddle.
- **Idle behaviors:** weighted by temper, mood and age.
- **Care scenes:** an apple to eat, a ball to chase, a nap with Z's.
- **Effects:** particles (hearts, notes, stars, drops, crumbs) and eyes that follow the pointer.
- **Tap-to-tickle:** with a raycast hit test.

**Fixed after the visual test:** the pet now turns to face the camera when it starts moves, and food drops between the pet and you.

### 8. "can you wrapup this project and promp and desight into on folder so i can give other agen continue it" (2026-10-18 19:40)
**Built:** this folder: a standalone app, the genome as a module with tests, a render-check script, the design docs, this history, a roadmap, a handoff prompt and fresh screenshots.
