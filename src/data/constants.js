// core tuning numbers, change these to rebalance pacing without
// touching any logic

export const ARENA_W = 1000, ARENA_H = 620;
export const WIN_WAVE = 30;
export const BOSS_EVERY = 5;
export const INV_CAP_BASE = 12;
export const GOLD_CAP = 75;
export const ITEM_STACK_LIMIT = 4;
export const IDLE_THRESHOLD = 1.5;
export const GAME_VERSION = '0.4.0-beta';

// minimum price a shop offer can ever be clamped to, per rarity, a
// safety floor so a stacked discount can't make something free. keep
// every value here comfortably below the cheapest item of that rarity
// in items.js or discounts silently stop working (learned that one
// the hard way)
export const RARITY_MIN_PRICE = { common:4, rare:10, epic:18, legendary:30, cursed:8 };
