// Cached references to DOM elements that many modules need. Grabbed once at
// import time (these elements exist in index.html before any script runs).

import { ARENA_W, ARENA_H } from './data/constants.js';

export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
canvas.width = ARENA_W;
canvas.height = ARENA_H;

export const gameWrap = document.getElementById('gameWrap');
export const tooltipEl = document.getElementById('itemTooltip');
export const canvasHolder = document.getElementById('canvasHolder');

export const screens = {
  menu: document.getElementById('screenMenu'),
  settings: document.getElementById('screenSettings'),
  compendium: document.getElementById('screenCompendium'),
  stats: document.getElementById('screenStats'),
  changelog: document.getElementById('screenChangelog'),
  pause: document.getElementById('screenPause'),
  event: document.getElementById('screenEvent'),
  shop: document.getElementById('screenShop'),
  victory: document.getElementById('screenVictory'),
  gameover: document.getElementById('screenGameOver')
};
