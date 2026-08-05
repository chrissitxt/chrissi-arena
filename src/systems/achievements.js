// Compendium unlock bookkeeping. Called from systems/enemies.js (boss
// kills) and systems/wave.js (event triggers) — never call
// saveJSON(STORE_COMPENDIUM, ...) anywhere else, or an unlock could be
// lost to a race between two concurrent saves.

import { sfxAchievement } from '../audio/sfx.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { logEvent } from '../render/hud.js';
import { store } from '../state/store.js';
import { STORE_COMPENDIUM, saveJSON } from '../storage.js';
import { triggerFrameFlash } from './particles.js';

export function unlockAchievement(id){
  if (!store.compendium.achievements.includes(id)){
    store.compendium.achievements.push(id);
    saveJSON(STORE_COMPENDIUM, store.compendium);
    const a = ACHIEVEMENTS.find(x=>x.id===id);
    if (a){ logEvent(`\u{1F3C6} Achievement unlocked: ${a.name}`); sfxAchievement(); triggerFrameFlash('rgba(199,125,255,1)', 'rgba(199,125,255,0.6)', 0.6); }
  }
}
export function unlockEvent(id){ if (!store.compendium.events.includes(id)){ store.compendium.events.push(id); saveJSON(STORE_COMPENDIUM, store.compendium); } }
