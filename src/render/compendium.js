// compendium (items/enemies/titans/events/achievements/guide),
// changelog, and stats screens

import { ACHIEVEMENTS } from '../data/achievements.js';
import { CHANGELOG } from '../data/changelog.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { EVENTS } from '../data/events.js';
import { GUIDE_SECTIONS } from '../data/guide.js';
import { ITEMS, RARITY_ORDER } from '../data/items.js';
import { drawEnemyShape } from './canvas.js';
import { showScreen } from './screens.js';
import { store } from '../state/store.js';

export function renderCompendium(tab){
  const grid = document.getElementById('compendiumGrid');
  grid.innerHTML = '';
  if (tab === 'items'){
    grid.style.display = 'block';
    RARITY_ORDER.forEach(rarity => {
      const header = document.createElement('div');
      header.className = 'rarity-section-header rarity-'+rarity;
      header.textContent = rarity.toUpperCase();
      grid.appendChild(header);
      const sub = document.createElement('div');
      sub.className = 'grid-cards';
      ITEMS.filter(i=>i.rarity===rarity).sort((a,b)=>a.name.localeCompare(b.name)).forEach(it => {
        const known = store.compendium.items.includes(it.id);
        const card = document.createElement('div');
        card.className = 'card ' + (known ? ('rarity-'+it.rarity) : 'locked');
        if (known){
          card.innerHTML = `<div class="card-icon">${it.icon}</div><div class="card-body"><div class="cname">${it.name}</div><div class="cprice">\u25CF ${it.price}</div><div class="cdesc">${it.desc}</div><div class="cstats">${it.stat}</div></div>`;
        } else {
          card.innerHTML = `<div class="card-icon">?</div><div class="card-body"><div class="cname">???</div><div class="cdesc">Not yet discovered. Buy this item in a run to unlock its entry.</div></div>`;
        }
        sub.appendChild(card);
      });
      grid.appendChild(sub);
    });
    return;
  } else if (tab === 'enemies'){
    grid.style.display = 'block';
    [{key:false,label:'ENEMIES',color:'var(--text)'},{key:true,label:'TITANS',color:'var(--legendary)'}].forEach(group => {
      const header = document.createElement('div');
      header.className = 'rarity-section-header';
      header.style.color = group.color; header.style.borderColor = group.color;
      header.textContent = group.label;
      grid.appendChild(header);
      const sub = document.createElement('div');
      sub.className = 'grid-cards';
      ENEMY_TYPES.filter(e => !!e.boss===group.key).sort((a,b) => (a.minWave-b.minWave) || a.name.localeCompare(b.name)).forEach(e => {
        const known = store.compendium.enemies.includes(e.id);
        const card = document.createElement('div');
        card.className = 'card ' + (known ? (e.boss ? 'rarity-legendary' : 'rarity-common') : 'locked');
        const iconWrap = document.createElement('div');
        iconWrap.className = 'card-icon';
        if (known){
          const c = document.createElement('canvas'); c.width=44; c.height=44;
          const cctx = c.getContext('2d');
          drawEnemyShape(cctx, 22, 22, e.boss?15:14, e.color, e.shape, false);
          iconWrap.appendChild(c);
        } else { iconWrap.textContent = '?'; }
        const body = document.createElement('div');
        body.className = 'card-body';
        if (known){
          body.innerHTML = `<div class="cname">${e.name}</div><div class="cdesc">${e.desc}</div><div class="cstats">HP ${e.hp} &middot; DMG ${e.dmg} &middot; SPD ${e.speed}</div><div class="cprice">First appears: Wave ${e.minWave}</div>`;
        } else {
          body.innerHTML = `<div class="cname">???</div><div class="cdesc">Not yet encountered. Meet this ${e.boss?'boss':'enemy'} in a run to unlock its entry.</div>`;
        }
        card.appendChild(iconWrap); card.appendChild(body);
        sub.appendChild(card);
      });
      grid.appendChild(sub);
    });
    return;
  } else if (tab === 'events'){
    grid.style.display = 'block';
    [{key:true,label:'BUFFS',color:'var(--accent)'},{key:false,label:'DEBUFFS',color:'var(--danger)'}].forEach(group => {
      const header = document.createElement('div');
      header.className = 'rarity-section-header';
      header.style.color = group.color; header.style.borderColor = group.color;
      header.textContent = group.label;
      grid.appendChild(header);
      const sub = document.createElement('div');
      sub.className = 'grid-cards';
      EVENTS.filter(ev=>ev.positive===group.key).sort((a,b)=>a.label.localeCompare(b.label)).forEach(ev => {
        const known = store.compendium.events.includes(ev.id);
        const card = document.createElement('div');
        card.className = 'card ' + (known ? '' : 'locked');
        if (known){
          card.innerHTML = `<div class="card-icon" style="color:${group.color}">${ev.positive?'\u2726':'\u26A0'}</div><div class="card-body"><div class="cname" style="color:${group.color}">${ev.label}</div><div class="crarity" style="color:${group.color}">${group.label.slice(0,-1)}</div><div class="cdesc">${ev.desc} Lasts 1-4 waves, chosen at random each time.</div></div>`;
        } else {
          card.innerHTML = `<div class="card-icon">?</div><div class="card-body"><div class="cname">???</div><div class="cdesc">Not yet encountered. This event will unlock its entry the first time it happens in a run.</div></div>`;
        }
        sub.appendChild(card);
      });
      grid.appendChild(sub);
    });
    return;
  } else if (tab === 'achievements'){
    grid.style.display = 'grid';
    ACHIEVEMENTS.forEach(a => {
      const known = store.compendium.achievements.includes(a.id);
      const card = document.createElement('div');
      card.className = 'card ' + (known ? 'rarity-legendary' : 'locked');
      if (known){
        card.innerHTML = `<div class="card-icon">${a.icon}</div><div class="card-body"><div class="cname">${a.name}</div><div class="cdesc">${a.desc}</div></div>`;
      } else {
        card.innerHTML = `<div class="card-icon">?</div><div class="card-body"><div class="cname">???</div><div class="cdesc">Not yet unlocked.</div></div>`;
      }
      grid.appendChild(card);
    });
  } else if (tab === 'guide'){
    grid.style.display = 'block';
    GUIDE_SECTIONS.forEach(s => {
      const d = document.createElement('div');
      d.className = 'guide-block';
      d.innerHTML = `<h3>${s.title}</h3><p>${s.text}</p>`;
      grid.appendChild(d);
    });
    return;
  }
}
export function renderChangelog(){
  const wrap = document.getElementById('changelogList');
  wrap.innerHTML = '';
  CHANGELOG.forEach(entry => {
    const d = document.createElement('div'); d.className = 'guide-block';
    const dateHtml = entry.date ? `<span class="changelog-date">${entry.date}</span>` : '';
    d.innerHTML = `<h3>v${entry.version} ${dateHtml}</h3><ul style="margin:0; padding-left:18px;">${entry.notes.map(n=>'<li>'+n+'</li>').join('')}</ul>`;
    wrap.appendChild(d);
  });
}
export function renderStats(){
  document.getElementById('statRuns').textContent = store.stats.runs;
  document.getElementById('statBestWave').textContent = store.stats.bestWave;
  document.getElementById('statBestScore').textContent = store.stats.bestScore;
  document.getElementById('statVictories').textContent = store.stats.victories;
  document.getElementById('statKills').textContent = store.stats.totalKills;
  document.getElementById('statGold').textContent = store.stats.totalGold;
  const mins = Math.floor(store.stats.totalTime/60), secs = Math.floor(store.stats.totalTime%60);
  document.getElementById('statTime').textContent = `${mins}m ${secs}s`;
  const counts = store.stats.itemPurchaseCounts || {};
  let bestId = null, bestCount = 0;
  Object.keys(counts).forEach(id => { if (counts[id] > bestCount){ bestCount = counts[id]; bestId = id; } });
  const favEl = document.getElementById('statFavItem');
  if (bestId){
    const it = ITEMS.find(i=>i.id===bestId);
    favEl.textContent = it ? `${it.icon} ${it.name} (${bestCount}x)` : 'None yet';
  } else { favEl.textContent = 'None yet'; }
  const wrap = document.getElementById('runHistoryList');
  wrap.innerHTML = '';
  if (!store.runHistory.length){ wrap.innerHTML = '<div style="color:var(--dim); font-size:11px;">No runs recorded yet.</div>'; return; }
  store.runHistory.forEach(r => {
    const d = document.createElement('div');
    d.className = 'history-row';
    const date = new Date(r.date);
    const tag = r.victory ? '\u2605 ' : '';
    const statLine = document.createElement('div');
    statLine.className = 'history-stat-line';
    statLine.innerHTML = `<span class="hwave">${tag}Wave ${r.wave}</span><span>Score ${r.score}</span><span>${r.kills} kills</span><span class="hquit">${r.quit?'quit &middot; ':''}${date.toLocaleDateString()}</span>`;
    d.appendChild(statLine);
    const iconLine = document.createElement('div');
    iconLine.className = 'history-icon-line';
    if (r.items && r.items.length){
      r.items.forEach(entry => {
        const it = ITEMS.find(i=>i.id===entry.id);
        if (!it) return;
        const span = document.createElement('span');
        span.className = 'history-icon rarity-'+it.rarity;
        span.textContent = it.icon + (entry.count>1?('\u00d7'+entry.count):'');
        span.title = it.name;
        iconLine.appendChild(span);
      });
    } else {
      iconLine.innerHTML = '<span style="color:var(--dim); font-size:9.5px;">No items this run.</span>';
    }
    d.appendChild(iconLine);
    wrap.appendChild(d);
  });
}
export function openCompendium(returnTo){
  store.settingsReturnTo = returnTo;
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  const itemsTab = document.querySelector('.tab[data-tab="items"]');
  if (itemsTab) itemsTab.classList.add('active');
  renderCompendium('items');
  showScreen('compendium');
}
