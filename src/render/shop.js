// shop screen rendering and the item tooltip that follows the cursor

import { tooltipEl } from '../dom.js';
import { effectiveCap, effectiveDamage, effectiveRange, effectiveFireRateMult, dodgeCap, lifestealCap, fmtDeltaFromBase } from '../state/derived.js';
import { previewStatDelta } from '../state/statBreakdown.js';
import { store } from '../state/store.js';
import { buyItem, groupOwnedItems, offerCost, priceFor, sellItem, sellValueFor } from '../systems/economy.js';
import { fmtStatValue, DELTA_DISPLAY_KEYS } from '../utils.js';

export function updateShopStats(){
  const p = store.game.player;
  document.getElementById('shopStatDamage').textContent = fmtStatValue('damage', effectiveDamage());
  document.getElementById('shopStatRange').textContent = fmtStatValue('range', effectiveRange());
  document.getElementById('shopStatFireRate').textContent = fmtStatValue('fireRate', p.fireRate*effectiveFireRateMult());
  document.getElementById('shopStatSpeed').textContent = fmtStatValue('moveSpeed', p.moveSpeed);
  document.getElementById('shopStatArmor').textContent = fmtStatValue('armor', p.armor);
  document.getElementById('shopStatCritChance').textContent = fmtStatValue('critChance', p.critChance);
  document.getElementById('shopStatCritMult').textContent = fmtStatValue('critMult', p.critMult);
  document.getElementById('shopStatLifesteal').textContent = fmtStatValue('lifesteal', Math.min(lifestealCap(),p.lifesteal));
  document.getElementById('shopStatDodge').textContent = fmtStatValue('dodgeChance', Math.min(dodgeCap(),p.dodgeChance));
  document.getElementById('shopStatPickup').textContent = fmtStatValue('pickupRadius', p.pickupRadius);
}

export function renderShop(){
  document.getElementById('shopGold').textContent = `\u25CF ${store.game.gold} gold`;
  document.getElementById('rerollCost').textContent = (store.game.freeRerolls>0) ? 'Free' : ('\u25CF '+store.rerollCost);
  const wrap = document.getElementById('shopCards');
  wrap.innerHTML = '';
  store.shopOffers.forEach((offer, idx) => {
    const el = document.createElement('div');
    const cost = offerCost(offer);
    const basePrice = priceFor(offer.item);
    el.className = 'shop-card rarity-'+offer.item.rarity + (offer.bought?' bought':'') + (offer.locked?' locked-offer':'');
    const costHtml = offer.discounted
      ? `<span class="strike">\u25CF ${basePrice}</span> \u25CF ${cost}<span class="sale">SALE</span>`
      : `\u25CF ${cost}`;
    const badgeHtml = offer.item.rarity==='legendary' ? '<div class="legendary-badge">\u2726</div>' : '';
    el.innerHTML = `${badgeHtml}<div class="scard-header"><span class="srarity">${offer.item.rarity.toUpperCase()}</span><button class="lock-toggle" title="${offer.locked?'Unlock — this slot will reroll again':'Lock — this item survives your next reroll'}">${offer.locked?'\u{1F512}':'\u{1F513}'}</button></div><div class="sicon">${offer.item.icon}</div><div class="sname">${offer.item.name}</div><div class="sdesc">${offer.item.desc}<br><span style="color:var(--accent)">${offer.item.stat}</span></div><div class="scost">${costHtml}</div>`;
    el.addEventListener('mouseenter',(ev)=>showItemTooltip(ev,offer.item,1,cost,false));
    el.addEventListener('mousemove',moveItemTooltip);
    el.addEventListener('mouseleave',hideItemTooltip);
    el.addEventListener('click', () => buyItem(idx));
    const lockBtn = el.querySelector('.lock-toggle');
    lockBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (offer.bought) return;
      if (!offer.locked){
        // only one offer can be locked at a time, locking a new one
        // releases whatever was locked before it
        store.shopOffers.forEach(o => { if (o!==offer) o.locked = false; });
      }
      offer.locked = !offer.locked;
      renderShop();
    });
    wrap.appendChild(el);
  });
  document.getElementById('btnReroll').disabled = (store.game.freeRerolls<=0) && (store.game.gold < store.rerollCost);
}
export function renderShopBuild(){
  hideItemTooltip();
  updateShopStats();
  const wrap = document.getElementById('shopBuildGrid');
  wrap.innerHTML = '';
  document.getElementById('shopBuildCount').textContent = store.game.ownedItems.length;
  document.getElementById('shopBuildCap').textContent = effectiveCap();
  const groups = groupOwnedItems();
  if (groups.length===0){ wrap.innerHTML = '<div style="color:var(--dim); font-size:11px;">No items yet.</div>'; return; }
  groups.forEach(g => {
    const d = document.createElement('div');
    d.className = 'build-icon rarity-'+g.item.rarity;
    d.style.cursor = 'pointer';
    d.textContent = g.item.icon;
    if (g.count>1){ const badge=document.createElement('span'); badge.className='stack-badge'; badge.textContent='x'+g.count; d.appendChild(badge); }
    // sellItem() always sells the most-recently-bought instance of this
    // id, the tooltip has to price that specific one or it'll show a
    // number with nothing to do with what selling actually pays
    const sellValue = sellValueFor(g.item.id);
    d.addEventListener('mouseenter', (ev)=> showItemTooltip(ev, g.item, g.count, sellValue, true));
    d.addEventListener('mousemove', moveItemTooltip);
    d.addEventListener('mouseleave', hideItemTooltip);
    d.addEventListener('click', () => sellItem(g.item.id));
    wrap.appendChild(d);
  });
}
export function showItemTooltip(ev, item, count, price, isSell){
  const priceLabel = isSell ? 'Sell for' : 'Price';
  let previewHtml = '';
  if (!isSell && store.game){
    const applyTimes = store.game.player.stackAmplifier>0 ? 1+store.game.player.stackAmplifier : 1;
    const changed = previewStatDelta(store.game.ownedItems, item, applyTimes);
    const rows = Object.entries(changed).map(([key, c]) =>
      DELTA_DISPLAY_KEYS.includes(key)
        ? `<div class="ttstatrow"><span>${c.label}</span><span>${fmtDeltaFromBase(key, c.from)} \u2192 ${fmtDeltaFromBase(key, c.to)}</span></div>`
        : `<div class="ttstatrow"><span>${c.label}</span><span>${fmtStatValue(key, c.from)} \u2192 ${fmtStatValue(key, c.to)}</span></div>`
    ).join('');
    if (rows) previewHtml = `<div class="ttpreview-title">If bought:</div>${rows}`;
  }
  tooltipEl.innerHTML = `<div class="ttname rarity-${item.rarity}">${item.name}${count>1?' x'+count:''}</div><div class="ttrarity">${item.rarity.toUpperCase()}</div><div class="ttprice">${priceLabel}: \u25CF ${price}</div><div class="ttstat">${item.stat}</div><div class="ttdesc">${item.desc}</div>${previewHtml}`;
  tooltipEl.classList.remove('hidden');
  moveItemTooltip(ev);
}
export function moveItemTooltip(ev){
  const s = store.uiScale || 1;
  const x = (ev.clientX+16)/s, y = (ev.clientY+16)/s;
  const maxX = (window.innerWidth-256)/s, maxY = (window.innerHeight-140)/s;
  tooltipEl.style.left = Math.min(x, maxX)+'px';
  tooltipEl.style.top = Math.min(y, maxY)+'px';
}
export function hideItemTooltip(){ tooltipEl.classList.add('hidden'); }
