# Pocket Pet

A casual, mobile-first 3D virtual pet game. Hatch a squishy mochi from a seed,
raise it in its little 3D room, and watch how you care for it shape its body,
features, colours and personality. The DNA system is documented in
[docs/DNA.md](docs/DNA.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test           # engine unit tests
npm run build      # production build in dist/ (installable PWA)
```

Prototype helpers:

- `?dev` adds a DEV button that moves the game clock forward (+1h / +6h / +1 day) or resets the save.
  Growth is time-gated, so this is how you can see Teen and Adult without waiting days.
- `?lab` opens the **Seed Lab**: type any seed and see its DNA, rarity and a 3D model at every
  stage, form, care level and mark, plus showcase seeds for every rare part. With `?lab&dev`
  you can hatch the seed you're looking at as your pet.

## How it's built

```
src/server/      game rules ("server"): the only place state changes
  constants.js   tuning: decay, caps, stage gates, marks, quirks...
  dna.js         personality quiz + DNA roll (seed + answer nudges)
  pet.js         care, timestamp catch-up, traits, evolution, names, DNA string
  battle.js      1 vs 1 beach volleyball (one touch per step) + simulated friends
  index.js       async API facade, storage, unique-seed registry, daily limits
src/lib/         api.js (the only door to the server), game.svelte.js (UI store), sound.js + synth.js (Web Audio)
src/server/genome/  seed code -> DNA (frozen per generation; see docs/DNA.md)
src/species/     species art, lazy-loaded: mochi/ (Season 1) and shiba/ (ready for later).
                 sculpt.js = smooth SDF sculpt (runs in sculpt.worker.js), build.js = model + accessories
src/three/       Three.js: kit (materials, helpers), stage (3D room, motion, care scenes),
                 court (volleyball match), viewer (turntable), thumbs (offscreen stills for cards)
src/components/  Room, Meters, sheets, PetCard, Quiz, Evolution, Battle, SeedLab...
```

**Server-authoritative from day one.** The UI never changes game state. It calls
`api.*` and receives read-only copies. Nothing ticks in the background. Each call
replays time since `lastUpdated` in 10-minute steps (decay, sleep, messes,
vividness), so being away works the same as being online. For now the "server"
runs in the browser and saves to `localStorage`. To move to Supabase, port
`src/server/index.js` handlers to Edge Functions and store `db` in Postgres;
`src/lib/api.js` is the only client file that changes.

### Rules at a glance

| | |
|---|---|
| Care stats | 5 stats, floor of 5 (pets never die). If energy runs out, the pet goes to sleep on its own. |
| Traits | Feed → Tough, Play → Playful, Train → Strong, Bath/Sleep/Clean → Calm. 20 points/day, 150 total cap. Talent grows 1.5×. |
| Stages | Egg (5 taps) → Baby → Teen (≥1 day old & 25 traits) → Adult (≥3 days & 70 traits) |
| Looks | Seed code decides flavour, shape, face, top, pattern, topper, base, charm, rare part and fingerprint (including how squishy and bouncy it is). Raising shows in the face, never as growths: Teen look = top trait (Strong: determined brows, Playful: happy brows and sparkly eyes, Tough: relaxed and chubby, Calm: serene and a bit taller). Adult feature = second trait (fighting spirit, curly tail, chunky feet, halo). A clean head is the norm: ears, antenna, sprout, horns and head parts are rare genes. Vividness from care, marks from history. |
| Bond | 0–100 ♥, saved on the pet. Grows with successful care (+1), pats (+0.25, 8/day), the first visit of the day (+2) and playing a match (+1), at most 8 a day. Fades while care is very low. |
| Daily wish | Each day the pet wants one thing (a snack, playing ball, a bath, training, 3 pats or a match), picked from its code and the date and tipped by its personality. Granting it: +3 bond (outside the daily cap) and +5 happiness, once a day. |
| Reminders | Optional (More → 🔔). The game rules replay the pet's day forward to see when it will be hungry, lonely or messy, or still waiting on its wish, and the app hands that to the service worker. No reminders 21:00–08:00, at most 3 a day. Best effort for now: an installed app on Chrome gets them when the browser wakes it in the background; a real push server (roadmap) makes them on time everywhere. |
| Coming back | After 30+ minutes away the pet greets you, as warmly as your bond: best friends rush over with hearts, shy pets back off and peek. Close pets wander near the front of the room, shy ones keep to the back. |
| Volleyball | 1 vs 1, first to 5. 5 matches/day, counted when a match starts; unfinished matches resume, so restarting can't re-roll a result. Power (Strong), Speed (Playful), Receive (Tough), Focus (Calm). Mood swings with the score: nervous pets miss receives, over-excited ones hit out. **Cheer** lifts the mood, **Calm** pulls it back to focused, once per point. The pet listens with a chance set by the bond (25% at 0 up to 95%), and an unbonded pet may sulk. Rewards are cosmetic only. |
| Anti-spam | Overfeeding is refused, Play/Train need energy, Bath has a 2h cooldown, messes limit cleaning |

Volleyball balance was checked by simulation (and `server.test.js` keeps it
there). Focused builds (70% in one trait) win about 40–60% against each other,
and a pet with 15% fewer trait points still wins about 1 in 3. Good commands
from a strong bond add about 10–15% to the win rate; spamming Cheer loses games.

## Not built yet

Real backend and auth, real friends and visits, push notifications, more
species and seasonal eggs, fusion, enchanting, Pet Dash. Pets are sculpted
in code (smooth SDF shapes); an artist-made model (glTF) could replace a species'
build.js later without changing any DNA.
