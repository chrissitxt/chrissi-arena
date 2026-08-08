import { describe, it, expect } from 'vitest';
import { computeStatBreakdown, previewStatDelta } from '../src/state/statBreakdown.js';
import { ITEMS } from '../src/data/items.js';
import { newPlayer } from '../src/state/player.js';

const dagger = ITEMS.find(i => i.id === 'dagger'); // +3 damage
const boots = ITEMS.find(i => i.id === 'boots'); // +10% move speed
const glasscannon = ITEMS.find(i => i.id === 'glasscannon'); // damage *=1.5, maxHp *=0.7
const echocore = ITEMS.find(i => i.id === 'echocore');

describe('computeStatBreakdown', () => {
  it('with no items owned, every stat shows only the base value, matching newPlayer()', () => {
    const fresh = newPlayer();
    const breakdown = computeStatBreakdown([]);
    expect(breakdown.damage.base).toBe(fresh.damage);
    expect(breakdown.damage.final).toBe(fresh.damage);
    expect(breakdown.damage.rows.length).toBe(0);
  });

  it('one item that changes a stat produces exactly one row with the correct delta', () => {
    const breakdown = computeStatBreakdown([{ item: dagger, applyCount: 1 }]);
    expect(breakdown.damage.rows.length).toBe(1);
    expect(breakdown.damage.rows[0]).toMatchObject({ name: 'Rusty Dagger', delta: 3, from: 8, to: 11 });
    expect(breakdown.damage.final).toBe(11);
  });

  it('an item does not create a row for stats it does not touch', () => {
    const breakdown = computeStatBreakdown([{ item: dagger, applyCount: 1 }]);
    expect(breakdown.moveSpeed.rows.length).toBe(0);
    expect(breakdown.moveSpeed.final).toBe(breakdown.moveSpeed.base);
  });

  it('multiple items accumulate in owned order, and the final value is exact', () => {
    const breakdown = computeStatBreakdown([
      { item: dagger, applyCount: 1 },
      { item: glasscannon, applyCount: 1 }
    ]);
    expect(breakdown.damage.rows.map(r => r.name)).toEqual(['Rusty Dagger', 'Glass Cannon']);
    expect(breakdown.damage.final).toBeCloseTo((8 + 3) * 1.5, 5);
  });

  it('the sum of base + all row deltas always exactly equals the final value, for every tracked stat', () => {
    const breakdown = computeStatBreakdown([
      { item: dagger, applyCount: 1 },
      { item: boots, applyCount: 1 },
      { item: glasscannon, applyCount: 1 }
    ]);
    for (const key of Object.keys(breakdown)) {
      const entry = breakdown[key];
      // deltas are only meaningful for additive stats directly; for
      // multiplicative ones the "delta" recorded is still the actual
      // numeric change at that step, so base + sum(deltas) must still
      // land exactly on the final value regardless of operation type.
      const sum = entry.base + entry.rows.reduce((a, r) => a + r.delta, 0);
      expect(sum, `${key}: base+deltas should equal final`).toBeCloseTo(entry.final, 5);
    }
  });

  it('a doubled purchase (Echo Core) folds into ONE row per stat, not two', () => {
    const breakdown = computeStatBreakdown([
      { item: echocore, applyCount: 1 },
      { item: dagger, applyCount: 2 } // simulates a Resonance-Core-doubled buy
    ]);
    expect(breakdown.damage.rows.length).toBe(1);
    expect(breakdown.damage.rows[0]).toMatchObject({ name: 'Rusty Dagger', delta: 6 }); // +3 applied twice
  });

  it('never mutates the ownedItems array or its item references passed in', () => {
    const owned = [{ item: dagger, applyCount: 1 }];
    const snapshotItem = owned[0].item;
    computeStatBreakdown(owned);
    expect(owned.length).toBe(1);
    expect(owned[0].item).toBe(snapshotItem);
    expect(dagger.price).toBeDefined(); // the shared ITEMS definition itself is untouched
  });
});

