// Enemy AI, spawning, and death. Every special-ability flag on an enemy
// type (ranged, phasing, shielding, leech, jammer, invisible, bomber,
// splitsInto/splitCount) gets copied onto the live instance in
// spawnRegular() — if you add a new flag to an enemy type in
// data/enemies.js, it has to be added here too, or it'll be silently
// ignored on spawn. spawnBoss() is separate and does NOT copy these
// flags, since bosses use handleBossBehavior() instead — but it DOES need
// `revealed:true` set explicitly, or the boss is invisible and
// untargetable (this happened once for real; see the changelog).

import { sfxBossAttack, sfxBossSpawn, sfxEnemyDeath, sfxExplosion } from '../audio/sfx.js';
import { ARENA_H, ARENA_W, BOSS_EVERY, WIN_WAVE } from '../data/constants.js';
import { BOSS_CYCLE, ENEMY_TYPES } from '../data/enemies.js';
import { logEvent, showBossBanner } from '../render/hud.js';
import { store } from '../state/store.js';
import { STORE_COMPENDIUM, saveJSON } from '../storage.js';
import { unlockAchievement } from './achievements.js';
import { applyDamageToPlayer } from './combat.js';
import { loop } from './loop.js';
import { spawnDamageText, spawnDeathBurst, triggerShake } from './particles.js';
import { finishWave, triggerVictory } from './wave.js';
import { clamp } from '../utils.js';

