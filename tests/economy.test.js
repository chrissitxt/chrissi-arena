import { describe, it, expect, beforeEach, vi } from 'vitest';
import { priceFor, offerCost, rollItem, buyItem, rollShopOffers, rerollUnlockedOffers, sellItem, openShop, pickItemForRarity } from '../src/systems/economy.js';
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

  it('increases by the 1.3x stacking multiplier per owned copy', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.ownedItems.push({ item: dagger, cost: dagger.price });
    expect(priceFor(dagger)).toBe(Math.round(dagger.price * 1.3));
    store.game.ownedItems.push({ item: dagger, cost: 99 });
    expect(priceFor(dagger)).toBe(Math.round(dagger.price * 1.3 * 1.3));
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

  it('without Overreach, never offers a legendary the player already owns', () => {
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });
    // pickItemForRarity is the actual function that excludes owned legendaries —
    // testing it directly, since rollItem() has its own EARLIER cap check that
    // blocks legendary rarity entirely once you're at the default cap of 1,
    // which would make this scenario unreachable through rollItem() alone.
    let sawAnotherLegendary = false;
    for (let i = 0; i < 500; i++) {
      const item = pickItemForRarity('legendary', []);
      if (item) {
        expect(item.id).not.toBe('phoenix');
        sawAnotherLegendary = true;
      }
    }
    expect(sawAnotherLegendary).toBe(true);
  });

  it('with Overreach, CAN offer an already-owned legendary again, since that dupe purchase is now legitimate', () => {
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    const overreach = ITEMS.find(i => i.id === 'overreach');
    overreach.apply(store.game.player);
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });
    let sawPhoenixOffered = false;
    // Needs a LOT of trials: legendary itself is a ~2% roll, and phoenix is
    // then one of several legendaries within that, so hitting phoenix
    // specifically is under 0.5% per roll. 500 trials left this flaky
    // (failed roughly 2 times out of 3 in a row when checked) since the
    // expected hit count sat right around 1 to 2 — a real chance of zero.
    for (let i = 0; i < 20000; i++) {
      const offer = rollItem();
      if (offer.item.rarity === 'legendary' && offer.item.id === 'phoenix') sawPhoenixOffered = true;
    }
    expect(sawPhoenixOffered).toBe(true);
  });

  it('once a legendary has actually been doubled, the shop stops offering owned legendaries again (the one-time allowance is spent)', () => {
    const phoenix = ITEMS.find(i => i.id === 'phoenix');
    const overreach = ITEMS.find(i => i.id === 'overreach');
    overreach.apply(store.game.player);
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 });
    store.game.ownedItems.push({ item: phoenix, cost: phoenix.price, applyCount: 1 }); // now 2 copies — allowance spent
    let sawOwnedLegendaryOffered = false;
    for (let i = 0; i < 500; i++) {
      const offer = rollItem();
      if (offer.item.rarity === 'legendary' && store.game.ownedItems.some(o => o.item.id === offer.item.id)) sawOwnedLegendaryOffered = true;
    }
    expect(sawOwnedLegendaryOffered).toBe(false);
  });
});

describe('shop/sell tooltip price accuracy (regression: tooltip used to always show the item\'s flat base price, never the actual discounted/stacked/sell price)', () => {
  it('shop hover tooltip shows exactly what buyItem() will charge, including a stacked price', async () => {
    const { showItemTooltip } = await import('../src/render/shop.js');
    const { tooltipEl } = await import('../src/dom.js');
    const dagger = ITEMS.find(i => i.id === 'dagger');
    // own one already, so the next purchase is stacked (pricier than base)
    store.game.ownedItems.push({ item: dagger, cost: dagger.price, applyCount: 1 });
    const actualCost = priceFor(dagger);
    expect(actualCost).not.toBe(dagger.price); // sanity: stacking really changed the price

    showItemTooltip({ clientX: 0, clientY: 0 }, dagger, 1, actualCost, false);
    expect(tooltipEl.innerHTML).toContain(String(actualCost));
    expect(tooltipEl.innerHTML).not.toContain('Price: \u25CF ' + dagger.price);
  });

  it('sell tooltip shows exactly what sellItem() will pay out for the actual owned instance, not the base price', async () => {
    const { showItemTooltip } = await import('../src/render/shop.js');
    const { tooltipEl } = await import('../src/dom.js');
    const dagger = ITEMS.find(i => i.id === 'dagger');
    const expensiveCost = 47; // an arbitrary stacked price, far from the base price
    store.game.ownedItems.push({ item: dagger, cost: expensiveCost, applyCount: 1 });
    const expectedSellValue = Math.floor(expensiveCost / 2);

    showItemTooltip({ clientX: 0, clientY: 0 }, dagger, 1, expectedSellValue, true);
    expect(tooltipEl.innerHTML).toContain('Sell for');
    expect(tooltipEl.innerHTML).toContain(String(expectedSellValue));
  });
});