describe('previewStatDelta', () => {
  it('reports the correct before/after for a stat a hypothetical purchase would change', () => {
    const preview = previewStatDelta([], dagger, 1);
    expect(preview.damage).toEqual({ label: 'Damage', from: 8, to: 11 });
  });

  it('does not report stats the hypothetical item does not touch', () => {
    const preview = previewStatDelta([], dagger, 1);
    expect(preview.moveSpeed).toBeUndefined();
  });

  it('accounts for items already owned when previewing a new one', () => {
    const preview = previewStatDelta([{ item: dagger, applyCount: 1 }], glasscannon, 1);
    expect(preview.damage.from).toBeCloseTo(8 + 3, 5);
    expect(preview.damage.to).toBeCloseTo((8 + 3) * 1.5, 5);
  });

  it('never mutates real game state — pure preview only', () => {
    const owned = [{ item: dagger, applyCount: 1 }];
    previewStatDelta(owned, glasscannon, 1);
    expect(owned.length).toBe(1); // glasscannon was NOT actually added
  });
});

describe('showStatTooltip (in-game hover tooltip on each BUILD STATS row)', () => {
  it('shows the base value and one row per item affecting that stat, using live store.game.ownedItems', async () => {
    const { showStatTooltip } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');

    store.game = newGameState();
    store.game.ownedItems = [{ item: dagger, applyCount: 1 }];

    showStatTooltip({ clientX: 0, clientY: 0 }, 'damage');
    expect(tooltipEl.classList.contains('hidden')).toBe(false);
    expect(tooltipEl.innerHTML).toContain('Rusty Dagger');
    expect(tooltipEl.innerHTML).toContain('Damage');
  });

  it('shows a friendly empty state for a stat nothing currently affects', async () => {
    const { showStatTooltip } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');

    store.game = newGameState();
    store.game.ownedItems = [];
    showStatTooltip({ clientX: 0, clientY: 0 }, 'armor');
    expect(tooltipEl.innerHTML).toContain('No items affecting this yet');
  });

  it('never throws when called with no active run', async () => {
    const { showStatTooltip } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    store.game = null;
    expect(() => showStatTooltip({ clientX: 0, clientY: 0 }, 'damage')).not.toThrow();
  });
});

describe('fmtStatValue', () => {
  it('formats percentage stats with a % suffix', async () => {
    const { fmtStatValue } = await import('../src/utils.js');
    expect(fmtStatValue('critChance', 15)).toBe('15%');
    expect(fmtStatValue('lifesteal', 4)).toBe('4%');
    expect(fmtStatValue('dodgeChance', 8)).toBe('8%');
  });

  it('formats crit damage with an x prefix', async () => {
    const { fmtStatValue } = await import('../src/utils.js');
    expect(fmtStatValue('critMult', 2.5)).toBe('x2.5');
  });

  it('formats fire rate with a /s suffix', async () => {
    const { fmtStatValue } = await import('../src/utils.js');
    expect(fmtStatValue('fireRate', 1.6)).toBe('1.6/s');
  });

  it('formats damage to one decimal place', async () => {
    const { fmtStatValue } = await import('../src/utils.js');
    expect(fmtStatValue('damage', 11.27)).toBe('11.3');
  });
});

describe('updateShopStats (live "YOUR STATS" panel in the shop)', () => {
  it('fills every shop stat element with the current, correctly-computed value', async () => {
    const { updateShopStats } = await import('../src/render/shop.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');

    store.game = newGameState();
    store.game.ownedItems = [{ item: dagger, applyCount: 1 }];
    store.game.player.damage = 11; // matches base(8)+dagger(3) so effectiveDamageMult=1 keeps it simple

    updateShopStats();
    expect(document.getElementById('shopStatDamage').textContent).toBe('11');
    expect(document.getElementById('shopStatArmor').textContent).not.toBe('-'); // no longer the placeholder
  });
});

