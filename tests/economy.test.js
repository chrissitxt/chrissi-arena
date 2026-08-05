import { describe, it, expect, beforeEach } from 'vitest';
import { priceFor, offerCost, rollItem } from '../src/systems/economy.js';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { ITEMS } from '../src/data/items.js';
import { RARITY_MIN_PRICE } from '../src/data/constants.js';

beforeEach(() => {
  store.game = newGameState();
});

describe('priceFor (per-copy stacking)', () => {
  it('charges base price for a first copy', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    expect(priceFor(dagger)).toBe(dagger.price);
  });

  it('increases by the 1.25x stacking multiplier per owned copy', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.ownedItems.push({ item: dagger, cost: dagger.price });
    expect(priceFor(dagger)).toBe(Math.round(dagger.price * 1.25));
    store.game.ownedItems.push({ item: dagger, cost: 99 });
    expect(priceFor(dagger)).toBe(Math.round(dagger.price * 1.25 * 1.25));
  });

  it('only counts copies of the SAME item, not other items owned', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    const boots = ITEMS.find(i => i.id === 'boots');
    store.game.ownedItems.push({ item: boots, cost: boots.price });
    expect(priceFor(dagger)).toBe(dagger.price);
  });
});

describe('offerCost (discount + rarity floor interaction)', () => {
  // Regression test for a real bug: the floor was once set equal to some
  // items' base price, which silently swallowed any discount on those
  // items — the shop showed a "SALE" tag but charged the exact same price.
  it('never produces a discounted price equal to the undiscounted price, for every item at every discount in the game\'s actual range (25%-40%)', () => {
    for (const item of ITEMS) {
      const base = priceFor(item);
      for (let pct = 0.25; pct <= 0.40; pct += 0.01) {
        const offer = { item, discounted: true, discountPct: pct };
        const cost = offerCost(offer);
        expect(cost, `${item.id} at ${Math.round(pct * 100)}% off: discounted price equals base price`).toBeLessThan(base);
      }
    }
  });

  it('never charges less than the rarity floor', () => {
    for (const item of ITEMS) {
      const offer = { item, discounted: true, discountPct: 0.40 };
      const cost = offerCost(offer);
      expect(cost).toBeGreaterThanOrEqual(RARITY_MIN_PRICE[item.rarity]);
    }
  });

  it('an undiscounted offer costs exactly priceFor(item)', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    const offer = { item: dagger, discounted: false, discountPct: 0 };
    expect(offerCost(offer)).toBe(priceFor(dagger));
  });
});

describe('rollItem', () => {
  it('never marks an offer as discounted unless the discount actually lowers the price', () => {
    // Run many rolls — rollItem() has its own internal check for this,
    // this test just makes sure that check actually holds in practice.
    for (let i = 0; i < 500; i++) {
      const offer = rollItem();
      if (offer.discounted) {
        expect(offerCost(offer)).toBeLessThan(priceFor(offer.item));
      }
    }
  });

  it('never offers a legendary the player already owns, even when the legendary cap allows more (Overreach)', () => {
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    const overreach = ITEMS.find(i => i.id === 'overreach');
    overreach.apply(store.game.player); // raises legendaryCap to 2, so the cap itself won't block offers
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });
    let sawAnotherLegendary = false;
    for (let i = 0; i < 500; i++) {
      const offer = rollItem();
      if (offer.item.rarity === 'legendary') {
        expect(offer.item.id).not.toBe('phoenix');
        sawAnotherLegendary = true;
      }
    }
    // sanity check the test setup itself actually exercised the legendary path
    expect(sawAnotherLegendary).toBe(true);
  });
});
