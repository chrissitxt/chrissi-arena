// Core numeric tuning constants for the game. Change these to rebalance
// global pacing without touching any game logic.

export const ARENA_W = 1000, ARENA_H = 620;
export const WIN_WAVE = 30;
export const BOSS_EVERY = 5;
export const INV_CAP_BASE = 12;
export const GOLD_CAP = 75;
export const IDLE_THRESHOLD = 1.5;
export const GAME_VERSION = '0.8.0-beta';

// Minimum price a shop offer can ever be clamped to, per rarity — a safety
// floor so a stacked discount can never make an item free. Always keep every
// value here comfortably BELOW the cheapest item of that rarity in items.js,
// or discounts on that item will silently stop working (this bit us once).
export const RARITY_MIN_PRICE = { common:4, rare:10, epic:18, legendary:30, cursed:8 };