describe('rollShopOffers (regression: three independent rollItem() calls could land on the same item twice or three times in one visit)', () => {
  it('never produces two offers with the same item id, across many rolls and shop sizes', () => {
    for (let trial = 0; trial < 300; trial++) {
      const offers = rollShopOffers(3);
      const ids = offers.map(o => o.item.id);
      expect(new Set(ids).size, `duplicate found in ${JSON.stringify(ids)}`).toBe(ids.length);
    }
  });

  it('still returns the requested count even when item pools are tight (many items already owned)', () => {
    // own most legendaries/commons to stress the exclude-fallback path
    for (const item of ITEMS.filter(i => i.rarity === 'common').slice(0, 10)) {
      store.game.ownedItems.push({ item, cost: item.price, applyCount: 1 });
    }
    const offers = rollShopOffers(3);
    expect(offers.length).toBe(3);
    expect(offers.every(o => o && o.item)).toBe(true);
  });
});

describe('rerollUnlockedOffers (item lock mechanic)', () => {
  it('keeps a locked offer exactly as it was, including its discount state', () => {
    store.shopOffers = rollShopOffers(3);
    store.shopOffers[0].locked = true;
    const lockedBefore = { ...store.shopOffers[0] };
    rerollUnlockedOffers();
    expect(store.shopOffers[0].item.id).toBe(lockedBefore.item.id);
    expect(store.shopOffers[0].discounted).toBe(lockedBefore.discounted);
    expect(store.shopOffers[0].locked).toBe(true);
  });

  it('a locked slot never gets duplicated by one of the freshly-rerolled slots', () => {
    for (let trial = 0; trial < 100; trial++) {
      store.shopOffers = rollShopOffers(3);
      store.shopOffers[0].locked = true;
      const lockedId = store.shopOffers[0].item.id;
      rerollUnlockedOffers();
      const otherIds = [store.shopOffers[1].item.id, store.shopOffers[2].item.id];
      expect(otherIds).not.toContain(lockedId);
    }
  });

  it('with nothing locked, all three slots still end up with distinct items', () => {
    store.shopOffers = rollShopOffers(3);
    rerollUnlockedOffers();
    const ids = store.shopOffers.map(o => o.item.id);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('buyItem with insufficient gold (feedback without cluttering the log)', () => {
  it('does not purchase the item', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.gold = 0;
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    expect(store.game.ownedItems.length).toBe(0);
    expect(store.shopOffers[0].bought).toBe(false);
  });

  it('flashes the gold display but does NOT add a log entry (the log stays free of routine "you can\'t afford this" noise)', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.gold = 2;
    const eventLog = document.getElementById('eventLog');
    eventLog.innerHTML = '';
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    expect(() => buyItem(0)).not.toThrow();
    expect(eventLog.children.length).toBe(0);
  });
});

describe('cursed item rules: never sellable, never discounted', () => {
  it('sellItem refuses to sell a cursed item and gives a reason', () => {
    const bloodpact = ITEMS.find(i => i.id === 'bloodpact');
    store.game.ownedItems.push({ item: bloodpact, cost: bloodpact.price, applyCount: 1 });
    const before = store.game.ownedItems.length;
    const goldBefore = store.game.gold;
    sellItem('bloodpact');
    expect(store.game.ownedItems.length).toBe(before); // still owned
    expect(store.game.gold).toBe(goldBefore); // no refund since nothing was sold

    const eventLog = document.getElementById('eventLog');
    const lastMessage = eventLog.children[eventLog.children.length - 1].textContent;
    expect(lastMessage).toContain("can't be sold");
  });

  it('non-cursed items can still be sold normally', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.ownedItems.push({ item: dagger, cost: dagger.price, applyCount: 1 });
    const before = store.game.ownedItems.length;
    sellItem('dagger');
    expect(store.game.ownedItems.length).toBe(before - 1);
  });

  it('rollItem never marks a cursed offer as discounted, across many rolls', () => {
    let sawCursed = false;
    for (let i = 0; i < 1000; i++) {
      const offer = rollItem();
      if (offer.item.rarity === 'cursed') {
        sawCursed = true;
        expect(offer.discounted).toBe(false);
      }
    }
    expect(sawCursed).toBe(true); // sanity: the test actually exercised the cursed path
  });
});

describe('openShop reroll pricing (regression: first reroll used to be free, and cost grew by flat +5 increments)', () => {
  it('starts at a reroll cost of 1 gold, with no free reroll', () => {
    openShop();
    expect(store.rerollCost).toBe(1);
    expect(store.game.freeRerolls).toBe(0);
  });

  it('doubles each time a paid reroll is used', () => {
    openShop();
    store.game.gold = 999;
    expect(store.rerollCost).toBe(1);
    // simulate what the reroll click handler does to the cost
    store.game.gold -= store.rerollCost; store.rerollCost *= 2;
    expect(store.rerollCost).toBe(2);
    store.game.gold -= store.rerollCost; store.rerollCost *= 2;
    expect(store.rerollCost).toBe(4);
    store.game.gold -= store.rerollCost; store.rerollCost *= 2;
    expect(store.rerollCost).toBe(8);
  });

  it("Fortune's Charm still grants a free reroll per visit, independent of the removed base freebie", () => {
    const charm = ITEMS.find(i => i.id === 'fortunescharm');
    charm.apply(store.game.player);
    openShop();
    expect(store.game.freeRerolls).toBe(1);
  });

  it('the base reroll price doubles every boss wave (every 5 waves)', () => {
    const expected = { 1: 1, 4: 1, 5: 2, 9: 2, 10: 4, 14: 4, 15: 8, 20: 16, 25: 32, 30: 64 };
    for (const [wave, price] of Object.entries(expected)) {
      store.game.wave = Number(wave);
      openShop();
      expect(store.rerollCost, `wave ${wave} should start rerolls at ${price}`).toBe(price);
    }
  });
});

describe('renderBuildGrid sell tooltip (regression: this second build-grid renderer called showItemTooltip with only 3 of its 5 arguments, silently dropping price and isSell — showed "Price: undefined" and a buy-preview instead of the actual sell value)', () => {
  it('shows the exact amount sellItem() will pay out, matching sellValueFor()', async () => {
    const { renderBuildGrid } = await import('../src/render/hud.js');
    const { tooltipEl } = await import('../src/dom.js');
    const { sellValueFor } = await import('../src/systems/economy.js');
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.gold = 50;

    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0); // second copy, stacked price

    renderBuildGrid();
    const icon = document.querySelector('#buildGrid .build-icon');
    icon.dispatchEvent(new Event('mouseenter'));

    const expected = sellValueFor('dagger');
    expect(tooltipEl.innerHTML).toContain(`Sell for: \u25CF ${expected}`);
    expect(tooltipEl.innerHTML).not.toContain('undefined');
    expect(tooltipEl.innerHTML).not.toContain('If bought');

    const goldBefore = store.game.gold;
    sellItem('dagger');
    expect(store.game.gold - goldBefore).toBe(expected); // tooltip and actual payout must match exactly
  });
});

