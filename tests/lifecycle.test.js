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