describe('showItemTooltip buy preview (shows what a purchase would change, live)', () => {
  it('shows a from -> to line for a stat the hovered item would change', async () => {
    const { showItemTooltip } = await import('../src/render/shop.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');

    store.game = newGameState();
    store.game.ownedItems = [];
    showItemTooltip({ clientX: 0, clientY: 0 }, dagger, 1, dagger.price, false);

    expect(tooltipEl.innerHTML).toContain('If bought');
    expect(tooltipEl.innerHTML).toContain('Damage');
    expect(tooltipEl.innerHTML).toContain('\u2192'); // the from -> to arrow
  });

  it('shows no preview section at all for a sell-context tooltip', async () => {
    const { showItemTooltip } = await import('../src/render/shop.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');

    store.game = newGameState();
    store.game.ownedItems = [{ item: dagger, applyCount: 1 }];
    showItemTooltip({ clientX: 0, clientY: 0 }, dagger, 1, 5, true);

    expect(tooltipEl.innerHTML).not.toContain('If bought');
  });

  it('reflects Echo Core doubling in the preview, matching what buyItem() would actually apply', async () => {
    const { showItemTooltip } = await import('../src/render/shop.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');
    const echocore = ITEMS.find(i => i.id === 'echocore');

    store.game = newGameState();
    store.game.ownedItems = [{ item: echocore, applyCount: 1 }];
    store.game.player.stackAmplifier = 1; // matches what owning Echo Core actually sets

    showItemTooltip({ clientX: 0, clientY: 0 }, dagger, 1, dagger.price, false);
    // base 8 + dagger(+3) doubled by Echo Core = 8 + 6 = 14
    expect(tooltipEl.innerHTML).toContain('14');
  });
});

describe('fmtDeltaFromBase (left-panel stats show delta-from-default, not the absolute value)', () => {
  it('shows plain "0" for a stat still at its default', async () => {
    const { fmtDeltaFromBase } = await import('../src/state/derived.js');
    expect(fmtDeltaFromBase('moveSpeed', 180)).toBe('0');
    expect(fmtDeltaFromBase('range', 160)).toBe('0');
  });

  it('shows a "+" prefixed positive delta above the default', async () => {
    const { fmtDeltaFromBase } = await import('../src/state/derived.js');
    expect(fmtDeltaFromBase('damage', 11)).toBe('+3'); // base damage is 8
  });

  it('shows a negative delta (with the native minus sign) below the default — stats can go negative on screen', async () => {
    const { fmtDeltaFromBase } = await import('../src/state/derived.js');
    expect(fmtDeltaFromBase('moveSpeed', 165)).toBe('-15'); // base move speed is 180
  });

  it('respects a decimals argument for stats like fire rate and crit damage', async () => {
    const { fmtDeltaFromBase } = await import('../src/state/derived.js');
    expect(fmtDeltaFromBase('fireRate', 1.75, 2)).toBe('+0.15'); // base fire rate is 1.6
    expect(fmtDeltaFromBase('critMult', 2.5, 2)).toBe('+0.5'); // base crit mult is 2.0
  });
});

describe('updateHUD stat display (integration: the actual left-panel numbers reflect fmtDeltaFromBase)', () => {
  it('shows 0 for every affected stat on a completely fresh run — the true defaults (160 range, 180 move speed, etc) stay real internally but never appear on screen', async () => {
    const { updateHUD } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    store.game = newGameState();
    expect(store.game.player.range).toBe(160); // the real default is untouched
    expect(store.game.player.moveSpeed).toBe(180);
    updateHUD();
    expect(document.getElementById('statDamage').textContent).toBe('8'); // damage always shows the real total, never a delta
    expect(document.getElementById('statSpeed').textContent).toBe('0');
    expect(document.getElementById('statRange').textContent).toBe('0');
    expect(document.getElementById('statCritMult').textContent).toBe('0');
    expect(document.getElementById('statPickup').textContent).toBe('0');
  });

  it('reflects a real buff and a real debuff correctly, including going negative', async () => {
    const { updateHUD } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    store.game = newGameState();
    const dagger = ITEMS.find(i => i.id === 'dagger'); // +3 damage
    const ironwill = ITEMS.find(i => i.id === 'ironwill'); // -8% move speed
    dagger.apply(store.game.player);
    ironwill.apply(store.game.player);
    updateHUD();
    expect(document.getElementById('statDamage').textContent).toBe('11'); // 8 + 3, the real total
    expect(document.getElementById('statSpeed').textContent.startsWith('-')).toBe(true);
  });
});

