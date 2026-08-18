// left/right hud panels, wave/boss banners, event log. showWaveBanner
// and showBossBanner clear their own animation class + text via
// setTimeout instead of relying on fill-mode alone, fill-mode replayed
// stale text after a pause/resume toggle. real bug, don't revert this

import { GOLD_CAP } from '../data/constants.js';
import { tooltipEl } from '../dom.js';
import { sfxWaveUrgent } from '../audio/sfx.js';
import { hideItemTooltip, moveItemTooltip, showItemTooltip } from './shop.js';
import { computeScore, dodgeCap, effectiveCap, effectiveDamage, effectiveFireRateMult, effectiveRange, isIdle, lifestealCap, fmtDeltaFromBase } from '../state/derived.js';
import { computeStatBreakdown } from '../state/statBreakdown.js';
import { store } from '../state/store.js';
import { groupOwnedItems, sellValueFor } from '../systems/economy.js';
import { isBossWaveNow } from '../systems/enemies.js';
import { fmtPct, fmtStatValue, DELTA_DISPLAY_KEYS } from '../utils.js';

let displayedScore = 0;
let lastScoreTickTs = 0;

// ticks the on-screen score toward the real score instead of snapping,
// frame-rate independent (wall-clock time between calls, not a fixed
// per-call step). self-corrects to 0 the moment a new run's score is
// lower than what's shown, so a fresh run never needs an explicit reset
function tickDisplayedScore(target){
  const now = performance.now();
  const dt = lastScoreTickTs ? Math.min(0.05, (now - lastScoreTickTs) / 1000) : 0;
  lastScoreTickTs = now;
  if (target <= displayedScore){ displayedScore = target; return displayedScore; }
  const step = Math.max(1, Math.ceil((target - displayedScore) * dt * 6));
  displayedScore = Math.min(target, displayedScore + step);
  return displayedScore;
}

