// In-game Guide tab content, shown in the Compendium. Some entries pull
// live numbers from other data modules so they can never drift out of sync
// with the actual game balance.
//
// Deliberately never names specific items, and never hints that a limit
// (legendary cap, dodge cap, build capacity) can be raised — those are
// meant to be discovered by playing, not spoiled in the guide.

import { GOLD_CAP, INV_CAP_BASE } from './constants.js';
import { RARITY_WEIGHT } from './items.js';

export const GUIDE_SECTIONS = [
  { title:'Combat Stats', text:'Your weapon only reaches a limited distance, shown as Range in your build stats — enemies outside that range are safe from you, and closing the gap puts you in reach of theirs. Damage is per hit before crits and armor. Crit is the chance to land a critical hit and the multiplier when it does. Armor flatly reduces damage you take, though cursed items can push it negative, which increases damage instead. Lifesteal returns a percent of the damage you deal as healing. Dodge is a flat chance to avoid a hit entirely, capped at 60%. Pickup range controls how far away gold starts flying toward you.' },
  { title:'Wave Scaling', text:'Regular enemies get stronger every wave. A boss appears every 5 waves; each time you face the same boss type again, it comes back noticeably stronger than last time. Defeat The Devourer at wave 30 to win, or keep going in Endless Mode, where waves and bosses keep escalating forever.' },
  { title:'Gold', text:`Gold is capped at ${GOLD_CAP} at any one time, so hoarding isn't an option. Spend it before it caps out.` },
  { title:'The Shop', text:'Every item has a fixed price, listed in the compendium. Buying more copies of the same item raises its price each time. Offers occasionally show up discounted, marked SALE. The very first reroll of each run is free; every reroll after that costs gold and gets pricier each time.' },
  { title:'Item Rarities', text:`Items come in five rarities: common, rare, epic, legendary, and cursed. Each shop offer rolls independently at ${RARITY_WEIGHT.common}% / ${RARITY_WEIGHT.rare}% / ${RARITY_WEIGHT.epic}% / ${RARITY_WEIGHT.cursed}% / ${RARITY_WEIGHT.legendary}% respectively. You can hold only 1 legendary item at a time, and never two copies of the same one. Cursed items, marked in blood red, grant huge power at a steep and permanent cost — they can make or break a run.` },
  { title:'Events', text:'Every few waves, a random event fires automatically: a straightforward stat buff or debuff, always temporary, lasting 1-4 waves (chosen randomly each time). You don\u2019t get to choose which one. The left panel shows the active effect and how many waves it has left.' },
  { title:'Orbiting Weapons', text:'Some items add a blade that orbits you and deals melee damage to anything it touches, independent of your ranged weapon and its range limit. Stack a few with a high Dodge stat for a melee-tank build.' },
  { title:'Build Limit', text:`You can hold at most ${INV_CAP_BASE} items. Once full, sell an item back in the shop (for half its price) to free a slot before buying something new.` }
];