describe('HP breakdown tooltip (regression: the HP row had no data-statkey, so hovering it never showed a breakdown at all)', () => {
  it('the HP row in index.html carries data-statkey="maxHp"', () => {
    const row = document.querySelector('[data-statkey="maxHp"]');
    expect(row).not.toBeNull();
    expect(row.querySelector('#hpLabel')).not.toBeNull();
  });

  it('showStatTooltip("maxHp") shows the real item breakdown for max HP', async () => {
    const { showStatTooltip } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');
    store.game = newGameState();
    const vest = ITEMS.find(i => i.id === 'vest'); // +15 max HP
    vest.apply(store.game.player);
    store.game.ownedItems.push({ item: vest, cost: 9, applyCount: 1 });

    showStatTooltip({ clientX: 0, clientY: 0 }, 'maxHp');
    expect(tooltipEl.innerHTML).toContain('Max HP');
    expect(tooltipEl.innerHTML).toContain('Padded Vest');
    expect(tooltipEl.innerHTML).toContain('+15');
  });
});

describe("dynamic damage bonuses in the breakdown (regression: Minimalist's Edge and Collector's Charm never appeared, since they set a flat-bonus-per-condition field instead of touching damage directly)", () => {
  it("Minimalist's Edge shows up as a damage row, and the final value matches the live displayed damage exactly", async () => {
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { effectiveDamage } = await import('../src/state/derived.js');
    store.game = newGameState();
    const edge = ITEMS.find(i => i.id === 'minimalistedge');
    edge.apply(store.game.player);
    store.game.ownedItems = [{ item: edge, applyCount: 1 }];

    const bd = computeStatBreakdown(store.game.ownedItems);
    expect(bd.damage.rows.some(r => r.name === "Minimalist's Edge")).toBe(true);
    expect(bd.damage.final).toBeCloseTo(effectiveDamage(), 5);
  });

  it("Collector's Charm shows up as a damage row scaled to the actual number of common items owned, at exactly +1 per common", async () => {
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    store.game = newGameState();
    const charm = ITEMS.find(i => i.id === 'collectorscharm');
    const dagger = ITEMS.find(i => i.id === 'dagger'); // common
    charm.apply(store.game.player);
    store.game.ownedItems = [{ item: charm, applyCount: 1 }, { item: dagger, applyCount: 1 }];

    const bd = computeStatBreakdown(store.game.ownedItems);
    const charmRow = bd.damage.rows.find(r => r.name === "Collector's Charm");
    expect(charmRow).toBeDefined();
    expect(charmRow.delta).toBe(1); // exactly 1 common owned (the dagger) -> +1 flat
  });

  it('when both are owned together, both flat bonuses add up correctly with no compounding', async () => {
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { effectiveDamage } = await import('../src/state/derived.js');
    store.game = newGameState();
    const edge = ITEMS.find(i => i.id === 'minimalistedge');
    const charm = ITEMS.find(i => i.id === 'collectorscharm');
    const dagger = ITEMS.find(i => i.id === 'dagger');
    edge.apply(store.game.player); charm.apply(store.game.player); dagger.apply(store.game.player);
    store.game.ownedItems = [{ item: edge, applyCount: 1 }, { item: charm, applyCount: 1 }, { item: dagger, applyCount: 1 }];

    const bd = computeStatBreakdown(store.game.ownedItems);
    expect(bd.damage.final).toBeCloseTo(effectiveDamage(), 5);
    // base + every row delta must still land exactly on final
    const sum = bd.damage.base + bd.damage.rows.reduce((a,r) => a+r.delta, 0);
    expect(sum).toBeCloseTo(bd.damage.final, 5);
  });

  it('produces no dynamic rows at all when neither item is owned', async () => {
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    store.game = newGameState();
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.ownedItems = [{ item: dagger, applyCount: 1 }];
    const bd = computeStatBreakdown(store.game.ownedItems);
    expect(bd.damage.rows.some(r => r.name === "Minimalist's Edge" || r.name === "Collector's Charm")).toBe(false);
  });
});

describe('fmtStatValue always returns a real string (regression: the fallback branch returned a bare number, and happy-dom silently turns element.textContent = 0 into an empty string instead of "0" — a genuine spec deviation, but the fix of always assigning a string sidesteps it in every environment, real browsers included)', () => {
  it('the fallback branch (armor, cursedStat, move speed, etc) returns a string even for zero', async () => {
    const { fmtStatValue } = await import('../src/utils.js');
    const result = fmtStatValue('armor', 0);
    expect(typeof result).toBe('string');
    expect(result).toBe('0');
  });

  it('assigning the result to textContent actually shows "0", not an empty string', async () => {
    const { fmtStatValue } = await import('../src/utils.js');
    const div = document.createElement('div');
    div.textContent = fmtStatValue('armor', 0);
    expect(div.textContent).toBe('0');
  });
});

