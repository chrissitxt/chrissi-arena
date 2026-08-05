// Application entry point: wires every DOM control to its handler and
// boots the game. This file should stay "thin" — event listener ->
// function call. Actual game logic lives in systems/*, rendering in
// render/*.

import './style.css';

import { initAudioOnce, sfxAchievement, sfxUIClick, startMusic, stopMusic } from './audio/sfx.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import { ARENA_H, ARENA_W, GAME_VERSION } from './data/constants.js';
import { ENEMY_TYPES } from './data/enemies.js';
import { EVENTS } from './data/events.js';
import { ITEMS } from './data/items.js';
import { canvas, gameWrap, screens } from './dom.js';
import { openCompendium, renderChangelog, renderCompendium, renderStats } from './render/compendium.js';
import { logEvent, renderPauseStats } from './render/hud.js';
import { applyUIScale, checkDesktop, refreshMenu, showScreen, updateSettingButtons } from './render/screens.js';
import { renderShop } from './render/shop.js';
import { computeScore } from './state/derived.js';
import { store } from './state/store.js';
import { STORE_COMPENDIUM, STORE_HISTORY, STORE_SETTINGS, STORE_STATS, loadJSON, saveJSON } from './storage.js';
import { buildSnapshot, openShop, rollItem } from './systems/economy.js';
import { loop } from './systems/loop.js';
import { quitToMenu, resumeGame, startRun } from './systems/run.js';
import { exportSave, importSaveFile } from './systems/saveFile.js';
import { continueEndless, recenterPlayer } from './systems/wave.js';
import { waveDurationFor } from './utils.js';

const CHEAT_CODE = 'unlockall';

// =================================================================
// Audio (synthesized, no external files)
// =================================================================

window.addEventListener('pointerdown', initAudioOnce);
window.addEventListener('keydown', initAudioOnce);
document.addEventListener('click', (e) => { if (e.target.closest('button')) sfxUIClick(); });

window.addEventListener('keydown', (e) => {
  if (!screens.menu || screens.menu.classList.contains('hidden')) return;
  if (e.key.length !== 1) return;
  store.cheatBuffer = (store.cheatBuffer + e.key.toLowerCase()).slice(-CHEAT_CODE.length);
  if (store.cheatBuffer === CHEAT_CODE){
    store.compendium.items = ITEMS.map(i=>i.id);
    store.compendium.enemies = ENEMY_TYPES.map(en=>en.id);
    store.compendium.events = EVENTS.map(ev=>ev.id);
    store.compendium.achievements = ACHIEVEMENTS.map(a=>a.id);
    saveJSON(STORE_COMPENDIUM, store.compendium);
    const toast = document.getElementById('cheatToast');
    toast.classList.remove('hidden');
    clearTimeout(window._cheatToastTimer);
    window._cheatToastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
    sfxAchievement();
    store.cheatBuffer = '';
  }
});




document.getElementById('btnStart').addEventListener('click', startRun);
document.getElementById('btnCompendium').addEventListener('click', () => { openCompendium('menu'); });
document.getElementById('btnStats').addEventListener('click', () => { renderStats(); showScreen('stats'); });
document.getElementById('btnSettings').addEventListener('click', () => { store.settingsReturnTo='menu'; showScreen('settings'); });
document.getElementById('versionTag').addEventListener('click', () => { renderChangelog(); showScreen('changelog'); });
document.getElementById('btnChangelogBack').addEventListener('click', () => { refreshMenu(); showScreen('menu'); });
document.getElementById('btnResume').addEventListener('click', resumeGame);
document.getElementById('btnPauseCompendium').addEventListener('click', () => { openCompendium('pause'); });
document.getElementById('btnPauseSettings').addEventListener('click', () => { store.settingsReturnTo='pause'; showScreen('settings'); });
document.getElementById('btnPauseQuit').addEventListener('click', async () => {
  if (!confirm('Quit to the main menu? Your current run will end.')) return;
  if (store.game && !store.game.over){
    store.game.over = true; store.running = false;
    const score = computeScore();
    store.stats.runs += 1; store.stats.totalKills += store.game.kills; store.stats.totalGold += store.game.gold; store.stats.totalTime += store.game.elapsed;
    if (score > store.stats.bestScore) store.stats.bestScore = score;
    if (store.game.wave > store.stats.bestWave) store.stats.bestWave = store.game.wave;
    await saveJSON(STORE_STATS, store.stats);
    store.runHistory.unshift({ wave:store.game.wave, score, kills:store.game.kills, gold:store.game.gold, victory:store.game.gameWon, quit:true, date:Date.now(), items:buildSnapshot() });
    store.runHistory = store.runHistory.slice(0,5);
    await saveJSON(STORE_HISTORY, store.runHistory);
  }
  quitToMenu();
});
document.getElementById('btnRetry').addEventListener('click', startRun);
document.getElementById('btnGoMenu').addEventListener('click', () => { refreshMenu(); showScreen('menu'); });
document.getElementById('btnVictoryMenu').addEventListener('click', () => { store.running=false; refreshMenu(); showScreen('menu'); });
document.getElementById('btnContinueEndless').addEventListener('click', continueEndless);
document.getElementById('btnEventContinue').addEventListener('click', openShop);

