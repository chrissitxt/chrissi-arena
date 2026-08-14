import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';

function mockAudioCtx(){
  return {
    currentTime: 0,
    createOscillator: () => ({ type:'', frequency:{setValueAtTime(){}}, connect(){}, start(){}, stop(){} }),
    createGain: () => ({ gain:{setValueAtTime(){}, exponentialRampToValueAtTime(){}}, connect(){} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    createBufferSource: () => ({ buffer:null, connect(){}, start(){} }),
    sampleRate: 44100,
    destination: {},
  };
}

beforeEach(() => {
  store.game = newGameState();
  store.audioCtx = mockAudioCtx();
  store.settings = { sfxVolume:5, musicVolume:5 };
});

describe('beep/noiseBurst independently respect the sfx and music volume sliders (0-5, replacing the old on/off toggles in v0.4.3 — every note of the background music routes through beep()/noiseBurst(), so it needs its own volume path separate from sound effects)', () => {
  it('a regular (non-music) beep call respects sfxVolume and does nothing at 0', async () => {
    const { beep } = await import('../src/audio/sfx.js');
    store.settings.sfxVolume = 0;
    let created = false;
    store.audioCtx.createOscillator = () => { created = true; return mockAudioCtx().createOscillator(); };
    beep(440, 0.1, 'sine', 0.1);
    expect(created).toBe(false);
  });

  it('a music beep call (isMusic=true) plays even when sfxVolume is 0', async () => {
    const { beep } = await import('../src/audio/sfx.js');
    store.settings.sfxVolume = 0;
    let created = false;
    store.audioCtx.createOscillator = () => { created = true; return mockAudioCtx().createOscillator(); };
    beep(440, 0.1, 'sine', 0.1, 0, true);
    expect(created).toBe(true);
  });

  it('a music beep call is silent when musicVolume is 0, independent of sfxVolume', async () => {
    const { beep } = await import('../src/audio/sfx.js');
    store.settings.musicVolume = 0;
    store.settings.sfxVolume = 5;
    let created = false;
    store.audioCtx.createOscillator = () => { created = true; return mockAudioCtx().createOscillator(); };
    beep(440, 0.1, 'sine', 0.1, 0, true);
    expect(created).toBe(false);
  });

  it('a lower volume setting scales the actual gain down, 5 being full volume (unchanged from before)', async () => {
    const { beep } = await import('../src/audio/sfx.js');
    store.settings.sfxVolume = 5;
    let fullVol;
    store.audioCtx.createGain = () => ({ gain:{ setValueAtTime:(v)=>{ fullVol=v; }, exponentialRampToValueAtTime(){} }, connect(){} });
    beep(440, 0.1, 'sine', 0.2);

    store.settings.sfxVolume = 1;
    let quietVol;
    store.audioCtx.createGain = () => ({ gain:{ setValueAtTime:(v)=>{ quietVol=v; }, exponentialRampToValueAtTime(){} }, connect(){} });
    beep(440, 0.1, 'sine', 0.2);

    expect(quietVol).toBeCloseTo(fullVol/5, 5);
  });

  it('missing volume settings default to 5 (full volume) rather than crashing on NaN', async () => {
    const { beep } = await import('../src/audio/sfx.js');
    store.settings = {}; // neither key set at all
    let created = false;
    store.audioCtx.createOscillator = () => { created = true; return mockAudioCtx().createOscillator(); };
    expect(() => beep(440, 0.1, 'sine', 0.1)).not.toThrow();
    expect(created).toBe(true);
  });
});

describe('currentTempoMs (regression: only knew about main/boss, and applied wave/low-hp speedup to every mode including the new menu/victory themes, which should have a fixed, predictable pace)', () => {
  it('each mode has its own distinct base tempo', async () => {
    const { setMusicMode, currentTempoMs } = await import('../src/audio/sfx.js');
    store.running = false;
    const tempos = {};
    for (const mode of ['menu','main','boss','victory']){
      setMusicMode(mode);
      tempos[mode] = currentTempoMs();
    }
    expect(tempos.boss).toBeLessThan(tempos.main); // boss is more urgent
    expect(new Set(Object.values(tempos)).size).toBe(4); // all four are distinct
  });

  it('wave progress and low hp speed up main/boss tempo', async () => {
    const { setMusicMode, currentTempoMs } = await import('../src/audio/sfx.js');
    setMusicMode('main');
    store.running = true;
    store.game.wave = 1;
    const early = currentTempoMs();
    store.game.wave = 30;
    const late = currentTempoMs();
    expect(late).toBeLessThan(early);
    store.game.player.hp = 10; store.game.player.maxHp = 100;
    const lowHp = currentTempoMs();
    expect(lowHp).toBeLessThan(late);
  });

  it('victory tempo ignores wave and hp entirely, staying fixed', async () => {
    const { setMusicMode, currentTempoMs } = await import('../src/audio/sfx.js');
    setMusicMode('victory');
    store.running = true;
    store.game.wave = 30;
    store.game.player.hp = 5; store.game.player.maxHp = 100;
    expect(currentTempoMs()).toBe(300);
  });

  it('menu tempo ignores wave and hp entirely, staying fixed', async () => {
    const { setMusicMode, currentTempoMs } = await import('../src/audio/sfx.js');
    setMusicMode('menu');
    store.running = true; // shouldn't matter, menu mode is excluded from the scaling branch
    store.game.wave = 30;
    expect(currentTempoMs()).toBe(420);
  });
});

describe('music mode transitions across screens (regression: quitting to the menu, either from the pause menu or the victory screen, left the exploring theme playing instead of switching to a dedicated menu theme, and the victory screen had no music identity of its own at all — it just inherited whatever was already playing)', () => {
  it('startRun switches to main mode', async () => {
    const { startRun } = await import('../src/systems/run.js');
    const sfx = await import('../src/audio/sfx.js');
    startRun();
    // musicMode is module-private, but currentTempoMs reflects it indirectly
    expect(sfx.currentTempoMs()).toBeLessThanOrEqual(340);
  });

  it('quitToMenu switches back to menu mode, not main', async () => {
    const { startRun, quitToMenu } = await import('../src/systems/run.js');
    const sfx = await import('../src/audio/sfx.js');
    startRun();
    quitToMenu();
    expect(sfx.currentTempoMs()).toBe(420); // menu's fixed tempo
  });

  it('triggerVictory switches to victory mode', async () => {
    const { triggerVictory } = await import('../src/systems/wave.js');
    const sfx = await import('../src/audio/sfx.js');
    store.running = true;
    await triggerVictory();
    expect(sfx.currentTempoMs()).toBe(300); // victory's fixed tempo
  });
});
