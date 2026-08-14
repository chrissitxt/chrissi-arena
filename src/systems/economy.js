// shop economy: rolling offers, pricing (per-copy stacking + rarity
// price floor), buying, selling. buyItem is also where echo core and
// the legendary rules live, both are shop-purchase-time checks

import { sfxPickupItem, sfxSell, sfxDenied, sfxLegendaryAppears, sfxDiscovery } from '../audio/sfx.js';
import { GOLD_CAP, RARITY_MIN_PRICE, ITEM_STACK_LIMIT, REROLL_BASE_CAP } from '../data/constants.js';
import { ITEMS, RARITY_WEIGHT } from '../data/items.js';
import { flashGoldDisplay, logEvent, renderBuildGrid } from '../render/hud.js';
import { showScreen } from '../render/screens.js';
import { hideItemTooltip, renderShop, renderShopBuild } from '../render/shop.js';
import { effectiveCap, legendaryCap, legendaryOwnedCount } from '../state/derived.js';
import { newPlayer } from '../state/player.js';
import { store } from '../state/store.js';
import { STORE_COMPENDIUM, STORE_STATS, saveJSON } from '../storage.js';

// rebuilds stats from scratch every time: fresh player, every owned item
// re-applied in order. used to just apply/unapply on the live player but
// items mix += and *= effects and those don't commute, so selling out of
// order left stats permanently wrong. recomputing means there's nothing
// to unwind, only what you currently own ever gets applied
//
// runtime stuff (position, current hp, timers, phoenix used) gets carried
// over manually, everything else is just derived from the build
export function recomputePlayerStats(){
  const old = store.game.player;
  const fresh = newPlayer();
  for (const inst of store.game.ownedItems){
    const times = inst.applyCount || 1;
    for (let i=0;i<times;i++) inst.item.apply(fresh);
  }
  // an active event got applied once when it triggered, but the rebuild
  // above never touches it, so without this any shop visit while an
  // event was active would silently wipe it out. keeps it alive until
  // it actually expires (wave.js handles the revert then)
  if (store.game.activeEvent && store.game.activeEvent.apply) store.game.activeEvent.apply(fresh);
  fresh.x = old.x; fresh.y = old.y; fresh.radius = old.radius;
  fresh.phoenixUsed = old.phoenixUsed;
  fresh.invulnTime = old.invulnTime;
  fresh.fireTimer = old.fireTimer;
  fresh.jamTimer = old.jamTimer;
  fresh.hexedTimer = old.hexedTimer;
  fresh.hp = Math.min(old.hp, fresh.maxHp);
  store.game.player = fresh;
}

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
  return Math.round(item.price * Math.pow(1.3, ownedCount));
}
export function pickItemForRarity(rarity, exclude){
  exclude = exclude || [];
  if (rarity==='legendary'){
    // overreach lets you buy a second copy of one legendary, but that's
    // pointless unless the shop can actually offer it again
    const dupeBonus = store.game.player.legendaryDupeBonus || 0;
    const anyLegendaryAlreadyDoubled = ITEMS.filter(i=>i.rarity==='legendary').some(legItem =>
      store.game.ownedItems.filter(i=>i.item.id===legItem.id).length >= 2
    );
    const canOfferOwned = dupeBonus>0 && !anyLegendaryAlreadyDoubled;
    const pool = ITEMS.filter(i=>i.rarity==='legendary' && !exclude.includes(i.id) && (canOfferOwned || !store.game.ownedItems.some(o=>o.item.id===i.id)));
    if (pool.length>0) return pool[Math.floor(Math.random()*pool.length)];
    return null;
  }
  let pool = ITEMS.filter(i=>i.rarity===rarity && !exclude.includes(i.id));
  if (pool.length===0) pool = ITEMS.filter(i=>i.rarity===rarity); // exhausted every unique option at this rarity — allow a repeat rather than break
  return pool[Math.floor(Math.random()*pool.length)];
}
export function offerCost(offer){
  const base = priceFor(offer.item);
  const floor = RARITY_MIN_PRICE[offer.item.rarity] || 1;
  const cost = offer.discounted ? Math.round(base*(1-offer.discountPct)) : base;
  return Math.max(floor, cost);
}
export function rollItem(exclude){
  exclude = exclude || [];
  let rarity = pickRarity(false);
  let item = (rarity==='legendary' && legendaryOwnedCount()>=legendaryCap()) ? null : pickItemForRarity(rarity, exclude);
  if (!item){
    rarity = pickRarity(true);
    item = pickItemForRarity(rarity, exclude);
  }
  let discounted = false, discountPct = 0;
  const base = priceFor(item);
  const floor = RARITY_MIN_PRICE[item.rarity] || 1;
  // cursed items never get discounted, the price is the price. owning
  // one should be a deliberate choice, not an impulse sale buy
  if (item.rarity!=='cursed' && Math.random() < 0.22){
    const testPct = 0.25 + Math.random()*0.15;
    const testCost = Math.max(floor, Math.round(base*(1-testPct)));
    if (testCost < base){ discounted = true; discountPct = testPct; }
  }
  return { item, discounted, discountPct, bought:false };
}
// rolls `count` offers, never the same item twice in one visit. three
// independent rolls could easily collide otherwise, especially on
// commons since there aren't many relative to their weight.
// preExcluded seeds the avoid-list, e.g. items already locked elsewhere
export function rollShopOffers(count, preExcluded){
  const offers = [];
  const usedIds = (preExcluded||[]).slice();
  for (let i=0;i<count;i++){
    const offer = rollItem(usedIds);
    offers.push(offer);
    usedIds.push(offer.item.id);
  }
  if (offers.some(o=>o.item.rarity==='legendary')) sfxLegendaryAppears();
  return offers;
}
// rerolls only the unlocked slots, locked offers stay exactly as they
// are, bought/discount state included
export function rerollUnlockedOffers(){
  const lockedIds = store.shopOffers.filter(o=>o.locked).map(o=>o.item.id);
  const freshOffers = rollShopOffers(store.shopOffers.length - lockedIds.length, lockedIds);
  let freshIdx = 0;
  store.shopOffers = store.shopOffers.map(o => o.locked ? o : freshOffers[freshIdx++]);
}
export function openShop(){
  // a locked offer used to only survive a reroll within the same shop
  // visit, the next wave wiped every offer, locked or not, and rolled
  // 3 completely fresh ones. that's not what locking is for, it should
  // carry an item across visits until bought or unlocked. carry the
  // locked offer over (still locked), only roll fresh offers for the
  // rest, excluding its item so it can't show up twice in one visit
  const carried = store.shopOffers ? store.shopOffers.find(o=>o.locked && !o.bought) : null;
  const freshCount = carried ? 2 : 3;
  const preExcluded = carried ? [carried.item.id] : [];
  const freshOffers = rollShopOffers(freshCount, preExcluded);
  store.shopOffers = carried ? [carried, ...freshOffers] : freshOffers;
  // the "first reroll is free" perk is gone. fortune's charm's own free
  // reroll is unrelated and still works
  store.game.freeRerolls = store.game.player.freeRerollBonus||0;
  // base reroll price doubles every boss wave, gold income holds up
  // way better late-run now so this needs to keep pace
  // base reroll price doubles every boss wave, but caps at REROLL_BASE_CAP
  // so a late-game visit doesn't require nearly the entire gold cap just
  // to afford a single reroll (uncapped, this hit 85% of the 75g cap by
  // wave 30 for the FIRST reroll alone, before even doubling further
  // within the visit)
  store.rerollCost = Math.min(REROLL_BASE_CAP, Math.pow(2, Math.floor(store.game.wave/5)));
  renderShop();
  renderShopBuild();
  showScreen('shop');
}
// what selling this item would actually pay right now, always the most
// recent copy, matches what sellItem() itself sells. shared by every
// tooltip that shows a sell value so there's one place to get this
// right instead of two that can drift apart (which is how this broke
// the first time)
export function sellValueFor(itemId){
  for (let i=store.game.ownedItems.length-1;i>=0;i--){
    if (store.game.ownedItems[i].item.id===itemId) return Math.floor(store.game.ownedItems[i].cost/2);
  }
  return 0;
}
export function sellItem(itemId){
  let idx=-1;
  for (let i=store.game.ownedItems.length-1;i>=0;i--){ if (store.game.ownedItems[i].item.id===itemId){ idx=i; break; } }
  if (idx===-1) return;
  if (store.game.ownedItems[idx].item.rarity==='cursed'){
    logEvent(`${store.game.ownedItems[idx].item.name} is cursed — it can't be sold. You're stuck with it for the rest of the run.`);
    sfxDenied();
    return;
  }
  const inst = store.game.ownedItems[idx];
  const refund = Math.floor(inst.cost/2);
  store.game.gold = Math.min(GOLD_CAP, store.game.gold + refund);
  store.game.goldCapNotified = false;
  store.game.ownedItems.splice(idx,1);
  recomputePlayerStats();
  logEvent(`Sold ${inst.item.name} for ${refund} gold.`);
  sfxSell(); flashGoldDisplay();
  renderShopBuild(); renderBuildGrid(); renderShop();
}
export function buyItem(idx){
  const offer = store.shopOffers[idx];
  const cost = offerCost(offer);
  if (offer.bought) return;
  if (store.game.gold < cost){
    flashGoldDisplay();
    sfxDenied();
    return;
  }
  if (offer.item.rarity==='legendary'){
    const ownedCopies = store.game.ownedItems.filter(i=>i.item.id===offer.item.id).length;
    if (ownedCopies > 0){
      // overreach lets you carry a second copy of ONE legendary, not
      // every legendary and not a third of the same one either
      const dupeBonus = store.game.player.legendaryDupeBonus || 0;
      const anyLegendaryAlreadyDoubled = ITEMS.filter(i=>i.rarity==='legendary').some(legItem =>
        store.game.ownedItems.filter(i=>i.item.id===legItem.id).length >= 2
      );
      if (dupeBonus<=0 || ownedCopies>1 || anyLegendaryAlreadyDoubled){
        logEvent(`You already carry a ${offer.item.name}. You can't hold two of the same legendary.`);
        sfxDenied();
        return;
      }
    }
    if (legendaryOwnedCount() >= legendaryCap()){
      logEvent(`You can't hold more than ${legendaryCap()} legendary item${legendaryCap()>1?'s':''} right now.`);
      sfxDenied();
      return;
    }
  } else {
    // legendaries have their own stricter rules above, everything else
    // shares one flat cap so nothing gets stacked into something absurd
    const ownedCopies = store.game.ownedItems.filter(i=>i.item.id===offer.item.id).length;
    if (ownedCopies >= ITEM_STACK_LIMIT){
      logEvent(`You already carry ${ITEM_STACK_LIMIT} copies of ${offer.item.name}. That's the most you can stack.`);
      sfxDenied();
      return;
    }
  }
  if (store.game.ownedItems.length >= effectiveCap()){ logEvent(`Build is full (${effectiveCap()}/${effectiveCap()}). Sell an item below to make room.`); sfxDenied(); return; }
  store.game.gold -= cost;
  store.game.goldCapNotified = false;
  // echo core doubles exactly the next eligible purchase (never cursed,
  // legendary, or itself), then gets consumed. one-shot instead of the
  // old "doubles everything forever" version nobody could actually feel
  const echoEligible = offer.item.rarity!=='cursed' && offer.item.rarity!=='legendary' && offer.item.id!=='echocore';
  const applyTimes = (store.game.player.stackAmplifier>0 && echoEligible) ? 2 : 1;
  offer.bought = true;
  store.game.ownedItems.push({item:offer.item, cost:cost, applyCount:applyTimes});
  recomputePlayerStats();
  if (applyTimes>1){
    logEvent(`Echo Core doubles ${offer.item.name}, then fades from your build.`);
    const echoIdx = store.game.ownedItems.findIndex(i=>i.item.id==='echocore');
    if (echoIdx!==-1){ store.game.ownedItems.splice(echoIdx,1); recomputePlayerStats(); }
  }
  store.stats.itemPurchaseCounts = store.stats.itemPurchaseCounts || {};
  store.stats.itemPurchaseCounts[offer.item.id] = (store.stats.itemPurchaseCounts[offer.item.id]||0) + 1;
  saveJSON(STORE_STATS, store.stats);
  hideItemTooltip();
  renderBuildGrid(); renderShopBuild();
  logEvent(`Bought ${offer.item.name}.`);
  sfxPickupItem(); flashGoldDisplay();
  if (!store.compendium.items.includes(offer.item.id)){
    store.compendium.items.push(offer.item.id);
    saveJSON(STORE_COMPENDIUM, store.compendium);
    logEvent(`New item discovered: ${offer.item.name}`);
    sfxDiscovery();
  }
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
