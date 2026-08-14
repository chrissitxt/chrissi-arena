import { describe, it, expect } from 'vitest';
import { clamp, fmtPct, waveDurationFor, spawnIntervalFor, migrateAudioSettings } from '../src/utils.js';

describe('clamp', () => {
  it('returns the value when inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps to the lower bound', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('clamps to the upper bound', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it('handles lo === hi', () => {
    expect(clamp(999, 5, 5)).toBe(5);
  });
});

describe('fmtPct', () => {
  it('rounds and appends a percent sign', () => {
    expect(fmtPct(42.4)).toBe('42%');
    expect(fmtPct(42.6)).toBe('43%');
  });
  it('handles zero', () => {
    expect(fmtPct(0)).toBe('0%');
  });
  it('handles negative values (a dodge/crit stat should never actually be negative in play, but the formatter itself should not throw)', () => {
    expect(fmtPct(-5)).toBe('-5%');
  });
});

describe('waveDurationFor', () => {
  it('is monotonically non-decreasing as waves progress', () => {
    let prev = -Infinity;
    for (let w = 1; w <= 60; w++) {
      const d = waveDurationFor(w);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });
  it('is capped at 58 seconds', () => {
    expect(waveDurationFor(100)).toBe(58);
    expect(waveDurationFor(1000)).toBe(58);
  });
  it('starts at wave 1 below the cap', () => {
    expect(waveDurationFor(1)).toBeCloseTo(27.5, 5);
  });
});

describe('spawnIntervalFor', () => {
  it('gets shorter (harder) as waves progress', () => {
    expect(spawnIntervalFor(20)).toBeLessThan(spawnIntervalFor(1));
  });
  it('never goes below the floor of 0.22s', () => {
    expect(spawnIntervalFor(1000)).toBe(0.22);
  });
});

describe('migrateAudioSettings (regression: v0.4.3 replaced the on/off musicOn/sfxOn toggles with 0-5 volume sliders — without a migration, a save from before that update with either set to false would silently come back at full volume, since the old keys mapped to nothing in the new shape)', () => {
  it('converts musicOn:false and sfxOn:false to volume 0', () => {
    const s = migrateAudioSettings({ musicOn:false, sfxOn:false, fps:60 });
    expect(s.musicVolume).toBe(0);
    expect(s.sfxVolume).toBe(0);
    expect(s.musicOn).toBeUndefined();
    expect(s.sfxOn).toBeUndefined();
  });

  it('converts musicOn:true and sfxOn:true to volume 5, not some other value', () => {
    const s = migrateAudioSettings({ musicOn:true, sfxOn:true });
    expect(s.musicVolume).toBe(5);
    expect(s.sfxVolume).toBe(5);
  });

  it('is a no-op on a settings object already in the new format', () => {
    const s = migrateAudioSettings({ musicVolume:2, sfxVolume:4 });
    expect(s.musicVolume).toBe(2);
    expect(s.sfxVolume).toBe(4);
  });

  it('handles null/undefined settings without throwing', () => {
    expect(() => migrateAudioSettings(null)).not.toThrow();
    expect(() => migrateAudioSettings(undefined)).not.toThrow();
    expect(migrateAudioSettings(null)).toBe(null);
  });

  it('does not touch other, unrelated settings keys', () => {
    const s = migrateAudioSettings({ musicOn:false, fps:120, uiSize:'large' });
    expect(s.fps).toBe(120);
    expect(s.uiSize).toBe('large');
  });
});
