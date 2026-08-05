// Persistence layer. Everything else in the game calls loadJSON/saveJSON
// and never touches localStorage directly — if you ever need to swap the
// backend (a real server, IndexedDB, a Steam cloud-save API), this is the
// only file that needs to change.
//
// NOTE: earlier versions of this game (built inside a Claude.ai artifact)
// used a `window.storage` API specific to that environment. That API does
// not exist in a normal browser, so it's been replaced here with the
// standard `localStorage` — same behavior, works anywhere.

export const STORE_SETTINGS = 'chrissi-arena:settings';
export const STORE_STATS = 'chrissi-arena:stats';
export const STORE_COMPENDIUM = 'chrissi-arena:compendium';
export const STORE_HISTORY = 'chrissi-arena:history';

/**
 * Load and JSON-parse a value from storage. Never throws — returns
 * `fallback` if the key is missing, storage is unavailable, or the stored
 * value isn't valid JSON.
 */
export async function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch (e) {
    // storage unavailable (e.g. private browsing) or corrupt value — fall through
  }
  return fallback;
}

/**
 * JSON-stringify and save a value to storage. Never throws — a failed save
 * (storage full, unavailable) is silently ignored, matching the original
 * game's best-effort persistence behavior.
 */
export async function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    // ignore — persistence is best-effort, gameplay should never block on it
  }
}