describe('Cursed stat is visible in the left panel (regression: tracked internally but never actually shown to the player)', () => {
  it('shows 0 on a fresh run, not an empty string', async () => {
    const { updateHUD } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    store.game = newGameState();
    updateHUD();
    expect(document.getElementById('statCursed').textContent).toBe('0');
  });

  it('reflects the real cursedStat value once a cursed item is owned', async () => {
    const { updateHUD } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    store.game = newGameState();
    const bloodpact = ITEMS.find(i => i.id === 'bloodpact');
    bloodpact.apply(store.game.player);
    updateHUD();
    expect(document.getElementById('statCursed').textContent).toBe('12');
  });

  it('has a working breakdown tooltip showing which cursed item contributed', async () => {
    const { showStatTooltip } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');
    store.game = newGameState();
    const bloodpact = ITEMS.find(i => i.id === 'bloodpact');
    bloodpact.apply(store.game.player);
    store.game.ownedItems.push({ item: bloodpact, cost: 22, applyCount: 1 });
    showStatTooltip({ clientX: 0, clientY: 0 }, 'cursedStat');
    expect(tooltipEl.innerHTML).toContain('Bloodpact Ring');
    expect(tooltipEl.innerHTML).toContain('+12');
  });
});

describe('Fire Rate always shows the absolute total, like Damage (regression: used to sit at delta-from-hidden-base, so a fresh run showed "0" instead of the real 1.6/s)', () => {
  it('shows the real base fire rate on a fresh run, not 0', async () => {
    const { updateHUD } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    store.game = newGameState();
    updateHUD();
    expect(document.getElementById('statFireRate').textContent).toBe('1.6/s');
  });
});

