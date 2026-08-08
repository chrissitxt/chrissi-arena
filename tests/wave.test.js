import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { updateWaveTimer } from '../src/systems/wave.js';

beforeEach(() => {
  store.game = newGameState();
  store.running = true;
});

describe('updateWaveTimer on a boss wave (regression: enrageBoss existed but was never called, and a 150s timer let players skip the boss entirely)', () => {
  it('never auto-finishes a boss wave through time alone, no matter how long it runs', () => {
    store.game.wave = 5;
    store.game.waveActive = true;
    store.game.bossSpawned = true;
    store.game.enemies = [{ id: 'warlord', boss: true, hp: 100, maxHp: 100, dmg: 20, speed: 38 }];

    for (let i = 0; i < 400; i++) updateWaveTimer(1); // 400 simulated seconds
    expect(store.game.waveActive).toBe(true); // still going — only killing the boss ends it
  });

  it('actually enrages the boss once bossEnrageAt is reached, and reschedules the next threshold', () => {
    store.game.wave = 5;
    store.game.waveActive = true;
    store.game.bossSpawned = true;
    const boss = { id: 'warlord', boss: true, hp: 100, maxHp: 100, dmg: 20, speed: 38, enrageStacks: 0 };
    store.game.enemies = [boss];
    store.game.bossEnrageAt = 40;

    for (let i = 0; i < 41; i++) updateWaveTimer(1);
    expect(boss.enrageStacks).toBeGreaterThan(0);
    expect(boss.dmg).toBeGreaterThan(20);
    expect(store.game.bossEnrageAt).toBe(70); // rescheduled 30s later
  });

  it('enrages repeatedly and without limit the longer a fight is avoided', () => {
    store.game.wave = 5;
    store.game.waveActive = true;
    store.game.bossSpawned = true;
    const boss = { id: 'warlord', boss: true, hp: 100, maxHp: 100, dmg: 20, speed: 38, enrageStacks: 0 };
    store.game.enemies = [boss];
    store.game.bossEnrageAt = 40;

    for (let i = 0; i < 200; i++) updateWaveTimer(1); // 200s of stalling
    expect(boss.enrageStacks).toBeGreaterThanOrEqual(5); // at least ~5 enrage ticks by 200s
  });
});

describe('updateHUD wave-urgency feedback (last 5 seconds of a non-boss wave)', () => {
  it('adds the urgent pulse class once 5 seconds or less remain', async () => {
    const { updateHUD } = await import('../src/render/hud.js');
    store.game.waveDuration = 30;
    store.game.waveTime = 26; // 4 seconds left
    store.game.enemies = [];
    updateHUD();
    expect(document.getElementById('timeBar').className).toContain('bar-time-urgent');
  });

  it('does not add the urgent class with more than 5 seconds left', async () => {
    const { updateHUD } = await import('../src/render/hud.js');
    store.game.waveDuration = 30;
    store.game.waveTime = 10; // 20 seconds left
    store.game.enemies = [];
    updateHUD();
    expect(document.getElementById('timeBar').className).not.toContain('bar-time-urgent');
  });

  it('only notifies (plays the cue) once per urgent window, not every frame', async () => {
    const { updateHUD } = await import('../src/render/hud.js');
    store.game.waveDuration = 30;
    store.game.waveTime = 26;
    store.game.enemies = [];
    store.game.waveUrgentNotified = false;
    updateHUD();
    expect(store.game.waveUrgentNotified).toBe(true);
    // calling again while still in the urgent window should not throw or reset
    expect(() => updateHUD()).not.toThrow();
    expect(store.game.waveUrgentNotified).toBe(true);
  });

  it('resets the notified flag once the wave is no longer in the urgent window (e.g. a new wave starts)', async () => {
    const { updateHUD } = await import('../src/render/hud.js');
    store.game.waveDuration = 30;
    store.game.waveTime = 26;
    store.game.enemies = [];
    updateHUD();
    expect(store.game.waveUrgentNotified).toBe(true);

    store.game.waveTime = 0; // new wave started
    updateHUD();
    expect(store.game.waveUrgentNotified).toBe(false);
  });
});
