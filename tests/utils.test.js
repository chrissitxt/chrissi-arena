import { describe, it, expect } from 'vitest';
import { clamp, fmtPct, waveDurationFor, spawnIntervalFor } from '../src/utils.js';

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
