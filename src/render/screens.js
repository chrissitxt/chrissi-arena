// screen show/hide, ui scale, settings button states, desktop-only
// gate. checkDesktop() pauses a run the moment the gate shows up,
// otherwise resizing mid-run kept the game running invisibly behind it

import { gameWrap, screens } from '../dom.js';
import { renderPauseStats } from './hud.js';
import { store } from '../state/store.js';

export function showScreen(name){
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  gameWrap.classList.add('hidden');
  if (name === 'game') gameWrap.classList.remove('hidden');
  else {
    document.getElementById('app').classList.remove('low-hp','critical-hp','boss-active');
    if (screens[name]) screens[name].classList.remove('hidden');
  }
}
export function refreshMenu(){
  document.getElementById('menuBestScore').textContent = store.stats.bestScore;
  document.getElementById('menuBestWave').textContent = store.stats.bestWave;
  document.getElementById('menuVictories').textContent = store.stats.victories;
}
export function applyUIScale(size){
  const map = { medium:1, large:1.16 };
  const s = map[size]||1;
  store.uiScale = s;
  const app = document.getElementById('app');
  if (s===1){ app.style.transform=''; app.style.width='100vw'; app.style.height='100vh'; app.style.transformOrigin=''; }
  else {
    app.style.transformOrigin = 'top left';
    app.style.transform = `scale(${s})`;
    app.style.width = (100/s)+'vw';
    app.style.height = (100/s)+'vh';
  }
}
export function updateSettingButtons(){
  document.querySelectorAll('.fps-opt').forEach(b => { b.classList.toggle('active', parseInt(b.dataset.fps,10) === store.settings.fps); b.disabled = !!store.settings.vsyncOn; });
  document.querySelectorAll('.toggle-opt[data-toggle]').forEach(b => b.classList.toggle('active', (b.dataset.val==='true') === !!store.settings[b.dataset.toggle]));
  document.querySelectorAll('.toggle-opt[data-uiscale]').forEach(b => b.classList.toggle('active', b.dataset.uiscale === store.settings.uiSize));
  const musicSlider = document.getElementById('musicVolumeSlider');
  const sfxSlider = document.getElementById('sfxVolumeSlider');
  if (musicSlider){ musicSlider.value = store.settings.musicVolume; document.getElementById('musicVolumeLabel').textContent = String(store.settings.musicVolume); }
  if (sfxSlider){ sfxSlider.value = store.settings.sfxVolume; document.getElementById('sfxVolumeLabel').textContent = String(store.settings.sfxVolume); }
}
export function checkDesktop(){
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const small = window.innerWidth < 900 || window.innerHeight < 560;
  const blocked = coarse || small;
  document.getElementById('gateOverlay').classList.toggle('hidden', !blocked);
  if (blocked && store.running && store.game && !store.game.over && !store.paused && !gameWrap.classList.contains('hidden')){
    store.paused = true; renderPauseStats(); showScreen('pause');
  }
}
