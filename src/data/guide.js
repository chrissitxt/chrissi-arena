// In-game Guide tab content, shown in the Compendium. Some entries pull
// live numbers from other data modules so they can never drift out of sync
// with the actual game balance.

import { GOLD_CAP, INV_CAP_BASE } from './constants.js';
import { RARITY_WEIGHT } from './items.js';

export const GUIDE_SECTIONS = [
  { title:'Combat Range', text:'Your weapon only reaches a limited distance, shown as Range in your build stats. Enemies outside that range are safe from you. You have to close the gap, which also puts you in reach of theirs.' },
  { title:'Combat Stats Explained', text:'Damage is per hit before crits and armor. Crit is the chance to land a critical hit and the multiplier when it does. Armor flatly reduces damage you take (it can go negative from cursed items, which increases damage instead). Lifesteal returns a percent of the damage you deal as healing. Dodge is a flat chance to avoid a hit entirely, normally capped at 60% (the cursed Whirlwind Pact raises this to 90%). Pickup range controls how far away gold starts flying toward you. Hover any stat in the left panel during a run for a quick reminder.' },
  { title:'Wave Scaling', text:'Regular enemies get stronger every wave. A boss appears every 5 waves; each time you face the same boss type again, it comes back noticeably stronger than last time. Defeat The Devourer at wave 30 to win, or keep going in Endless Mode, where waves and bosses keep escalating forever.' },
  { title:'Gold', text:`Gold is capped at ${GOLD_CAP} at any one time, so hoarding isn't an option. Spend it before it caps out.` },
  { title:'The Shop', text:'Every item has a fixed price, listed in the compendium. Buying more copies of the same item raises its price each time. Offers occasionally show up discounted, marked SALE. The very first reroll of each run is free; every reroll after that costs gold and gets pricier each time.' },
  { title:'Item Odds', text:`Each shop offer rolls independently: ${RARITY_WEIGHT.common}% common, ${RARITY_WEIGHT.rare}% rare, ${RARITY_WEIGHT.epic}% epic, ${RARITY_WEIGHT.cursed}% cursed, ${RARITY_WEIGHT.legendary}% legendary. A legendary roll that would break your legendary limit rerolls into a different rarity instead. About 22% of offers also get a random 25-40% discount.` },
  { title:'Legendary Items', text:'You can normally hold only 1 legendary item at a time. The cursed item Overreach permanently raises that limit, at a cost. Either way, you can never hold two copies of the exact same legendary; Overreach only lets you carry different ones together.' },
  { title:'Cursed Items', text:'Marked in blood red, cursed items grant huge, permanent power at a steep and permanent cost. They can make or break a run. Use them deliberately.' },
  { title:'Events', text:'Every few waves, a random event fires automatically: a straightforward stat buff or debuff, always temporary, lasting 1-4 waves (chosen randomly each time). You don\u2019t get to choose which one. The left panel shows the active effect and how many waves it has left.' },
  { title:'Standing Still', text:'A few items reward holding your ground instead of moving, granting bonuses after you stand still for a moment. Great for turret-style builds, risky against fast enemies.' },
  { title:'Orbiting Weapons', text:'Some items add a blade that orbits you and deals melee damage to anything it touches, independent of your ranged weapon and its range limit. Stack a few with a high Dodge stat for a melee-tank build.' },
  { title:'Build Limit', text:`You can hold at most ${INV_CAP_BASE} items by default (some legendaries raise this). Once full, sell an item back in the shop (for half its price) to free a slot before buying something new.` }
];
