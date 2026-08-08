import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { triggerHitStop } from '../src/systems/particles.js';
import { update } from '../src/systems/loop.js';
import { setMusicMode, currentTempoMs } from '../src/audio/sfx.js';

beforeEach(() => {
  store.game = newGameState();
  store.running = true;
  store.game.wave = 5;
});

describe('hit-stop', () => {
  it('actually blocks gameplay updates while active', () => {
    triggerHitStop(0.1);
    const waveTimeBefore = store.game.waveTime;
    const elapsedBefore = store.game.elapsed;
    update(0.05);
    expect(store.game.waveTime).toBe(waveTimeBefore);
    expect(store.game.elapsed).toBe(elapsedBefore);
    expect(store.game.hitStopTimer).toBeCloseTo(0.05, 5);
  });

  it('resumes normal updates once the hit-stop duration elapses', () => {
    triggerHitStop(0.05);
    update(0.05); // exhausts it
    expect(store.game.hitStopTimer).toBeLessThanOrEqual(0);
    const elapsedBefore = store.game.elapsed;
    update(0.05); // should now actually progress
    expect(store.game.elapsed).toBeGreaterThan(elapsedBefore);
  });
});

describe('setMusicMode', () => {
  it('does not throw when switching between main and boss', () => {
    expect(() => setMusicMode('boss')).not.toThrow();
    expect(() => setMusicMode('main')).not.toThrow();
  });
  it('ignores an unknown mode rather than switching to it', () => {
    setMusicMode('main');
    expect(() => setMusicMode('not-a-real-mode')).not.toThrow();
  });
});

describe('music tempo (regression: tempo used to stay panicked forever after death)', () => {
  it('is calm on the menu / before any run has started', () => {
    setMusicMode('main');
    store.game = null;
    store.running = false;
    expect(currentTempoMs()).toBe(340);
  });

  it('speeds up during an active run at low HP', () => {
    setMusicMode('main');
    store.game = newGameState();
    store.running = true;
    store.game.player.hp = 1;
    store.game.player.maxHp = 100;
    expect(currentTempoMs()).toBeLessThan(340);
  });

  it('returns to the calm baseline once the run ends, even though store.game still holds the dead run at 0 HP', () => {
    setMusicMode('main');
    store.game = newGameState();
    store.running = true;
    store.game.player.hp = 1;
    store.game.player.maxHp = 100;
    expect(currentTempoMs()).toBeLessThan(340); // sped up while actually playing

    // simulate death: game object is NOT cleared, only .over and running flip —
    // this is exactly the real endRun() behavior that caused the bug
    store.game.over = true;
    store.game.player.hp = 0;
    store.running = false;
    expect(currentTempoMs()).toBe(340); // must NOT still be panicked
  });
});

describe('triggerFrameFlash', () => {
  it('applies the flash class and CSS custom properties to the canvas frame', async () => {
    const { triggerFrameFlash } = await import('../src/systems/particles.js');
    const frame = document.getElementById('canvasFrame');
    triggerFrameFlash('rgba(1,2,3,1)', 'rgba(1,2,3,0.5)', 0.4);
    expect(frame.classList.contains('frame-flash')).toBe(true);
    expect(frame.style.getPropertyValue('--flash-color')).toBe('rgba(1,2,3,1)');
    expect(frame.style.getPropertyValue('--flash-dur')).toBe('0.4s');
  });

  it('does not throw when called repeatedly in quick succession', async () => {
    const { triggerFrameFlash } = await import('../src/systems/particles.js');
    expect(() => {
      triggerFrameFlash('red', 'red', 0.2);
      triggerFrameFlash('blue', 'blue', 0.2);
      triggerFrameFlash('green', 'green', 0.2);
    }).not.toThrow();
  });
});

describe('scheduleNextFrame (background-tab mitigation: falls back to setTimeout while the tab is hidden, since browsers pause requestAnimationFrame entirely for backgrounded tabs)', () => {
  it('uses requestAnimationFrame while the document is visible', async () => {
    const { scheduleNextFrame } = await import('../src/systems/loop.js');
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    scheduleNextFrame();
    expect(rafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it('falls back to setTimeout while the document is hidden, instead of requestAnimationFrame', async () => {
    const { scheduleNextFrame } = await import('../src/systems/loop.js');
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const timeoutSpy = vi.spyOn(window, 'setTimeout');
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    scheduleNextFrame();
    expect(rafSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
    timeoutSpy.mockRestore();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
});
