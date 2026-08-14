// pure functions, no state or dom dependency. easiest stuff to actually
// test, see tests/utils.test.js

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function fmtPct(v) {
  return Math.round(v) + '%';
}

const PCT_STAT_KEYS = ['critChance', 'lifesteal', 'dodgeChance'];

// these stats show as a delta from a hidden default everywhere in the
// ui (main left-panel number, its tooltip, the shop buy preview)
// instead of the raw value, the actual default never gets revealed.
// damage and fire rate are the deliberate exceptions and always show
// their real total
export const DELTA_DISPLAY_KEYS = ['range', 'moveSpeed', 'critMult', 'pickupRadius'];

// formats a single stat value (or a delta from a breakdown row) with
// one consistent convention per stat, shared by the live hud display,
// its tooltip, and the shop's stats panel/preview, so none of them
// can ever show the same number formatted differently
export function fmtStatValue(key, value) {
  if (key === 'critMult') return 'x' + (Math.round(value * 100) / 100);
  if (key === 'fireRate') return (Math.round(value * 100) / 100) + '/s';
  if (PCT_STAT_KEYS.includes(key)) return Math.round(value) + '%';
  if (key === 'damage') return String(Math.round(value * 10) / 10);
  return String(Math.round(value));
}

// seconds a regular wave lasts before enemies stop spawning and it clears
export function waveDurationFor(wave) {
  return Math.min(26 + wave * 1.5, 58);
}

// seconds between regular-enemy spawns during a wave
export function spawnIntervalFor(wave) {
  return Math.max(0.22, 1.2 - wave * 0.03);
}

// v0.4.3 replaced the old musicOn/sfxOn on-off toggles with 0-5 volume
// sliders. Without this, a save from before that change with either set
// to false would silently come back at full volume after loading, since
// the old keys don't map to anything in the new settings shape — a real
// regression for anyone who had deliberately muted the game. Mutates
// and returns the same settings object; safe to call on a save that's
// already on the new format, it's a no-op then.
export function migrateAudioSettings(settings) {
  if (settings && typeof settings.musicOn === 'boolean' && settings.musicVolume === undefined) {
    settings.musicVolume = settings.musicOn ? 5 : 0;
  }
  if (settings && typeof settings.sfxOn === 'boolean' && settings.sfxVolume === undefined) {
    settings.sfxVolume = settings.sfxOn ? 5 : 0;
  }
  if (settings) { delete settings.musicOn; delete settings.sfxOn; }
  return settings;
}
