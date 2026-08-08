import { describe, it, expect } from 'vitest';
import { ITEMS, RARITY_WEIGHT, RARITY_ORDER } from '../src/data/items.js';
import { ENEMY_TYPES, BOSS_POOL } from '../src/data/enemies.js';
import { EVENTS } from '../src/data/events.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { RARITY_MIN_PRICE } from '../src/data/constants.js';

/**
 * A representative dummy player object covering every stat any item or
 * event might touch. Kept in sync manually with state/player.js's field
 * list — if newPlayer() ever gains a field an item relies on, add it here
 * too, or that item's test will silently pass without exercising it.
 */
function dummyPlayer() {
  return {
    damage: 10, moveSpeed: 100, armor: 5, maxHp: 100, hp: 100,
    critChance: 5, critMult: 2, lifesteal: 0, projectileCount: 1, pierce: 0,
    fireRate: 1, dodgeChance: 0, goldMult: 1, chainCount: 0, explosiveLevel: 0,
    frostChance: 0, berserkerBonus: 0, hasPhoenix: false, invCapBonus: 0,
    legendaryCapBonus: 0, legendaryDupeBonus: 0, idleRangeBonus: 0, idleDamageBonus: 0, idleFireRateBonus: 0,
    orbitCount: 0, dodgeCapBonus: 0, freeRerollBonus: 0, bombDropLevel: 0,
    stackAmplifier: 0, emptySlotDmgFlat: 0, commonSynergyDmgFlat: 0, cursedStat: 0, pickupRadius: 65, regen: 0
  };
}

describe('ITEMS data integrity', () => {
  it('has 47 items with unique ids', () => {
    expect(ITEMS.length).toBe(47);
    expect(new Set(ITEMS.map(i => i.id)).size).toBe(47);
  });

  it('every item has apply and unapply as exact inverses (excluding the one known, intentional hp-clamp side effect some items have)', () => {
    for (const item of ITEMS) {
      const p = dummyPlayer();
      const before = { ...p };
      delete before.hp; // hp intentionally isn't guaranteed symmetric — see note below
      item.apply(p);
      item.unapply(p);
      const after = { ...p };
      delete after.hp;
      expect(after, `${item.id}: unapply did not exactly reverse apply`).toEqual(before);
    }
  });

  it('every item price sits comfortably above its rarity floor (a price at or below the floor would make its shop discount silently do nothing — this bit us once)', () => {
    for (const item of ITEMS) {
      const floor = RARITY_MIN_PRICE[item.rarity];
      expect(item.price, `${item.id} (${item.rarity}, ${item.price}g) vs floor ${floor}`).toBeGreaterThan(floor);
    }
  });

  it('RARITY_WEIGHT sums to 100', () => {
    const total = Object.values(RARITY_WEIGHT).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('RARITY_ORDER covers exactly the rarities used in RARITY_WEIGHT', () => {
    expect(new Set(RARITY_ORDER)).toEqual(new Set(Object.keys(RARITY_WEIGHT)));
  });

  it("the guide's rarity odds text pairs each rarity name directly with its own value (regression: cursed and legendary were swapped, a reader matching a separate name-list against a separate value-list would think legendary was cursed's actual rate and vice versa)", async () => {
    const { GUIDE_SECTIONS } = await import('../src/data/guide.js');
    const section = GUIDE_SECTIONS.find(s => s.title === 'Item Rarities');
    for (const rarity of ['common', 'rare', 'epic', 'cursed', 'legendary']) {
      expect(section.text, `expected "${rarity} ${RARITY_WEIGHT[rarity]}%" in the guide text`).toContain(`${rarity} ${RARITY_WEIGHT[rarity]}%`);
    }
  });

  it('legendary items are capped at 1 owned by default and Overreach is the only item that raises it', () => {
    const raisesLegendaryCap = ITEMS.filter(i => {
      const p = dummyPlayer();
      i.apply(p);
      return p.legendaryCapBonus > 0;
    });
    expect(raisesLegendaryCap.map(i => i.id)).toEqual(['overreach']);
  });
});

describe('ENEMY_TYPES data integrity', () => {
  it('has 25 enemies with unique ids', () => {
    expect(ENEMY_TYPES.length).toBe(25);
    expect(new Set(ENEMY_TYPES.map(e => e.id)).size).toBe(25);
  });

  it('has exactly 9 bosses: the BOSS_POOL plus the final boss', () => {
    const bosses = ENEMY_TYPES.filter(e => e.boss);
    expect(bosses.length).toBe(9);
    expect(new Set(bosses.map(b => b.id))).toEqual(new Set([...BOSS_POOL, 'finalboss']));
  });

  it('BOSS_POOL has at least 8 bosses, as intended', () => {
    expect(BOSS_POOL.length).toBeGreaterThanOrEqual(8);
  });

  it('every splitsInto value points at a real, non-boss enemy id (so Bloater-style splits never spawn something nonexistent)', () => {
    for (const e of ENEMY_TYPES) {
      if (e.splitsInto) {
        const target = ENEMY_TYPES.find(t => t.id === e.splitsInto);
        expect(target, `${e.id} splits into unknown id '${e.splitsInto}'`).toBeTruthy();
        expect(target.boss, `${e.id} splits into a boss, which is almost certainly wrong`).toBeFalsy();
      }
    }
  });
});

describe('EVENTS data integrity', () => {
  it('has exactly 8 events, 4 positive and 4 negative', () => {
    expect(EVENTS.length).toBe(8);
    expect(EVENTS.filter(e => e.positive).length).toBe(4);
    expect(EVENTS.filter(e => !e.positive).length).toBe(4);
  });

  it('every event apply/revert pair is an exact inverse', () => {
    for (const ev of EVENTS) {
      const p = dummyPlayer();
      const before = { ...p };
      ev.apply(p);
      ev.revert(p);
      expect(p, `${ev.id}: revert did not exactly reverse apply`).toEqual(before);
    }
  });
});

describe('ACHIEVEMENTS data integrity', () => {
  it('has exactly one slay + one flawless achievement per boss (18 total for 9 bosses)', () => {
    expect(ACHIEVEMENTS.length).toBe(18);
    const bossIds = ENEMY_TYPES.filter(e => e.boss).map(e => e.id);
    expect(bossIds.length).toBe(9);
    // note: the final boss's internal id is 'finalboss', but its achievement
    // ids use 'devourer' (its display name) — this mapping lives in
    // systems/enemies.js:killEnemy and must stay in sync with this list.
    const expectedSlay = ['slay_warlord', 'slay_broodmother', 'slay_colossus', 'slay_devourer', 'slay_butcher', 'slay_swarmqueen', 'slay_sentinel', 'slay_mirror', 'slay_hollowking'];
    const expectedFlawless = ['flawless_warlord', 'flawless_broodmother', 'flawless_colossus', 'flawless_devourer', 'flawless_butcher', 'flawless_swarmqueen', 'flawless_sentinel', 'flawless_mirror', 'flawless_hollowking'];
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(ids.sort()).toEqual([...expectedSlay, ...expectedFlawless].sort());
  });
});
