// Genuinely pure functions — no dependency on game state or the DOM.
// These are the safest, highest-value things to have real tests around,
// since they're exactly the kind of logic that silently breaks when a
// new feature touches something nearby. See tests/utils.test.js.

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function fmtPct(v) {
  return Math.round(v) + '%';
}

/** Seconds a regular wave lasts, before enemies stop spawning and it clears. */
export function waveDurationFor(wave) {
  return Math.min(24 + wave * 1.4, 52);
}

/** Seconds between regular-enemy spawns during a wave. */
export function spawnIntervalFor(wave) {
  return Math.max(0.27, 1.25 - wave * 0.025);
}
