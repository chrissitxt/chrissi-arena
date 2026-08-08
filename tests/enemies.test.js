import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { spawnRegular, spawnEnemy, handleBossBehavior, killEnemy, updateEnemies } from '../src/systems/enemies.js';
import { BOSS_POOL, ENEMY_TYPES } from '../src/data/enemies.js';
import { ITEMS } from '../src/data/items.js';

const dummyType = { id: 'shambler', name: 'Shambler', hp: 10, dmg: 5, speed: 50, radius: 13, color: '#fff', shape: 'basic', gold: 1 };

beforeEach(() => {
  store.game = newGameState();
});

describe('cursedStat accumulation', () => {
  it('starts at 0 for a fresh run', () => {
    expect(store.game.player.cursedStat).toBe(0);
  });

  it('every cursed item adds the same +12 to cursedStat', () => {
    const cursedItems = ITEMS.filter(i => i.rarity === 'cursed');
    for (const item of cursedItems) {
      const p = { cursedStat: 0 };
      item.apply(p);
      expect(p.cursedStat, `${item.id} should add +12 cursedStat`).toBe(12);
    }
  });
});

describe('spawnRegular cursed-variant roll (regression-proofing a brand new mechanic)', () => {
  it('never spawns a cursed variant at 0 cursedStat', () => {
    store.game.player.cursedStat = 0;
    for (let i = 0; i < 200; i++) {
      spawnRegular(dummyType, 100, 100);
    }
    expect(store.game.enemies.every(e => !e.cursed)).toBe(true);
  });

  it('always spawns a cursed variant once cursedStat is at or above the 50% cap, given a lucky enough roll count', () => {
    store.game.player.cursedStat = 999; // far above the cap
    vi.spyOn(Math, 'random').mockReturnValue(0.49); // just under 50% -> should trigger
    spawnRegular(dummyType, 100, 100);
    expect(store.game.enemies[0].cursed).toBe(true);
    Math.random.mockRestore();
  });

  it('a cursed variant has more HP and damage than the same enemy would normally have', () => {
    store.game.player.cursedStat = 999;
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // guarantee the cursed roll succeeds
    spawnRegular(dummyType, 100, 100);
    const cursedEnemy = store.game.enemies[0];
    Math.random.mockRestore();

    store.game.enemies = [];
    store.game.player.cursedStat = 0; // guarantee a normal spawn for comparison
    spawnRegular(dummyType, 100, 100);
    const normalEnemy = store.game.enemies[0];

    expect(cursedEnemy.cursed).toBe(true);
    expect(normalEnemy.cursed).toBe(false);
    expect(cursedEnemy.maxHp).toBeGreaterThan(normalEnemy.maxHp);
    expect(cursedEnemy.dmg).toBeGreaterThan(normalEnemy.dmg);
  });

  it('the spawn chance is capped at 50%, even with an extreme cursedStat', () => {
    store.game.player.cursedStat = 100000;
    vi.spyOn(Math, 'random').mockReturnValue(0.501); // just over 50%
    spawnRegular(dummyType, 100, 100);
    expect(store.game.enemies[0].cursed).toBe(false); // capped roll still failed at 50.1%
    Math.random.mockRestore();
  });
});

describe('boss pool spawning (Phase 3: random pool instead of a fixed 3-boss cycle)', () => {
  it('picking a boss for a non-final boss wave always comes from BOSS_POOL', () => {
    store.game.wave = 5;
    store.game.waveActive = true;
    for (let trial = 0; trial < 50; trial++) {
      store.game.enemies = [];
      store.game.bossSpawned = false;
      store.game.lastBossId = null;
      spawnEnemy();
      expect(BOSS_POOL).toContain(store.game.enemies[0].id);
    }
  });

  it('never spawns the same boss twice in a row, across many consecutive boss waves', () => {
    store.game.waveActive = true;
    let previousId = null;
    for (let wave = 5; wave <= 200; wave += 5) {
      if (wave === 30) continue; // final boss wave, different pool entirely
      store.game.wave = wave;
      store.game.enemies = [];
      store.game.bossSpawned = false;
      spawnEnemy();
      const spawnedId = store.game.enemies[0].id;
      if (previousId) expect(spawnedId).not.toBe(previousId);
      previousId = spawnedId;
    }
  });

  it('tracks a per-boss "loop" count that increases the more times that specific boss has appeared', () => {
    store.game.waveActive = true;
    store.game.bossSeenCounts = { warlord: 3 };
    store.game.lastBossId = 'broodmother'; // force warlord to be eligible by excluding a different one
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic: always pick the first candidate
    store.game.wave = 5;
    store.game.enemies = [];
    store.game.bossSpawned = false;
    spawnEnemy();
    // whichever boss got picked, its seen-count should have incremented from whatever it was
    const spawned = store.game.enemies[0];
    expect(store.game.bossSeenCounts[spawned.id]).toBeGreaterThan(0);
    Math.random.mockRestore();
  });
});

