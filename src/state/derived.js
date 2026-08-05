// Stats that are computed from the player/game state rather than stored
// directly — "effective" range/damage/fire-rate account for idle bonuses
// and build-size bonuses live, every time they're read, so they can never
// go stale the way a cached value could.

import { store } from './store.js';
import { IDLE_THRESHOLD, INV_CAP_BASE } from '../data/constants.js';

export function isIdle() {
  return (store.game.idleTimer || 0) >= IDLE_THRESHOLD;
}

export function effectiveRange() {
  const p = store.game.player;
  return p.range * (1 + (isIdle() ? (p.idleRangeBonus || 0) / 100 : 0));
}

export function emptySlotBonusPct() {
  const p = store.game.player;
  if (!p.emptySlotDmgPct) return 0;
  const empty = Math.max(0, effectiveCap() - store.game.ownedItems.length);
  return empty * p.emptySlotDmgPct;
}

export function effectiveDamageMult() {
  const p = store.game.player;
  return 1 + (isIdle() ? (p.idleDamageBonus || 0) / 100 : 0) + emptySlotBonusPct() / 100;
}

export function effectiveFireRateMult() {
  const p = store.game.player;
  return 1 + (isIdle() ? (p.idleFireRateBonus || 0) / 100 : 0);
}

export function effectiveCap() {
  return INV_CAP_BASE + (store.game.player.invCapBonus || 0);
}

export function legendaryCap() {
  return 1 + (store.game.player.legendaryCapBonus || 0);
}

export function dodgeCap() {
  return 60 + (store.game.player.dodgeCapBonus || 0);
}

export function legendaryOwnedCount() {
  return store.game.ownedItems.filter(i => i.item.rarity === 'legendary').length;
}

export function computeScore() {
  return store.game.wave * 100 + store.game.kills * 2 + store.game.gold;
}
