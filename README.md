# chrissi's arena

A Brotato-style top-down wave-survival roguelite. Move to dodge and
position; your weapon fires on its own, but only within range. Kill
enemies for gold, spend it in the shop between waves, survive 30 waves
(or keep going in Endless Mode).

## Getting started

```bash
npm install
npm run dev       # local dev server with hot reload, http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build locally, to sanity-check it
npm test          # run the automated test suite
```

## Project structure

This game used to be a single 2,500-line HTML file. It's been restructured
into modules along one central rule:

> **Systems change state. Rendering reads state. Nothing else is allowed
> to do both.**

That rule is not a style preference — it's a direct fix for the two worst
bugs found in the original file's architecture review. Both were the same
root cause: a piece of state (whether an enemy was "revealed," whether it
was a boss) got checked or written from more than one place, and those
places quietly drifted out of sync. Splitting "what's true right now" from
"how it's drawn" removes that failure mode structurally, not just in the
two spots that happened to break.

```
src/
├── main.js              Entry point. Wires DOM controls to handlers, calls boot().
│                         Should stay "thin" — logic belongs in systems/, not here.
├── dom.js                Cached references to DOM elements (canvas, screens, etc.)
├── storage.js             localStorage persistence (settings, stats, unlocks, run history)
├── style.css              All styling
│
├── data/                 Pure content — no logic, no game-state dependency.
│   ├── items.js            All 47 shop items (apply/unapply pairs)
│   ├── enemies.js          All 18 enemy types, incl. the 4 bosses
│   ├── events.js           All 8 random wave-clear events (apply/revert pairs)
│   ├── achievements.js      Achievement definitions
│   ├── guide.js             In-game Guide tab content
│   ├── changelog.js         Version history
│   └── constants.js         Tuning constants (arena size, gold cap, price floors, ...)
│
├── state/                The single source of truth for what's happening right now.
│   ├── store.js             The shared mutable state container — see below.
│   ├── player.js             newPlayer() factory
│   ├── gameState.js          newGameState() factory
│   └── derived.js            Computed stats (effective range/damage/fire-rate, caps, score)
│
├── systems/              Game logic. Reads and writes state. Never touches the DOM
│   │                      directly (the few exceptions are documented inline).
│   ├── combat.js            Movement, auto-fire, projectiles, damage
│   ├── enemies.js           Enemy AI, spawning, death
│   ├── economy.js           Shop: pricing, rolling offers, buying, selling
│   ├── wave.js               Wave timing, clearing, random events
│   ├── particles.js          Visual-only feel (shake, sparks, floating damage text)
│   ├── achievements.js        Compendium unlock bookkeeping
│   ├── run.js                Run lifecycle: start/pause/resume/quit/death/end
│   ├── loop.js                The single requestAnimationFrame loop
│   └── saveFile.js            Manual save export/import (downloadable JSON)
│
├── render/                Reads state, draws it. Never mutates game state.
│   ├── canvas.js             The main canvas render pass
│   ├── hud.js                Side panels, banners, event log
│   ├── shop.js                Shop screen + item tooltip
│   ├── compendium.js          Compendium, changelog, stats screens
│   └── screens.js             Screen show/hide, UI scale, brightness, desktop-size gate
│
└── audio/
    └── sfx.js                All sound, synthesized live with Web Audio — no sound files
```

### `state/store.js`

Everything genuinely shared and mutable across the whole app — the current
run, whether it's paused, settings, lifetime stats, unlocks — lives in one
object, `store`, imported wherever it's needed. This is a deliberate,
standard pattern for vanilla JS games (not a "real" state manager like
Redux), chosen because it's the smallest change that gives every piece of
shared state exactly one owner, which is the property that actually
matters here.

One consequence worth knowing if you're adding code: because ES modules
only let you *reassign* an imported variable from the module that
declared it, wholesale replacement of a piece of state (`store.game =
newGameState()` at the start of a run) has to happen via a property
mutation on `store`, not by trying to reassign an imported binding.
Mutating `store.xxx.yyy = ...` from anywhere works fine, as always.

## Why localStorage instead of `window.storage`

Earlier versions of this game were built inside a Claude.ai artifact,
which provides a `window.storage` API specific to that environment. That
API doesn't exist in a normal browser, so `src/storage.js` now uses the
standard `localStorage` behind the exact same `loadJSON`/`saveJSON`
interface — nothing else in the codebase needed to change.

## Testing

`tests/` covers the highest-risk, highest-value logic:

- **`utils.test.js`** — pure helper functions (clamp, formatting, wave pacing)
- **`data.test.js`** — every item's buy/sell math is an exact inverse, every
  event's apply/revert is an exact inverse, every price sits safely above
  its rarity floor, achievement IDs match their unlock triggers, enemy
  splits point at real non-boss enemies
- **`economy.test.js`** — the shop pricing/discount/floor interaction
  (this is where a real bug was found and fixed: a discount could round to
  the same price as the original if the floor was set too close to it —
  this file has regression tests specifically for that)
- **`combat.test.js`** — the damage formula, including the documented
  armor floor (never less than 1 damage) and that dodge is checked
  *before* armor, not after

This is not full coverage of the game (rendering, enemy AI timing, and the
main loop aren't unit-tested — they're better verified by playing) but it
covers the logic that's cheap to get subtly wrong and expensive to notice
by eye.

Tests run in `happy-dom` (a lightweight browser environment for Node)
because some modules touch `document` at import time. `tests/setup.js`
loads the real `index.html` markup and stubs a canvas 2D context, so tests
exercise the actual DOM structure rather than a hand-maintained copy of it
that could drift out of sync.

## What hasn't been playtested

Everything above has been verified the ways a human without hands on a
keyboard can verify it: the production build succeeds, every module's
imports resolve, and 45 automated tests pass. None of that confirms the
game **feels** right to actually play — that needs you, running `npm run
dev` and playing a few runs, ideally comparing side-by-side against the
original single-file version before it's retired.

## Roadmap ideas

- Mobile support (touch input, responsive HUD layout)
- A "continue run" feature — the pieces are close: `state/store.js`
  already centralizes everything a save would need, though
  `store.game.activeEvent.revert` is currently a function reference,
  which can't be serialized to JSON as-is. It'd need to become an event
  ID looked up from `data/events.js` on load instead.
- A Godot port for a real Steam release, using this codebase primarily as
  a design reference (balance numbers, content roster, pacing) rather
  than a direct port target
