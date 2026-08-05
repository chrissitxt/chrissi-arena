// Left/right side-panel HUD, the wave-clear/boss-name banners, and the
// scrolling event log. showWaveBanner/showBossBanner explicitly clear
// their own CSS animation class + text via setTimeout rather than relying
// on the animation's `forwards` fill-mode alone — the fill-mode approach
// looked fine but replayed stale text if the game screen toggled
// display:none and back (e.g. pause/resume) while it was still "holding"
// its end state. That was a real, shipped bug; don't revert this.

import { GOLD_CAP } from '../data/constants.js';
import { hideItemTooltip, moveItemTooltip, showItemTooltip } from './shop.js';
import { computeScore, dodgeCap, effectiveCap, effectiveDamageMult, effectiveFireRateMult, effectiveRange, isIdle } from '../state/derived.js';
import { store } from '../state/store.js';
import { groupOwnedItems } from '../systems/economy.js';
import { isBossWaveNow } from '../systems/enemies.js';
import { fmtPct } from '../utils.js';

export function updateHUD(){
  const p = store.game.player;
  const lowHp = p.hp < p.maxHp*0.35, critHp = p.hp < p.maxHp*0.15;
  const appEl = document.getElementById('app');
  appEl.classList.toggle('low-hp', lowHp);
  appEl.classList.toggle('critical-hp', critHp);

  document.getElementById('hpLabel').textContent = `${Math.max(0,Math.ceil(p.hp))}/${Math.round(p.maxHp)}`;
  document.getElementById('hpBar').style.width = Math.max(0,(p.hp/p.maxHp*100))+'%';
  document.getElementById('waveLabel').textContent = store.game.wave + (isBossWaveNow()?' (BOSS)':'') + (store.game.gameWon?' \u2726':'');
  document.getElementById('scoreLabel').textContent = computeScore();
  document.getElementById('goldLabel').textContent = `\u25CF ${store.game.gold}/${GOLD_CAP}`;

  const evRow = document.getElementById('activeEventRow');
  if (store.game.activeEvent){
    evRow.classList.remove('hidden');
    const color = store.game.activeEvent.positive ? 'var(--accent)' : 'var(--danger)';
    const wl = store.game.activeEvent.wavesLeft;
    document.getElementById('activeEventText').innerHTML =
      `<span style="color:${color}; font-weight:600;">${store.game.activeEvent.positive?'\u2726':'\u26A0'} ${store.game.activeEvent.label}</span> <span style="color:var(--dim);">(${wl} wave${wl>1?'s':''} left)</span><br><span style="color:var(--dim);">${store.game.activeEvent.desc}</span>`;
  } else {
    evRow.classList.add('hidden');
  }

  const boss = store.game.enemies.find(e=>e.boss);
  const timeBar = document.getElementById('timeBar');
  const timeBarLabel = document.getElementById('timeBarLabel');
  const timeLabel = document.getElementById('timeLabel');
  if (boss){
    timeBarLabel.textContent = 'Boss health';
    timeBar.className = 'bar-inner bar-boss';
    const pct = Math.max(0, boss.hp/boss.maxHp*100);
    timeBar.style.width = pct+'%';
    timeLabel.textContent = Math.ceil(pct)+'%';
  } else {
    timeBarLabel.textContent = 'Wave timer';
    timeBar.className = 'bar-inner bar-time';
    const pct = Math.max(0, 100-(store.game.waveTime/store.game.waveDuration*100));
    timeBar.style.width = pct+'%';
    timeLabel.textContent = Math.max(0,Math.ceil(store.game.waveDuration-store.game.waveTime))+'s';
  }

  const idleTag = isIdle() ? ' \u26A1' : '';
  document.getElementById('statDamage').textContent = Math.round(p.damage*effectiveDamageMult()*10)/10 + (p.idleDamageBonus?idleTag:'');
  document.getElementById('statRange').textContent = Math.round(effectiveRange()) + (p.idleRangeBonus?idleTag:'');
  document.getElementById('statFireRate').textContent = (Math.round(p.fireRate*effectiveFireRateMult()*100)/100)+'/s' + (p.idleFireRateBonus?idleTag:'');
  document.getElementById('statSpeed').textContent = Math.round(p.moveSpeed);
  document.getElementById('statArmor').textContent = Math.round(p.armor);
  document.getElementById('statCrit').textContent = fmtPct(p.critChance)+' x'+(Math.round(p.critMult*100)/100);
  document.getElementById('statLifesteal').textContent = fmtPct(p.lifesteal);
  document.getElementById('statDodge').textContent = fmtPct(Math.min(dodgeCap(),p.dodgeChance));
  document.getElementById('statPickup').textContent = Math.round(p.pickupRadius);
}
export function showWaveBanner(text){
  const el = document.getElementById('waveBanner');
  el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(showWaveBanner._t);
  showWaveBanner._t = setTimeout(() => { el.classList.remove('show'); el.textContent = ''; }, 950);
}
export function showBossBanner(text){
  const el = document.getElementById('bossBanner');
  el.textContent = '\u26A0 ' + text + ' \u26A0'; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(showBossBanner._t);
  showBossBanner._t = setTimeout(() => { el.classList.remove('show'); el.textContent = ''; }, 950);
}
export function renderPauseStats(){
  const wrap = document.getElementById('pauseStats');
  if (!store.game){ wrap.innerHTML=''; return; }
  const mins = Math.floor(store.game.elapsed/60), secs = Math.floor(store.game.elapsed%60);
  wrap.innerHTML = `
    <div class="stat-row-sm"><span class="lbl">Wave</span><span>${store.game.wave}</span></div>
    <div class="stat-row-sm"><span class="lbl">Score</span><span>${computeScore()}</span></div>
    <div class="stat-row-sm"><span class="lbl">Kills</span><span>${store.game.kills}</span></div>
    <div class="stat-row-sm"><span class="lbl">Gold</span><span style="color:var(--gold)">\u25CF ${store.game.gold}</span></div>
    <div class="stat-row-sm"><span class="lbl">Time survived</span><span>${mins}m ${secs}s</span></div>
  `;
}
export function renderBuildGrid(){
  const wrap = document.getElementById('buildGrid');
  wrap.innerHTML = '';
  const groups = groupOwnedItems();
  document.getElementById('buildCount').textContent = store.game.ownedItems.length;
  document.getElementById('buildCap').textContent = effectiveCap();
  groups.forEach(g => {
    const d = document.createElement('div');
    d.className = 'build-icon rarity-'+g.item.rarity;
    d.textContent = g.item.icon;
    if (g.count>1){ const badge=document.createElement('span'); badge.className='stack-badge'; badge.textContent='x'+g.count; d.appendChild(badge); }
    d.addEventListener('mouseenter', (ev)=> showItemTooltip(ev, g.item, g.count));
    d.addEventListener('mousemove', moveItemTooltip);
    d.addEventListener('mouseleave', hideItemTooltip);
    wrap.appendChild(d);
  });
}
export function logEvent(msg){
  const el = document.getElementById('eventLog');
  Array.from(el.children).forEach(c=>c.className='');
  const d = document.createElement('div'); d.textContent = msg; d.className='recent';
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 40) el.removeChild(el.firstChild);
}
export function logEl_clear(){ document.getElementById('eventLog').innerHTML=''; }
export function flashGoldDisplay(){
  const el = document.getElementById('shopGoldFlash');
  el.classList.remove('gold-flash'); void el.offsetWidth; el.classList.add('gold-flash');
}