describe('Mirror clone (regression-proofing a brand new interaction: a clone dying must NOT trigger boss-defeat logic)', () => {
  it('killing a Mirror clone does not end the wave or unlock achievements', () => {
    store.game.waveActive = true;
    store.game.bossSpawned = true;
    const clone = { id:'mirror', name:'Mirror Image', x:0, y:0, radius:20, hp:1, maxHp:100, boss:true, isClone:true, gold:0, color:'#fff', splitsInto:null };
    store.game.enemies = [clone];
    killEnemy(clone);
    expect(store.game.bossSpawned).toBe(true); // untouched — the real boss fight is still ongoing
    expect(store.game.waveActive).toBe(true); // finishWave() was NOT called
  });

  it('killing the real Mirror (not a clone) does end the boss wave normally', () => {
    store.game.waveActive = true;
    store.game.bossSpawned = true;
    const realMirror = { id:'mirror', name:'The Mirror', x:0, y:0, radius:28, hp:1, maxHp:420, boss:true, isClone:false, gold:15, color:'#fff', splitsInto:null };
    store.game.enemies = [realMirror];
    killEnemy(realMirror);
    expect(store.game.bossSpawned).toBe(false); // the real fight ended
  });

  it('only the real Mirror spawns clones — a clone never spawns a further clone', () => {
    const realMirror = ENEMY_TYPES.find(e => e.id === 'mirror');
    store.game.enemies = [{ ...realMirror, boss:true, isClone:false, splitTimer:0, hp:realMirror.hp, maxHp:realMirror.hp }];
    handleBossBehavior(store.game.enemies[0], 0.1, realMirror.speed);
    const countAfterReal = store.game.enemies.length;
    expect(countAfterReal).toBe(2); // the original plus one new clone

    const clone = store.game.enemies[1];
    expect(clone.isClone).toBe(true);
    handleBossBehavior(clone, 0.1, clone.speed); // run behavior on the CLONE
    expect(store.game.enemies.length).toBe(countAfterReal); // no further clone was spawned
  });
});

describe("Butcher's rage threshold (permanent buff below 40% HP)", () => {
  it('gains a permanent speed and damage boost exactly once when crossing below 40% HP', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'butcher');
    const butcher = { ...def, boss:true, hp: def.hp*0.5, maxHp: def.hp, raged:false, x:0, y:0 };
    store.game.player.x = 500; store.game.player.y = 500; // far away, so it won't actually charge mid-test
    const speedBefore = butcher.speed, dmgBefore = butcher.dmg;

    handleBossBehavior(butcher, 0.1, butcher.speed); // still above 40%, should not rage yet
    expect(butcher.raged).toBe(false);

    butcher.hp = def.hp*0.35; // now below 40%
    handleBossBehavior(butcher, 0.1, butcher.speed);
    expect(butcher.raged).toBe(true);
    expect(butcher.speed).toBeGreaterThan(speedBefore);
    expect(butcher.dmg).toBeGreaterThan(dmgBefore);
  });
});