export function updateHUD(){
  const p = store.game.player;
  const lowHp = p.hp < p.maxHp*0.35, critHp = p.hp < p.maxHp*0.15;
  const appEl = document.getElementById('app');
  appEl.classList.toggle('low-hp', lowHp);
  appEl.classList.toggle('critical-hp', critHp);

  document.getElementById('hpLabel').textContent = `${Math.max(0,Math.ceil(p.hp))}/${Math.round(p.maxHp)}`;
  const hpBar = document.getElementById('hpBar');
  hpBar.style.width = Math.max(0,(p.hp/p.maxHp*100))+'%';
  hpBar.classList.toggle('bar-hp-critical', p.hp>0 && p.hp/p.maxHp < 0.25);
  document.getElementById('lowHpVignette').classList.toggle('visible', p.hp>0 && p.hp/p.maxHp < 0.25);
  document.getElementById('waveLabel').textContent = store.game.wave + (isBossWaveNow()?' (BOSS)':'') + (store.game.gameWon?' \u2726':'');
  document.getElementById('scoreLabel').textContent = tickDisplayedScore(computeScore());
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
    const secondsLeft = Math.max(0,Math.ceil(store.game.waveDuration-store.game.waveTime));
    const urgent = secondsLeft<=5 && secondsLeft>0;
    timeBar.className = 'bar-inner bar-time' + (urgent?' bar-time-urgent':'');
    const pct = Math.max(0, 100-(store.game.waveTime/store.game.waveDuration*100));
    timeBar.style.width = pct+'%';
    timeLabel.textContent = secondsLeft+'s';
    if (urgent && !store.game.waveUrgentNotified){
      store.game.waveUrgentNotified = true;
      sfxWaveUrgent();
    }
    if (!urgent) store.game.waveUrgentNotified = false;
  }

  const idleTag = isIdle() ? ' \u26A1' : '';
  document.getElementById('statDamage').textContent = (Math.round(effectiveDamage()*10)/10) + (p.idleDamageBonus?idleTag:'');
  document.getElementById('statRange').textContent = fmtDeltaFromBase('range', effectiveRange()) + (p.idleRangeBonus?idleTag:'');
  document.getElementById('statFireRate').textContent = (Math.round(p.fireRate*effectiveFireRateMult()*100)/100) + '/s' + (p.idleFireRateBonus?idleTag:'');
  document.getElementById('statSpeed').textContent = fmtDeltaFromBase('moveSpeed', p.moveSpeed);
  document.getElementById('statArmor').textContent = String(Math.round(p.armor));
  document.getElementById('statCritChance').textContent = fmtPct(p.critChance);
  document.getElementById('statCritMult').textContent = fmtDeltaFromBase('critMult', p.critMult, 2);
  document.getElementById('statLifesteal').textContent = fmtPct(Math.min(lifestealCap(),p.lifesteal));
  document.getElementById('statDodge').textContent = fmtPct(Math.min(dodgeCap(),p.dodgeChance));
  document.getElementById('statPickup').textContent = fmtDeltaFromBase('pickupRadius', p.pickupRadius);
  document.getElementById('statCursed').textContent = String(Math.round(p.cursedStat||0));
  // these nine only show up on the panel at all once they're actually
  // relevant — a build that never touches pierce/chain/orbit/etc would
  // otherwise carry nine permanently-zero rows for no reason. each one
  // still gets its usual hover breakdown once visible, same as every
  // other stat here.
  showExtraStat('pierce', 'statPierce', p.pierce, p.pierce>0, v=>String(v));
  showExtraStat('projectileCount', 'statProjectiles', p.projectileCount, p.projectileCount!==1, v=>String(v));
  showExtraStat('regen', 'statRegen', p.regen, p.regen>0, v=>v.toFixed(1)+'/s');
  showExtraStat('orbitCount', 'statOrbit', p.orbitCount||0, (p.orbitCount||0)>0, v=>String(v));
  showExtraStat('frostChance', 'statFrost', p.frostChance, p.frostChance>0, v=>fmtPct(v));
  showExtraStat('chainCount', 'statChain', p.chainCount, p.chainCount>0, v=>String(v));
  showExtraStat('explosiveLevel', 'statExplosive', p.explosiveLevel, p.explosiveLevel>0, v=>String(v));
  showExtraStat('bombDropLevel', 'statBombs', p.bombDropLevel||0, (p.bombDropLevel||0)>0, v=>String(v));
  showExtraStat('berserkerBonus', 'statBerserker', p.berserkerBonus, p.berserkerBonus>0, v=>'+'+fmtPct(v)+' <50% hp');
}
function showExtraStat(key, elId, value, visible, formatter){
  const row = document.querySelector(`.stat-row-extra[data-statkey="${key}"]`);
  row.classList.toggle('hidden', !visible);
  if (visible) document.getElementById(elId).textContent = formatter(value);
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
    const sellValue = sellValueFor(g.item.id);
    d.addEventListener('mouseenter', (ev)=> showItemTooltip(ev, g.item, g.count, sellValue, true));
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

function fmtStatDelta(key, value){
  const sign = value >= 0 ? '+' : '';
  return sign + fmtStatValue(key, value);
}

// shows exactly how the hovered stat arrived at its current value: a
// base line, then one line per item that changed it, in the order it
// was bought. built from the same computeStatBreakdown() the shop
// preview uses, so it can never tell a different story than the
// number actually shown above it

export function showStatTooltip(ev, key){
  if (!store.game) return;
  const breakdown = computeStatBreakdown(store.game.ownedItems);
  const entry = breakdown[key];
  if (!entry) return;
  const isDelta = DELTA_DISPLAY_KEYS.includes(key);
  const rows = entry.rows.map(r =>
    `<div class="ttstatrow"><span>${r.name}</span><span>${fmtStatDelta(key, r.delta)}</span></div>`
  ).join('');
  const empty = entry.rows.length === 0 ? '<div class="ttstatrow dim">No items affecting this yet.</div>' : '';
  const baseDisplay = isDelta ? fmtStatValue(key, 0) : fmtStatValue(key, entry.base);
  const totalDisplay = isDelta ? fmtDeltaFromBase(key, entry.final) : fmtStatValue(key, entry.final);
  tooltipEl.innerHTML = `<div class="ttname">${entry.label}</div>` +
    `<div class="ttstatrow"><span>Base</span><span>${baseDisplay}</span></div>` +
    rows + empty +
    `<div class="ttstatrow total"><span>Total</span><span>${totalDisplay}</span></div>`;
  tooltipEl.classList.remove('hidden');
  moveItemTooltip(ev);
}

const DEATH_QUIPS = [
  "Better luck next time.",
  "Do you even try?",
  "The arena remembers.",
  "Skill issue.",
  "That's rough, buddy.",
  "Not your day.",
  "Dodging is optional, apparently.",
  "The floor was not lava. You still touched it.",
  "A valiant effort. Mostly effort.",
  "Somewhere, a boss is laughing."
];
export function randomDeathQuip(){
  return DEATH_QUIPS[Math.floor(Math.random()*DEATH_QUIPS.length)];
}

// fills in the final build / final stats / run log panels on the
// game-over and victory screens. called once right when a run ends,
// store.game and #eventLog still hold that run's final state at that
// point since a new run hasn't started (and cleared them) yet. prefix
// is 'go' for game-over or 'victory' for the victory screen, matching
// the id pattern the rest of each screen already uses
// (goWave/victoryWave, etc)
export function renderPostRunSummary(prefix){
  const p = store.game.player;
  const statsHtml = [
    ['Damage', Math.round(effectiveDamage()*10)/10],
    ['Range', Math.round(effectiveRange())],
    ['Fire rate', (Math.round(p.fireRate*effectiveFireRateMult()*100)/100)+'/s'],
    ['Move speed', Math.round(p.moveSpeed)],
    ['Armor', Math.round(p.armor)],
    ['Crit chance', fmtPct(p.critChance)],
    ['Crit damage', 'x'+(Math.round(p.critMult*100)/100)],
    ['Lifesteal', fmtPct(Math.min(lifestealCap(),p.lifesteal))],
    ['Dodge', fmtPct(Math.min(dodgeCap(),p.dodgeChance))],
    ['Pickup range', Math.round(p.pickupRadius)]
  ].map(([label,val]) => `<div class="stat-row-sm"><span class="lbl">${label}</span><span>${val}</span></div>`).join('');
  const statsEl = document.getElementById(prefix+'StatsGrid');
  if (statsEl) statsEl.innerHTML = statsHtml;

  const groups = groupOwnedItems();
  const buildEl = document.getElementById(prefix+'BuildGrid');
  if (buildEl){
    buildEl.innerHTML = groups.length ? groups.map((g,idx) =>
      `<div class="build-icon rarity-${g.item.rarity}" data-postrun-idx="${idx}">${g.item.icon}${g.count>1?`<span class="stack-badge">x${g.count}</span>`:''}</div>`
    ).join('') : '<div style="color:var(--dim); font-size:11px;">No items this run.</div>';
    buildEl.querySelectorAll('[data-postrun-idx]').forEach(el => {
      const g = groups[Number(el.dataset.postrunIdx)];
      el.addEventListener('mouseenter', (ev) => showItemTooltip(ev, g.item, g.count, sellValueFor(g.item.id), true));
      el.addEventListener('mousemove', moveItemTooltip);
      el.addEventListener('mouseleave', hideItemTooltip);
    });
  }

  const logEl = document.getElementById(prefix+'EventLog');
  const sourceLog = document.getElementById('eventLog');
  if (logEl && sourceLog) logEl.innerHTML = sourceLog.innerHTML;
}