export function unlockEnemy(id){ if (!store.compendium.enemies.includes(id)){ store.compendium.enemies.push(id); saveJSON(STORE_COMPENDIUM, store.compendium); } }
export function spawnRegular(type, xOverride, yOverride){
  const scale = 1 + (store.game.wave-1)*0.15;
  let x,y;
  if (xOverride!=null){ x=clamp(xOverride,20,ARENA_W-20); y=clamp(yOverride,20,ARENA_H-20); }
  else {
    const edge = Math.floor(Math.random()*4);
    if (edge===0){ x=Math.random()*ARENA_W; y=-20; }
    else if (edge===1){ x=Math.random()*ARENA_W; y=ARENA_H+20; }
    else if (edge===2){ x=-20; y=Math.random()*ARENA_H; }
    else { x=ARENA_W+20; y=Math.random()*ARENA_H; }
  }
  store.game.enemies.push({
    id:type.id, name:type.name, x, y, radius:type.radius, color:type.color, shape:type.shape,
    hp:Math.round(type.hp*scale), maxHp:Math.round(type.hp*scale), speed:type.speed,
    dmg:Math.round(type.dmg*scale)||1, ranged:!!type.ranged, boss:false, bomber:!!type.bomber,
    phasing:!!type.phasing, shielding:!!type.shielding, leech:!!type.leech, jammer:!!type.jammer,
    invisible:!!type.invisible, revealed:!type.invisible, splitsInto:type.splitsInto||null, splitCount:type.splitCount||0,
    armor:type.armor||0, gold:type.gold, flashTime:0, slowTimer:0
  });
  unlockEnemy(type.id);
}
export function spawnBoss(def, loop){
  const scale = 1 + loop*0.35;
  store.game.enemies.push({
    id:def.id, name:def.name, x:ARENA_W/2, y:70, radius:def.radius, color:def.color, shape:def.shape,
    hp:Math.round(def.hp*scale), maxHp:Math.round(def.hp*scale), speed:def.speed,
    dmg:Math.round(def.dmg*scale), ranged:!!def.ranged, boss:true, gold:def.gold,
    flashTime:0, slowTimer:0, armor:0, revealed:true
  });
  unlockEnemy(def.id);
  store.game.currentBossDamaged = false;
  showBossBanner(def.name);
  logEvent(`${def.name} has entered the arena!`);
  sfxBossSpawn(); triggerShake(8,0.4);
}
export function isBossWaveNow(){ return (store.game.wave===WIN_WAVE) || (store.game.wave % BOSS_EVERY === 0); }
export function spawnEnemy(){
  const wave = store.game.wave;
  if (isBossWaveNow() && !store.game.bossSpawned){
    let def, loop=0;
    if (wave===WIN_WAVE && !store.game.gameWon){ def = ENEMY_TYPES.find(e=>e.id==='finalboss'); }
    else {
      const idx = Math.floor(wave/BOSS_EVERY)-1;
      loop = Math.floor(idx/3);
      def = ENEMY_TYPES.find(e=>e.id===BOSS_CYCLE[((idx%3)+3)%3]);
    }
    spawnBoss(def, loop);
    store.game.bossSpawned = true;
    return;
  }
  if (store.game.enemies.length >= 40) return;
  const pool = ENEMY_TYPES.filter(e=>!e.boss && e.minWave<=wave);
  if (pool.length===0) return;
  const type = pool[Math.floor(Math.random()*pool.length)];
  if (type.id==='swarmling'){ const n=3+Math.floor(Math.random()*2); for(let i=0;i<n;i++) spawnRegular(type); }
  else spawnRegular(type);
}
export function fireAtPlayer(e, speed){
  const ang = Math.atan2(store.game.player.y-e.y, store.game.player.x-e.x);
  store.game.enemyProjectiles.push({x:e.x,y:e.y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,dmg:e.dmg,life:2.5,radius:5,color:e.boss?'#ff5f8f':'#e5534b'});
}
export function fireRing(e){
  const n=14;
  for (let i=0;i<n;i++){ const ang=(i/n)*Math.PI*2;
    store.game.enemyProjectiles.push({x:e.x,y:e.y,vx:Math.cos(ang)*170,vy:Math.sin(ang)*170,dmg:Math.round(e.dmg*0.55),life:3.2,radius:6,color:'#ff5f8f'}); }
  sfxBossAttack(); triggerShake(5,0.2);
}
export function summonAdds(e, typeId, count){
  const type = ENEMY_TYPES.find(t=>t.id===typeId);
  if (!type) return;
  for (let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2, dist=40+Math.random()*30;
    spawnRegular(type, e.x+Math.cos(ang)*dist, e.y+Math.sin(ang)*dist);
  }
}
export function handleBomber(e, spd, dt){
  const p = store.game.player;
  const d = Math.hypot(p.x-e.x,p.y-e.y);
  if (d>1){ const ang=Math.atan2(p.y-e.y,p.x-e.x); e.x+=Math.cos(ang)*spd*dt; e.y+=Math.sin(ang)*spd*dt; }
  if (d<38){
    applyDamageToPlayer(14+Math.round((store.game.wave-1)*0.3));
    spawnDeathBurst(e.x,e.y,'#ff7a3d',16);
    triggerShake(7,0.25); sfxExplosion();
    e.hp = -1;
  }
}
export function handleRangedMovementAndFire(e, spd, dt){
  const p = store.game.player;
  const dist = Math.hypot(p.x-e.x,p.y-e.y);
  e.rangedTimer = (e.rangedTimer==null?2:e.rangedTimer) - dt;
  if (e.rangedTimer<=0 && dist<420){ e.rangedTimer=2.0; fireAtPlayer(e,220); }
  if (dist>190){ const ang=Math.atan2(p.y-e.y,p.x-e.x); e.x+=Math.cos(ang)*spd*dt; e.y+=Math.sin(ang)*spd*dt; }
}
export function handleSpecialTimers(e, dt){
  if (e.phasing){
    e.phaseTimer = (e.phaseTimer==null?3:e.phaseTimer) - dt;
    if (e.phaseTimer<=0){ e.phased = !e.phased; e.phaseTimer = e.phased?1:3; }
  }
  if (e.shielding){
    e.shieldTimer = (e.shieldTimer==null?5:e.shieldTimer) - dt;
    e.shielded = e.shieldTimer<=2;
    if (e.shieldTimer<=0) e.shieldTimer = 5;
  }
}
export function handleBossBehavior(e, dt, spd){
  const p = store.game.player;
  if (e.id==='broodmother'){
    const dist = Math.hypot(p.x-e.x,p.y-e.y);
    if (dist<200){ const ang=Math.atan2(e.y-p.y,e.x-p.x); e.x+=Math.cos(ang)*spd*dt; e.y+=Math.sin(ang)*spd*dt; }
    else if (dist>320){ const ang=Math.atan2(p.y-e.y,p.x-e.x); e.x+=Math.cos(ang)*spd*dt; e.y+=Math.sin(ang)*spd*dt; }
    e.spitTimer = (e.spitTimer==null?2.5:e.spitTimer) - dt;
    if (e.spitTimer<=0 && dist<450){ e.spitTimer=2.3; fireAtPlayer(e,190); }
    e.summonTimer = (e.summonTimer==null?6:e.summonTimer) - dt;
    if (e.summonTimer<=0 && store.game.enemies.length<40){ e.summonTimer=6; summonAdds(e,'swarmling',2); }
  } else {
    const ang = Math.atan2(p.y-e.y,p.x-e.x);
    e.x += Math.cos(ang)*spd*dt; e.y += Math.sin(ang)*spd*dt;
  }
  if (e.id==='warlord' || e.id==='finalboss'){
    e.ringTimer = (e.ringTimer==null?4:e.ringTimer) - dt;
    if (e.ringTimer<=0){ e.ringTimer = e.id==='finalboss'?4.5:4; fireRing(e); }
  }
  if (e.id==='colossus' || e.id==='finalboss'){
    e.slamTimer = (e.slamTimer==null?5:e.slamTimer) - dt;
    e.slamming = e.slamTimer <= 0.9;
    if (e.slamTimer<=0){
      e.slamTimer = e.id==='finalboss'?6:5;
      const d = Math.hypot(p.x-e.x,p.y-e.y);
      if (d<=95) { applyDamageToPlayer(e.id==='finalboss'?30:26); triggerShake(10,0.3); }
      spawnDeathBurst(e.x,e.y,'#ffffff',14);
      sfxBossAttack();
    }
  }
  if (e.id==='finalboss'){
    e.summonTimer2 = (e.summonTimer2==null?8:e.summonTimer2) - dt;
    if (e.summonTimer2<=0 && store.game.enemies.length<40){ e.summonTimer2=8; summonAdds(e,'shambler',2); summonAdds(e,'sprinter',1); }
  }
}
export function updateEnemies(dt){
  const p = store.game.player;
  for (const e of store.game.enemies){
    if (e.hp<=0) continue;
    if (e.flashTime>0) e.flashTime -= dt;
    if (!e.boss && e.slowTimer>0) e.slowTimer -= dt;
    if (e.invisible && !e.revealed){
      if (Math.hypot(p.x-e.x,p.y-e.y) < 130) e.revealed = true;
    }
    handleSpecialTimers(e, dt);
    const spd = e.speed * ((!e.boss && e.slowTimer>0) ? 0.5 : 1);

    if (e.bomber){ handleBomber(e,spd,dt); continue; }
    if (e.boss){ handleBossBehavior(e,dt,spd); }
    else if (e.ranged){ handleRangedMovementAndFire(e,spd,dt); }
    else { const ang=Math.atan2(p.y-e.y,p.x-e.x); e.x+=Math.cos(ang)*spd*dt; e.y+=Math.sin(ang)*spd*dt; }

    const d2 = Math.hypot(p.x-e.x,p.y-e.y);
    if (d2 < p.radius+e.radius){
      const dealt = applyDamageToPlayer(e.dmg);
      if (dealt && e.leech){
        const stolen = Math.min(store.game.gold, 2+Math.floor(store.game.wave*0.15));
        if (stolen>0){ store.game.gold -= stolen; spawnDamageText(p.x,p.y-38,'-'+stolen+'g','#f2c94c',false); }
      }
      if (dealt && e.jammer){ p.jamTimer = Math.max(p.jamTimer||0, 1.0); spawnDamageText(p.x,p.y-38,'JAMMED','#e0c840',false); }
    }
  }
  store.game.enemies = store.game.enemies.filter(e=>e.hp>0);
}
export function updateEnemyProjectiles(dt){
  const arr = store.game.enemyProjectiles;
  const p = store.game.player;
  for (let i=arr.length-1;i>=0;i--){
    const pr = arr[i];
    pr.x += pr.vx*dt; pr.y += pr.vy*dt; pr.life -= dt;
    if (pr.life<=0){ arr.splice(i,1); continue; }
    const d = Math.hypot(p.x-pr.x,p.y-pr.y);
    if (d < p.radius+pr.radius){ applyDamageToPlayer(pr.dmg); arr.splice(i,1); }
  }
}
export function killEnemy(e){
  store.game.kills += 1;
  if (e.gold>0 && (e.boss || e.gold>1 || Math.random()<0.7)){
    store.game.coins.push({x:e.x,y:e.y,value:e.gold,vx:(Math.random()-0.5)*50,vy:(Math.random()-0.5)*50});
  }
  spawnDeathBurst(e.x,e.y,e.color, e.boss?26:9);
  sfxEnemyDeath();
  if (e.splitsInto && store.game.enemies.length<40){
    const childType = ENEMY_TYPES.find(t=>t.id===e.splitsInto);
    if (childType){
      for (let i=0;i<(e.splitCount||2);i++){
        const ang = Math.random()*Math.PI*2, dist = 10+Math.random()*16;
        spawnRegular(childType, e.x+Math.cos(ang)*dist, e.y+Math.sin(ang)*dist);
      }
    }
  }
  if (e.boss){
    store.game.bossSpawned = false;
    const slayId = {warlord:'slay_warlord', broodmother:'slay_broodmother', colossus:'slay_colossus', finalboss:'slay_devourer'}[e.id];
    if (slayId) unlockAchievement(slayId);
    if (!store.game.currentBossDamaged){
      const flawlessId = {warlord:'flawless_warlord', broodmother:'flawless_broodmother', colossus:'flawless_colossus', finalboss:'flawless_devourer'}[e.id];
      if (flawlessId) unlockAchievement(flawlessId);
    }
    if (e.id==='finalboss'){ store.game.gameWon = true; triggerVictory(); }
    else { finishWave(); }
  }
}
