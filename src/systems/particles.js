// visual/feel state: screen shake, hit sparks, death bursts, damage
// numbers, chain lines, plus gold-coin pickup movement and collection

import { sfxPickupGold } from '../audio/sfx.js';
import { GOLD_CAP } from '../data/constants.js';
import { waveGoldMult } from '../state/derived.js';
import { canvasHolder, canvasFrame } from '../dom.js';
import { logEvent } from '../render/hud.js';
import { store } from '../state/store.js';

export function triggerShake(mag,dur){ store.game.shakeMag = Math.max(store.game.shakeMag,mag); store.game.shakeTime = Math.max(store.game.shakeTime,dur); }

// freezes gameplay updates (not rendering) for a few frames, a genuine
// hit-stop, reserved for the heaviest impacts (boss slams landing).
// keep it short, well under 0.15s, longer reads as lag not impact
export function triggerHitStop(dur){ store.game.hitStopTimer = Math.max(store.game.hitStopTimer||0, dur); }

let chromaTimeout = null;
// brief red/cyan channel-split flash on the play area, reserved for
// genuinely big moments (crits, boss slams, boss spawns) so it stays
// meaningful instead of firing on every hit
export function triggerChroma(){
  canvasHolder.classList.remove('chroma-pulse');
  void canvasHolder.offsetWidth;
  canvasHolder.classList.add('chroma-pulse');
  clearTimeout(chromaTimeout);
  chromaTimeout = setTimeout(() => canvasHolder.classList.remove('chroma-pulse'), 350);
}

let frameFlashTimeout = null;
// punches the arena's outer frame with a brief colored flash, the
// "outline lights up" reaction. color drives the border and tight
// inner glow, glow is the softer wider halo (usually same hue, lower
// opacity). called generously on purpose, it's the main "something
// just happened" signal
export function triggerFrameFlash(color, glow, dur){
  dur = dur || 0.4;
  canvasFrame.style.setProperty('--flash-color', color);
  canvasFrame.style.setProperty('--flash-glow', glow);
  canvasFrame.style.setProperty('--flash-dur', dur+'s');
  canvasFrame.classList.remove('frame-flash');
  void canvasFrame.offsetWidth;
  canvasFrame.classList.add('frame-flash');
  clearTimeout(frameFlashTimeout);
  frameFlashTimeout = setTimeout(() => canvasFrame.classList.remove('frame-flash'), dur*1000+60);
}
export function spawnHitParticle(x,y,color){ store.game.particles.push({x,y,vx:(Math.random()-0.5)*30,vy:(Math.random()-0.5)*30,life:0.22,maxLife:0.22,color,size:3}); }
export function spawnDeathBurst(x,y,color,count){
  for (let i=0;i<(count||9);i++){
    store.game.particles.push({x,y,vx:(Math.random()-0.5)*230,vy:(Math.random()-0.5)*230,life:0.4+Math.random()*0.35,maxLife:0.75,color,size:2+Math.random()*3});
  }
}
export function spawnDamageText(x,y,text,color,big){ store.game.damageTexts.push({x,y,text,color,big,life:0.7,maxLife:0.7,vy:-42}); }
export function updateParticles(dt){
  for (let i=store.game.particles.length-1;i>=0;i--){
    const pt = store.game.particles[i];
    pt.x += (pt.vx||0)*dt; pt.y += (pt.vy||0)*dt; pt.life -= dt;
    if (pt.life<=0) store.game.particles.splice(i,1);
  }
}
export function updateDamageTexts(dt){
  for (let i=store.game.damageTexts.length-1;i>=0;i--){
    const t = store.game.damageTexts[i];
    t.y += t.vy*dt; t.life -= dt;
    if (t.life<=0) store.game.damageTexts.splice(i,1);
  }
}
export function updateChainLines(dt){
  for (let i=store.game.chainLines.length-1;i>=0;i--){ store.game.chainLines[i].life -= dt; if (store.game.chainLines[i].life<=0) store.game.chainLines.splice(i,1); }
}
export function updateCoins(dt){
  const p = store.game.player;
  for (let i=store.game.coins.length-1;i>=0;i--){
    const c = store.game.coins[i];
    const d = Math.hypot(p.x-c.x,p.y-c.y);
    if (d < p.pickupRadius){ const ang=Math.atan2(p.y-c.y,p.x-c.x); c.x+=Math.cos(ang)*340*dt; c.y+=Math.sin(ang)*340*dt; }
    else { c.x += (c.vx||0)*dt*0.3; c.y += (c.vy||0)*dt*0.3; }
    if (d < 12){
      const gain = Math.round(c.value*p.goldMult*waveGoldMult());
      const before = store.game.gold;
      store.game.gold = Math.min(GOLD_CAP, store.game.gold+gain);
      if (store.game.gold===GOLD_CAP && before<GOLD_CAP && !store.game.goldCapNotified){ store.game.goldCapNotified=true; logEvent(`Gold capped at ${GOLD_CAP}. Spend some in the shop to keep earning.`); }
      store.game.coins.splice(i,1); sfxPickupGold();
    }
  }
}
