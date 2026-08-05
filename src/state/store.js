// The single shared, mutable state container for the whole game.
//
// Every other module imports `store` from here and reads/writes its
// properties (`store.game.player.x`, `store.running = false`, etc.) instead
// of holding its own copy or a stale reference. That's the whole point:
// there is exactly one place a value like "is a run currently active" or
// "what wave are we on" lives, so it can't drift out of sync between two
// places that both think they own it — which is exactly what caused the
// two real bugs found in the original prototype's architecture review
// (a boss that was silently untargetable, and enemies that vanished from
// the compendium) — both were the same root cause: the same piece of
// state read or written in more than one place, with no single owner.
//
// `store.game` itself gets replaced wholesale at the start of every run
// (see systems/run.js:startRun) — that's the one case where you must do
// `store.game = newGameState()` rather than mutating in place, and it's
// safe specifically because `store` itself is never reassigned, only its
// properties are.

export const store = {
  // Persisted (see storage.js) — user settings, lifetime stats, unlocks
  settings: { fps: 60, musicOn: true, sfxOn: true, uiSize: 'medium', showFps: false, vsyncOn: true },
  stats: { runs: 0, bestWave: 0, bestScore: 0, totalKills: 0, totalGold: 0, totalTime: 0, victories: 0, itemPurchaseCounts: {} },
  compendium: { items: [], enemies: [], events: [], achievements: [] },
  runHistory: [],

  // Current run (null when no run is active)
  game: null,
  running: false,
  paused: false,

  // Main loop bookkeeping
  animHandle: null,
  lastFrameTime: 0,

  // UI navigation
  settingsReturnTo: 'menu',

  // Shop screen (per-run-visit state)
  shopOffers: [],
  rerollCost: 3,

  // Web Audio context (created lazily on first user interaction)
  audioCtx: null,

  // Current UI scale multiplier (0.85 / 1 / 1.16 for small/medium/large) —
  // read by anything that needs to convert screen coordinates to
  // game-space coordinates, e.g. tooltip positioning.
  uiScale: 1,

  // Main-menu cheat-code input buffer
  cheatBuffer: ''
};
