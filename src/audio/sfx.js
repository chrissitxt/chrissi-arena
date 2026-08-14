// all audio is synthesized live with web audio, no sound files.
// ensureAudio lazily creates the audiocontext on first interaction
// (autoplay policies), everything else is oscillators/noise shaped into notes

import { store } from '../state/store.js';

let musicTimeout = null;
let musicStep = 0;
let musicMode = 'menu'; // 'main', 'boss', 'menu', or 'victory' — see setMusicMode()

export function ensureAudio(){
  if (!store.audioCtx){ try { store.audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} }
  if (store.audioCtx && store.audioCtx.state === 'suspended') store.audioCtx.resume();
}
export function beep(freq, dur, type, vol, when, isMusic){
  // isMusic switches which of the two volume sliders applies — every
  // note of the background music routes through this same function, so
  // without this distinction there'd be no way to scale music and sound
  // effects independently. 0 on either slider means silent, same as the
  // old on/off toggles used to.
  const volSetting = (isMusic ? store.settings.musicVolume : store.settings.sfxVolume) ?? 5;
  if (volSetting<=0 || !store.audioCtx) return;
  type = type||'square'; vol = (vol==null?0.12:vol) * (volSetting/5); when = when||0;
  const t0 = store.audioCtx.currentTime + when;
  const osc = store.audioCtx.createOscillator(); const gain = store.audioCtx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  osc.connect(gain); gain.connect(store.audioCtx.destination);
  osc.start(t0); osc.stop(t0+dur+0.02);
}
export function noiseBurst(dur, vol, isMusic){
  const volSetting = (isMusic ? store.settings.musicVolume : store.settings.sfxVolume) ?? 5;
  if (volSetting<=0 || !store.audioCtx) return;
  vol = (vol==null?0.15:vol) * (volSetting/5);
  const n = Math.floor(store.audioCtx.sampleRate*dur);
  const buffer = store.audioCtx.createBuffer(1,n,store.audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i=0;i<n;i++) data[i] = (Math.random()*2-1)*(1-i/n);
  const src = store.audioCtx.createBufferSource(); src.buffer = buffer;
  const gain = store.audioCtx.createGain(); gain.gain.value = vol;
  src.connect(gain); gain.connect(store.audioCtx.destination);
  src.start();
}

// --- one-shot sound effects ---
export function sfxShoot(){ beep(880,0.045,'square',0.035); }
export function sfxEnemyDeath(){ noiseBurst(0.12,0.12); }
export function sfxPlayerHurt(){ beep(140,0.15,'sawtooth',0.16); }
export function sfxPickupGold(){ beep(1200,0.05,'sine',0.07); beep(1600,0.05,'sine',0.05,0.04); }
export function sfxPickupItem(){ beep(600,0.07,'triangle',0.1); beep(900,0.07,'triangle',0.1,0.06); beep(1300,0.14,'triangle',0.1,0.12); }
export function sfxSell(){ beep(500,0.08,'triangle',0.09); beep(320,0.1,'triangle',0.08,0.06); }
export function sfxWaveClear(){ beep(523.25,0.09,'triangle',0.1); beep(659.25,0.09,'triangle',0.1,0.09); beep(784.00,0.09,'triangle',0.1,0.18); beep(1046.50,0.22,'triangle',0.13,0.27); }
// a single soft tick, played once the moment a wave's timer drops to
// 5 seconds or less, the "hurry up" cue
export function sfxWaveUrgent(){ beep(880,0.06,'square',0.05); beep(880,0.06,'square',0.05,0.5); }
export function sfxBossSpawn(){ beep(70,0.5,'sawtooth',0.18); beep(90,0.5,'sawtooth',0.12,0.1); beep(55,0.4,'sawtooth',0.16,0.35); }
export function sfxBossAttack(){ beep(120,0.2,'sawtooth',0.14); }
// enrageBoss() used to reuse sfxBossAttack for the enrage trigger, even
// though enraging isn't an attack landing at all — a player hearing it
// could easily read it as "I just got hit again." A rising three-note
// sweep instead, distinctly a power-up/threat-escalation sound, nothing
// like an impact.
export function sfxBossEnrage(){ beep(90,0.25,'sawtooth',0.14); beep(140,0.3,'sawtooth',0.16,0.15); beep(200,0.35,'sawtooth',0.18,0.3); }
// heavier and more percussive than the plain ranged-attack beep above,
// for when a boss's melee hit actually connects (Colossus/Devourer slam,
// Butcher's charge) — these are the biggest single hits in the game and
// deserve to sound like it, distinct from firing a ring of projectiles
export function sfxBossMeleeImpact(){ noiseBurst(0.15,0.16); beep(70,0.25,'sawtooth',0.16); }
export function sfxExplosion(){ noiseBurst(0.25,0.22); beep(90,0.2,'sawtooth',0.1); }
export function sfxGameOver(){ beep(300,0.2,'sawtooth',0.15); beep(220,0.25,'sawtooth',0.14,0.18); beep(140,0.4,'sawtooth',0.14,0.36); }
export function sfxVictory(){ [523.25,659.25,784.00,1046.50].forEach((f,i)=>beep(f,0.25,'triangle',0.12,i*0.15)); }
export function sfxPhoenix(){ beep(300,0.3,'sine',0.15); beep(600,0.3,'sine',0.12,0.1); beep(900,0.4,'sine',0.1,0.2); }
export function sfxEvent(debuff){ if (debuff){ beep(260,0.2,'sawtooth',0.12); beep(180,0.25,'sawtooth',0.1,0.15); } else { beep(700,0.1,'triangle',0.1); beep(1000,0.15,'triangle',0.1,0.1); } }
export function sfxAchievement(){ beep(660,0.09,'triangle',0.1); beep(880,0.09,'triangle',0.1,0.08); beep(1100,0.09,'triangle',0.12,0.16); beep(1320,0.22,'triangle',0.12,0.24); }
// deliberately smaller and softer than sfxAchievement above — a new item,
// enemy, or event added to the compendium is a nice little moment worth
// marking, but it happens far more often than an actual achievement and
// shouldn't compete with one for attention
export function sfxDiscovery(){ beep(784,0.07,'sine',0.08); beep(1046.50,0.1,'sine',0.09,0.06); }
export function sfxUIClick(){ beep(500,0.03,'square',0.04); }
// hits used to be completely silent, both normal and crit, across every
// weapon type — only the shot firing and the eventual kill had sound.
// short and quiet on purpose (rapid-fire builds can land several of
// these a second, this should read as a rhythm, not a wall of noise)
export function sfxHit(){ beep(1500,0.02,'square',0.018); }
export function sfxCritHit(){ beep(1500,0.02,'square',0.024); beep(1900,0.03,'triangle',0.03,0.015); }
export function sfxDenied(){ beep(180,0.09,'square',0.09); beep(140,0.12,'square',0.08,0.07); }
// a soft, low "lub-dub" for the critical-hp warning below 25% hp, sine
// wave to feel organic rather than alarming, gets called more often as
// hp drops further (see systems/loop.js), never louder, just faster
export function sfxHeartbeat(){ beep(70,0.09,'sine',0.1); beep(55,0.11,'sine',0.09,0.13); }
// plays once whenever a legendary offer actually shows up in the shop
// (a rare 2% roll), a small sparkle to mark the moment. distinct from
// the pickup jingle since this fires on seeing it, not buying it
export function sfxLegendaryAppears(){ beep(1046.50,0.08,'triangle',0.09); beep(1318.51,0.08,'triangle',0.09,0.07); beep(1568,0.16,'triangle',0.11,0.14); }