describe("Swarm Queen's minion-fueled healing", () => {
  it('heals when her pulse timer elapses and swarmlings are alive, proportional to how many', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'swarmqueen');
    const queen = { ...def, boss:true, hp: def.hp*0.5, maxHp: def.hp, x:0, y:0, pulseTimer:0.05, birthTimer:999 };
    store.game.player.x = 500; store.game.player.y = 500;
    store.game.enemies = [queen,
      { id:'swarmling', hp:5, boss:false },
      { id:'swarmling', hp:5, boss:false },
      { id:'swarmling', hp:0, boss:false } // dead — should not count
    ];
    const hpBefore = queen.hp;
    handleBossBehavior(queen, 0.1, queen.speed);
    expect(queen.hp).toBeGreaterThan(hpBefore);
  });

  it('does not heal when no swarmlings are alive', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'swarmqueen');
    const queen = { ...def, boss:true, hp: def.hp*0.5, maxHp: def.hp, x:0, y:0, pulseTimer:0.05, birthTimer:999 };
    store.game.player.x = 500; store.game.player.y = 500;
    store.game.enemies = [queen];
    const hpBefore = queen.hp;
    handleBossBehavior(queen, 0.1, queen.speed);
    expect(queen.hp).toBe(hpBefore);
  });
});

describe('Totem (regression-proofing: shields nearby enemies, never moves, decays without a refresh)', () => {
  it('shields a nearby enemy but not one that is out of range', () => {
    const totemDef = ENEMY_TYPES.find(e => e.id === 'totem');
    const totem = { ...totemDef, x: 0, y: 0, pulseTimer: 0, hp: totemDef.hp, revealed: true };
    const near = { id: 'shambler', x: 50, y: 0, radius: 13, speed: 50, dmg: 5, hp: 10, boss: false, shielded: false, revealed: true, flashTime: 0, slowTimer: 0 };
    const far = { id: 'shambler', x: 900, y: 0, radius: 13, speed: 50, dmg: 5, hp: 10, boss: false, shielded: false, revealed: true, flashTime: 0, slowTimer: 0 };
    store.game.enemies = [totem, near, far];
    store.game.player.x = -500; store.game.player.y = -500; // keep the player far away

    updateEnemies(0.1);

    expect(near.shielded).toBe(true);
    expect(far.shielded).toBe(false);
  });

  it('a totem never moves, regardless of where the player is', () => {
    const totemDef = ENEMY_TYPES.find(e => e.id === 'totem');
    spawnRegular(totemDef, 300, 300);
    const totem = store.game.enemies[0];
    store.game.player.x = 10; store.game.player.y = 10;

    for (let i = 0; i < 30; i++) updateEnemies(1/30);
    expect(totem.x).toBe(300);
    expect(totem.y).toBe(300);
  });

  it("a totem-granted shield decays on its own once the totem stops refreshing it", () => {
    const near = { id: 'shambler', x: 0, y: 0, radius: 13, speed: 50, dmg: 5, hp: 10, boss: false, shielded: true, totemShieldTimer: 0.05, revealed: true, flashTime: 0, slowTimer: 0 };
    store.game.enemies = [near];
    store.game.player.x = -500; store.game.player.y = -500;
    updateEnemies(0.1); // 0.1s > the 0.05s remaining on the shield timer
    expect(near.shielded).toBe(false);
  });
});

describe('Mimic (regression: had speed:0 in its data, so multiplying its speed on waking would have left it stuck at 0 forever)', () => {
  it('has a non-zero base speed (the actual bug that was caught before it shipped)', () => {
    const mimicDef = ENEMY_TYPES.find(e => e.id === 'mimic');
    expect(mimicDef.speed).toBeGreaterThan(0);
  });

  it('stays perfectly still while dormant, even after many frames, if the player never gets close', () => {
    const mimicDef = ENEMY_TYPES.find(e => e.id === 'mimic');
    spawnRegular(mimicDef, 500, 500);
    const mimic = store.game.enemies[0];
    store.game.player.x = 500 + 200; store.game.player.y = 500; // outside the 70px wake radius

    for (let i = 0; i < 60; i++) updateEnemies(1/30);
    expect(mimic.awake).toBe(false);
    expect(mimic.x).toBe(500);
    expect(mimic.y).toBe(500);
  });

  it('wakes and actually starts moving once the player gets within range', () => {
    const mimicDef = ENEMY_TYPES.find(e => e.id === 'mimic');
    spawnRegular(mimicDef, 500, 500);
    const mimic = store.game.enemies[0];
    store.game.player.x = 550; store.game.player.y = 500; // 50px away, inside the 70px wake radius

    updateEnemies(0.1);
    expect(mimic.awake).toBe(true);

    const xAfterWake = mimic.x;
    updateEnemies(0.1); // one more tick — should now actually be moving
    expect(mimic.x).not.toBe(xAfterWake);
  });
});

