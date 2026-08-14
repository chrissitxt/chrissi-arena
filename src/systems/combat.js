// player combat each frame: movement, auto-aim/fire, projectiles,
// explosive/chain/orbit/bomb damage, and damage taken. the "effective"
// stat lookups come from state/derived.js so idle and empty-slot
// bonuses stay current

import { sfxCritHit, sfxExplosion, sfxHit, sfxPlayerHurt, sfxShoot } from '../audio/sfx.js';
import { ARENA_H, ARENA_W } from '../data/constants.js';
import { dodgeCap, effectiveDamageMult, effectiveDamage, effectiveFireRateMult, effectiveRange, lifestealCap, emptySlotDamageBonus, commonSynergyDamageBonus } from '../state/derived.js';
import { store } from '../state/store.js';
import { killEnemy } from './enemies.js';
import { spawnDamageText, spawnDeathBurst, spawnHitParticle, triggerShake, triggerFrameFlash } from './particles.js';
import { clamp } from '../utils.js';

export function updateShooting(dt){
  const p = store.game.player;
  if (p.jamTimer>0) return;
  p.fireTimer -= dt;
  if (p.fireTimer>0) return;
  const target = nearestEnemy();
  if (!target) return;
  p.fireTimer = 1/Math.max(0.1, p.fireRate*effectiveFireRateMult());
  const baseAngle = Math.atan2(target.y-p.y, target.x-p.x);
  const n = p.projectileCount;
  const spread = Math.min(0.6, n*0.07);
  const effCrit = Math.max(0, p.critChance);
  const dmgMult = effectiveDamageMult();
  const flatDmgBonus = emptySlotDamageBonus() + commonSynergyDamageBonus();
  for (let i=0;i<n;i++){
    const off = n===1 ? 0 : (i/(n-1)-0.5)*spread;
    const ang = baseAngle+off;
    let dmg = p.damage * dmgMult + flatDmgBonus;
    if (p.berserkerBonus>0 && p.hp < p.maxHp*0.5) dmg *= (1+p.berserkerBonus/100);
    const isCrit = Math.random()*100 < effCrit;
    store.game.projectiles.push({ x:p.x, y:p.y, px:p.x, py:p.y, vx:Math.cos(ang)*520, vy:Math.sin(ang)*520, dmg, crit:isCrit, pierceLeft:p.pierce, life:effectiveRange()/520 });
  }
  sfxShoot();
}
export function updateProjectiles(dt){
  const arr = store.game.projectiles;
  for (let i=arr.length-1;i>=0;i--){
    const pr = arr[i];
    pr.px = pr.x; pr.py = pr.y;
    pr.x += pr.vx*dt; pr.y += pr.vy*dt; pr.life -= dt;
    if (pr.life<=0 || pr.x<-20||pr.x>ARENA_W+20||pr.y<-20||pr.y>ARENA_H+20){ arr.splice(i,1); continue; }
    for (const e of store.game.enemies){
      if (e.hp<=0 || e.phased || !e.revealed) continue;
      const d = Math.hypot(e.x-pr.x, e.y-pr.y);
      if (d < e.radius+4){
        let dmg = pr.crit ? pr.dmg*store.game.player.critMult : pr.dmg;
        if (e.shielded) dmg *= 0.3;
        dmg = Math.max(1, Math.round(dmg-(e.armor||0)));
        e.hp -= dmg; e.flashTime = 0.08;
        spawnHitParticle(pr.x,pr.y, pr.crit?'#f2c94c':'#ffffff');
        spawnDamageText(e.x, e.y-e.radius-4, String(dmg), pr.crit?'#f2c94c':'#eae6f0', pr.crit);
        pr.crit ? sfxCritHit() : sfxHit();
        if (store.game.player.lifesteal>0) store.game.player.hp = Math.min(store.game.player.maxHp, store.game.player.hp + dmg*Math.min(lifestealCap(),store.game.player.lifesteal)/100*(store.game.player.hexedTimer>0?0.25:1));
        if (store.game.player.frostChance>0 && !e.boss && Math.random()*100 < store.game.player.frostChance) e.slowTimer = 1.5;
        if (store.game.player.explosiveLevel>0){
          const lvl = store.game.player.explosiveLevel;
          doExplosion(e.x, e.y, Math.round(dmg*(0.4+(lvl-1)*0.08)), e, 58+(lvl-1)*12);
        }
        if (store.game.player.chainCount>0) doChain(e, dmg, store.game.player.chainCount, new Set([e]));
        if (e.hp<=0) killEnemy(e);
        if (pr.pierceLeft>0) pr.pierceLeft -= 1; else arr.splice(i,1);
        break;
      }
    }
  }
  store.game.enemies = store.game.enemies.filter(e=>e.hp>0);
}
export function doExplosion(x,y,dmg,exclude,radius){
  radius = radius || 58;
  for (const o of store.game.enemies){
    if (o===exclude||o.hp<=0||o.phased||!o.revealed) continue;
    if (Math.hypot(o.x-x,o.y-y) < radius){
      o.hp -= dmg; o.flashTime = 0.08;
      spawnHitParticle(o.x,o.y,'#ff9d3d');
      sfxHit();
      if (o.hp<=0) killEnemy(o);
    }
  }
  spawnDeathBurst(x,y,'#ff9d3d',6);
}
export function doChain(fromEnemy, prevDmg, jumpsLeft, hitSet){
  if (jumpsLeft<=0) return;
  let best=null, bestD=170;
  for (const o of store.game.enemies){
    if (hitSet.has(o)||o.hp<=0||o.phased||!o.revealed) continue;
    const d = Math.hypot(o.x-fromEnemy.x,o.y-fromEnemy.y);
    if (d<bestD){ bestD=d; best=o; }
  }
  if (!best) return;
  const dmg = Math.max(1, Math.round(prevDmg*0.55));
  best.hp -= dmg; best.flashTime = 0.08;
  hitSet.add(best);
  store.game.chainLines.push({x1:fromEnemy.x,y1:fromEnemy.y,x2:best.x,y2:best.y,life:0.15,maxLife:0.15});
  spawnHitParticle(best.x,best.y,'#9d7bf0');
  sfxHit();
  if (best.hp<=0) killEnemy(best);
  doChain(best, dmg, jumpsLeft-1, hitSet);
}
export function applyDamageToPlayer(dmg){
  const p = store.game.player;
  if (store.godmode) return false;
  if (p.invulnTime>0) return false;
  if (Math.random()*100 < Math.min(dodgeCap(),p.dodgeChance)){
    spawnDamageText(p.x,p.y-22,'DODGE','#9aa6c9',false);
    p.invulnTime = 0.15;
    return false;
  }
  const finalDmg = Math.max(1, Math.round(dmg - p.armor));
  p.hp -= finalDmg;
  p.invulnTime = 0.4;
  if (store.game.enemies.some(en=>en.boss)) store.game.currentBossDamaged = true;
  spawnDamageText(p.x,p.y-22,'-'+finalDmg,'#e5534b',false);
  triggerShake(6,0.15);
  triggerFrameFlash('rgba(229,83,75,0.9)', 'rgba(229,83,75,0.55)', 0.35);
  sfxPlayerHurt();
  return true;
}
export function nearestEnemy(){
  let best=null, bestD=Infinity;
  const range = effectiveRange();
  const rangeSq = range*range;
  for (const e of store.game.enemies){
    if (e.phased || !e.revealed) continue;
    const d=(e.x-store.game.player.x)**2+(e.y-store.game.player.y)**2;
    if (d<=rangeSq && d<bestD){ bestD=d; best=e; }
  }
  return best;
}
export function updateOrbitWeapons(dt){
  const p = store.game.player;
  const count = p.orbitCount||0;
  store.game.orbitBlades = [];
  if (count<=0) return;
  // rotation speed and per-target cooldown both scale gently with attack
  // speed, so fire-rate investment helps a blade build the same way it
  // helps a gun build instead of blades being a flat tickrate
  const spinSpeed = 4.2 * Math.max(0.6, Math.min(2, p.fireRate/1.6));
  store.game.orbitAngle = (store.game.orbitAngle||0) + dt*spinSpeed;
  const radius = 48;
  const baseDmg = Math.max(4, Math.round(effectiveDamage()*0.5));
  const effCrit = Math.max(0, p.critChance);
  const cooldown = Math.max(0.16, 0.35 / Math.max(0.6, Math.min(2, p.fireRate/1.6)));
  for (let i=0;i<count;i++){
    const ang = store.game.orbitAngle + (i/count)*Math.PI*2;
    const bx = p.x + Math.cos(ang)*radius, by = p.y + Math.sin(ang)*radius;
    store.game.orbitBlades.push({x:bx, y:by, ang});
    for (const e of store.game.enemies){
      if (e.hp<=0 || e.phased || !e.revealed) continue;
      if (!e.orbitCooldown) e.orbitCooldown = {};
      const key = 'b'+i;
      if ((e.orbitCooldown[key]||0) > 0) continue;
      const d = Math.hypot(e.x-bx, e.y-by);
      if (d < e.radius+9){
        // blades go through the same crit/lifesteal pipeline as gunfire
        // now, so investing in either actually helps a melee build too
        const isCrit = Math.random()*100 < effCrit;
        const dmg = isCrit ? Math.round(baseDmg*p.critMult) : baseDmg;
        e.hp -= dmg; e.flashTime = 0.08;
        if (p.lifesteal>0) p.hp = Math.min(p.maxHp, p.hp + dmg*Math.min(lifestealCap(),p.lifesteal)/100*(p.hexedTimer>0?0.25:1));
        spawnHitParticle(bx,by, isCrit?'#f2c94c':'#c9c9d8');
        spawnDamageText(e.x, e.y-e.radius-4, String(dmg), isCrit?'#f2c94c':'#c9c9d8', isCrit);
        isCrit ? sfxCritHit() : sfxHit();
        e.orbitCooldown[key] = cooldown;
        if (e.hp<=0){ killEnemy(e); }
      }
    }
  }
  for (const e of store.game.enemies){
    if (e.orbitCooldown){ for (const k in e.orbitCooldown){ if (e.orbitCooldown[k]>0) e.orbitCooldown[k]-=dt; } }
  }
  store.game.enemies = store.game.enemies.filter(e=>e.hp>0);
}
export function updatePlayerBombs(dt){
  const p = store.game.player;
  store.game.playerBombs = store.game.playerBombs || [];
  if (p.bombDropLevel>0){
    store.game.bombDropTimer = (store.game.bombDropTimer==null?3.5:store.game.bombDropTimer) - dt;
    if (store.game.bombDropTimer<=0){
      store.game.bombDropTimer = 3.5;
      for (let i=0;i<p.bombDropLevel;i++){
        const ang = Math.random()*Math.PI*2, dist = Math.random()*10;
        store.game.playerBombs.push({x:p.x+Math.cos(ang)*dist, y:p.y+Math.sin(ang)*dist, fuse:1.3, maxFuse:1.3});
      }
    }
  }
  for (let i=store.game.playerBombs.length-1;i>=0;i--){
    const b = store.game.playerBombs[i];
    b.fuse -= dt;
    if (b.fuse<=0){
      const dmg = 10 + Math.round(p.damage*0.6);
      for (const e of store.game.enemies){
        if (e.hp<=0 || e.phased || !e.revealed) continue;
        if (Math.hypot(e.x-b.x,e.y-b.y) < 58){
          e.hp -= dmg; e.flashTime = 0.08;
          spawnHitParticle(e.x,e.y,'#ff9d3d');
          sfxHit();
          if (e.hp<=0) killEnemy(e);
        }
      }
      if (Math.hypot(p.x-b.x,p.y-b.y) < 58){ applyDamageToPlayer(Math.round(dmg*0.5)); }
      spawnDeathBurst(b.x,b.y,'#ff7a3d',14);
      triggerShake(7,0.2); sfxExplosion();
      store.game.playerBombs.splice(i,1);
    }
  }
  store.game.enemies = store.game.enemies.filter(e=>e.hp>0);
}
// lingering hazard left behind by a cursed enemy's death, ticks damage
// every 0.5s while standing in it. rewards paying attention to where
// a cursed pack dies, not just clearing through it
export function updateCurseZones(dt){
  const p = store.game.player;
  const arr = store.game.curseZones;
  for (let i=arr.length-1;i>=0;i--){
    const z = arr[i];
    z.life -= dt;
    if (z.life<=0){ arr.splice(i,1); continue; }
    z.tickTimer -= dt;
    if (z.tickTimer<=0 && Math.hypot(p.x-z.x,p.y-z.y) < z.radius){
      z.tickTimer = 0.5;
      applyDamageToPlayer(4 + Math.round(store.game.wave*0.15));
      spawnDamageText(p.x, p.y-30, 'CURSED', '#c07dff', false);
    }
  }
}
export function updatePlayerMovement(dt){
  const p = store.game.player;
  let dx=0,dy=0;
  if (store.game.keys['w']||store.game.keys['arrowup']) dy-=1;
  if (store.game.keys['s']||store.game.keys['arrowdown']) dy+=1;
  if (store.game.keys['a']||store.game.keys['arrowleft']) dx-=1;
  if (store.game.keys['d']||store.game.keys['arrowright']) dx+=1;
  const effSpeed = Math.max(15, p.moveSpeed);
  if (dx!==0||dy!==0){
    const len=Math.hypot(dx,dy); dx/=len; dy/=len; p.x+=dx*effSpeed*dt; p.y+=dy*effSpeed*dt;
    store.game.idleTimer = 0;
  } else {
    store.game.idleTimer = (store.game.idleTimer||0) + dt;
  }
  p.x = clamp(p.x, p.radius, ARENA_W-p.radius);
  p.y = clamp(p.y, p.radius, ARENA_H-p.radius);
}
