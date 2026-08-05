// Version history shown in the in-game changelog screen. Newest first.
//
// House rule: when an entry adds items or enemies, list their names only —
// never describe what they do. That's for the player to find out.

export const CHANGELOG = [
  { version:'0.8.0-beta', notes:[
    'Rebuilt the game from a single 2,500-line file into a properly organized, modular codebase, necessary for the game to keep growing without accumulating bugs in stranger and stranger places. The source is now open on GitHub',
    'Fixed item tooltips appearing in the wrong position',
    'Fixed the Compendium failing to open',
    'The Darker/Brighter atmosphere setting now makes an actual visible difference',
    'Removed the Small UI size option',
    'Reworked the Guide tab: merged a few overlapping sections, cut some redundant ones, and cleaned up the wording throughout',
    'New menu description, and a new favicon'
  ] },
  { version:'0.7.0-beta', notes:[
    'Your position now resets to the center of the arena at the start of each wave',
    "Added new items: Fortune's Charm, Sticky Charges, Resonance Core, and Minimalist's Edge",
    'Added 2 new enemies: Shade and Bloater',
    'Legendary items now get a much stronger visual showcase in the shop',
    'Moved the light-sweep effect to the main menu only; it was distracting during gameplay and settings'
  ] },
  { version:'0.6.0-beta', notes:[
    'Combined the VHS and Arcade looks into one fixed retro filter; removed the filter picker and the custom cursor',
    'The Compendium window no longer resizes when you switch tabs',
    'Item prices and reroll costs now round to clean numbers',
    'Added orbiting blade weapons and Whirlwind Pact'
  ] },
  { version:'0.5.1-beta', notes:[
    'Fixed a shop pricing bug where item costs could go stale mid-visit',
    'Fixed ESC not returning to the pause menu from Compendium/Settings mid-run',
    'Fixed the final boss fight being able to time out before the Victory screen',
    'Fixed a stray "leave site?" browser warning after winning and returning to the menu',
    'Added a simple achievement system, tracked in a new Compendium tab',
    'Added an Events tab to the Compendium, and "first appears" wave info on enemies',
    'VSync is now on by default; combat range reduced further for a tighter, harder game'
  ] },
  { version:'0.5.0-beta', notes:[
    'Fixed the shooting range and reworked the gold economy for a slower, harder game',
    'Added a gold cap, fixed item prices with a compendium listing, and shop discounts',
    'Legendary items are capped at 1 by default; stacking non-legendaries now costs more each copy',
    'Added Overreach and Bottomless Satchel',
    'Added periodic buff/debuff events between some waves',
    'Added 2 new enemies: Leech and Jammer',
    'Added a VHS filter, FPS counter, VSync toggle, and a UI size setting',
    'Compendium is now grouped by rarity and reachable mid-run from the pause menu',
    'Run history now records runs you quit out of, not just deaths',
    'Clearer sell feedback in the shop, plus more shop visual flair',
    'Switched the body font for readability; low HP now tints the UI chrome instead of the play area'
  ] },
  { version:'0.4.0-beta', notes:[
    'Major visual overhaul: screen shake, hit flashes, damage numbers, ambient effects',
    '32 items across 4 rarities, 8 enemies, 3 cyclic bosses, a final boss and Endless Mode',
    'Synthesized music and sound effects, smaller arena with dedicated info panels'
  ] }
];