// short "power-on" arpeggio, played once on first load, the arcade
// cabinet boot chime
export function sfxBootJingle(){
  beep(220.00,0.08,'square',0.05,0);
  beep(329.63,0.08,'square',0.05,0.09);
  beep(440.00,0.08,'square',0.05,0.18);
  beep(659.25,0.24,'square',0.06,0.27);
}

// --- background music ---
// a tiny step sequencer: each track is a 4-bar chord progression, one
// bass note, one lead arpeggio note, a light kick/hat beat per step.
// reschedules itself every step (setTimeout, not setInterval) so tempo
// can change smoothly mid-track instead of needing a restart

// transposes a frequency up (or down, with a negative value) by a number
// of semitones — used below to build the second half of a loop from the
// first instead of hand-typing frequency values that are easy to get
// subtly wrong
const up = (f, semitones) => f * Math.pow(2, semitones/12);

const TRACKS = {
  // a minor, Am-F-C-G for the first half, then Dm-C-Am-E for the second
  // (a real modulation, not a repeat) — the old 4-bar version looped
  // every 3-5.5s depending on tempo, so a multi-minute run heard the
  // exact same 16 notes hundreds of times. 8 bars roughly doubles that,
  // and the second half deliberately thins out (rests, held notes)
  // instead of just repeating the first half's density, so the loop
  // has an actual arc instead of being a flat, mechanical cycle
  main: {
    bass: [110.00, 87.31, 130.81, 98.00, 146.83, 130.81, 110.00, 164.81],
    lead: [
      [220.00, 261.63, 329.63, 261.63],
      [174.61, 220.00, 261.63, 220.00],
      [261.63, 329.63, 392.00, 329.63],
      [196.00, 246.94, 293.66, 246.94],
      [293.66, null, null, 261.63],
      [261.63, null, null, null],
      [220.00, null, 246.94, null],
      [164.81, null, null, null]
    ],
    leadType: 'square', leadVol: 0.018, bassVol: 0.045
  },
  // half-step lower and more chromatic than main, for boss fights. the
  // second half transposes the first half up a minor third and keeps
  // the same density throughout (no breathing room here on purpose,
  // a boss fight should feel like it's climbing, not settling)
  boss: {
    bass: [82.41, 87.31, 82.41, 73.42, up(82.41,3), up(87.31,3), up(82.41,3), up(73.42,3)],
    lead: [
      [164.81, 196.00, 233.08, 196.00],
      [174.61, 220.00, 261.63, 220.00],
      [146.83, 174.61, 207.65, 174.61],
      [130.81, 164.81, 196.00, 164.81],
      [164.81, 196.00, 233.08, 196.00].map(f=>up(f,3)),
      [174.61, 220.00, 261.63, 220.00].map(f=>up(f,3)),
      [146.83, 174.61, 207.65, 174.61].map(f=>up(f,3)),
      [130.81, 164.81, 196.00, 164.81].map(f=>up(f,3))
    ],
    leadType: 'sawtooth', leadVol: 0.026, bassVol: 0.052
  },
  // calmer and more spacious than main — plays on the menu itself, not
  // during a run, so it needed its own identity rather than borrowing
  // the exploring theme or (previously) just being silent until a run
  // started
  menu: {
    bass: [110.00, 130.81, 146.83, 98.00],
    lead: [
      [329.63, null, 293.66, null],
      [392.00, null, 349.23, null],
      [440.00, null, 392.00, null],
      [293.66, null, 261.63, null]
    ],
    leadType: 'sine', leadVol: 0.02, bassVol: 0.032
  },
  // a real loop instead of a one-shot fanfare over whatever track
  // happened to still be playing — major, bright, unhurried
  victory: {
    bass: [130.81, 174.61, 196.00, 130.81],
    lead: [
      [261.63, 329.63, 392.00, 523.25],
      [349.23, 440.00, 523.25, 440.00],
      [392.00, 493.88, 587.33, 493.88],
      [261.63, 329.63, 392.00, null]
    ],
    leadType: 'triangle', leadVol: 0.024, bassVol: 0.04
  }
};

