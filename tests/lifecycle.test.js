import { describe, it, expect } from 'vitest';
import { store } from '../src/state/store.js';

describe('run lifecycle (regression: restarting after a run ended used to require an F5 refresh)', () => {
  it('runs multiple full cycles (start -> play -> die -> restart) without throwing or leaving stale state', async () => {
    const { startRun, checkPlayerDeath } = await import('../src/systems/run.js');
    const { update } = await import('../src/systems/loop.js');
    const { render } = await import('../src/render/canvas.js');

    for (let cycle = 0; cycle < 3; cycle++) {
      expect(() => startRun()).not.toThrow();
      expect(store.running).toBe(true);
      expect(store.game.over).toBe(false);

      for (let i = 0; i < 20; i++) {
        expect(() => update(0.016)).not.toThrow();
        expect(() => render()).not.toThrow();
      }

      store.game.player.hp = 0;
      expect(() => checkPlayerDeath()).not.toThrow();
      await new Promise(r => setTimeout(r, 10));
      expect(store.game.over).toBe(true);
    }
  });
});

describe('low-hp heartbeat warning (regression: the single most important survival signal in the game, being critically low on hp, had zero escalating feedback at all, no color change, no pulse, no sound)', () => {
  it('does nothing at healthy hp', async () => {
    const { startRun } = await import('../src/systems/run.js');
    const { update } = await import('../src/systems/loop.js');
    startRun();
    store.game.player.hp = 80; store.game.player.maxHp = 100;
    update(0.1);
    expect(store.game.hpBeatTimer).toBe(0);
  });

  it('starts counting down once hp drops below 25%', async () => {
    const { startRun } = await import('../src/systems/run.js');
    const { update } = await import('../src/systems/loop.js');
    startRun();
    store.game.player.hp = 20; store.game.player.maxHp = 100;
    update(0.1);
    expect(store.game.hpBeatTimer).toBeGreaterThan(0);
  });

  it('the beat interval shrinks as hp drops further, an escalating warning rather than a flat one', async () => {
    const { startRun } = await import('../src/systems/run.js');
    const { update } = await import('../src/systems/loop.js');
    startRun();

    store.game.player.hp = 24; store.game.player.maxHp = 100;
    update(0.001); // just crossed the threshold, timer freshly (re)set
    const intervalNearThreshold = store.game.hpBeatTimer;

    store.game.player.hp = 2; store.game.player.maxHp = 100;
    store.game.hpBeatTimer = 0; // force it to reset fresh at this much lower hp
    update(0.001);
    const intervalNearDeath = store.game.hpBeatTimer;

    expect(intervalNearDeath).toBeLessThan(intervalNearThreshold);
  });

  it('resets cleanly back to 0 once hp recovers above the threshold', async () => {
    const { startRun } = await import('../src/systems/run.js');
    const { update } = await import('../src/systems/loop.js');
    startRun();
    store.game.player.hp = 10; store.game.player.maxHp = 100;
    update(0.1);
    expect(store.game.hpBeatTimer).toBeGreaterThan(0);

    store.game.player.hp = 90;
    update(0.1);
    expect(store.game.hpBeatTimer).toBe(0);
  });
});

describe("Phoenix Heart's revival color (regression: flashed epic orange, #ff9d3d, despite being a legendary item — the game ties color to rarity everywhere else, and the single most dramatic payoff moment of a legendary item was showing the wrong one)", () => {
  it('shows the PHOENIX! text in legendary purple, not epic orange', async () => {
    const { checkPlayerDeath } = await import('../src/systems/run.js');
    store.game.player.hasPhoenix = true;
    store.game.player.phoenixUsed = false;
    store.game.player.hp = 0;
    store.game.damageTexts = [];
    checkPlayerDeath();
    const text = store.game.damageTexts.find(t => t.text === 'PHOENIX!');
    expect(text).toBeDefined();
    expect(text.color).toBe('#c77dff');
    expect(text.color).not.toBe('#ff9d3d');
  });
});