document.querySelectorAll('[data-back]').forEach(btn => btn.addEventListener('click', () => {
  if (store.settingsReturnTo === 'pause') showScreen('pause'); else { refreshMenu(); showScreen('menu'); }
}));

document.querySelectorAll('.fps-opt').forEach(btn => btn.addEventListener('click', () => {
  if (store.settings.vsyncOn) return;
  store.settings.fps = parseInt(btn.dataset.fps, 10);
  updateSettingButtons();
  saveJSON(STORE_SETTINGS, store.settings);
}));
document.querySelectorAll('.toggle-opt[data-uiscale]').forEach(btn => btn.addEventListener('click', () => {
  store.settings.uiSize = btn.dataset.uiscale;
  applyUIScale(store.settings.uiSize);
  updateSettingButtons();
  saveJSON(STORE_SETTINGS, store.settings);
}));
document.querySelectorAll('.toggle-opt[data-toggle]').forEach(btn => btn.addEventListener('click', () => {
  const key = btn.dataset.toggle;
  const val = btn.dataset.val === 'true';
  store.settings[key] = val;
  if (key === 'musicOn'){ val ? startMusic() : stopMusic(); }
  if (key === 'showFps'){ document.getElementById('fpsCounter').classList.toggle('hidden', !val); }
  updateSettingButtons();
  saveJSON(STORE_SETTINGS, store.settings);
}));

document.getElementById('btnExportSave').addEventListener('click', exportSave);
document.getElementById('btnImportSave').addEventListener('click', () => document.getElementById('importFileInput').click());
document.getElementById('importFileInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) importSaveFile(file);
  e.target.value = '';
});

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  renderCompendium(t.dataset.tab);
}));



window.addEventListener('keydown', (e) => {
  if (store.game) store.game.keys[e.key.toLowerCase()] = true;
  if (e.key === 'Escape'){
    if (store.running && store.game && !store.game.over && !store.paused && !gameWrap.classList.contains('hidden')){
      store.paused = true; renderPauseStats(); showScreen('pause');
    } else if (!screens.pause.classList.contains('hidden')){
      resumeGame();
    } else if (store.settingsReturnTo==='pause' && (!screens.settings.classList.contains('hidden') || !screens.compendium.classList.contains('hidden'))){
      showScreen('pause');
    }
  }
});
window.addEventListener('keyup', (e) => { if (store.game) store.game.keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = ARENA_W/rect.width, sy = ARENA_H/rect.height;
  if (store.game){ store.game.mouseX = (e.clientX-rect.left)*sx; store.game.mouseY = (e.clientY-rect.top)*sy; }
});
canvas.addEventListener('mouseleave', () => { if (store.game){ store.game.mouseX=null; store.game.mouseY=null; } });
window.addEventListener('beforeunload', (e) => {
  if (store.running && store.game && !store.game.over){ e.preventDefault(); e.returnValue = ''; }
});




document.getElementById('btnReroll').addEventListener('click', () => {
  if (store.game.freeRerolls > 0){
    store.game.freeRerolls -= 1;
    if (store.game.freeRerollsFromBase > 0){ store.game.freeRerollsFromBase -= 1; store.game.freeRerollUsedThisRun = true; }
  } else {
    if (store.game.gold < store.rerollCost) return;
    store.game.gold -= store.rerollCost;
    store.rerollCost += 5;
  }
  store.shopOffers = [rollItem(), rollItem(), rollItem()];
  renderShop();
});
document.getElementById('btnContinue').addEventListener('click', () => {
  store.game.wave += 1; store.game.waveTime = 0; store.game.waveDuration = waveDurationFor(store.game.wave);
  store.game.waveActive = true; store.game.spawnTimer = 0.3;
  recenterPlayer();
  logEvent(`Wave ${store.game.wave} begins.`);
  showScreen('game'); store.lastFrameTime = performance.now();
});




window.addEventListener('resize', checkDesktop);

export async function boot(){
  checkDesktop();
  document.getElementById('versionTag').innerHTML = 'v'+GAME_VERSION+' &middot; changelog';
  store.settings = Object.assign({fps:60,musicOn:true,sfxOn:true,uiSize:'medium',showFps:false,vsyncOn:true}, await loadJSON(STORE_SETTINGS, {}));
  store.stats = Object.assign({runs:0,bestWave:0,bestScore:0,totalKills:0,totalGold:0,totalTime:0,victories:0,itemPurchaseCounts:{}}, await loadJSON(STORE_STATS, {}));
  store.compendium = Object.assign({items:[],enemies:[],events:[],achievements:[]}, await loadJSON(STORE_COMPENDIUM, {}));
  store.runHistory = await loadJSON(STORE_HISTORY, []);
  applyUIScale(store.settings.uiSize);
  document.getElementById('fpsCounter').classList.toggle('hidden', !store.settings.showFps);
  updateSettingButtons();
  refreshMenu();
  showScreen('menu');
  store.animHandle = requestAnimationFrame(loop);
}

boot();
