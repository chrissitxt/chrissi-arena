// run lifecycle: start, pause/resume, quit to menu, death (including
// the phoenix heart revive), and ending a run (stats + history)

import { sfxGameOver, sfxPhoenix, sfxBootJingle, setMusicMode, stopMusic, scheduleMusicStart } from '../audio/sfx.js';
import { logEl_clear, logEvent, renderBuildGrid, renderPostRunSummary, randomDeathQuip } from '../render/hud.js';
import { refreshMenu, showScreen } from '../render/screens.js';
import { computeScore } from '../state/derived.js';
import { newGameState } from '../state/gameState.js';
import { store } from '../state/store.js';
import { STORE_HISTORY, STORE_STATS, saveJSON } from '../storage.js';
import { buildSnapshot } from './economy.js';
import { spawnDamageText, triggerShake, triggerFrameFlash } from './particles.js';

export function startRun(){
  store.game = newGameState();
  store.running = true; store.paused = false;
  setMusicMode('main');
  stopMusic();
  sfxBootJingle();
  scheduleMusicStart(3000);
  logEl_clear();
  logEvent('The arena opens. Wave 1 begins.');
  renderBuildGrid();
  showScreen('game');
  store.lastFrameTime = performance.now();
}
export function resumeGame(){ store.paused = false; showScreen('game'); store.lastFrameTime = performance.now(); }
export function quitToMenu(){ store.running = false; store.paused = false; setMusicMode('main'); refreshMenu(); showScreen('menu'); }
export function checkPlayerDeath(){
  const p = store.game.player;
  if (p.hp<=0){
    if (p.hasPhoenix && !p.phoenixUsed){
      p.phoenixUsed = true;
      p.hp = Math.max(1, Math.round(p.maxHp*0.3));
      p.invulnTime = 1.5;
      spawnDamageText(p.x,p.y-32,'PHOENIX!','#ff9d3d',true);
      logEvent('The Phoenix Heart flares. You rise again.');
      triggerShake(12,0.4);
      triggerFrameFlash('rgba(255,157,61,1)', 'rgba(255,157,61,0.7)', 0.8);
      sfxPhoenix();
    } else {
      endRun();
    }
  }
}
export async function endRun(){
  if (store.game.over) return;
  store.game.over = true; store.running = false;
  const score = computeScore();
  store.stats.runs += 1; store.stats.totalKills += store.game.kills; store.stats.totalGold += store.game.gold; store.stats.totalTime += store.game.elapsed;
  const isNewBest = score > store.stats.bestScore;
  if (isNewBest) store.stats.bestScore = score;
  if (store.game.wave > store.stats.bestWave) store.stats.bestWave = store.game.wave;
  await saveJSON(STORE_STATS, store.stats);
  store.runHistory.unshift({ wave:store.game.wave, score, kills:store.game.kills, gold:store.game.gold, victory:store.game.gameWon, quit:false, date:Date.now(), items:buildSnapshot() });
  store.runHistory = store.runHistory.slice(0,5);
  await saveJSON(STORE_HISTORY, store.runHistory);
  setMusicMode('main');
  sfxGameOver();
  document.getElementById('goWave').textContent = store.game.wave;
  document.getElementById('goScore').textContent = score;
  document.getElementById('goKills').textContent = store.game.kills;
  document.getElementById('goGold').textContent = store.game.gold;
  document.getElementById('newBestBanner').classList.toggle('hidden', !isNewBest);
  document.getElementById('goVictoryTag').classList.toggle('hidden', !store.game.gameWon);
  document.getElementById('goDeathQuip').textContent = store.game.gameWon ? '' : randomDeathQuip();
  renderPostRunSummary('go');
  showScreen('gameover');
}
