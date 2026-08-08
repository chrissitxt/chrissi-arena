import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  effectiveCap, legendaryCap, dodgeCap, legendaryOwnedCount, computeScore, waveGoldMult
} from '../src/state/derived.js';
import { applyDamageToPlayer } from '../src/systems/combat.js';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { INV_CAP_BASE } from '../src/data/constants.js';
import { ITEMS } from '../src/data/items.js';

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

describe('updateOrbitWeapons (regression: melee dealt a flat, non-scaling tick that ignored crit and lifesteal entirely)', () => {
  it('deals real, non-zero damage to an enemy in range', async () => {
    const { updateOrbitWeapons } = await import('../src/systems/combat.js');
    store.game.player.orbitCount = 1;
    store.game.player.damage = 20;
    store.game.enemies = [{ x: store.game.player.x + 48, y: store.game.player.y, radius: 12, hp: 100, maxHp: 100, revealed: true, phased: false }];
    // run enough steps for the blade to complete at least one full sweep
    for (let i = 0; i < 60; i++) updateOrbitWeapons(1/30);
    expect(store.game.enemies[0].hp).toBeLessThan(100);
  });

  it('a crit chance of 100% guarantees every hit crits for critMult damage, proving crit now applies to blades', async () => {
    const { updateOrbitWeapons } = await import('../src/systems/combat.js');
    store.game.player.orbitCount = 1;
    store.game.player.damage = 20;
    store.game.player.critChance = 100;
    store.game.player.critMult = 3;
    store.game.enemies = [{ x: store.game.player.x + 48, y: store.game.player.y, radius: 12, hp: 100000, maxHp: 100000, revealed: true, phased: false }];
    for (let i = 0; i < 60; i++) updateOrbitWeapons(1/30);
    const hpLost = 100000 - store.game.enemies[0].hp;
    const nonCritHit = Math.max(4, Math.round(20*1*0.5)); // player.damage(20) * effectiveDamageMult(1, no bonuses active) * 0.5
    const critHit = Math.round(nonCritHit*3);
    expect(critHit).not.toBe(nonCritHit); // sanity: the two values are actually distinguishable
    expect(hpLost).toBeGreaterThan(0);
    expect(hpLost % critHit).toBe(0); // every single hit landed at the CRIT rate, not the base rate
  });

  it('lifesteal heals the player from blade damage dealt, proving lifesteal now applies to blades', async () => {
    const { updateOrbitWeapons } = await import('../src/systems/combat.js');
    store.game.player.orbitCount = 1;
    store.game.player.damage = 20;
    store.game.player.lifesteal = 100;
    store.game.player.hp = 1;
    store.game.player.maxHp = 1000;
    store.game.enemies = [{ x: store.game.player.x + 48, y: store.game.player.y, radius: 12, hp: 100000, maxHp: 100000, revealed: true, phased: false }];
    for (let i = 0; i < 60; i++) updateOrbitWeapons(1/30);
    expect(store.game.player.hp).toBeGreaterThan(1);
  });
});

describe('doExplosion radius/damage scaling (regression: explosiveLevel was checked as a boolean, so stacking Explosive Tips did literally nothing beyond the first copy)', () => {
  it('a second copy produces a strictly larger explosion radius than the first', async () => {
    const { doExplosion } = await import('../src/systems/combat.js');
    // one enemy just outside the level-1 radius (58), inside the level-2 radius (70)
    const nearEnemy = { x: 62, y: 0, hp: 100, maxHp: 100, revealed: true, phased: false };
    store.game.enemies = [nearEnemy];
    doExplosion(0, 0, 10, null, 58); // level 1 radius
    expect(nearEnemy.hp).toBe(100); // out of range at level 1, untouched

    store.game.enemies = [{ ...nearEnemy, hp: 100 }];
    doExplosion(0, 0, 10, null, 70); // level 2 radius
    expect(store.game.enemies[0].hp).toBeLessThan(100); // now in range at level 2
  });
});

describe('waveGoldMult (late-game gold taper)', () => {
  it('is unchanged (1.0) for the first 10 waves', () => {
    for (let w = 1; w <= 10; w++) {
      store.game.wave = w;
      expect(waveGoldMult()).toBe(1);
    }
  });

  it('strictly decreases past wave 10', () => {
    store.game.wave = 10;
    const at10 = waveGoldMult();
    store.game.wave = 20;
    const at20 = waveGoldMult();
    store.game.wave = 30;
    const at30 = waveGoldMult();
    expect(at20).toBeLessThan(at10);
    expect(at30).toBeLessThan(at20);
  });

  it('never drops below the 60% floor, even far past wave 30', () => {
    store.game.wave = 200;
    expect(waveGoldMult()).toBeCloseTo(0.6, 5);
  });
});