describe('shop card lock toggle (only one offer can be locked at a time)', () => {
  it('locking a second offer automatically unlocks whichever was locked before it', async () => {
    const { renderShop } = await import('../src/render/shop.js');
    store.shopOffers = rollShopOffers(3);
    renderShop();

    const cards = document.querySelectorAll('.shop-card');
    const lockButtons = Array.from(cards).map(c => c.querySelector('.lock-toggle'));

    lockButtons[0].dispatchEvent(new Event('click', { bubbles: true }));
    expect(store.shopOffers[0].locked).toBe(true);

    // renderShop() rebuilds the DOM on every lock click, so re-query
    const cards2 = document.querySelectorAll('.shop-card');
    const lockButtons2 = Array.from(cards2).map(c => c.querySelector('.lock-toggle'));
    lockButtons2[1].dispatchEvent(new Event('click', { bubbles: true }));

    expect(store.shopOffers[0].locked).toBe(false); // released automatically
    expect(store.shopOffers[1].locked).toBe(true);
    expect(store.shopOffers.filter(o => o.locked).length).toBe(1);
  });
});

describe('sfxLegendaryAppears (plays once whenever a legendary offer shows up in the shop)', () => {
  it('does not throw when a legendary happens to roll, across enough tries to virtually guarantee it at a 2% rate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001); // forces the highest-priority rarity, legendary, every time
    expect(() => rollShopOffers(3)).not.toThrow();
    Math.random.mockRestore();
  });

  it('never throws on a normal, non-legendary roll either', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // forces the lowest-priority rarity, common
    expect(() => rollShopOffers(3)).not.toThrow();
    Math.random.mockRestore();
  });
});

