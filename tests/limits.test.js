import { describe, it, expect, beforeEach } from 'vitest';
import { buyItem, openShop, sellItem } from '../src/systems/economy.js';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { ITEMS } from '../src/data/items.js';
import { effectiveDamage, emptySlotDamageBonus, commonSynergyDamageBonus, effectiveCap } from '../src/state/derived.js';

beforeEach(() => {
  store.game = newGameState();
  store.game.gold = 999;
});

describe('buyItem enforcement (not just rollItem avoidance)', () => {
  it('actually blocks a manufactured duplicate-legendary purchase attempt', () => {
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    phoenix.apply(store.game.player);
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });

    const before = store.game.ownedItems.length;
    store.shopOffers = [{ item: phoenix, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.length).toBe(before);
    expect(store.shopOffers[0].bought).toBe(false);
  });

  it('actually blocks a purchase attempt once at the legendary cap', () => {
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    const titansgrip = ITEMS.find(i => i.id === 'titansgrip');
    phoenix.apply(store.game.player);
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });

    const before = store.game.ownedItems.length;
    store.shopOffers = [{ item: titansgrip, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.length, 'a second, DIFFERENT legendary should also be blocked at the default cap of 1').toBe(before);
  });

  it('allows a second, different legendary once Overreach raises the cap', () => {
    const overreach = ITEMS.find(i => i.id === 'overreach');
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    const titansgrip = ITEMS.find(i => i.id === 'titansgrip');
    overreach.apply(store.game.player);
    phoenix.apply(store.game.player);
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });

    const before = store.game.ownedItems.length;
    store.shopOffers = [{ item: titansgrip, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.length).toBe(before + 1);
  });

  it('with Overreach, buyItem() actually allows purchasing a second copy of a legendary already owned', () => {
    const overreach = ITEMS.find(i => i.id === 'overreach');
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    overreach.apply(store.game.player);
    phoenix.apply(store.game.player);
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });

    store.shopOffers = [{ item: phoenix, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.filter(i => i.item.id === 'phoenix').length).toBe(2);
  });

  it('the Overreach dupe allowance is spent after one use — a second, different legendary is blocked once one has already been doubled', () => {
    const overreach = ITEMS.find(i => i.id === 'overreach');
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    const titansgrip = ITEMS.find(i => i.id === 'titansgrip');
    overreach.apply(store.game.player);
    phoenix.apply(store.game.player);
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 }); // 2 copies already

    const before = store.game.ownedItems.length;
    store.shopOffers = [{ item: titansgrip, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.length, 'legendaryOwnedCount (2) already equals the Overreach-raised cap (2), so this is blocked by the cap check regardless').toBe(before);
  });

  it('without Overreach, buyItem() still refuses to sell you a second copy of the same legendary', () => {
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    phoenix.apply(store.game.player);
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });

    const before = store.game.ownedItems.length;
    store.shopOffers = [{ item: phoenix, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.length).toBe(before);
  });

  it('blocks a purchase once the build is full', () => {
    for (let i = 0; i < 12; i++) {
      store.game.ownedItems.push({ item: ITEMS.find(it => it.id === 'boots'), cost: 5, applyCount: 1 });
    }
    const dagger = ITEMS.find(i => i.id === 'dagger');
    const before = store.game.ownedItems.length;
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.length).toBe(before);
  });
});