let musicStartDelay = null;

// music speeds up in a boss fight, deeper into a run, and at low hp,
// but only while a run is actually active. gating on store.running
// (not just store.game existing) matters, store.game still holds the
// last run's data right after death at 0 hp, which would otherwise
// keep the music panicked forever on the game-over and menu screens
export function currentTempoMs(){
  const baseTempos = { main:340, boss:190, menu:420, victory:300 };
  let ms = baseTempos[musicMode] ?? 340;
  // wave/low-hp speedup only makes sense mid-run — applying it to the
  // menu or victory themes too would mean victory's pace quietly
  // depended on what wave you won on or how close to death you were,
  // instead of feeling like a fixed, consistent payoff
  const g = store.game;
  if (store.running && g && (musicMode==='main' || musicMode==='boss')){
    const waveProgress = Math.max(0, Math.min(1, (g.wave-1)/29));
    ms -= waveProgress*50;
    if (g.player && g.player.hp < g.player.maxHp*0.3) ms -= 40;
  }
  return Math.max(85, ms);
}

function playMusicStep(){
  const track = TRACKS[musicMode];
  const tempo = currentTempoMs();
  if (store.settings.musicVolume>0 && store.audioCtx){
    const bar = Math.floor(musicStep/4) % track.bass.length;
    const beatIdx = musicStep % 4;
    // a touch of random volume drift per note, so this reads as played
    // rather than sequenced — subtle on purpose, this is texture, not
    // a new rhythm
    const jitter = () => 0.9 + Math.random()*0.2;
    if (beatIdx === 0){
      beep(track.bass[bar], tempo/1000*3.4, 'triangle', track.bassVol*jitter(), 0, true);
      if (musicMode === 'boss') beep(45, 0.07, 'sawtooth', 0.07*jitter(), 0, true); // heavier kick
      else beep(55, 0.05, 'sine', 0.045*jitter(), 0, true); // soft kick
    } else {
      if (musicMode === 'boss' && beatIdx === 2) noiseBurst(0.05, 0.045*jitter(), true); // snare-ish backbeat
      else noiseBurst(0.02, 0.012*jitter(), true); // soft hat tick
    }
    // rests (null lead notes, used in the quieter second half of the
    // main loop and the sparser menu theme) just skip the beep entirely
    const leadNote = track.lead[bar][beatIdx];
    if (leadNote) beep(leadNote, tempo/1000*0.85, track.leadType, track.leadVol*jitter(), 0, true);
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

// cancels any previously-scheduled delayed start before scheduling a
// new one, so restarting quickly (dying and hitting retry right away)
// can't leave two pending starts racing each other
export function scheduleMusicStart(delayMs){
  clearTimeout(musicStartDelay);
  musicStartDelay = setTimeout(() => { if (store.settings.musicVolume>0) startMusic(); }, delayMs);
}

// switches between the main and boss themes. restarts the pattern from
// the top of the bar for a clean transition instead of cutting in
// mid-phrase
export function setMusicMode(mode){
  if (musicMode === mode || !TRACKS[mode]) return;
  musicMode = mode;
  musicStep = 0;
}

export function initAudioOnce(){
  ensureAudio();
  if (store.settings.musicVolume>0) startMusic();
  window.removeEventListener('pointerdown', initAudioOnce);
  window.removeEventListener('keydown', initAudioOnce);
}
