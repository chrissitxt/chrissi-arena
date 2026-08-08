// random wave-clear events, all temporary. apply(p) runs once on
// trigger, revert(p) has to undo it exactly. duration (1-4 waves,
// random) is tracked separately in game state, not here

export const EVENTS = [
  { id:'adrenalinerush', label:'Adrenaline Rush', positive:true, desc:'+20% damage.', apply:p=>{p.damage*=1.2;}, revert:p=>{p.damage/=1.2;} },
  { id:'fleetfoot', label:'Fleet of Foot', positive:true, desc:'+20% move speed.', apply:p=>{p.moveSpeed*=1.2;}, revert:p=>{p.moveSpeed/=1.2;} },
  { id:'sharpfocus', label:'Sharp Focus', positive:true, desc:'+15% crit chance.', apply:p=>{p.critChance+=15;}, revert:p=>{p.critChance-=15;} },
  { id:'ironskin', label:'Iron Skin', positive:true, desc:'+5 armor.', apply:p=>{p.armor+=5;}, revert:p=>{p.armor-=5;} },
  { id:'fatigue', label:'Fatigue', positive:false, desc:'-20% damage.', apply:p=>{p.damage*=0.8;}, revert:p=>{p.damage/=0.8;} },
  { id:'heavylegs', label:'Heavy Legs', positive:false, desc:'-20% move speed.', apply:p=>{p.moveSpeed*=0.8;}, revert:p=>{p.moveSpeed/=0.8;} },
  { id:'shakyhands', label:'Shaky Hands', positive:false, desc:'-15% crit chance.', apply:p=>{p.critChance-=15;}, revert:p=>{p.critChance+=15;} },
  { id:'crackedarmor', label:'Cracked Armor', positive:false, desc:'-5 armor.', apply:p=>{p.armor-=5;}, revert:p=>{p.armor+=5;} }
];
