# chrissi's arena

An auto-firing survival roguelite. Move to dodge and position; your
weapon fires on its own, but only within range. Kill enemies for gold,
then spend it between waves on permanent upgrades. Reach wave 30 to win,
or push further in Endless Mode.

This project was originally vibecoded, and is now developed and maintained by myself.

## Getting started

```bash
npm install
npm run dev       # local dev server with hot reload, http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build locally
npm test          # run the automated test suite
```

## Project structure

```
src/
├── main.js              Entry point — wires DOM controls to handlers, boots the game
├── dom.js                 Cached references to DOM elements
├── storage.js              localStorage persistence (settings, stats, unlocks, run history)
├── style.css                All styling
│
├── data/                  Game content (items, enemies, events, achievements, guide text, constants)
├── state/                 Player/game-state factories and the shared state store
├── systems/                Game logic (combat, enemies, economy, waves, run lifecycle, main loop)
├── render/                 Screen rendering (canvas, HUD, shop, compendium, screen management)
└── audio/                   Synthesized sound (Web Audio, no external sound files)

tests/                      Automated tests for the core data and logic
legacy/                     The original single-file version, kept for reference
```

## Testing

`npm test` runs the automated test suite covering item/enemy/event data
integrity, shop pricing, and core combat math.