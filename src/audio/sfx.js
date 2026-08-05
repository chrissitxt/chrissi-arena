// All game audio is synthesized live with the Web Audio API — no external
// sound files. `ensureAudio` lazily creates the AudioContext on first user
// interaction (required by browser autoplay policies); everything else is
// oscillators and noise bursts shaped into short notes.

import { store } from '../state/store.js';

let musicTimeout = null;
let musicStep = 0;
let musicMode = 'main'; // 'main' or 'boss' — see setMusicMode()

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

// --- One-shot sound effects ---------------------------------------------
export function sfxShoot(){ beep(880,0.045,'square',0.035); }
export function sfxEnemyDeath(){ noiseBurst(0.12,0.12); }
export function sfxPlayerHurt(){ beep(140,0.15,'sawtooth',0.16); }
export function sfxPickupGold(){ beep(1200,0.05,'sine',0.07); beep(1600,0.05,'sine',0.05,0.04); }
export function sfxPickupItem(){ beep(600,0.07,'triangle',0.1); beep(900,0.07,'triangle',0.1,0.06); beep(1300,0.14,'triangle',0.1,0.12); }
export function sfxSell(){ beep(500,0.08,'triangle',0.09); beep(320,0.1,'triangle',0.08,0.06); }
export function sfxWaveClear(){ beep(523.25,0.09,'triangle',0.1); beep(659.25,0.09,'triangle',0.1,0.09); beep(784.00,0.09,'triangle',0.1,0.18); beep(1046.50,0.22,'triangle',0.13,0.27); }
export function sfxBossSpawn(){ beep(70,0.5,'sawtooth',0.18); beep(90,0.5,'sawtooth',0.12,0.1); beep(55,0.4,'sawtooth',0.16,0.35); }
export function sfxBossAttack(){ beep(120,0.2,'sawtooth',0.14); }
export function sfxExplosion(){ noiseBurst(0.25,0.22); beep(90,0.2,'sawtooth',0.1); }
export function sfxGameOver(){ beep(300,0.2,'sawtooth',0.15); beep(220,0.25,'sawtooth',0.14,0.18); beep(140,0.4,'sawtooth',0.14,0.36); }
export function sfxVictory(){ [523.25,659.25,784.00,1046.50].forEach((f,i)=>beep(f,0.25,'triangle',0.12,i*0.15)); }
export function sfxPhoenix(){ beep(300,0.3,'sine',0.15); beep(600,0.3,'sine',0.12,0.1); beep(900,0.4,'sine',0.1,0.2); }
export function sfxEvent(debuff){ if (debuff){ beep(260,0.2,'sawtooth',0.12); beep(180,0.25,'sawtooth',0.1,0.15); } else { beep(700,0.1,'triangle',0.1); beep(1000,0.15,'triangle',0.1,0.1); } }
export function sfxAchievement(){ beep(660,0.09,'triangle',0.1); beep(880,0.09,'triangle',0.1,0.08); beep(1100,0.09,'triangle',0.12,0.16); beep(1320,0.22,'triangle',0.12,0.24); }
export function sfxUIClick(){ beep(500,0.03,'square',0.04); }

/** Short "power-on" arpeggio, played once on first load — the arcade
 * cabinet boot chime. */
export function sfxBootJingle(){
  beep(220.00,0.08,'square',0.05,0);
  beep(329.63,0.08,'square',0.05,0.09);
  beep(440.00,0.08,'square',0.05,0.18);
  beep(659.25,0.24,'square',0.06,0.27);
}

// --- Background music -----------------------------------------------------
// A tiny step sequencer: each track is a 4-bar chord progression, one bass
// note, one lead arpeggio note, and a light kick/hat percussion beat per
// step. Playback reschedules itself every step (setTimeout, not
// setInterval) so tempo can change smoothly mid-track instead of needing
// a restart.

const TRACKS = {
  // A minor, Am-F-C-G — calm, unhurried exploring theme.
  main: {
    bass: [110.00, 87.31, 130.81, 98.00],
    lead: [
      [220.00, 261.63, 329.63, 261.63],
      [174.61, 220.00, 261.63, 220.00],
      [261.63, 329.63, 392.00, 329.63],
      [196.00, 246.94, 293.66, 246.94]
    ],
    leadType: 'square', leadVol: 0.018, bassVol: 0.045
  },
  // A half-step lower and more chromatic — swapped in for the duration of
  // a boss fight, noticeably more urgent than the main theme.
  boss: {
    bass: [82.41, 87.31, 82.41, 73.42],
    lead: [
      [164.81, 196.00, 233.08, 196.00],
      [174.61, 220.00, 261.63, 220.00],
      [146.83, 174.61, 207.65, 174.61],
      [130.81, 164.81, 196.00, 164.81]
    ],
    leadType: 'sawtooth', leadVol: 0.026, bassVol: 0.052
  }
};

let musicStartDelay = null;

/** Music speeds up in a boss fight, deeper into a run, and at low HP —
 * but only while a run is actually active. Gating on `store.running`
 * (not just `store.game` existing) matters: `store.game` still holds the
 * last run's data right after death, at 0 HP, which would otherwise keep
 * the music panicked forever on the game-over and menu screens. */
export function currentTempoMs(){
  let ms = musicMode === 'boss' ? 190 : 340;
  const g = store.game;
  if (store.running && g){
    const waveProgress = Math.max(0, Math.min(1, (g.wave-1)/29));
    ms -= waveProgress*50;
    if (g.player && g.player.hp < g.player.maxHp*0.3) ms -= 40;
  }
  return Math.max(85, ms);
}

function playMusicStep(){
  const track = TRACKS[musicMode];
  const tempo = currentTempoMs();
  if (store.settings.musicOn && store.audioCtx){
    const bar = Math.floor(musicStep/4) % track.bass.length;
    const beatIdx = musicStep % 4;
    if (beatIdx === 0){
      beep(track.bass[bar], tempo/1000*3.4, 'triangle', track.bassVol);
      beep(55, 0.05, 'sine', 0.045); // soft kick
    } else {
      noiseBurst(0.02, 0.012); // soft hat tick on the off-beats
    }
    beep(track.lead[bar][beatIdx], tempo/1000*0.85, track.leadType, track.leadVol);
    musicStep = (musicStep+1) % (track.bass.length*4);
  }
  musicTimeout = setTimeout(playMusicStep, tempo);
}

export function startMusic(){
  ensureAudio();
  if (!store.audioCtx || musicTimeout) return;
  musicStep = 0;
  playMusicStep();
}
export function stopMusic(){ if (musicTimeout){ clearTimeout(musicTimeout); musicTimeout=null; } }

/** Cancels any previously-scheduled delayed start before scheduling a new
 * one, so restarting a run quickly (e.g. dying and immediately hitting
 * Retry) can never leave two pending starts racing each other. */
export function scheduleMusicStart(delayMs){
  clearTimeout(musicStartDelay);
  musicStartDelay = setTimeout(() => { if (store.settings.musicOn) startMusic(); }, delayMs);
}

/** Switch between the main and boss themes. Restarts the pattern from the
 * top of the bar for a clean transition rather than cutting in mid-phrase. */
export function setMusicMode(mode){
  if (musicMode === mode || !TRACKS[mode]) return;
  musicMode = mode;
  musicStep = 0;
}

export function initAudioOnce(){
  ensureAudio();
  if (store.settings.musicOn) startMusic();
  window.removeEventListener('pointerdown', initAudioOnce);
  window.removeEventListener('keydown', initAudioOnce);
}
