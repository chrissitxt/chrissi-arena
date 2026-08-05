import { describe, it, expect, beforeEach } from 'vitest';
import { buyItem, openShop } from '../src/systems/economy.js';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { ITEMS } from '../src/data/items.js';

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
