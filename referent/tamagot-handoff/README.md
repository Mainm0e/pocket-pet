# Tamagot

A 3D virtual pet for the web. Every pet hatches from a **seed**: any text, turned into DNA. You warm the egg, it hatches, and it grows from **Egg → Baby → Child → Teen → Adult**. The DNA decides its looks (body, color, ears, eyes, a rare unique part like wings or a unicorn horn). **How you raise it** decides its adult form (Chonky, Sporty, Dreamy, Radiant, Scruffy or Sweet). It moves around on its own, eats, chases a ball, naps and reacts when you tap it.

![life stages](screenshots/overview-life-stages.png)

## Start here

| If you want to… | Open |
|---|---|
| Continue the project as an AI agent | **`HANDOFF_PROMPT.md`** (paste it into the new agent) |
| Play with it | `app/index.html` in any modern browser (needs internet for Three.js and fonts) |
| Understand the game design and genome | `docs/DESIGN.md` |
| Find your way around the code | `docs/ARCHITECTURE.md` |
| See how the project got here | `docs/HISTORY.md` |
| Pick the next thing to build | `docs/ROADMAP.md` |

## Folder map

```
tamagot-handoff/
├── README.md               this file
├── HANDOFF_PROMPT.md       ready-to-paste prompt for the next agent
├── package.json            npm scripts: test, render-check (dev deps: three 0.128.0, playwright)
├── app/index.html          THE PRODUCT: the whole web app in one file (HTML + CSS + JS, ~900 lines)
├── src/genome.js           seed → DNA rules, life stages, raising styles (Node module, copied from the app)
├── tests/
│   ├── genome.test.js      locks known seeds to known pets; checks odds and raising styles
│   └── render-check.js     headless-browser smoke test that saves screenshots
├── design-canvas/          the original 2D concept boards (Claude Design canvas files)
│   ├── canvas.json         board layout
│   ├── Main.dc.html        "Hatchery" board (2D, interactive)
│   ├── Pet.dc.html         2D SVG pet component
│   ├── Gallery.dc.html     8 example seeds
│   └── Genome.dc.html      DNA spec board (genes, odds, unique parts, rarity tiers)
├── docs/
│   ├── DESIGN.md           product, genome, life cycle, nurture, motion, visual style
│   ├── ARCHITECTURE.md     code map, state schema, invariants, how to change things safely
│   ├── HISTORY.md          every request in order and what was built for it
│   └── ROADMAP.md          next steps, known issues and limits
└── screenshots/            renders from the test browser
```

## Run it

- **Play:** double-click `app/index.html`, or host it anywhere static (Netlify Drop, GitHub Pages). Your pet saves in the browser (`localStorage`).
- **Share a pet:** `yoursite/#UNI-14` opens a fresh egg from that seed when the visitor has no pet yet. Otherwise the seed is pre-filled in the "Lay a new egg" box.
- **Genome tests:** `npm test` (or `node tests/genome.test.js`, no dependencies).
- **Render check:** `npm install`, then `npm run render-check -- [path-to-chromium]`. It must print `page errors: none` and saves fresh screenshots.

## Live versions (owner's private claude.ai artifacts)

- Web app: [private artifact link removed]
- Design canvas: [private artifact link removed]

The copies in this folder match those as of 2026-10-18. `app/index.html` here is a standalone version: the same code wrapped in a full `<html><head><body>` page.

## Try these seeds

| Seed | Pet |
|---|---|
| `MOCHI-001` | Nupi: mint droplet, sprout, halo, feather wings (Rare) |
| `UNI-14` | Kipoko: unicorn horn (0.4% part) |
| `ANGEL-66` | Bonun: angel wings |
| `EMBER-81` | Luyumi: flame tail |
| `BAT-3` | Ruchipo: bat wings |
| `LUNA-7F3A` | Kipon: lightning tail (Epic) |
