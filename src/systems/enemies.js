// enemy ai, spawning, death. every special flag on an enemy type (ranged,
// phasing, shielding, leech, jammer, invisible, bomber, totem, mimic,
// splitsInto/splitCount) gets copied onto the live instance in
// spawnRegular(). add a new flag in data/enemies.js, it has to get
// added here too or it's silently ignored. spawnBoss() is separate and
// doesn't copy these, bosses use handleBossBehavior() instead, but it
// does need revealed:true set explicitly or the boss is invisible and
// untargetable (happened for real once, see the changelog)

import { sfxBossAttack, sfxBossSpawn, sfxEnemyDeath, sfxExplosion, setMusicMode } from '../audio/sfx.js';
import { ARENA_H, ARENA_W, BOSS_EVERY, WIN_WAVE } from '../data/constants.js';
import { BOSS_POOL, ENEMY_TYPES } from '../data/enemies.js';
import { logEvent, showBossBanner } from '../render/hud.js';
import { store } from '../state/store.js';
import { STORE_COMPENDIUM, saveJSON } from '../storage.js';
import { unlockAchievement } from './achievements.js';
import { applyDamageToPlayer } from './combat.js';
import { loop } from './loop.js';
import { spawnDamageText, spawnDeathBurst, triggerShake, triggerChroma, triggerHitStop, triggerFrameFlash } from './particles.js';
import { finishWave, triggerVictory } from './wave.js';
import { clamp } from '../utils.js';

export function unlockEnemy(id){ if (!store.compendium.enemies.includes(id)){ store.compendium.enemies.push(id); saveJSON(STORE_COMPENDIUM, store.compendium); } }
export function spawnRegular(type, xOverride, yOverride){
  const scale = 1 + (store.game.wave-1)*0.19;
  let x,y;
  if (xOverride!=null){ x=clamp(xOverride,20,ARENA_W-20); y=clamp(yOverride,20,ARENA_H-20); }
  else {
    const edge = Math.floor(Math.random()*4);
    if (edge===0){ x=Math.random()*ARENA_W; y=-20; }
    else if (edge===1){ x=Math.random()*ARENA_W; y=ARENA_H+20; }
    else if (edge===2){ x=-20; y=Math.random()*ARENA_H; }
    else { x=ARENA_W+20; y=Math.random()*ARENA_H; }
  }
  // more cursed items you own, more likely a spawn rolls cursed instead
  // of normal, just a stat-boosted variant of whatever would've spawned
  // anyway. capped at 50% so it never makes literally every enemy cursed
  const cursedChance = Math.min(50, store.game.player.cursedStat||0);
  const isCursed = Math.random()*100 < cursedChance;
  const hp = Math.round(type.hp*scale*(isCursed?1.35:1));
  store.game.enemies.push({
    id:type.id, name:(isCursed?'Cursed ':'')+type.name, x, y, radius:type.radius,
    color:isCursed?'#ff2d55':type.color, shape:type.shape,
    hp, maxHp:hp, speed:type.speed,
    dmg:Math.round(type.dmg*scale*(isCursed?1.2:1))||1, ranged:!!type.ranged, boss:false, bomber:!!type.bomber,
    phasing:!!type.phasing, shielding:!!type.shielding, leech:!!type.leech, jammer:!!type.jammer,
    totem:!!type.totem, mimic:!!type.mimic, awake:!type.mimic,
    invisible:!!type.invisible, revealed:!type.invisible, splitsInto:type.splitsInto||null, splitCount:type.splitCount||0,
    armor:type.armor||0, gold:type.gold+(isCursed?1:0), flashTime:0, slowTimer:0, cursed:isCursed
  });
  unlockEnemy(type.id);
}
export function spawnBoss(def, loop){
  const scale = 1 + loop*0.45;
  store.game.enemies.push({
    id:def.id, name:def.name, x:ARENA_W/2, y:70, radius:def.radius, color:def.color, shape:def.shape,
    hp:Math.round(def.hp*scale), maxHp:Math.round(def.hp*scale), speed:def.speed,
    dmg:Math.round(def.dmg*scale), ranged:!!def.ranged, boss:true, gold:def.gold,
    flashTime:0, slowTimer:0, armor:0, revealed:true, enrageStacks:0
  });
  unlockEnemy(def.id);
  store.game.currentBossDamaged = false;
  store.game.bossEnrageAt = store.game.waveTime + 40;
  showBossBanner(def.name);
  logEvent(`${def.name} has entered the arena!`);
  sfxBossSpawn(); triggerShake(11,0.4); triggerChroma(); triggerFrameFlash('rgba(229,83,75,1)', 'rgba(229,83,75,0.7)', 0.7);
  setMusicMode('boss');
}
export function isBossWaveNow(){ return (store.game.wave===WIN_WAVE) || (store.game.wave % BOSS_EVERY === 0); }

