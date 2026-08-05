// Achievement definitions shown in the Compendium. Unlocking is triggered
// from systems/enemies.js (killEnemy) via the slayId/flawlessId maps —
// every id here must have a matching entry in exactly one of those maps.

export const ACHIEVEMENTS = [
  { id:'slay_warlord', name:'Warlord Slain', icon:'\u2694', desc:'Defeat The Warlord.' },
  { id:'slay_broodmother', name:'Broodmother Slain', icon:'\u2694', desc:'Defeat The Broodmother.' },
  { id:'slay_colossus', name:'Colossus Slain', icon:'\u2694', desc:'Defeat The Colossus.' },
  { id:'slay_devourer', name:'Devourer Slain', icon:'\u2694', desc:'Defeat The Devourer, the final boss.' },
  { id:'flawless_warlord', name:'Flawless: Warlord', icon:'\u2726', desc:'Defeat The Warlord without taking any damage during that fight.' },
  { id:'flawless_broodmother', name:'Flawless: Broodmother', icon:'\u2726', desc:'Defeat The Broodmother without taking any damage during that fight.' },
  { id:'flawless_colossus', name:'Flawless: Colossus', icon:'\u2726', desc:'Defeat The Colossus without taking any damage during that fight.' },
  { id:'flawless_devourer', name:'Flawless: Devourer', icon:'\u2726', desc:'Defeat The Devourer without taking any damage during that fight.' }
];