describe('Echo Core (doubles exactly the next eligible purchase, then is consumed and removed from the build)', () => {
  it('does not affect the purchase that buys it', () => {
    const echo = ITEMS.find(i => i.id === 'echocore');
    store.shopOffers = [{ item: echo, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems[0].applyCount).toBe(1);
  });

  it('doubles the very next eligible purchase, then removes itself from the build', () => {
    const echo = ITEMS.find(i => i.id === 'echocore');
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.shopOffers = [{ item: echo, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.some(i => i.item.id === 'echocore')).toBe(true);

    const damageBefore = store.game.player.damage;
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.player.damage).toBe(damageBefore + 3 * 2); // dagger is +3, doubled
    expect(store.game.ownedItems.some(i => i.item.id === 'echocore')).toBe(false); // consumed
    expect(store.game.ownedItems.find(i => i.item.id === 'dagger').applyCount).toBe(2);
  });

  it('does not trigger on a cursed item, and stays armed for the next eligible purchase after that', () => {
    const echo = ITEMS.find(i => i.id === 'echocore');
    const cursed = ITEMS.find(i => i.rarity === 'cursed');
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.gold = 999;
    store.shopOffers = [{ item: echo, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);

    store.shopOffers = [{ item: cursed, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.find(i => i.item.id === cursed.id).applyCount).toBe(1); // not doubled
    expect(store.game.ownedItems.some(i => i.item.id === 'echocore')).toBe(true); // still armed

    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.find(i => i.item.id === 'dagger').applyCount).toBe(2); // doubled here instead
    expect(store.game.ownedItems.some(i => i.item.id === 'echocore')).toBe(false);
  });

  it('does not trigger on a legendary item purchase either', () => {
    const echo = ITEMS.find(i => i.id === 'echocore');
    const legendary = ITEMS.find(i => i.rarity === 'legendary');
    store.game.gold = 999;
    store.shopOffers = [{ item: echo, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    store.shopOffers = [{ item: legendary, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.find(i => i.item.id === legendary.id).applyCount).toBe(1);
    expect(store.game.ownedItems.some(i => i.item.id === 'echocore')).toBe(true);
  });

  it('does not retroactively affect items bought before it', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    const echo = ITEMS.find(i => i.id === 'echocore');
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems[0].applyCount).toBe(1);

    store.shopOffers = [{ item: echo, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems[0].applyCount).toBe(1);
  });

  it('two stacked Echo Cores each consume on their own eligible purchase, one at a time', () => {
    const echo = ITEMS.find(i => i.id === 'echocore');
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.gold = 999;
    store.shopOffers = [{ item: echo, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    store.shopOffers = [{ item: echo, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.filter(i => i.item.id === 'echocore').length).toBe(2);

    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.filter(i => i.item.id === 'echocore').length).toBe(1); // only one consumed
  });
});

describe('stat correctness across non-LIFO sell order (regression: selling items out of purchase order used to leave stats permanently wrong)', () => {
  it('selling a flat +maxHP item while a multiplicative -maxHP item is still owned leaves maxHP exactly correct', () => {
    const vest = ITEMS.find(i => i.id === 'vest'); // +15 max HP, additive
    const overclock = ITEMS.find(i => i.id === 'overclock'); // maxHp *= 0.85, multiplicative
    const baseMaxHp = 100; // newPlayer() default

    store.shopOffers = [{ item: vest, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.player.maxHp).toBeCloseTo(baseMaxHp + 15, 5);

    store.shopOffers = [{ item: overclock, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.player.maxHp).toBeCloseTo((baseMaxHp + 15) * 0.85, 5);

    // sell the FIRST-bought item (vest) while the multiplicative item is still owned —
    // this exact sequence used to corrupt the result
    sellItem('vest');
    expect(store.game.player.maxHp).toBeCloseTo(baseMaxHp * 0.85, 5); // Overclock alone, correctly

    sellItem('overclock');
    expect(store.game.player.maxHp).toBeCloseTo(baseMaxHp, 5); // fully back to the true baseline
  });

  it('holds for damage too, mixing an additive item with a multiplicative one, sold out of order', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger'); // +3 damage, additive
    const glassCannon = ITEMS.find(i => i.id === 'glasscannon'); // damage *= 1.5, multiplicative
    const baseDamage = 8; // newPlayer() default

    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    store.shopOffers = [{ item: glassCannon, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.player.damage).toBeCloseTo((baseDamage + 3) * 1.5, 5);

    sellItem('dagger'); // non-LIFO: sell the earlier purchase first
    expect(store.game.player.damage).toBeCloseTo(baseDamage * 1.5, 5);

    sellItem('glasscannon');
    expect(store.game.player.damage).toBeCloseTo(baseDamage, 5);
  });

  it('preserves current HP (clamped to the new cap) and the one-time Phoenix flag across a recompute', () => {
    const vest = ITEMS.find(i => i.id === 'vest');
    store.game.player.hp = 100; // fully healed at the default 100 max
    store.game.player.phoenixUsed = true; // simulate an already-used revive this run

    store.shopOffers = [{ item: vest, discounted: false, discountPct: 0, bought: false }];
    buyItem(0); // +15 max HP — current HP should NOT auto-heal up to the new cap
    expect(store.game.player.hp).toBe(100);
    expect(store.game.player.maxHp).toBe(115);
    expect(store.game.player.phoenixUsed).toBe(true); // must survive the recompute
  });

  it('buying a max-HP item raises the cap only — it does not auto-heal current HP (deliberate design: "+X max HP" means exactly that, and this also closes a potential buy-item-for-a-free-heal exploit)', () => {
    const vest = ITEMS.find(i => i.id === 'vest');
    store.game.player.hp = 50; // well below the default 100 max
    store.shopOffers = [{ item: vest, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.player.maxHp).toBe(115);
    expect(store.game.player.hp).toBe(50); // unchanged
  });
});

describe("Collector's Charm (common-item synergy, now a flat damage bonus, not a percentage)", () => {
  it('damage bonus scales with the number of common items actually owned, live, at exactly +1 damage per common', () => {
    const charm = ITEMS.find(i => i.id === 'collectorscharm');
    store.shopOffers = [{ item: charm, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    const baseDamage = effectiveDamage();

    const dagger = ITEMS.find(i => i.id === 'dagger'); // common, +3 damage itself
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    // dagger's own +3 plus the charm's +1 per common (1 common now owned)
    expect(effectiveDamage()).toBeCloseTo(baseDamage + 3 + 1, 5);

    const boots = ITEMS.find(i => i.id === 'boots'); // also common, no damage of its own
    store.shopOffers = [{ item: boots, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    const afterTwoCommons = effectiveDamage();
    expect(afterTwoCommons).toBeCloseTo(baseDamage + 3 + 2, 5); // 2 commons now -> +2 flat

    // a rare item should NOT move this bonus at all — it only counts commons
    const fang = ITEMS.find(i => i.id === 'fang'); // rare
    store.shopOffers = [{ item: fang, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(commonSynergyDamageBonus()).toBe(2); // unchanged — fang isn't common
  });

  it('does nothing at all without owning the charm', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(commonSynergyDamageBonus()).toBe(0);
  });
});

describe("Minimalist's Edge (empty-slot synergy, now a flat damage bonus, not a percentage)", () => {
  it('grants exactly +1 damage per empty build slot', () => {
    const edge = ITEMS.find(i => i.id === 'minimalistedge');
    store.shopOffers = [{ item: edge, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    const emptySlots = effectiveCap() - store.game.ownedItems.length;
    expect(emptySlotDamageBonus()).toBe(emptySlots);
  });

  it('the flat bonus is reflected in the actual displayed and dealt damage identically, via effectiveDamage()', () => {
    const edge = ITEMS.find(i => i.id === 'minimalistedge');
    store.shopOffers = [{ item: edge, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    const emptySlots = effectiveCap() - store.game.ownedItems.length;
    expect(effectiveDamage()).toBeCloseTo(store.game.player.damage + emptySlots, 5);
  });

  it('does nothing at all without owning the item', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(emptySlotDamageBonus()).toBe(0);
  });
});

describe('general item stack limit (max 4 copies of any non-legendary item)', () => {
  it('allows buying up to 4 copies', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.gold = 999;
    for (let i = 0; i < 4; i++){
      store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
      buyItem(0);
    }
    expect(store.game.ownedItems.filter(i => i.item.id === 'dagger').length).toBe(4);
  });

  it('blocks a 5th copy of the same item', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.gold = 999;
    for (let i = 0; i < 4; i++){
      store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
      buyItem(0);
    }
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.filter(i => i.item.id === 'dagger').length).toBe(4); // still 4, not 5
  });

  it('does not affect a different item — the limit is per-item, not global', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    const boots = ITEMS.find(i => i.id === 'boots');
    store.game.gold = 999;
    for (let i = 0; i < 4; i++){
      store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
      buyItem(0);
    }
    store.shopOffers = [{ item: boots, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.filter(i => i.item.id === 'boots').length).toBe(1);
  });
});
