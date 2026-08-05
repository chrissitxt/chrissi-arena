// All game audio is synthesized live with the Web Audio API — no external
// sound files. `ensureAudio` lazily creates the AudioContext on first user
// interaction (required by browser autoplay policies); everything else is
// oscillators and noise bursts shaped into short notes.

import { store } from '../state/store.js';

let musicInterval = null;

export function ensureAudio(){
  if (!store.audioCtx){ try { store.audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} }
  if (store.audioCtx && store.audioCtx.state === 'suspended') store.audioCtx.resume();
}
export function beep(freq, dur, type, vol, when){
  if (!store.settings.sfxOn || !store.audioCtx) return;
  type = type||'square'; vol = vol==null?0.12:vol; when = when||0;
  const t0 = store.audioCtx.currentTime + when;
  const osc = store.audioCtx.createOscillator(); const gain = store.audioCtx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  osc.connect(gain); gain.connect(store.audioCtx.destination);
  osc.start(t0); osc.stop(t0+dur+0.02);
}
export function noiseBurst(dur, vol){
  if (!store.settings.sfxOn || !store.audioCtx) return;
  vol = vol==null?0.15:vol;
  const n = Math.floor(store.audioCtx.sampleRate*dur);
  const buffer = store.audioCtx.createBuffer(1,n,store.audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i=0;i<n;i++) data[i] = (Math.random()*2-1)*(1-i/n);
  const src = store.audioCtx.createBufferSource(); src.buffer = buffer;
  const gain = store.audioCtx.createGain(); gain.gain.value = vol;
  src.connect(gain); gain.connect(store.audioCtx.destination);
  src.start();
}
export function sfxShoot(){ beep(880,0.045,'square',0.035); }
export function sfxEnemyDeath(){ noiseBurst(0.12,0.12); }
export function sfxPlayerHurt(){ beep(140,0.15,'sawtooth',0.16); }
export function sfxPickupGold(){ beep(1200,0.05,'sine',0.07); beep(1600,0.05,'sine',0.05,0.04); }
export function sfxPickupItem(){ beep(600,0.08,'triangle',0.1); beep(950,0.12,'triangle',0.1,0.06); }
export function sfxSell(){ beep(500,0.08,'triangle',0.09); beep(320,0.1,'triangle',0.08,0.06); }
export function sfxWaveClear(){ beep(523,0.1,'triangle',0.1); beep(659,0.1,'triangle',0.1,0.1); beep(784,0.18,'triangle',0.12,0.2); }
export function sfxBossSpawn(){ beep(70,0.5,'sawtooth',0.18); beep(90,0.5,'sawtooth',0.12,0.1); }
export function sfxBossAttack(){ beep(120,0.2,'sawtooth',0.14); }
export function sfxExplosion(){ noiseBurst(0.25,0.22); beep(90,0.2,'sawtooth',0.1); }
export function sfxGameOver(){ beep(300,0.2,'sawtooth',0.15); beep(220,0.25,'sawtooth',0.14,0.18); beep(140,0.4,'sawtooth',0.14,0.36); }
export function sfxVictory(){ [523,659,784,1046].forEach((f,i)=>beep(f,0.25,'triangle',0.12,i*0.15)); }
export function sfxPhoenix(){ beep(300,0.3,'sine',0.15); beep(600,0.3,'sine',0.12,0.1); beep(900,0.4,'sine',0.1,0.2); }
export function sfxEvent(debuff){ if (debuff){ beep(260,0.2,'sawtooth',0.12); beep(180,0.25,'sawtooth',0.1,0.15); } else { beep(700,0.1,'triangle',0.1); beep(1000,0.15,'triangle',0.1,0.1); } }
export function sfxAchievement(){ beep(660,0.1,'triangle',0.1); beep(880,0.12,'triangle',0.1,0.09); beep(1100,0.2,'triangle',0.12,0.18); }
export function sfxUIClick(){ beep(500,0.03,'square',0.04); }

export function startMusic(){
  ensureAudio();
  if (!store.audioCtx || musicInterval) return;
  const scale = [98.00,110.00,116.54,130.81,146.83,155.56,174.61];
  musicInterval = setInterval(() => {
    if (!store.settings.musicOn) return;
    const note = scale[Math.floor(Math.random()*scale.length)];
    beep(note*2, 1.8, 'sine', 0.03);
    if (Math.random()<0.35) beep(note*4, 0.9, 'triangle', 0.018, 0.5);
  }, 1900);
}
export function stopMusic(){ if (musicInterval){ clearInterval(musicInterval); musicInterval=null; } }
export function initAudioOnce(){
  ensureAudio();
  if (store.settings.musicOn) startMusic();
  window.removeEventListener('pointerdown', initAudioOnce);
  window.removeEventListener('keydown', initAudioOnce);
}
