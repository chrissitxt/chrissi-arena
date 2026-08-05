// Shop screen rendering and the item tooltip that follows the cursor.

import { tooltipEl } from '../dom.js';
import { effectiveCap } from '../state/derived.js';
import { store } from '../state/store.js';
import { buyItem, groupOwnedItems, offerCost, priceFor, sellItem } from '../systems/economy.js';

export function renderShop(){
  document.getElementById('shopGold').textContent = `\u25CF ${store.game.gold} gold`;
  document.getElementById('rerollCost').textContent = (store.game.freeRerolls>0) ? 'Free' : ('\u25CF '+store.rerollCost);
  const wrap = document.getElementById('shopCards');
  wrap.innerHTML = '';
  store.shopOffers.forEach((offer, idx) => {
    const el = document.createElement('div');
    const cost = offerCost(offer);
    const basePrice = priceFor(offer.item);
    el.className = 'shop-card rarity-'+offer.item.rarity + (offer.bought?' bought':'');
    const costHtml = offer.discounted
      ? `<span class="strike">\u25CF ${basePrice}</span> \u25CF ${cost}<span class="sale">SALE</span>`
      : `\u25CF ${cost}`;
    const badgeHtml = offer.item.rarity==='legendary' ? '<div class="legendary-badge">\u2726</div>' : '';
    el.innerHTML = `${badgeHtml}<div class="srarity">${offer.item.rarity.toUpperCase()}</div><div class="sicon">${offer.item.icon}</div><div class="sname">${offer.item.name}</div><div class="sdesc">${offer.item.desc}<br><span style="color:var(--accent)">${offer.item.stat}</span></div><div class="scost">${costHtml}</div>`;
    el.addEventListener('mouseenter',(ev)=>showItemTooltip(ev,offer.item,1));
    el.addEventListener('mousemove',moveItemTooltip);
    el.addEventListener('mouseleave',hideItemTooltip);
    el.addEventListener('click', () => buyItem(idx));
    wrap.appendChild(el);
  });
  document.getElementById('btnReroll').disabled = (store.game.freeRerolls<=0) && (store.game.gold < store.rerollCost);
}
export function renderShopBuild(){
  hideItemTooltip();
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
    const sellTag = document.createElement('span'); sellTag.className='sell-badge'; sellTag.textContent='SELL';
    d.appendChild(sellTag);
    if (g.count>1){ const badge=document.createElement('span'); badge.className='stack-badge'; badge.textContent='x'+g.count; d.appendChild(badge); }
    d.addEventListener('mouseenter', (ev)=> showItemTooltip(ev, g.item, g.count));
    d.addEventListener('mousemove', moveItemTooltip);
    d.addEventListener('mouseleave', hideItemTooltip);
    d.addEventListener('click', () => sellItem(g.item.id));
    wrap.appendChild(d);
  });
}
export function showItemTooltip(ev, item, count){
  tooltipEl.innerHTML = `<div class="ttname rarity-${item.rarity}">${item.name}${count>1?' x'+count:''}</div><div class="ttrarity">${item.rarity.toUpperCase()}</div><div class="ttprice">\u25CF ${item.price}</div><div class="ttstat">${item.stat}</div><div class="ttdesc">${item.desc}</div>`;
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
