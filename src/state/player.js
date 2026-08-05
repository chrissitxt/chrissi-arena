// Factory for a fresh player object at the start of every run.
// Every field the game reads from `player` must be initialized here —
// see the project README for why this matters (a whole class of bug in
// the original prototype came from state fields that weren't).

import { ARENA_W, ARENA_H } from '../data/constants.js';

export function newPlayer() {
  return {
    x: ARENA_W / 2, y: ARENA_H / 2, radius: 13, range: 200,
    hp: 100, maxHp: 100, armor: 0, damage: 8, fireRate: 1.6, moveSpeed: 190,
    critChance: 5, critMult: 2.0, lifesteal: 0, projectileCount: 1, pierce: 0,
    pickupRadius: 65, dodgeChance: 0, goldMult: 1, chainCount: 0, explosiveLevel: 0,
    frostChance: 0, berserkerBonus: 0, hasPhoenix: false, phoenixUsed: false, regen: 0,
    invulnTime: 0, fireTimer: 0, jamTimer: 0, invCapBonus: 0, legendaryCapBonus: 0,
    idleRangeBonus: 0, idleDamageBonus: 0, idleFireRateBonus: 0,
    orbitCount: 0, dodgeCapBonus: 0,
    freeRerollBonus: 0, bombDropLevel: 0, stackAmplifier: 0, emptySlotDmgPct: 0
  };
}
