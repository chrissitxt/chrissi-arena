// Every enemy type, regular and boss. `boss:true` marks the four Titans.
// Special-ability flags (ranged, phasing, shielding, leech, jammer,
// invisible, splitsInto/splitCount, bomber) are read by systems/enemies.js —
// see spawnRegular() there for exactly which flags get copied onto a live
// enemy instance.

export const ENEMY_TYPES = [
  { id:'shambler', name:'Shambler', hp:10, speed:56, dmg:5, radius:13, color:'#b06a4a', shape:'basic', ranged:false, gold:1, minWave:1, desc:'A slow, shuffling husk. Weak alone, dangerous in numbers.' },
  { id:'sprinter', name:'Sprinter', hp:6, speed:145, dmg:4, radius:10, color:'#e0985f', shape:'basic', ranged:false, gold:1, minWave:1, desc:'Fast and erratic. Closes distance before you notice.' },
  { id:'brute', name:'Brute', hp:38, speed:40, dmg:12, radius:19, color:'#a25fd0', shape:'armored', ranged:false, gold:2, minWave:3, desc:'A hulking wall of muscle. Slow, but hits like a truck.' },
  { id:'spitter', name:'Spitter', hp:9, speed:46, dmg:6, radius:12, color:'#5fd0d0', shape:'spiky', ranged:true, gold:2, minWave:4, desc:'Keeps its distance and spits corrosive bolts.' },
  { id:'swarmling', name:'Swarmling', hp:3, speed:100, dmg:2, radius:8, color:'#e5e55f', shape:'basic', ranged:false, gold:1, minWave:5, desc:'Nearly harmless alone. Never seen alone.' },
  { id:'wraith', name:'Wraith', hp:16, speed:78, dmg:7, radius:13, color:'#6c6cae', shape:'erratic', ranged:false, gold:2, minWave:7, desc:'A restless spirit that lurches in short, unpredictable bursts.' },
  { id:'bloater', name:'Bloater', hp:26, speed:44, dmg:7, radius:16, color:'#7fbf5f', shape:'spiky', ranged:false, gold:2, splitsInto:'swarmling', splitCount:3, minWave:8, desc:'Bursts into a handful of swarmlings when it dies. Killing it is only the start.' },
  { id:'hulk', name:'Armored Hulk', hp:44, speed:34, dmg:9, radius:18, color:'#8a8a9a', shape:'armored', ranged:false, gold:2, armor:4, minWave:9, desc:'Thick plating shrugs off ranged fire. Best avoided, not fought.' },
  { id:'leech', name:'Leech', hp:12, speed:65, dmg:3, radius:11, color:'#3ddb8f', shape:'spiky', ranged:false, gold:2, leech:true, minWave:11, desc:'Every hit it lands drains a little gold along with your health.' },
  { id:'bomber', name:'Bomber', hp:8, speed:72, dmg:0, radius:11, color:'#ff7a3d', shape:'bomb', ranged:false, gold:2, bomber:true, minWave:12, desc:'Rushes in and detonates. Do not let it get close.' },
  { id:'jammer', name:'Jammer', hp:20, speed:48, dmg:5, radius:14, color:'#e0c840', shape:'erratic', ranged:false, gold:3, jammer:true, minWave:13, desc:'A hit from this thing jams your weapon for a moment.' },
  { id:'phantom', name:'Phantom', hp:14, speed:85, dmg:8, radius:12, color:'#c8b8ff', shape:'erratic', ranged:false, gold:3, phasing:true, minWave:14, desc:'Slips out of phase on a cycle. Your shots pass through it while it fades.' },
  { id:'shade', name:'Shade', hp:14, speed:70, dmg:9, radius:12, color:'#4a3a5c', shape:'erratic', ranged:false, gold:3, invisible:true, minWave:16, desc:'Unseen until it is nearly on top of you. Stays hidden until it closes the distance.' },
  { id:'warden', name:'Warden', hp:50, speed:30, dmg:11, radius:20, color:'#5a6fae', shape:'armored', ranged:false, gold:3, shielding:true, minWave:17, desc:'Periodically raises a shield that blocks most incoming damage. Time your shots.' },
  { id:'warlord', name:'The Warlord', hp:380, speed:38, dmg:20, radius:30, color:'#e5534b', shape:'boss', boss:true, gold:15, minWave:5, desc:'A boss. Periodically unleashes a ring of projectiles.' },
  { id:'broodmother', name:'The Broodmother', hp:320, speed:42, dmg:13, radius:27, color:'#6fae4f', shape:'boss', boss:true, ranged:true, gold:15, minWave:10, desc:'A boss. Keeps its distance, spits from range, and calls swarmlings to her aid.' },
  { id:'colossus', name:'The Colossus', hp:520, speed:28, dmg:18, radius:34, color:'#8a8a9a', shape:'boss', boss:true, gold:15, minWave:15, desc:'A boss. Slow but devastating. Its slam telegraphs before it lands.' },
  { id:'finalboss', name:'The Devourer', hp:900, speed:34, dmg:24, radius:38, color:'#7d2fae', shape:'boss', boss:true, gold:35, minWave:30, desc:'The final boss. Rings, slams, and summons, all at once.' }
];

// Boss rotation for every 5th wave (excluding the final boss at WIN_WAVE).
export const BOSS_CYCLE = ['warlord','broodmother','colossus'];
