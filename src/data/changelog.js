// Version history shown in the in-game changelog screen. Newest first.
//
// House rule: when an entry adds items or enemies, list their names only —
// never describe what they do. That's for the player to find out.

export const CHANGELOG = [
  { version:'0.8.0-beta', notes:[
    'Rebuilt the game from a single 2,500-line file into a properly organized, modular codebase, necessary for the game to keep growing without accumulating bugs in stranger and stranger places',
    'Fixed item tooltips appearing in the wrong position',
    'Fixed the Compendium failing to open',
    'Removed the Small UI size option',
    'Reworked the Guide tab: merged a few overlapping sections, cut some redundant ones, and cleaned up the wording throughout',
    'Rebalanced difficulty across the board: enemies and repeat bosses scale up faster, waves run longer, and item prices climb faster the more copies you stack',
    'New menu description, and a new favicon'
  ] }
];
