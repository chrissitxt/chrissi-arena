// The single requestAnimationFrame loop and the per-frame update
// orchestrator. This is the one place that decides what runs each frame
// and in what order — if you add a new per-frame system, it gets wired
// in here, once.

import { gameWrap } from '../dom.js';
import { render } from '../render/canvas.js';
import { store } from '../state/store.js';
import { updateOrbitWeapons, updatePlayerBombs, updatePlayerMovement, updateProjectiles, updateShooting } from './combat.js';
import { updateEnemies, updateEnemyProjectiles } from './enemies.js';
import { updateChainLines, updateCoins, updateDamageTexts, updateParticles } from './particles.js';
import { checkPlayerDeath } from './run.js';
import { updateWaveTimer } from './wave.js';

let fpsFrames = 0, fpsTimer = 0;

export function loop(now){
  store.animHandle = requestAnimationFrame(loop);
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

  try { update(dt); render(); }
  catch (err) { console.error('chrissi-arena frame error (recovered):', err); }
}
export function update(dt){
  if (!store.game || store.game.over) return;
  store.game.elapsed += dt;
  if (store.game.shakeTime>0) store.game.shakeTime -= dt; else store.game.shakeMag = 0;
  const p = store.game.player;
  if (p.invulnTime>0) p.invulnTime -= dt;
  if (p.jamTimer>0) p.jamTimer -= dt;
  if (p.regen>0 && p.hp<p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen*dt);

  updatePlayerMovement(dt);
  updateShooting(dt);
  updateProjectiles(dt);
  updateOrbitWeapons(dt);
  updatePlayerBombs(dt);
  updateEnemies(dt);
  updateEnemyProjectiles(dt);
  updateCoins(dt);
  updateParticles(dt);
  updateDamageTexts(dt);
  updateChainLines(dt);
  updateWaveTimer(dt);
  checkPlayerDeath();
}