// called when a boss fight drags on too long. bosses used to let the
// wave time out, so dodging one forever was a free indefinite gold farm
// with zero downside. now every 30s not killing it makes it meaningfully
// more dangerous, stacking forever, so stalling isn't a real option
export function enrageBoss(){
  const boss = store.game.enemies.find(e=>e.boss);
  if (!boss) return;
  boss.enrageStacks = (boss.enrageStacks||0) + 1;
  boss.dmg = Math.round(boss.dmg * 1.25);
  boss.speed *= 1.12;
  logEvent(`${boss.name} grows enraged from the drawn-out fight!`);
  triggerFrameFlash('rgba(255,45,85,1)', 'rgba(255,45,85,0.75)', 0.6);
  triggerShake(9,0.3);
  sfxBossAttack();
}
export function spawnEnemy(){
  const wave = store.game.wave;
  if (isBossWaveNow() && !store.game.bossSpawned){
    let def, loop=0;
    if (wave===WIN_WAVE && !store.game.gameWon){ def = ENEMY_TYPES.find(e=>e.id==='finalboss'); }
    else {
      const candidates = BOSS_POOL.length>1 ? BOSS_POOL.filter(id=>id!==store.game.lastBossId) : BOSS_POOL;
      const bossId = candidates[Math.floor(Math.random()*candidates.length)];
      def = ENEMY_TYPES.find(e=>e.id===bossId);
      loop = store.game.bossSeenCounts[bossId] || 0;
      store.game.bossSeenCounts[bossId] = loop + 1;
      store.game.lastBossId = bossId;
    }
    spawnBoss(def, loop);
    store.game.bossSpawned = true;
    return;
  }
  if (store.game.enemies.length >= 46) return;
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
  sfxBossAttack(); triggerShake(6,0.2);
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
  // a totem's shield decays on its own if it doesn't get refreshed in
  // time, walk away from the totem and the shield drops off
  if (e.totemShieldTimer>0){
    e.totemShieldTimer -= dt;
    if (e.totemShieldTimer<=0){ e.shielded = false; }
  }
}
// totems never move or chase, they stand still and periodically grant a
// damage-reducing shield to nearby non-boss enemies, reusing the same
// shielded flag the warden already has instead of building a whole new
// buff system. killing the totem is what stops the shielding, that's
// the point, it's the priority target, not what it's protecting
function handleTotem(e, dt){
  e.pulseTimer = (e.pulseTimer==null?0.6:e.pulseTimer) - dt;
  if (e.pulseTimer<=0){
    e.pulseTimer = 0.6;
    for (const other of store.game.enemies){
      if (other===e || other.boss || other.hp<=0 || other.totem) continue;
      if (Math.hypot(other.x-e.x, other.y-e.y) < 150){ other.shielded = true; other.totemShieldTimer = 0.75; }
    }
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
    if (e.summonTimer<=0 && store.game.enemies.length<46){ e.summonTimer=6; summonAdds(e,'swarmling',2); }
  } else if (e.id==='sentinel'){
    // barely moves, the threat is the sweeping beam, not a chase
    const ang = Math.atan2(p.y-e.y,p.x-e.x); e.x+=Math.cos(ang)*spd*dt*0.3; e.y+=Math.sin(ang)*spd*dt*0.3;
  } else if (e.id==='mirror' || e.id==='butcher' || e.id==='swarmqueen' || e.id==='hollowking'){
    const ang = Math.atan2(p.y-e.y,p.x-e.x); e.x+=Math.cos(ang)*spd*dt; e.y+=Math.sin(ang)*spd*dt;
  } else {
    const ang = Math.atan2(p.y-e.y,p.x-e.x); e.x += Math.cos(ang)*spd*dt; e.y += Math.sin(ang)*spd*dt;
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
      if (d<=95) { applyDamageToPlayer(e.id==='finalboss'?30:26); triggerShake(14,0.35); triggerChroma(); triggerHitStop(0.07); triggerFrameFlash('rgba(229,83,75,1)', 'rgba(229,83,75,0.6)', 0.45); }
      spawnDeathBurst(e.x,e.y,'#ffffff',14);
      sfxBossAttack();
    }
  }
  if (e.id==='finalboss'){
    e.summonTimer2 = (e.summonTimer2==null?8:e.summonTimer2) - dt;
    if (e.summonTimer2<=0 && store.game.enemies.length<46){ e.summonTimer2=8; summonAdds(e,'shambler',2); summonAdds(e,'sprinter',1); }
  }
  if (e.id==='butcher'){
    // winds up in place (telegraphed), then bursts toward where the
    // player was standing when it started. permanently enrages below
    // 40% hp, gets scarier as it dies instead of weaker
    if (!e.raged && e.hp < e.maxHp*0.4){
      e.raged = true; e.speed *= 1.35; e.dmg = Math.round(e.dmg*1.3);
      logEvent(`${e.name} flies into a rage!`);
      triggerFrameFlash('rgba(181,69,31,1)', 'rgba(181,69,31,0.6)', 0.5);
    }
    if (e.dashTime>0){
      e.dashTime -= dt; e.x += (e.dashVX||0)*dt; e.y += (e.dashVY||0)*dt;
    } else if (e.charging>0){
      e.charging -= dt;
      if (e.charging<=0){
        const ang = Math.atan2((e.chargeTY??p.y)-e.y, (e.chargeTX??p.x)-e.x);
        e.dashVX = Math.cos(ang)*620; e.dashVY = Math.sin(ang)*620; e.dashTime = 0.3;
        triggerShake(8,0.2);
      }
    } else {
      e.chargeTimer = (e.chargeTimer==null?4:e.chargeTimer) - dt;
      if (e.chargeTimer<=0){
        e.chargeTimer = e.raged?2.8:4;
        e.charging = 0.55; e.chargeTX = p.x; e.chargeTY = p.y;
        spawnDeathBurst(e.x,e.y,'#b5451f',10);
      }
    }
    if (e.dashTime>0){
      const d = Math.hypot(p.x-e.x,p.y-e.y);
      if (d < e.radius+p.radius+6){ applyDamageToPlayer(Math.round(e.dmg*1.1)); e.dashTime=0; triggerShake(10,0.25); }
    }
  }
  if (e.id==='swarmqueen'){
    e.birthTimer = (e.birthTimer==null?2.5:e.birthTimer) - dt;
    if (e.birthTimer<=0 && store.game.enemies.length<46){ e.birthTimer=2.5; summonAdds(e,'swarmling',2); }
    e.pulseTimer = (e.pulseTimer==null?8:e.pulseTimer) - dt;
    if (e.pulseTimer<=0){
      e.pulseTimer = 8;
      const aliveMinions = store.game.enemies.filter(o=>o.id==='swarmling' && o.hp>0 && !o.boss).length;
      if (aliveMinions>0 && e.hp<e.maxHp){
        const healAmt = Math.min(e.maxHp-e.hp, Math.round(e.maxHp*0.02*aliveMinions));
        e.hp += healAmt;
        spawnDamageText(e.x,e.y-e.radius-10,'+'+healAmt,'#3d8b5f',true);
      }
    }
  }
  if (e.id==='sentinel'){
    e.beamAngle = (e.beamAngle||0) + dt*1.8;
    e.beamFireTimer = (e.beamFireTimer==null?0.12:e.beamFireTimer) - dt;
    if (e.beamFireTimer<=0){
      e.beamFireTimer = 0.12;
      store.game.enemyProjectiles.push({x:e.x,y:e.y,vx:Math.cos(e.beamAngle)*260,vy:Math.sin(e.beamAngle)*260,dmg:Math.round(e.dmg*0.45),life:1.2,radius:5,color:'#4a6fa5'});
    }
  }
  if (e.id==='mirror' && !e.isClone){
    e.splitTimer = (e.splitTimer==null?10:e.splitTimer) - dt;
    if (e.splitTimer<=0 && store.game.enemies.length<46){
      e.splitTimer = 10;
      const cloneHp = Math.round(e.maxHp*0.35);
      store.game.enemies.push({
        id:'mirror', name:'Mirror Image', x:e.x+30, y:e.y+30, radius:e.radius*0.75, color:e.color, shape:'boss',
        hp:cloneHp, maxHp:cloneHp, speed:e.speed*1.15, dmg:Math.round(e.dmg*0.5), ranged:false, boss:true, isClone:true,
        gold:0, flashTime:0, slowTimer:0, armor:0, revealed:true, enrageStacks:0
      });
      logEvent(`${e.name} splits off a duplicate!`);
      triggerFrameFlash('rgba(157,123,240,1)', 'rgba(157,123,240,0.6)', 0.4);
    }
  }
  if (e.id==='hollowking'){
    const dist = Math.hypot(p.x-e.x,p.y-e.y);
    const cursedBonus = Math.min(1, (p.cursedStat||0)/50);
    if (dist<260 && dist>40){
      const pullAng = Math.atan2(e.y-p.y,e.x-p.x);
      const pullStrength = 40 + cursedBonus*40;
      p.x += Math.cos(pullAng)*pullStrength*dt; p.y += Math.sin(pullAng)*pullStrength*dt;
    }
    e.voidTimer = (e.voidTimer==null?6:e.voidTimer) - dt;
    if (e.voidTimer<=0){
      e.voidTimer = 6;
      if (dist<300){
        applyDamageToPlayer(Math.round(e.dmg*(0.6+cursedBonus*0.5)));
        spawnDamageText(p.x,p.y-30,'VOID PULSE','#c07dff',true);
        triggerFrameFlash('rgba(42,18,64,1)', 'rgba(120,60,180,0.7)', 0.5);
        triggerShake(9,0.25);
      }
    }
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
    if (e.totem){ handleTotem(e,dt); }
    else if (e.mimic && !e.awake){
      if (Math.hypot(p.x-e.x,p.y-e.y) < 70){ e.awake = true; e.speed *= 1.4; spawnDeathBurst(e.x,e.y,e.color,10); }
      // stays put while dormant, but contact damage below still applies
      // if the player wanders right up to it before it wakes
    }
    else if (e.boss){ handleBossBehavior(e,dt,spd); }
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
      // cursed enemies hex you on a landed hit, lifesteal barely works
      // for a few seconds. punishes sustain builds specifically, fits
      // the "power at a cost" cursed theme
      if (dealt && e.cursed){ p.hexedTimer = Math.max(p.hexedTimer||0, 4); spawnDamageText(p.x,p.y-46,'HEXED','#ff2d55',false); }
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
  // a cursed enemy leaves a lingering hazard when it dies, punishes
  // carelessly aoe-clearing a cursed pack instead of watching where
  // the bodies land
  if (e.cursed && !e.boss){
    store.game.curseZones.push({x:e.x, y:e.y, radius:48, life:3, tickTimer:0});
  }
  spawnDeathBurst(e.x,e.y,e.color, e.boss?26:9);
  sfxEnemyDeath();
  if (e.splitsInto && store.game.enemies.length<46){
    const childType = ENEMY_TYPES.find(t=>t.id===e.splitsInto);
    if (childType){
      for (let i=0;i<(e.splitCount||2);i++){
        const ang = Math.random()*Math.PI*2, dist = 10+Math.random()*16;
        spawnRegular(childType, e.x+Math.cos(ang)*dist, e.y+Math.sin(ang)*dist);
      }
    }
  }
  if (e.boss && !e.isClone){
    store.game.bossSpawned = false;
    setMusicMode('main');
    const slayId = {warlord:'slay_warlord', broodmother:'slay_broodmother', colossus:'slay_colossus', finalboss:'slay_devourer', butcher:'slay_butcher', swarmqueen:'slay_swarmqueen', sentinel:'slay_sentinel', mirror:'slay_mirror', hollowking:'slay_hollowking'}[e.id];
    if (slayId) unlockAchievement(slayId);
    if (!store.game.currentBossDamaged){
      const flawlessId = {warlord:'flawless_warlord', broodmother:'flawless_broodmother', colossus:'flawless_colossus', finalboss:'flawless_devourer', butcher:'flawless_butcher', swarmqueen:'flawless_swarmqueen', sentinel:'flawless_sentinel', mirror:'flawless_mirror', hollowking:'flawless_hollowking'}[e.id];
      if (flawlessId) unlockAchievement(flawlessId);
    }
    if (e.id==='finalboss'){ store.game.gameWon = true; triggerVictory(); }
    else { finishWave(); }
  }
}
