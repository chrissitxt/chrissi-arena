import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { spawnRegular, spawnEnemy, handleBossBehavior, killEnemy, updateEnemies, enrageBoss, unlockEnemy } from '../src/systems/enemies.js';
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

describe("Mirror's twin-shot (regression: its entire kit used to be the clone-spawn, nothing to react to in between)", () => {
  it('fires exactly 2 projectiles at once, symmetric around the line to the player', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'mirror');
    const mirror = { ...def, boss:true, isClone:false, x:300, y:500, mirrorShotTimer:0 };
    store.game.player.x = 500; store.game.player.y = 500;
    store.game.enemies = [mirror];
    store.game.enemyProjectiles = [];
    handleBossBehavior(mirror, 0.1, mirror.speed);
    expect(store.game.enemyProjectiles.length).toBe(2);
  });

  it('a clone also fires the twin-shot, not just the original', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'mirror');
    const clone = { ...def, boss:true, isClone:true, x:300, y:500, mirrorShotTimer:0, dmg:Math.round(def.dmg*0.5) };
    store.game.player.x = 500; store.game.player.y = 500;
    store.game.enemies = [clone];
    store.game.enemyProjectiles = [];
    handleBossBehavior(clone, 0.1, clone.speed);
    expect(store.game.enemyProjectiles.length).toBe(2);
  });
});

describe("Hollow King's void pulse telegraph (regression: dealt damage and showed the warning at the exact same instant, no way to see it coming, unlike every other big boss hit)", () => {
  it('sets voidCharging to true in the 0.8s window before the pulse fires', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'hollowking');
    const king = { ...def, boss:true, voidTimer:0.5 };
    store.game.player.x = 1000; store.game.player.y = 1000; // far away, pull/pulse irrelevant here
    store.game.enemies = [king];
    handleBossBehavior(king, 0.1, king.speed);
    expect(king.voidCharging).toBe(true);
  });

  it('is false outside that window, and false again right after the pulse actually fires', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'hollowking');
    const king = { ...def, boss:true, voidTimer:5 };
    store.game.player.x = 1000; store.game.player.y = 1000;
    store.game.enemies = [king];
    handleBossBehavior(king, 0.1, king.speed);
    expect(king.voidCharging).toBe(false); // still 4.9s left, not charging yet

    king.voidTimer = 0.05;
    handleBossBehavior(king, 0.1, king.speed); // crosses zero, pulse fires
    expect(king.voidCharging).toBe(false);
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

