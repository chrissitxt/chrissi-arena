// The single canvas render pass. This function ONLY reads state and draws
// — it never mutates game state. That one-directional rule (systems
// change state, render reads it) is the core fix from the architecture
// review: the original prototype's two worst bugs both came from state
// being written from more than one place with no clear owner.

import { ARENA_H, ARENA_W } from '../data/constants.js';
import { ctx } from '../dom.js';
import { updateHUD } from './hud.js';
import { effectiveRange, isIdle } from '../state/derived.js';
import { store } from '../state/store.js';

export function render(){
  if (!store.game) return;
  const bossPresent = store.game.enemies.some(e=>e.boss);
  document.getElementById('app').classList.toggle('boss-active', bossPresent);

  ctx.save();
  const mag = store.game.shakeTime>0 ? store.game.shakeMag : 0;
  const ox = (Math.random()-0.5)*mag, oy = (Math.random()-0.5)*mag;
  ctx.translate(ox,oy);

  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(-10,-10,ARENA_W+20,ARENA_H+20);
  ctx.strokeStyle = bossPresent ? 'rgba(255,90,90,0.06)' : 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
  for (let x=0;x<ARENA_W;x+=50){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ARENA_H); ctx.stroke(); }
  for (let y=0;y<ARENA_H;y+=50){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(ARENA_W,y); ctx.stroke(); }

  const p0 = store.game.player;
  const idleActive = isIdle();
  ctx.strokeStyle = idleActive ? 'rgba(242,201,76,0.16)' : 'rgba(126,231,135,0.08)'; ctx.lineWidth = idleActive ? 1.5 : 1;
  ctx.beginPath(); ctx.arc(p0.x,p0.y,effectiveRange(),0,Math.PI*2); ctx.stroke();

  for (const c of store.game.coins){ ctx.fillStyle='#f2c94c'; ctx.beginPath(); ctx.arc(c.x,c.y,5,0,Math.PI*2); ctx.fill(); }

  for (const ln of store.game.chainLines){
    ctx.strokeStyle = `rgba(157,123,240,${(ln.life/ln.maxLife)*0.9})`; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(ln.x1,ln.y1); ctx.lineTo(ln.x2,ln.y2); ctx.stroke();
  }

  for (const pr of store.game.enemyProjectiles){
    ctx.fillStyle = pr.color || '#e5534b';
    ctx.beginPath(); ctx.arc(pr.x,pr.y,pr.radius,0,Math.PI*2); ctx.fill();
  }

  for (const pr of store.game.projectiles){
    ctx.strokeStyle = pr.crit ? 'rgba(242,201,76,0.5)' : 'rgba(126,231,135,0.4)';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pr.px,pr.py); ctx.lineTo(pr.x,pr.y); ctx.stroke();
    ctx.fillStyle = pr.crit ? '#f2c94c' : '#7ee787';
    ctx.beginPath(); ctx.arc(pr.x,pr.y,pr.crit?4:3,0,Math.PI*2); ctx.fill();
  }

  let hovered = null;
  if (store.game.mouseX!=null){
    let bd = Infinity;
    for (const e of store.game.enemies){ if (!e.revealed) continue; const d=Math.hypot(e.x-store.game.mouseX,e.y-store.game.mouseY); if (d<e.radius+10 && d<bd){ bd=d; hovered=e; } }
  }

  for (const e of store.game.enemies){
    if (!e.revealed) continue;
    if (e.boss && e.slamming){
      ctx.strokeStyle = 'rgba(255,80,80,0.6)'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(e.x,e.y,95,0,Math.PI*2); ctx.stroke();
    }
    ctx.globalAlpha = e.phased ? 0.28 : 1;
    drawEnemyShape(ctx, e.x, e.y, e.radius, e.color, e.shape, e.flashTime>0);
    if (e.shielded){
      ctx.strokeStyle = 'rgba(120,190,255,0.85)'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(e.x,e.y,e.radius+5,0,Math.PI*2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const pct = Math.max(0, e.hp/e.maxHp);
    ctx.fillStyle='#000'; ctx.fillRect(e.x-e.radius, e.y-e.radius-9, e.radius*2, 4);
    ctx.fillStyle= e.boss?'#c77dff':'#e5534b'; ctx.fillRect(e.x-e.radius, e.y-e.radius-9, e.radius*2*pct, 4);
    if (e===hovered){
      ctx.font='11px monospace'; ctx.textAlign='center';
      const label = e.name;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(e.x-tw/2-4, e.y-e.radius-26, tw+8, 14);
      ctx.fillStyle='#fff'; ctx.fillText(label, e.x, e.y-e.radius-16);
    }
  }

  for (const pt of store.game.particles){
    ctx.globalAlpha = Math.max(0, pt.life/pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.size,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  const p = store.game.player;
  const blink = p.invulnTime>0 ? (Math.floor(performance.now()/70)%2===0) : true;
  ctx.globalAlpha = blink ? 1 : 0.35;
  ctx.fillStyle = '#7ee787'; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  if (store.game.orbitBlades && store.game.orbitBlades.length){
    for (const b of store.game.orbitBlades){
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.rotate(b.ang+Math.PI/2);
      ctx.fillStyle = '#c9c9d8';
      ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(4,6); ctx.lineTo(-4,6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a8a9a';
      ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(2,-2); ctx.lineTo(-2,-2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  if (store.game.playerBombs && store.game.playerBombs.length){
    for (const b of store.game.playerBombs){
      const pct = Math.max(0, b.fuse/b.maxFuse);
      const pulse = 1 + (1-pct)*0.3;
      ctx.fillStyle = '#ff7a3d';
      ctx.beginPath(); ctx.arc(b.x,b.y,7*pulse,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(b.x,b.y,3,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x,b.y,11,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-pct)); ctx.stroke();
    }
  }

  for (const t of store.game.damageTexts){
    ctx.globalAlpha = Math.max(0, t.life/t.maxLife);
    ctx.fillStyle = t.color;
    ctx.font = (t.big ? 'bold 15px monospace' : (t.text==='DODGE'?'10px monospace':'11px monospace'));
    ctx.textAlign = 'center';
    ctx.shadowColor = t.color;
    ctx.shadowBlur = t.big ? 12 : 7;
    ctx.fillText(t.text, t.x, t.y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  updateHUD();
}
export function drawEnemyShape(g, x, y, r, color, shape, flash){
  g.save();
  if (shape==='boss'){
    const grad = g.createRadialGradient(x,y,r*0.4,x,y,r*1.9);
    grad.addColorStop(0, color+'66'); grad.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(x,y,r*1.9,0,Math.PI*2); g.fill();
  }
  g.fillStyle = flash ? '#ffffff' : color;
  g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  if (shape==='armored'){
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = Math.max(2,r*0.28);
    g.beginPath(); g.arc(x,y,r*0.66,0,Math.PI*2); g.stroke();
  } else if (shape==='spiky'){
    g.fillStyle = flash ? '#fff' : 'rgba(255,255,255,0.55)';
    for (let i=0;i<5;i++){ const a=(i/5)*Math.PI*2;
      g.beginPath(); g.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
      g.lineTo(x+Math.cos(a)*(r+7),y+Math.sin(a)*(r+7));
      g.lineTo(x+Math.cos(a+0.35)*r,y+Math.sin(a+0.35)*r); g.closePath(); g.fill(); }
  } else if (shape==='bomb'){
    g.strokeStyle = flash ? '#fff' : 'rgba(0,0,0,0.55)'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x-r*0.5,y-r*0.5); g.lineTo(x+r*0.5,y+r*0.5);
    g.moveTo(x+r*0.5,y-r*0.5); g.lineTo(x-r*0.5,y+r*0.5); g.stroke();
  } else if (shape==='erratic'){
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.setLineDash([3,3]);
    g.beginPath(); g.arc(x,y,r+4,0,Math.PI*2); g.stroke(); g.setLineDash([]);
  } else if (shape==='boss'){
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.stroke();
    for (let i=0;i<6;i++){ const a=(i/6)*Math.PI*2;
      g.beginPath(); g.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
      g.lineTo(x+Math.cos(a)*(r+9),y+Math.sin(a)*(r+9));
      g.strokeStyle='rgba(255,255,255,0.65)'; g.lineWidth=2; g.stroke(); }
  }
  g.restore();
}
