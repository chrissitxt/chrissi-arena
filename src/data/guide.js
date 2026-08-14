// guide tab content in the compendium. some lines pull live numbers so
// they can't drift out of sync with actual balance.
//
// never names specific items or hints a limit (legendary cap, dodge
// cap, build capacity) can be raised, that's for players to discover

import { GOLD_CAP, INV_CAP_BASE } from './constants.js';
import { RARITY_WEIGHT } from './items.js';

export const GUIDE_SECTIONS = [
  { title:'Combat Stats', text:'Your weapon only reaches a limited distance, shown as Range in your build stats. Enemies outside that range are safe from you, and closing the gap puts you in reach of theirs. Damage is per hit before crits and armor. Crit is the chance to land a critical hit and the multiplier when it does. Armor flatly reduces damage you take, though cursed items can push it negative, which increases damage instead. You get a moment of invulnerability after taking a hit, so a crowd cannot all hit you at once. Lifesteal heals you for a percent of the actual damage dealt, crit included and enemy defenses already applied. It has nothing to do with your own armor or the targets total HP, and is capped at 75%. Dodge is a flat chance to avoid a hit entirely, capped at 60%. Pickup range controls how far away gold starts flying toward you.' },
  { title:'Wave Scaling', text:'Regular enemies scale up every wave. Bosses show up every 5 waves, randomly picked from a pool, so its rarely the same fight twice. Beat one already, and it comes back harder next time. Avoiding a boss only makes it worse the longer you stall. Wave 30 is The Devourer, beat it to win, or push into Endless Mode and keep going.' },
  { title:'Gold', text:`Gold caps at ${GOLD_CAP}, so hoarding just wastes kills, spend it as you go. Income also tapers off in later waves, and drops hard from regular enemies during an active boss fight, so stalling a boss for easy gold is not a real income strategy.` },
  { title:'The Shop', text:'Item prices are fixed, but go up with every copy you already own. Any offer has a 22% chance to come discounted, 25 to 40% off, except cursed items, those never get cheaper. You can stack up to 4 of the same item. Rerolling costs gold and doubles every time you do it in one visit, and the starting price itself doubles every boss wave, up to a cap. Lock one offer at a time to keep it through rerolls and future visits, until you buy it or unlock it yourself.' },
  { title:'Item Rarities', text:`Five rarities exist. Each shop offer rolls independently: common ${RARITY_WEIGHT.common}%, rare ${RARITY_WEIGHT.rare}%, epic ${RARITY_WEIGHT.epic}%, cursed ${RARITY_WEIGHT.cursed}%, legendary ${RARITY_WEIGHT.legendary}%. You can hold 1 legendary at a time, never two copies of the same one. Cursed items, marked in blood red, hit hard and cost just as hard, permanently. Once bought, they can't be sold, and they never show up discounted. Owning one also makes your enemies more dangerous for the rest of the run, and Cursed enemies fight dirty in ways regular ones don't.` },
  { title:'Events', text:'Random events fire every few waves, a temporary stat buff or debuff lasting 1 to 4 waves. No choice in which one you get. Check the left panel for what\'s active and how long it lasts.' },
  { title:'Build Limit', text:`${INV_CAP_BASE} items max. Once full, sell something for half its price to free up a slot before buying new.` }
];
