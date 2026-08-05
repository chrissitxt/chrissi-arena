// The shop economy: rolling offers, pricing (with the per-copy stacking
// multiplier and the rarity price floor), buying, and selling. `buyItem`
// is also where the Resonance Core stack-amplifier and the duplicate-
// legendary block live — both are shop-purchase-time rules.

import { sfxPickupItem, sfxSell } from '../audio/sfx.js';
import { GOLD_CAP, RARITY_MIN_PRICE } from '../data/constants.js';
import { ITEMS, RARITY_WEIGHT } from '../data/items.js';
import { flashGoldDisplay, logEvent, renderBuildGrid } from '../render/hud.js';
import { showScreen } from '../render/screens.js';
import { hideItemTooltip, renderShop, renderShopBuild } from '../render/shop.js';
import { effectiveCap, legendaryCap, legendaryOwnedCount } from '../state/derived.js';
import { store } from '../state/store.js';
import { STORE_COMPENDIUM, STORE_STATS, saveJSON } from '../storage.js';

export function pickRarity(excludeLegendary){
  let weight = RARITY_WEIGHT;
  let total = weight.legendary + weight.epic + weight.rare + weight.cursed + weight.common;
  if (excludeLegendary) total -= weight.legendary;
  const roll = Math.random()*total;
  let acc = 0;
  if (!excludeLegendary){ acc += weight.legendary; if (roll < acc) return 'legendary'; }
  acc += weight.epic; if (roll < acc) return 'epic';
  acc += weight.rare; if (roll < acc) return 'rare';
  acc += weight.cursed; if (roll < acc) return 'cursed';
  return 'common';
}
export function priceFor(item){
  const ownedCount = store.game.ownedItems.filter(i=>i.item.id===item.id).length;
  return Math.round(item.price * Math.pow(1.25, ownedCount));
}
export function pickItemForRarity(rarity){
  if (rarity==='legendary'){
    const pool = ITEMS.filter(i=>i.rarity==='legendary' && !store.game.ownedItems.some(o=>o.item.id===i.id));
    if (pool.length>0) return pool[Math.floor(Math.random()*pool.length)];
    return null;
  }
  const pool = ITEMS.filter(i=>i.rarity===rarity);
  return pool[Math.floor(Math.random()*pool.length)];
}
export function offerCost(offer){
  const base = priceFor(offer.item);
  const floor = RARITY_MIN_PRICE[offer.item.rarity] || 1;
  const cost = offer.discounted ? Math.round(base*(1-offer.discountPct)) : base;
  return Math.max(floor, cost);
}
export function rollItem(){
  let rarity = pickRarity(false);
  let item = (rarity==='legendary' && legendaryOwnedCount()>=legendaryCap()) ? null : pickItemForRarity(rarity);
  if (!item){
    rarity = pickRarity(true);
    item = pickItemForRarity(rarity);
  }
  let discounted = false, discountPct = 0;
  const base = priceFor(item);
  const floor = RARITY_MIN_PRICE[item.rarity] || 1;
  if (Math.random() < 0.22){
    const testPct = 0.25 + Math.random()*0.15;
    const testCost = Math.max(floor, Math.round(base*(1-testPct)));
    if (testCost < base){ discounted = true; discountPct = testPct; }
  }
  return { item, discounted, discountPct, bought:false };
}
export function openShop(){
  store.shopOffers = [rollItem(), rollItem(), rollItem()];
  const baseFree = store.game.freeRerollUsedThisRun ? 0 : 1;
  store.game.freeRerolls = baseFree + (store.game.player.freeRerollBonus||0);
  store.game.freeRerollsFromBase = baseFree;
  store.rerollCost = 5;
  renderShop();
  renderShopBuild();
  showScreen('shop');
}
export function sellItem(itemId){
  let idx=-1;
  for (let i=store.game.ownedItems.length-1;i>=0;i--){ if (store.game.ownedItems[i].item.id===itemId){ idx=i; break; } }
  if (idx===-1) return;
  const inst = store.game.ownedItems[idx];
  if (inst.item.unapply){
    const times = inst.applyCount||1;
    for (let i=0;i<times;i++) inst.item.unapply(store.game.player);
  }
  const refund = Math.floor(inst.cost/2);
  store.game.gold = Math.min(GOLD_CAP, store.game.gold + refund);
  store.game.goldCapNotified = false;
  store.game.ownedItems.splice(idx,1);
  logEvent(`Sold ${inst.item.name} for ${refund} gold.`);
  sfxSell(); flashGoldDisplay();
  renderShopBuild(); renderBuildGrid(); renderShop();
}
export function buyItem(idx){
  const offer = store.shopOffers[idx];
  const cost = offerCost(offer);
  if (offer.bought || store.game.gold < cost) return;
  if (offer.item.rarity==='legendary'){
    if (legendaryOwnedCount() >= legendaryCap()){
      logEvent(`You can't hold more than ${legendaryCap()} legendary item${legendaryCap()>1?'s':''} right now.`);
      return;
    }
    if (store.game.ownedItems.some(i=>i.item.id===offer.item.id)){
      logEvent(`You already carry a ${offer.item.name}. You can't hold two of the same legendary.`);
      return;
    }
  }
  if (store.game.ownedItems.length >= effectiveCap()){ logEvent(`Build is full (${effectiveCap()}/${effectiveCap()}). Sell an item below to make room.`); return; }
  store.game.gold -= cost;
  store.game.goldCapNotified = false;
  const alreadyOwned = store.game.ownedItems.filter(i=>i.item.id===offer.item.id).length;
  const isStacking = alreadyOwned >= 1;
  const applyTimes = (isStacking && store.game.player.stackAmplifier>0) ? 1+store.game.player.stackAmplifier : 1;
  for (let i=0;i<applyTimes;i++) offer.item.apply(store.game.player);
  offer.bought = true;
  store.game.ownedItems.push({item:offer.item, cost:cost, applyCount:applyTimes});
  if (applyTimes>1) logEvent(`Resonance Core doubles down: ${offer.item.name} applied ${applyTimes}x!`);
  store.stats.itemPurchaseCounts = store.stats.itemPurchaseCounts || {};
  store.stats.itemPurchaseCounts[offer.item.id] = (store.stats.itemPurchaseCounts[offer.item.id]||0) + 1;
  saveJSON(STORE_STATS, store.stats);
  hideItemTooltip();
  renderBuildGrid(); renderShopBuild();
  logEvent(`Bought ${offer.item.name}.`);
  sfxPickupItem(); flashGoldDisplay();
  if (!store.compendium.items.includes(offer.item.id)){ store.compendium.items.push(offer.item.id); saveJSON(STORE_COMPENDIUM, store.compendium); }
  renderShop();
}
export function groupOwnedItems(){
  const map = new Map();
  for (const inst of store.game.ownedItems){
    if (!map.has(inst.item.id)) map.set(inst.item.id, {item:inst.item, count:0});
    map.get(inst.item.id).count += 1;
  }
  return Array.from(map.values());
}
export function buildSnapshot(){ return groupOwnedItems().map(g=>({id:g.item.id, count:g.count})); }
