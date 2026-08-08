// stats computed from player/game state instead of stored directly, so
// idle and build-size bonuses never go stale like a cached value could

import { store } from './store.js';
import { IDLE_THRESHOLD, INV_CAP_BASE } from '../data/constants.js';
import { newPlayer } from './player.js';

const BASE_PLAYER = newPlayer();

// displays a stat as its distance from the game's own default, not the
// raw number. the default (e.g. 190 move speed, 160 range) is real and
// unchanged internally, just never shown directly, because to a player
// "0" reads as "untouched baseline" way more clearly than "190" ever
// could. buff pushes it up, debuff pushes it down, possibly negative.
// used by the left-panel display, its tooltip, and the shop buy
// preview so the real default never leaks out anywhere
export function fmtDeltaFromBase(key, currentValue, decimals){
  const mult = decimals ? Math.pow(10, decimals) : 1;
  const delta = Math.round((currentValue - BASE_PLAYER[key]) * mult) / mult;
  return delta > 0 ? '+'+delta : String(delta);
}

export function isIdle() {
  return (store.game.idleTimer || 0) >= IDLE_THRESHOLD;
}

export function effectiveRange() {
  const p = store.game.player;
  return p.range * (1 + (isIdle() ? (p.idleRangeBonus || 0) / 100 : 0));
}

export function emptySlotDamageBonus() {
  const p = store.game.player;
  if (!p.emptySlotDmgFlat) return 0;
  const empty = Math.max(0, effectiveCap() - store.game.ownedItems.length);
  return empty * p.emptySlotDmgFlat;
}

export function commonSynergyDamageBonus() {
  const p = store.game.player;
  if (!p.commonSynergyDmgFlat) return 0;
  const commonCount = store.game.ownedItems.filter(i => i.item.rarity === 'common').length;
  return commonCount * p.commonSynergyDmgFlat;
}

export function effectiveDamageMult() {
  const p = store.game.player;
  return 1 + (isIdle() ? (p.idleDamageBonus || 0) / 100 : 0);
}

// the real, final damage number shown and dealt: the multiplicative
// chain (items, idle bonus) applied to raw damage, plus minimalist's
// edge and collector's charm's flat bonuses added on top. those two
// used to be folded into effectiveDamageMult() as a percentage, which
// was basically impossible to actually feel. flat round numbers are
// way more tangible and simpler to show right in a breakdown tooltip
export function effectiveDamage() {
  const p = store.game.player;
  return p.damage * effectiveDamageMult() + emptySlotDamageBonus() + commonSynergyDamageBonus();
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

export function lifestealCap() {
  return 75 + (store.game.player.lifestealCapBonus || 0);
}

export function legendaryOwnedCount() {
  return store.game.ownedItems.filter(i => i.item.rarity === 'legendary').length;
}

export function computeScore() {
  return store.game.wave * 100 + store.game.kills * 2 + store.game.gold;
}

// gold income tapers off in later waves, unchanged through wave 10,
// then down to a 60% floor by around wave 30. keeps the economy from
// snowballing forever and makes stalling to avoid a boss less
// rewarding than actually progressing
export function waveGoldMult() {
  const wave = store.game.wave;
  return Math.max(0.6, 1 - Math.max(0, wave - 10) * 0.02);
}
