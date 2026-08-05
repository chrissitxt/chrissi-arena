import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  effectiveCap, legendaryCap, dodgeCap, legendaryOwnedCount, computeScore
} from '../src/state/derived.js';
import { applyDamageToPlayer } from '../src/systems/combat.js';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { INV_CAP_BASE } from '../src/data/constants.js';

beforeEach(() => {
  store.game = newGameState();
});

describe('derived caps', () => {
  it('effectiveCap defaults to INV_CAP_BASE with no bonuses', () => {
    expect(effectiveCap()).toBe(INV_CAP_BASE);
  });
  it('effectiveCap adds invCapBonus (e.g. from Bottomless Satchel)', () => {
    store.game.player.invCapBonus = 2;
    expect(effectiveCap()).toBe(INV_CAP_BASE + 2);
  });

  it('legendaryCap defaults to 1', () => {
    expect(legendaryCap()).toBe(1);
  });
  it('legendaryCap rises with legendaryCapBonus (Overreach)', () => {
    store.game.player.legendaryCapBonus = 1;
    expect(legendaryCap()).toBe(2);
  });

  it('dodgeCap defaults to 60', () => {
    expect(dodgeCap()).toBe(60);
  });
  it('dodgeCap rises with dodgeCapBonus (Whirlwind Pact takes it to 90)', () => {
    store.game.player.dodgeCapBonus = 30;
    expect(dodgeCap()).toBe(90);
  });

  it('legendaryOwnedCount only counts legendary-rarity items', () => {
    store.game.ownedItems = [
      { item: { rarity: 'legendary' } },
      { item: { rarity: 'common' } },
      { item: { rarity: 'legendary' } }
    ];
    expect(legendaryOwnedCount()).toBe(2);
  });
});

describe('computeScore', () => {
  it('matches the documented formula: wave*100 + kills*2 + gold', () => {
    store.game.wave = 5;
    store.game.kills = 30;
    store.game.gold = 40;
    expect(computeScore()).toBe(5 * 100 + 30 * 2 + 40);
  });
});

describe('applyDamageToPlayer', () => {
  beforeEach(() => {
    // dodge is randomized — pin Math.random so these tests are deterministic
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // never dodges by default
  });

  it('reduces damage by armor, rounded', () => {
    store.game.player.armor = 3;
    store.game.player.hp = 100;
    applyDamageToPlayer(10);
    expect(store.game.player.hp).toBe(100 - Math.round(10 - 3));
  });

  it('never deals less than 1 damage, even against very high armor (the documented armor floor)', () => {
    store.game.player.armor = 999;
    store.game.player.hp = 100;
    applyDamageToPlayer(10);
    expect(store.game.player.hp).toBe(99); // exactly 1 damage got through
  });

  it('does nothing while invulnerable (post-hit i-frames)', () => {
    store.game.player.invulnTime = 0.3;
    store.game.player.hp = 100;
    const dealt = applyDamageToPlayer(50);
    expect(dealt).toBe(false);
    expect(store.game.player.hp).toBe(100);
  });

  it('checks dodge BEFORE armor — a successful dodge negates the hit entirely regardless of armor', () => {
    Math.random.mockReturnValue(0.01); // guaranteed dodge given any nonzero dodge chance
    store.game.player.dodgeChance = 50;
    store.game.player.armor = -999; // would otherwise massively amplify damage
    store.game.player.hp = 100;
    const dealt = applyDamageToPlayer(10);
    expect(dealt).toBe(false);
    expect(store.game.player.hp).toBe(100);
  });

  it('dodge chance is clamped at dodgeCap(), not the raw stat', () => {
    // random() = 0.99 means only a >99% dodge chance could trigger it —
    // set a raw dodge chance far above the cap and confirm it still doesn't
    // dodge, proving the roll is checked against the capped value.
    store.game.player.dodgeChance = 999;
    store.game.player.hp = 100;
    applyDamageToPlayer(10);
    expect(store.game.player.hp).toBeLessThan(100); // it took damage — dodge did not trigger
  });
});
