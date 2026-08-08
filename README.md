# chrissi's Arena

chrissi's Arena is a minimalist, retro-styled auto-fire roguelite where
movement is the only input that matters. Your weapon aims and fires by
itself. Collect gold, buy upgrades between waves, survive as long as you can.

This project was originally vibecoded and is now developed and maintained by myself.

## Getting started

```bash
npm install
npm run dev       # local dev server with hot reload, http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build locally
npm test          # run the automated test suite
npm run lint      # check for undeclared/undefined variable references
```

## Project structure

```
src/
├── main.js              Entry point, wires DOM controls to handlers, boots the game
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
