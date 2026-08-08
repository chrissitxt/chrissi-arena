// persistence layer. everything else calls loadJSON/saveJSON and never
// touches localStorage directly, so swapping the backend later only
// means changing this file
//
// note: an earlier prototype version used a storage api specific to
// the environment it was first built in, that doesn't exist in a
// normal browser, replaced here with plain localStorage, same
// behavior, works anywhere

export const STORE_SETTINGS = 'chrissi-arena:settings';
export const STORE_STATS = 'chrissi-arena:stats';
export const STORE_COMPENDIUM = 'chrissi-arena:compendium';
export const STORE_HISTORY = 'chrissi-arena:history';

// loads and json-parses a value from storage. never throws, returns
// fallback if the key is missing, storage's unavailable, or the value
// isn't valid json
export async function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch (e) {
    // storage unavailable (private browsing etc) or corrupt value, fall through
  }
  return fallback;
}

// json-stringifies and saves a value to storage. never throws, a
// failed save (storage full, unavailable) is silently ignored, best
// effort persistence
export async function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    // ignore, persistence is best-effort, gameplay should never block on it
  }
}