describe('delta-display stat tooltips never reveal the true hidden base value (regression: Base row showed the real internal default like 180 for Move Speed, undermining the whole point of showing 0 on the main panel)', () => {
  it('the left-panel breakdown tooltip shows Base: 0 and a Total matching the main panel delta, never the true internal default', async () => {
    const { showStatTooltip } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');
    store.game = newGameState();
    const ironwill = ITEMS.find(i => i.id === 'ironwill'); // -8% move speed
    ironwill.apply(store.game.player);
    store.game.ownedItems.push({ item: ironwill, cost: 14, applyCount: 1 });

    showStatTooltip({ clientX: 0, clientY: 0 }, 'moveSpeed');
    expect(tooltipEl.innerHTML).not.toContain('>180<');
    expect(tooltipEl.innerHTML).not.toContain('>165.6<');
    expect(tooltipEl.innerHTML).toContain('<span>Base</span><span>0</span>');
  });

  it('the shop buy-preview shows a delta (0 -> X) instead of absolute values (180 -> 165.6) for a delta-display stat', async () => {
    const { showItemTooltip } = await import('../src/render/shop.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');
    store.game = newGameState();
    const ironwill = ITEMS.find(i => i.id === 'ironwill');

    showItemTooltip({ clientX: 0, clientY: 0 }, ironwill, 1, 14, false);
    expect(tooltipEl.innerHTML).not.toContain('>180<');
    expect(tooltipEl.innerHTML).not.toContain('165.6');
    expect(tooltipEl.innerHTML).toContain('0 \u2192 -14');
  });

  it('Damage and Max HP (non-delta-display stats) still show real absolute values in both the tooltip and the shop preview', async () => {
    const { showStatTooltip } = await import('../src/render/hud.js');
    const { showItemTooltip } = await import('../src/render/shop.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { tooltipEl } = await import('../src/dom.js');
    store.game = newGameState();
    const dagger = ITEMS.find(i => i.id === 'dagger');

    showStatTooltip({ clientX: 0, clientY: 0 }, 'damage');
    expect(tooltipEl.innerHTML).toContain('<span>Base</span><span>8</span>');

    showItemTooltip({ clientX: 0, clientY: 0 }, dagger, 1, 9, false);
    expect(tooltipEl.innerHTML).toContain('8 \u2192 11');
  });
});

describe('active wave events show up in the stat breakdown (regression: recomputePlayerStats never reapplied the active event at all, so buying or selling ANY item while an event was active silently erased its entire effect)', () => {
  it('recomputePlayerStats keeps an active event alive across a purchase, instead of wiping it', async () => {
    const { buyItem } = await import('../src/systems/economy.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { EVENTS } = await import('../src/data/events.js');
    store.game = newGameState();
    store.game.gold = 999;

    const ev = EVENTS.find(e => e.id === 'adrenalinerush'); // +20% damage
    ev.apply(store.game.player);
    store.game.activeEvent = { id: ev.id, label: ev.label, wavesLeft: 2, apply: ev.apply, revert: ev.revert };
    expect(store.game.player.damage).toBeCloseTo(8*1.2, 5);

    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);
    // if the event survived: (8+3)*1.2 = 13.2. If it got wiped: just 11.
    expect(store.game.player.damage).toBeCloseTo(13.2, 5);
  });

  it('shows the active event as its own row in the breakdown tooltip, with the correct delta', async () => {
    const { buyItem } = await import('../src/systems/economy.js');
    const { showStatTooltip } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { EVENTS } = await import('../src/data/events.js');
    const { tooltipEl } = await import('../src/dom.js');
    store.game = newGameState();
    store.game.gold = 999;

    const ev = EVENTS.find(e => e.id === 'adrenalinerush');
    ev.apply(store.game.player);
    store.game.activeEvent = { id: ev.id, label: ev.label, wavesLeft: 2, apply: ev.apply, revert: ev.revert };
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);

    showStatTooltip({ clientX: 0, clientY: 0 }, 'damage');
    expect(tooltipEl.innerHTML).toContain('Adrenaline Rush (event)');
    expect(tooltipEl.innerHTML).toContain('+2.2'); // (8+3)*0.2 = the event's own slice
    expect(tooltipEl.innerHTML).toContain('<span>Total</span><span>13.2</span>');
  });

  it('does not add any event row when no event is active', async () => {
    const { computeStatBreakdown } = await import('../src/state/statBreakdown.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    store.game = newGameState();
    store.game.activeEvent = null;
    const bd = computeStatBreakdown(store.game.ownedItems);
    expect(bd.damage.rows.length).toBe(0);
  });

  it('a negative event (e.g. Fatigue, -20% damage) shows correctly as a negative row', async () => {
    const { computeStatBreakdown } = await import('../src/state/statBreakdown.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { EVENTS } = await import('../src/data/events.js');
    store.game = newGameState();
    const ev = EVENTS.find(e => e.id === 'fatigue');
    store.game.activeEvent = { id: ev.id, label: ev.label, wavesLeft: 2, apply: ev.apply, revert: ev.revert };
    const bd = computeStatBreakdown(store.game.ownedItems);
    const row = bd.damage.rows.find(r => r.name.includes('Fatigue'));
    expect(row).toBeDefined();
    expect(row.delta).toBeLessThan(0);
  });

  it('the displayed left-panel damage and the tooltip total agree exactly when an event and an item are both active', async () => {
    const { buyItem } = await import('../src/systems/economy.js');
    const { updateHUD, showStatTooltip } = await import('../src/render/hud.js');
    const { store } = await import('../src/state/store.js');
    const { newGameState } = await import('../src/state/gameState.js');
    const { EVENTS } = await import('../src/data/events.js');
    const { tooltipEl } = await import('../src/dom.js');
    store.game = newGameState();
    store.running = true;
    store.game.gold = 999;

    const ev = EVENTS.find(e => e.id === 'adrenalinerush');
    ev.apply(store.game.player);
    store.game.activeEvent = { id: ev.id, label: ev.label, wavesLeft: 2, apply: ev.apply, revert: ev.revert };
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.shopOffers = [{ item: dagger, discounted: false, discountPct: 0, bought: false }];
    buyItem(0);

    updateHUD();
    const displayed = document.getElementById('statDamage').textContent;
    showStatTooltip({ clientX: 0, clientY: 0 }, 'damage');
    const totalMatch = tooltipEl.innerHTML.match(/<span>Total<\/span><span>([\d.]+)<\/span>/);
    expect(totalMatch[1]).toBe(displayed);
  });
});
