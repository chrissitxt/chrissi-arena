// Factory for a fresh game-state object at the start of every run.
// Same rule as player.js: every field the game reads must be
// initialized here.

import { newPlayer } from './player.js';
import { waveDurationFor } from '../utils.js';

export function newGameState() {
  return {
    player: newPlayer(), ownedItems: [], keys: {}, mouseX: null, mouseY: null,
    projectiles: [], enemyProjectiles: [], enemies: [], coins: [], particles: [],
    damageTexts: [], chainLines: [],
    wave: 1, waveTime: 0, waveDuration: waveDurationFor(1), waveActive: true,
    spawnTimer: 0, gold: 0, kills: 0, elapsed: 0, over: false, gameWon: false,
    bossSpawned: false, shakeTime: 0, shakeMag: 0, goldCapNotified: false,
    activeEvent: null,
    currentBossDamaged: false, idleTimer: 0, orbitAngle: 0, orbitBlades: [],
    freeRerolls: 0, freeRerollsFromBase: 0, freeRerollUsedThisRun: false,
    playerBombs: [], bombDropTimer: 3.5
  };
}
