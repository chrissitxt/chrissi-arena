// wave lifecycle: countdown, clearing, random temporary events (1-4
// waves, auto-reverted), endless mode continue/victory
//
// triggerVictory has a deliberate if (!store.running) return; guard in
// its setTimeout, without it quitting to menu during the ~900ms
// victory banner still forces the victory screen open a moment later.
// don't remove it

import { sfxEvent, sfxVictory, sfxWaveClear } from '../audio/sfx.js';
import { ARENA_H, ARENA_W } from '../data/constants.js';
import { EVENTS } from '../data/events.js';
import { logEvent, showWaveBanner, renderPostRunSummary } from '../render/hud.js';
import { showScreen } from '../render/screens.js';
import { computeScore } from '../state/derived.js';
import { store } from '../state/store.js';
import { STORE_STATS, saveJSON } from '../storage.js';
import { unlockEvent } from './achievements.js';
import { openShop } from './economy.js';
import { isBossWaveNow, spawnEnemy, enrageBoss } from './enemies.js';
import { triggerShake, triggerFrameFlash } from './particles.js';
import { spawnIntervalFor, waveDurationFor } from '../utils.js';

export function updateWaveTimer(dt){
  if (!store.game.waveActive) return;
  const bossWave = isBossWaveNow();
  store.game.spawnTimer -= dt;
  if (store.game.spawnTimer<=0){
    store.game.spawnTimer = spawnIntervalFor(store.game.wave);
    if (bossWave){
      if (!store.game.bossSpawned) spawnEnemy();
      else if (store.game.enemies.filter(e=>!e.boss).length<8) spawnEnemy();
    } else spawnEnemy();
  }
  store.game.waveTime += dt;
  if (!bossWave && store.game.waveTime>=store.game.waveDuration) finishWave();
  // boss waves never time out into the shop, the only way out is
  // killing the boss. avoiding it makes it enrage, repeatedly, no
  // limit, so stalling gets worse the longer it drags on instead of
  // eventually just working
  else if (bossWave && store.game.bossSpawned && store.game.waveTime>=store.game.bossEnrageAt){
    enrageBoss();
    store.game.bossEnrageAt += 30;
  }
}
export function finishWave(){
  store.game.waveActive = false;
  store.game.enemies = []; store.game.enemyProjectiles = []; store.game.coins = []; store.game.bossSpawned = false;
  const clearedWave = store.game.wave;

  if (store.game.activeEvent){
    store.game.activeEvent.wavesLeft -= 1;
    if (store.game.activeEvent.wavesLeft <= 0){
      if (store.game.activeEvent.revert) store.game.activeEvent.revert(store.game.player);
      logEvent(`Event faded: ${store.game.activeEvent.label} has ended.`);
      store.game.activeEvent = null;
    }
  }

  showWaveBanner(`WAVE ${clearedWave} CLEARED`);
  logEvent(`Wave ${clearedWave} cleared.`);
  sfxWaveClear();
  triggerFrameFlash('rgba(126,231,135,1)', 'rgba(126,231,135,0.6)', 0.5);
  setTimeout(() => { if (store.running) maybeTriggerEvent(clearedWave); }, 850);
}
export function maybeTriggerEvent(clearedWave){
  if (isBossWaveNow() || clearedWave % 4 !== 0 || store.game.activeEvent){ openShop(); return; }
  const ev = EVENTS[Math.floor(Math.random()*EVENTS.length)];
  const duration = 1 + Math.floor(Math.random()*4);
  ev.apply(store.game.player);
  unlockEvent(ev.id);
  store.game.activeEvent = { id:ev.id, label:ev.label, desc:ev.desc, positive:ev.positive, wavesLeft:duration, apply:ev.apply, revert:ev.revert };
  document.getElementById('eventIcon').textContent = ev.positive ? '\u2726' : '\u26A0';
  document.getElementById('eventIcon').style.color = ev.positive ? 'var(--accent)' : 'var(--danger)';
  const titleEl = document.getElementById('eventTitle');
  titleEl.textContent = ev.label;
  titleEl.style.color = ev.positive ? 'var(--accent)' : 'var(--danger)';
  const durText = `Lasts ${duration} wave${duration>1?'s':''}.`;
  document.getElementById('eventDesc').textContent = `${ev.desc} ${durText}`;
  logEvent(`Event: ${ev.label}. ${ev.desc} ${durText}`);
  sfxEvent(!ev.positive);
  triggerFrameFlash(ev.positive?'rgba(126,231,135,1)':'rgba(229,83,75,1)', ev.positive?'rgba(126,231,135,0.55)':'rgba(229,83,75,0.55)', 0.5);
  showScreen('event');
}
export async function triggerVictory(){
  store.game.waveActive = false;
  store.game.enemies = []; store.game.enemyProjectiles = []; store.game.coins = [];
  showWaveBanner('VICTORY!');
  logEvent('The Devourer falls. You have won.');
  sfxVictory(); triggerShake(10,0.5); triggerFrameFlash('rgba(199,125,255,1)', 'rgba(199,125,255,0.75)', 1.1);
  store.stats.victories = (store.stats.victories||0)+1;
  await saveJSON(STORE_STATS, store.stats);
  setTimeout(() => {
    if (!store.running) return;
    document.getElementById('victoryScore').textContent = computeScore();
    document.getElementById('victoryWave').textContent = store.game.wave;
    renderPostRunSummary('victory');
    showScreen('victory');
  }, 900);
}
export function continueEndless(){
  store.game.wave += 1; store.game.waveTime = 0; store.game.waveDuration = waveDurationFor(store.game.wave);
  store.game.waveActive = true; store.game.spawnTimer = 0.3;
  recenterPlayer();
  showScreen('game'); store.lastFrameTime = performance.now();
}
export function recenterPlayer(){ store.game.player.x = ARENA_W/2; store.game.player.y = ARENA_H/2; }