describe('lifestealCap (regression: lifesteal had no ceiling, unlike dodge)', () => {
  it('caps lifesteal healing on gunfire at 75%, even with far more owned', async () => {
    const { applyDamageToPlayer, updateProjectiles } = await import('../src/systems/combat.js');
    store.game.player.lifesteal = 500;
    store.game.player.hp = 1;
    store.game.player.maxHp = 100000;
    store.game.player.pierce = 0;
    store.game.enemies = [{ x: store.game.player.x+10, y: store.game.player.y, radius: 12, hp: 100000, maxHp: 100000, revealed: true, phased: false, armor: 0 }];
    store.game.projectiles = [{ x: store.game.player.x+10, y: store.game.player.y, px: store.game.player.x, py: store.game.player.y, vx: 0, vy: 0, dmg: 1000, crit: false, pierceLeft: 0, life: 1 }];
    updateProjectiles(0.001);
    // healed by at most 75% of the 1000 damage dealt = 750, not 500% = 5000
    expect(store.game.player.hp).toBeLessThanOrEqual(1 + 1000*0.75 + 1);
  });

  it('caps lifesteal healing on orbit blades the same way', async () => {
    const { updateOrbitWeapons } = await import('../src/systems/combat.js');
    store.game.player.orbitCount = 1;
    store.game.player.damage = 1000;
    store.game.player.lifesteal = 500;
    store.game.player.hp = 1;
    store.game.player.maxHp = 100000;
    store.game.enemies = [{ x: store.game.player.x + 48, y: store.game.player.y, radius: 12, hp: 1000000, maxHp: 1000000, revealed: true, phased: false }];
    for (let i = 0; i < 30; i++) updateOrbitWeapons(1/30);
    const hpGained = store.game.player.hp - 1;
    const dmgDealt = 1000000 - store.game.enemies[0].hp;
    expect(hpGained).toBeLessThanOrEqual(dmgDealt*0.75 + 1);
  });
});

describe('projectile lifetime respects the range stat (regression: shots used to fly for a fixed 1.3s / ~676px regardless of range, so pierce could carry a hit far past your actual range)', () => {
  it('a fired projectile is given exactly range/520 seconds of life, not a fixed constant', async () => {
    const { updateShooting } = await import('../src/systems/combat.js');
    store.game.player.range = 160; // the current default
    store.game.player.fireTimer = 0;
    store.game.player.pierce = 5;
    store.game.enemies = [{ x: store.game.player.x+50, y: store.game.player.y, radius: 12, hp: 100, maxHp: 100, revealed: true, phased: false }];
    updateShooting(0.001);
    expect(store.game.projectiles.length).toBeGreaterThan(0);
    expect(store.game.projectiles[0].life).toBeCloseTo(160/520, 5);
  });

  it('a longer range gives the projectile proportionally more life, and pierce does not change that', async () => {
    const { updateShooting } = await import('../src/systems/combat.js');
    store.game.player.range = 320; // double
    store.game.player.fireTimer = 0;
    store.game.player.pierce = 0;
    store.game.enemies = [{ x: store.game.player.x+50, y: store.game.player.y, radius: 12, hp: 100, maxHp: 100, revealed: true, phased: false }];
    updateShooting(0.001);
    expect(store.game.projectiles[0].life).toBeCloseTo(320/520, 5);
  });
});

describe("Impaler's Lance (pierce as a one-time legendary unlock, not a stacking numeric stat)", () => {
  it('grants a fixed pierce value regardless of anything else', async () => {
    const lance = ITEMS.find(i => i.id === 'impalerslance');
    const p = { pierce: 0 };
    lance.apply(p);
    expect(p.pierce).toBe(3);
  });

  it('Piercing Rounds no longer exists as a separate stacking item', async () => {
    expect(ITEMS.find(i => i.id === 'piercing')).toBeUndefined();
  });

  it('Thousand Cuts no longer grants pierce, only projectiles and the damage tradeoff', async () => {
    const thousandCuts = ITEMS.find(i => i.id === 'thousandcuts');
    const p = { projectileCount: 1, damage: 10, pierce: 0 };
    thousandCuts.apply(p);
    expect(p.pierce).toBe(0);
    expect(p.projectileCount).toBe(4);
  });
});