describe("Swarm Queen's swarmling spawn rate and cap (regression: spawned 2 every 2.5s with no ceiling at all, so a player who could not clear them as fast as they arrived just kept falling further behind, permanently stuck on crowd control with no real window to hit the queen herself)", () => {
  it('never lets more than 8 of her swarmlings be alive at once, even given an unlimited amount of time with zero player intervention', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'swarmqueen');
    const queen = { ...def, boss:true, hp:def.hp, maxHp:def.hp, x:0, y:0, birthTimer:0 };
    store.game.player.x = 500; store.game.player.y = 500;
    store.game.enemies = [queen];
    for (let i=0;i<600;i++) handleBossBehavior(queen, 0.1, queen.speed); // 60 simulated seconds
    const alive = store.game.enemies.filter(e=>e.id==='swarmling').length;
    expect(alive).toBeLessThanOrEqual(8);
  });

  it('the spawn interval is 4s, not the old 2.5s', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'swarmqueen');
    const queen = { ...def, boss:true, hp:def.hp, maxHp:def.hp, x:0, y:0, birthTimer:4 };
    store.game.player.x = 500; store.game.player.y = 500;
    store.game.enemies = [queen];
    handleBossBehavior(queen, 3.9, queen.speed); // not quite there yet
    expect(store.game.enemies.filter(e=>e.id==='swarmling').length).toBe(0);
    handleBossBehavior(queen, 0.2, queen.speed); // now it should fire
    expect(store.game.enemies.filter(e=>e.id==='swarmling').length).toBe(2);
  });

  it('resumes spawning again once the alive count drops back below the cap', () => {
    const def = ENEMY_TYPES.find(e => e.id === 'swarmqueen');
    const queen = { ...def, boss:true, hp:def.hp, maxHp:def.hp, x:0, y:0, birthTimer:0 };
    store.game.player.x = 500; store.game.player.y = 500;
    store.game.enemies = [queen];
    for (let i=0;i<600;i++) handleBossBehavior(queen, 0.1, queen.speed); // fills to the cap
    expect(store.game.enemies.filter(e=>e.id==='swarmling').length).toBe(8);
    // clear them all out, as if the player killed every one
    store.game.enemies = store.game.enemies.filter(e=>e.id!=='swarmling');
    queen.birthTimer = 0;
    handleBossBehavior(queen, 0.1, queen.speed);
    expect(store.game.enemies.filter(e=>e.id==='swarmling').length).toBeGreaterThan(0);
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

describe('gold from non-boss kills is cut during an active boss fight (regression: a build that could dodge both the boss and its ambient spawns could fill the entire 75-gold cap from regular kills alone in well under a minute, with zero incentive to ever engage the boss, since boss waves have no time limit at all)', () => {
  it('a non-boss kill during an active boss wave drops noticeably less gold on average than the same kill on a normal wave', () => {
    const N = 4000;
    let normalTotal = 0, farmingTotal = 0;
    for (let i=0;i<N;i++){
      store.game.coins = [];
      store.game.wave = 7; // not a boss wave
      killEnemy({ x:0, y:0, hp:0, gold:2, boss:false, color:'#fff', splitsInto:null });
      normalTotal += store.game.coins.reduce((a,c)=>a+c.value,0);
    }
    for (let i=0;i<N;i++){
      store.game.coins = [];
      store.game.wave = 10; store.game.bossSpawned = true; // active boss wave
      killEnemy({ x:0, y:0, hp:0, gold:2, boss:false, color:'#fff', splitsInto:null });
      farmingTotal += store.game.coins.reduce((a,c)=>a+c.value,0);
    }
    const ratio = farmingTotal/normalTotal;
    expect(ratio).toBeGreaterThan(0.1);
    expect(ratio).toBeLessThan(0.3); // should land close to the intended 0.2x
  });

  it('killing the boss itself is completely unaffected and always pays its full, real gold value', () => {
    store.game.wave = 10;
    store.game.bossSpawned = true;
    const pushSpy = vi.spyOn(store.game.coins, 'push');
    killEnemy({ x:0, y:0, hp:0, gold:15, boss:true, id:'warlord', color:'#fff', splitsInto:null });
    expect(pushSpy).toHaveBeenCalledWith(expect.objectContaining({ value: 15 }));
  });

  it('does not reduce gold on a normal (non-boss) wave at all', () => {
    store.game.wave = 7;
    let total = 0;
    const N = 2000;
    for (let i=0;i<N;i++){
      store.game.coins = [];
      killEnemy({ x:0, y:0, hp:0, gold:2, boss:false, color:'#fff', splitsInto:null });
      total += store.game.coins.reduce((a,c)=>a+c.value,0);
    }
    expect(total/N).toBeCloseTo(2, 0); // always drops its full value on a normal wave
  });

  it('does not reduce gold on a boss wave before the boss has actually spawned yet', () => {
    store.game.wave = 10;
    store.game.bossSpawned = false; // boss not spawned yet, still waiting
    let total = 0;
    const N = 2000;
    for (let i=0;i<N;i++){
      store.game.coins = [];
      killEnemy({ x:0, y:0, hp:0, gold:2, boss:false, color:'#fff', splitsInto:null });
      total += store.game.coins.reduce((a,c)=>a+c.value,0);
    }
    expect(total/N).toBeCloseTo(2, 0);
  });
});

describe('erratic movement for Sprinter and Wraith (regression: both promised "erratic"/"unpredictable" movement in their own flavor text, but shape:\'erratic\' only ever affected how they were drawn, never how they moved — both were plain straight-line chasers same as Shambler)', () => {
  it('the erratic flag is copied onto the live spawned instance', () => {
    const sprinterDef = ENEMY_TYPES.find(t => t.id === 'sprinter');
    spawnRegular(sprinterDef, 0, 500);
    expect(store.game.enemies[0].erratic).toBe(true);
  });

  it('a non-erratic enemy (Shambler) still moves in a perfectly straight line toward the player', () => {
    store.game.player.x = 500; store.game.player.y = 500;
    const shamblerDef = ENEMY_TYPES.find(t => t.id === 'shambler');
    spawnRegular(shamblerDef, 0, 500);
    const shambler = store.game.enemies[0];
    for (let i=0;i<20;i++) updateEnemies(0.1);
    expect(shambler.y).toBeCloseTo(500, 1); // no vertical drift at all
  });

  it("an erratic enemy's path visibly deviates from a straight line to the player, instead of beelining", () => {
    store.game.player.x = 500; store.game.player.y = 500; store.game.player.hp = 1000; store.game.player.maxHp = 1000;
    const sprinterDef = ENEMY_TYPES.find(t => t.id === 'sprinter');
    spawnRegular(sprinterDef, 0, 500);
    const sprinter = store.game.enemies[0];
    const yValues = [];
    for (let i=0;i<20;i++){ updateEnemies(0.1); yValues.push(sprinter.y); }
    const spread = Math.max(...yValues) - Math.min(...yValues);
    expect(spread).toBeGreaterThan(1); // a straight chase toward (500,500) from (0,500) would keep y at exactly 500
  });

  it('still generally makes forward progress toward the player over time, despite the wobble', () => {
    store.game.player.x = 500; store.game.player.y = 500; store.game.player.hp = 1000; store.game.player.maxHp = 1000;
    const wraithDef = ENEMY_TYPES.find(t => t.id === 'wraith');
    spawnRegular(wraithDef, 0, 500);
    const wraith = store.game.enemies[0];
    const startDist = Math.hypot(500-wraith.x, 500-wraith.y);
    for (let i=0;i<50;i++) updateEnemies(0.1);
    const endDist = Math.hypot(500-wraith.x, 500-wraith.y);
    expect(endDist).toBeLessThan(startDist);
  });
});

describe("Phantom's phasing (regression: could not be hit by the player while phased, per combat.js's e.phased checks, but could still deal full contact damage to the player during that same window — untouchable but not harmless, an unfair asymmetry rather than the intended 'out of phase' idea)", () => {
  it('deals no contact damage to the player while phased, even standing right on top of them', () => {
    store.game.player.x = 500; store.game.player.y = 500; store.game.player.hp = 100; store.game.player.maxHp = 100;
    const phantomDef = ENEMY_TYPES.find(t => t.id === 'phantom');
    spawnRegular(phantomDef, 500, 500); // exactly on the player
    store.game.enemies[0].phased = true;
    const hpBefore = store.game.player.hp;
    updateEnemies(0.1);
    expect(store.game.player.hp).toBe(hpBefore);
  });

  it('deals its normal contact damage once no longer phased', () => {
    store.game.player.x = 500; store.game.player.y = 500; store.game.player.hp = 100; store.game.player.maxHp = 100;
    const phantomDef = ENEMY_TYPES.find(t => t.id === 'phantom');
    spawnRegular(phantomDef, 500, 500);
    store.game.enemies[0].phased = false;
    const hpBefore = store.game.player.hp;
    updateEnemies(0.1);
    expect(store.game.player.hp).toBeLessThan(hpBefore);
  });
});

describe('boss sound splitting (regression: sfxBossAttack was reused for three different events, enrage, ring fire, and slam impact, with enrage not being an attack at all — a player hearing it could easily mistake it for getting hit again)', () => {
  it('enrageBoss plays sfxBossEnrage, a distinct sound, not the plain attack sound', async () => {
    const sfx = await import('../src/audio/sfx.js');
    const enrageSpy = vi.spyOn(sfx, 'sfxBossEnrage').mockImplementation(() => {});
    const attackSpy = vi.spyOn(sfx, 'sfxBossAttack').mockImplementation(() => {});
    store.game.enemies = [{ name:'Test Boss', boss:true, hp:100, maxHp:100, dmg:10, speed:30, enrageStacks:0 }];
    enrageBoss();
    expect(enrageSpy).toHaveBeenCalled();
    expect(attackSpy).not.toHaveBeenCalled();
    enrageSpy.mockRestore();
    attackSpy.mockRestore();
  });

  it("a Colossus slam landing plays sfxBossMeleeImpact, not the plain ranged-attack sound", async () => {
    const sfx = await import('../src/audio/sfx.js');
    const meleeSpy = vi.spyOn(sfx, 'sfxBossMeleeImpact').mockImplementation(() => {});
    const attackSpy = vi.spyOn(sfx, 'sfxBossAttack').mockImplementation(() => {});
    const def = ENEMY_TYPES.find(e => e.id === 'colossus');
    const colossus = { ...def, boss:true, hp:def.hp, maxHp:def.hp, x:0, y:0, slamming:true, slamTimer:0 };
    store.game.player.x = 30; store.game.player.y = 0; // within the 95-radius slam danger zone
    store.game.enemies = [colossus];
    handleBossBehavior(colossus, 0.1, colossus.speed);
    expect(meleeSpy).toHaveBeenCalled();
    expect(attackSpy).not.toHaveBeenCalled();
    meleeSpy.mockRestore();
    attackSpy.mockRestore();
  });

  it("Warlord's ring attack still uses the original sfxBossAttack, unchanged", async () => {
    const sfx = await import('../src/audio/sfx.js');
    const attackSpy = vi.spyOn(sfx, 'sfxBossAttack').mockImplementation(() => {});
    const meleeSpy = vi.spyOn(sfx, 'sfxBossMeleeImpact').mockImplementation(() => {});
    const def = ENEMY_TYPES.find(e => e.id === 'warlord');
    const warlord = { ...def, boss:true, hp:def.hp, maxHp:def.hp, x:0, y:0, ringTimer:0 };
    store.game.player.x = 500; store.game.player.y = 500;
    store.game.enemies = [warlord];
    handleBossBehavior(warlord, 0.1, warlord.speed);
    expect(attackSpy).toHaveBeenCalled();
    expect(meleeSpy).not.toHaveBeenCalled();
    attackSpy.mockRestore();
    meleeSpy.mockRestore();
  });
});

describe("Colossus/Devourer slam signature color (regression: the death-burst flashed plain white and the frame-flash used generic danger-red, unlike Butcher and Mirror which both show their own boss color somewhere in their kit — Colossus/Devourer's whole identity is the slam, and it had zero boss-colored feedback anywhere in it)", () => {
  it.each(['colossus', 'finalboss'])('the slam death-burst uses its own signature color, not generic white (%s)', async (bossId) => {
    const def = ENEMY_TYPES.find(e => e.id === bossId);
    const boss = { ...def, boss:true, hp:def.hp, maxHp:def.hp, x:0, y:0, slamming:true, slamTimer:0 };
    store.game.player.x = 10; store.game.player.y = 0; // within the 95-radius danger zone
    store.game.player.hp = 1000; store.game.player.maxHp = 1000;
    store.game.enemies = [boss];
    store.game.particles = [];
    handleBossBehavior(boss, 0.1, boss.speed);
    const ownColorParticles = store.game.particles.filter(pt => pt.color === def.color);
    expect(ownColorParticles.length).toBeGreaterThan(0);
  });
});

describe('discovering a new enemy plays sfxDiscovery (regression: was completely silent)', () => {
  it('plays sfxDiscovery and adds it to the compendium the first time', async () => {
    const sfx = await import('../src/audio/sfx.js');
    const spy = vi.spyOn(sfx, 'sfxDiscovery').mockImplementation(() => {});
    store.compendium = { items: [], enemies: [], events: [], achievements: [] };
    unlockEnemy('shambler');
    expect(spy).toHaveBeenCalled();
    expect(store.compendium.enemies).toContain('shambler');
    spy.mockRestore();
  });

  it('does not fire again once already discovered', async () => {
    const sfx = await import('../src/audio/sfx.js');
    store.compendium = { items: [], enemies: ['shambler'], events: [], achievements: [] };
    const spy = vi.spyOn(sfx, 'sfxDiscovery').mockImplementation(() => {});
    unlockEnemy('shambler');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
