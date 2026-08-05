// Manual save export/import (a downloadable JSON snapshot of settings,
// stats, compendium unlocks, and run history) — independent of the
// automatic localStorage persistence in storage.js.

import { GAME_VERSION } from '../data/constants.js';
import { applyBrightness, applyUIScale, refreshMenu, updateSettingButtons } from '../render/screens.js';
import { store } from '../state/store.js';
import { STORE_COMPENDIUM, STORE_HISTORY, STORE_SETTINGS, STORE_STATS, saveJSON } from '../storage.js';

export function exportSave(){
  const data = { version:GAME_VERSION, settings: store.settings, stats: store.stats, compendium: store.compendium, runHistory: store.runHistory };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'chrissis-arena-save.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
export function importSaveFile(file){
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.settings){
        store.settings = Object.assign({fps:60,musicOn:true,sfxOn:true,uiSize:'medium',showFps:false,vsyncOn:true,brightness:'dark'}, data.settings);
      }
      if (data.stats) store.stats = Object.assign({runs:0,bestWave:0,bestScore:0,totalKills:0,totalGold:0,totalTime:0,victories:0,itemPurchaseCounts:{}}, data.stats);
      if (data.compendium) store.compendium = Object.assign({items:[],enemies:[],events:[],achievements:[]}, data.compendium);
      if (Array.isArray(data.runHistory)) store.runHistory = data.runHistory.slice(0,5);
      await saveJSON(STORE_SETTINGS,store.settings); await saveJSON(STORE_STATS,store.stats);
      await saveJSON(STORE_COMPENDIUM,store.compendium); await saveJSON(STORE_HISTORY,store.runHistory);
      updateSettingButtons(); applyUIScale(store.settings.uiSize); applyBrightness(store.settings.brightness);
      document.getElementById('fpsCounter').classList.toggle('hidden', !store.settings.showFps);
      refreshMenu();
      alert('Save imported successfully.');
    } catch(err){ alert('Could not import this file. It may not be a valid chrissi\'s arena save.'); }
  };
  reader.readAsText(file);
}
