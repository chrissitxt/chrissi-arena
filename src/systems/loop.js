// the one requestAnimationFrame loop and the per-frame update order.
// new per-frame systems get wired in here, once

import { gameWrap } from '../dom.js';
import { render } from '../render/canvas.js';
import { store } from '../state/store.js';
import { sfxHeartbeat } from '../audio/sfx.js';
import { updateOrbitWeapons, updatePlayerBombs, updatePlayerMovement, updateProjectiles, updateShooting, updateCurseZones } from './combat.js';
import { updateEnemies, updateEnemyProjectiles } from './enemies.js';
import { updateChainLines, updateCoins, updateDamageTexts, updateParticles } from './particles.js';
import { checkPlayerDeath, quitToMenu } from './run.js';
import { updateWaveTimer } from './wave.js';

let fpsFrames = 0, fpsTimer = 0;
let consecutiveErrors = 0;

// browsers deliberately pause requestAnimationFrame entirely for
// backgrounded tabs, standard across every major browser now, no page
// can opt out, it's a battery/security thing. best mitigation: fall
// back to setTimeout while hidden, still allowed to fire (heavily
// throttled, roughly once a second) instead of going dark until refocus
export function scheduleNextFrame(){
  if (typeof document !== 'undefined' && document.hidden){
    store.animHandle = setTimeout(() => loop(performance.now()), 250);
  } else {
    store.animHandle = requestAnimationFrame(loop);
  }
}

export function loop(now){
  scheduleNextFrame();
  if (!store.running || store.paused || gameWrap.classList.contains('hidden')) { store.lastFrameTime = now; return; }
  let elapsed = now - store.lastFrameTime;
  if (!store.settings.vsyncOn){
    const targetDt = 1000/store.settings.fps;
    if (elapsed < targetDt - 1) return;
  }
  let dt = Math.min(elapsed/1000, 0.05);
  store.lastFrameTime = now;

  fpsFrames++; fpsTimer += dt;
  if (fpsTimer >= 0.5){
    const fps = Math.round(fpsFrames/fpsTimer);
    fpsFrames = 0; fpsTimer = 0;
    if (store.settings.showFps) document.getElementById('fpsCounter').textContent = 'FPS: '+fps;
  }

  try {
    update(dt); render();
    consecutiveErrors = 0;
  } catch (err) {
    console.error('chrissi-arena frame error (recovered):', err);
    consecutiveErrors++;
    // a single bad frame is recoverable, shouldn't interrupt play. but
    // if every frame is throwing, the run's stuck in a way this loop
    // can't recover from alone, better to visibly bail to the menu
    // than sit there doing nothing forever (used to mean an F5 refresh
    // with zero indication anything went wrong)
    if (consecutiveErrors >= 8){
      consecutiveErrors = 0;
      store.running = false;
      alert("Something went wrong and the run couldn't continue. Returning to the main menu — sorry about that.");
      quitToMenu();
    }
  }
}
export function update(dt){
  if (!store.game || store.game.over) return;
  if (store.game.hitStopTimer > 0){ store.game.hitStopTimer -= dt; return; }
  store.game.elapsed += dt;
  if (store.game.shakeTime>0) store.game.shakeTime -= dt; else store.game.shakeMag = 0;
  const p = store.game.player;
  if (p.invulnTime>0) p.invulnTime -= dt;
  if (p.jamTimer>0) p.jamTimer -= dt;
  if (p.hexedTimer>0) p.hexedTimer -= dt;
  if (p.regen>0 && p.hp<p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen*dt);
  // heartbeat warning below 25% hp, interval shrinks the lower hp gets
  // (0.8s right at the threshold, down to 0.3s near death), so it reads
  // as escalating urgency rather than a flat, static alarm
  const hpPct = p.hp/p.maxHp;
  if (hpPct < 0.25 && hpPct > 0){
    const beatInterval = 0.3 + (hpPct/0.25)*0.5;
    store.game.hpBeatTimer = (store.game.hpBeatTimer||0) - dt;
    if (store.game.hpBeatTimer <= 0){ store.game.hpBeatTimer = beatInterval; sfxHeartbeat(); }
  } else {
    store.game.hpBeatTimer = 0;
  }

  updatePlayerMovement(dt);
  updateShooting(dt);
  updateProjectiles(dt);
  updateOrbitWeapons(dt);
  updatePlayerBombs(dt);
  updateCurseZones(dt);
  updateEnemies(dt);
  updateEnemyProjectiles(dt);
  updateCoins(dt);
  updateParticles(dt);
  updateDamageTexts(dt);
  updateChainLines(dt);
  updateWaveTimer(dt);
  checkPlayerDeath();
}