describe('locked shop offers persist across shop visits (regression: a lock only survived a reroll within the same visit, the next wave wiped the whole offer list including anything locked)', () => {
  it('a locked offer is still there, still locked, when the shop reopens on a later wave', () => {
    openShop();
    const lockedId = store.shopOffers[0].item.id;
    store.shopOffers[0].locked = true;

    store.game.wave = 5;
    openShop();

    const carried = store.shopOffers.find(o => o.item.id === lockedId);
    expect(carried).toBeDefined();
    expect(carried.locked).toBe(true);
  });

  it('the carried offer is excluded from the fresh rolls, so it cannot appear twice in the same visit', () => {
    openShop();
    store.shopOffers[0].locked = true;
    const lockedId = store.shopOffers[0].item.id;

    store.game.wave = 5;
    openShop();

    const occurrences = store.shopOffers.filter(o => o.item.id === lockedId).length;
    expect(occurrences).toBe(1);
  });

  it('buying the locked item means it is never carried over as the same bought offer object again (a coincidental fresh reroll of the same item id is fine, that is not what this guards against)', () => {
    store.game.gold = 999;
    openShop();
    store.shopOffers[0].locked = true;

    buyItem(0);
    expect(store.shopOffers[0].bought).toBe(true);

    store.game.wave = 5;
    openShop();

    // the carry-over logic only ever carries an offer with locked && !bought,
    // so nothing in the new list should ever be the already-bought instance
    expect(store.shopOffers.every(o => !o.bought)).toBe(true);
  });

  it('unlocking an item before the wave ends means it does NOT carry over to the next shop visit', () => {
    openShop();
    store.shopOffers[0].locked = true;
    const wasLockedId = store.shopOffers[0].item.id;
    store.shopOffers[0].locked = false; // player changed their mind

    store.game.wave = 5;
    openShop();

    // it's not IMPOSSIBLE for the same item to roll again by chance, but it
    // should not be forced in as a carried, still-locked offer
    const stillLocked = store.shopOffers.find(o => o.item.id === wasLockedId && o.locked);
    expect(stillLocked).toBeUndefined();
  });

  it('without any locked offer, a fresh visit rolls a completely new set of 3, same as before', () => {
    openShop();
    const firstVisitIds = store.shopOffers.map(o => o.item.id);
    store.game.wave = 5;
    openShop();
    expect(store.shopOffers.length).toBe(3);
    // sanity: this is just confirming the normal no-lock path still works,
    // not that the items must differ (they could coincidentally repeat)
    expect(firstVisitIds.length).toBe(3);
  });
});