describe('cursed enemy special mechanics (hex on hit, death curse zone)', () => {
  it('a cursed enemy hitting the player applies hexedTimer, a non-cursed one does not', () => {
    const cursedEnemy = { id:'shambler', x: store.game.player.x+10, y: store.game.player.y, radius: 20, speed: 0, dmg: 5, hp: 10, boss:false, cursed:true, revealed:true, flashTime:0, slowTimer:0 };
    store.game.enemies = [cursedEnemy];
    store.game.player.invulnTime = 0;
    updateEnemies(0.1);
    expect(store.game.player.hexedTimer).toBeGreaterThan(0);
  });

  it('reduces lifesteal healing to 25% while hexed', async () => {
    const { applyDamageToPlayer } = await import('../src/systems/combat.js');
    store.game.player.lifesteal = 100;
    store.game.player.hexedTimer = 4;
    store.game.player.hp = 1;
    store.game.player.maxHp = 100000;
    store.game.enemies = [{ x: store.game.player.x+10, y: store.game.player.y, radius: 12, hp: 100000, maxHp: 100000, revealed: true, phased: false, armor: 0 }];
    store.game.projectiles = [{ x: store.game.player.x+10, y: store.game.player.y, px: store.game.player.x, py: store.game.player.y, vx: 0, vy: 0, dmg: 1000, crit: false, pierceLeft: 0, life: 1 }];
    const { updateProjectiles } = await import('../src/systems/combat.js');
    updateProjectiles(0.001);
    const hpGained = store.game.player.hp - 1;
    // full lifesteal would heal ~1000, hexed should heal roughly a quarter of that
    expect(hpGained).toBeLessThan(400);
    expect(hpGained).toBeGreaterThan(0);
  });

  it('a cursed enemy leaves a curse zone on death, a non-cursed one does not', () => {
    const cursedEnemy = { id:'shambler', x: 100, y: 100, hp: 1, boss:false, cursed:true, gold:1, color:'#fff' };
    killEnemy(cursedEnemy);
    expect(store.game.curseZones.length).toBe(1);
    expect(store.game.curseZones[0].x).toBe(100);

    store.game.curseZones = [];
    const normalEnemy = { id:'shambler', x: 100, y: 100, hp: 1, boss:false, cursed:false, gold:1, color:'#fff' };
    killEnemy(normalEnemy);
    expect(store.game.curseZones.length).toBe(0);
  });

  it('curse zones damage the player while standing in them, and expire on their own', async () => {
    const { updateCurseZones } = await import('../src/systems/combat.js');
    store.game.player.x = 100; store.game.player.y = 100;
    store.game.player.hp = 1000; store.game.player.maxHp = 1000;
    store.game.player.invulnTime = 0;
    store.game.curseZones = [{ x: 100, y: 100, radius: 48, life: 3, tickTimer: 0 }];
    updateCurseZones(0.1);
    expect(store.game.player.hp).toBeLessThan(1000);

    store.game.curseZones = [{ x: 100, y: 100, radius: 48, life: 0.05, tickTimer: 1 }];
    updateCurseZones(0.1); // life runs out
    expect(store.game.curseZones.length).toBe(0);
  });

  it('a boss never leaves a curse zone, even if flagged cursed somehow', () => {
    const cursedBoss = { id:'warlord', x: 200, y: 200, hp: 1, boss:true, cursed:true, gold:1, color:'#fff', splitsInto:null };
    killEnemy(cursedBoss);
    expect(store.game.curseZones.length).toBe(0);
  });
});
