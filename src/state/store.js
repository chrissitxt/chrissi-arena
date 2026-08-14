// the one shared mutable state container for the whole game
//
// every other module imports store from here and reads/writes its
// properties (store.game.player.x, store.running = false, etc) instead
// of holding its own copy. that's the whole point: one place a value
// like "is a run active" or "what wave are we on" lives, so it can't
// drift out of sync between two places that both think they own it,
// which is exactly what caused two real bugs early on (a boss that
// was silently untargetable, enemies vanishing from the compendium),
// both the same root cause: the same state read/written in more than
// one place with no single owner
//
// store.game gets replaced wholesale at the start of every run (see
// systems/run.js:startRun), that's the one case where you do
// store.game = newGameState() instead of mutating in place, and it's
// safe specifically because store itself is never reassigned, only
// its properties are

export const store = {
  // persisted (see storage.js): user settings, lifetime stats, unlocks
  settings: { fps: 60, musicVolume: 5, sfxVolume: 5, uiSize: 'medium', showFps: false, vsyncOn: true },
  stats: { runs: 0, bestWave: 0, bestScore: 0, totalKills: 0, totalGold: 0, totalTime: 0, victories: 0, itemPurchaseCounts: {} },
  compendium: { items: [], enemies: [], events: [], achievements: [] },
  runHistory: [],

  // current run, null when no run is active
  game: null,
  running: false,
  paused: false,

  // main loop bookkeeping
  animHandle: null,
  lastFrameTime: 0,

  // ui navigation
  settingsReturnTo: 'menu',

  // shop screen, per-visit state
  shopOffers: [],
  rerollCost: 3,

  // web audio context, created lazily on first user interaction
  audioCtx: null,

  // current ui scale multiplier (0.85 / 1 / 1.16 for small/medium/large),
  // read by anything converting screen coords to game-space coords,
  // e.g. tooltip positioning
  uiScale: 1,

  // main-menu cheat-code input buffer
  cheatBuffer: '',
  // separate from cheatBuffer above: that one only listens on the menu
  // screen (for unlockall), this one listens during an active run too,
  // since the whole point of godmode is testing deep into a run without
  // dying, not from the main menu
  godmodeCheatBuffer: '',
  godmode: false
};
