// figures out exactly how each stat got to its current value: a base
// number, then one row per owned item that changed it, in order.
// powers the stat tooltips and the shop's buy preview
//
// reuses the same trick recomputePlayerStats() uses (fresh player,
// every owned item re-applied in order) so this can't drift out of
// sync with the real value, one source of truth instead of two

import { newPlayer } from './player.js';
import { INV_CAP_BASE } from '../data/constants.js';
import { store } from './store.js';

export const BREAKDOWN_STAT_KEYS = [
  { key: 'damage', label: 'Damage' },
  { key: 'range', label: 'Range' },
  { key: 'armor', label: 'Armor' },
  { key: 'maxHp', label: 'Max HP' },
  { key: 'fireRate', label: 'Attack Speed' },
  { key: 'moveSpeed', label: 'Move Speed' },
  { key: 'critChance', label: 'Crit Chance' },
  { key: 'critMult', label: 'Crit Damage' },
  { key: 'lifesteal', label: 'Lifesteal' },
  { key: 'dodgeChance', label: 'Dodge Chance' },
  { key: 'pickupRadius', label: 'Pickup Range' },
  { key: 'goldMult', label: 'Gold Gain' },
  { key: 'cursedStat', label: 'Cursed' }
];

// ownedItems is the same shape as store.game.ownedItems: a list of
// { item, applyCount }. returns per tracked stat key:
// { label, base, final, rows: [{ name, delta, from, to }, ...] }
export function computeStatBreakdown(ownedItems){
  const fresh = newPlayer();
  const entries = {};
  for (const { key, label } of BREAKDOWN_STAT_KEYS){
    entries[key] = { label, base: fresh[key], rows: [] };
  }

  const current = fresh;
  for (const inst of ownedItems){
    const times = inst.applyCount || 1;
    for (let t = 0; t < times; t++){
      const before = { ...current };
      inst.item.apply(current);
      for (const { key } of BREAKDOWN_STAT_KEYS){
        if (current[key] === before[key]) continue;
        const delta = current[key] - before[key];
        const rows = entries[key].rows;
        const last = rows[rows.length - 1];
        // fold a multi-application (echo core doubling one purchase)
        // into one row instead of showing the same item name twice
        if (t > 0 && last && last.name === inst.item.name){
          last.delta += delta;
          last.to = current[key];
        } else {
          rows.push({ name: inst.item.name, delta, from: before[key], to: current[key] });
        }
      }
    }
  }

  for (const { key } of BREAKDOWN_STAT_KEYS) entries[key].final = current[key];

  // an active event applies on top of every item, exactly once, same
  // as recomputePlayerStats() does it, so this has to mirror that
  // order to stay accurate
  if (store.game && store.game.activeEvent && store.game.activeEvent.apply){
    const before = { ...current };
    store.game.activeEvent.apply(current);
    for (const { key } of BREAKDOWN_STAT_KEYS){
      if (current[key] === before[key]) continue;
      entries[key].rows.push({ name: `${store.game.activeEvent.label} (event)`, delta: current[key]-before[key], from: before[key], to: current[key] });
      entries[key].final = current[key];
    }
  }

  // minimalist's edge and collector's charm don't touch p.damage
  // directly, they set a flat-bonus field that a separate calculation
  // in derived.js turns into extra damage. so the loop above never
  // catches them, add them here as their own rows. flat additions, no
  // shared-multiplier math to untangle, each source's number is
  // already exactly what to show
  if (current.emptySlotDmgFlat){
    const cap = INV_CAP_BASE + (current.invCapBonus||0);
    const empty = Math.max(0, cap - ownedItems.length);
    const bonus = empty * current.emptySlotDmgFlat;
    if (bonus > 0){
      entries.damage.rows.push({ name: "Minimalist's Edge", delta: bonus, from: entries.damage.final, to: entries.damage.final+bonus });
      entries.damage.final += bonus;
    }
  }
  if (current.commonSynergyDmgFlat){
    const commonCount = ownedItems.filter(i => i.item.rarity === 'common').length;
    const bonus = commonCount * current.commonSynergyDmgFlat;
    if (bonus > 0){
      entries.damage.rows.push({ name: "Collector's Charm", delta: bonus, from: entries.damage.final, to: entries.damage.final+bonus });
      entries.damage.final += bonus;
    }
  }

  return entries;
}

// what each tracked stat would become if hypotheticalItem got bought
// right now (with applyTimes applications, matching whatever echo core
// would currently do), on top of everything already owned. pure
// preview, never touches real state, only returns stats that'd change
export function previewStatDelta(ownedItems, hypotheticalItem, applyTimes){
  const before = computeStatBreakdown(ownedItems);
  const after = computeStatBreakdown([...ownedItems, { item: hypotheticalItem, applyCount: applyTimes || 1 }]);
  const changed = {};
  for (const { key, label } of BREAKDOWN_STAT_KEYS){
    if (before[key].final !== after[key].final){
      changed[key] = { label, from: before[key].final, to: after[key].final };
    }
  }
  return changed;
}
