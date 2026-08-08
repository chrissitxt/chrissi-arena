import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '../src/state/store.js';
import { newGameState } from '../src/state/gameState.js';
import { ITEMS } from '../src/data/items.js';
import { renderPostRunSummary, randomDeathQuip, logEvent, logEl_clear } from '../src/render/hud.js';

beforeEach(() => {
  store.game = newGameState();
  logEl_clear();
});

describe('randomDeathQuip', () => {
  it('always returns a non-empty string', () => {
    for (let i = 0; i < 20; i++) {
      const quip = randomDeathQuip();
      expect(typeof quip).toBe('string');
      expect(quip.length).toBeGreaterThan(0);
    }
  });

  it('produces more than one distinct line across many calls (not hardcoded to a single string)', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) seen.add(randomDeathQuip());
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('renderPostRunSummary (FINAL BUILD / FINAL STATS / RUN LOG panels on the death and victory screens)', () => {
  it('fills the stats grid with real, current stat values for the given prefix', () => {
    store.game.player.damage = 15;
    renderPostRunSummary('go');
    const html = document.getElementById('goStatsGrid').innerHTML;
    expect(html).toContain('Damage');
    expect(html).toContain('15');
  });

  it('fills the build grid with owned items, or a friendly empty state with none', () => {
    renderPostRunSummary('go');
    expect(document.getElementById('goBuildGrid').innerHTML).toContain('No items this run');

    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.ownedItems.push({ item: dagger, cost: 9, applyCount: 1 });
    renderPostRunSummary('go');
    expect(document.getElementById('goBuildGrid').innerHTML).toContain(dagger.icon);
  });

  it('groups multiple copies of the same item into one icon with a stack badge', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.ownedItems.push({ item: dagger, cost: 9, applyCount: 1 });
    store.game.ownedItems.push({ item: dagger, cost: 12, applyCount: 1 });
    renderPostRunSummary('go');
    const html = document.getElementById('goBuildGrid').innerHTML;
    expect(html).toContain('x2');
    expect((html.match(new RegExp(dagger.icon, 'g')) || []).length).toBe(1); // one icon, not two
  });

  it('copies the exact final event log content into the panel', () => {
    logEvent('Wave 5 cleared.');
    logEvent('Bought Rusty Dagger.');
    renderPostRunSummary('go');
    const html = document.getElementById('goEventLog').innerHTML;
    expect(html).toContain('Wave 5 cleared.');
    expect(html).toContain('Bought Rusty Dagger.');
  });

  it('works identically for the victory screen prefix', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.ownedItems.push({ item: dagger, cost: 9, applyCount: 1 });
    logEvent('The Devourer falls.');
    renderPostRunSummary('victory');
    expect(document.getElementById('victoryBuildGrid').innerHTML).toContain(dagger.icon);
    expect(document.getElementById('victoryStatsGrid').innerHTML).toContain('Damage');
    expect(document.getElementById('victoryEventLog').innerHTML).toContain('The Devourer falls.');
  });

  it('does not throw if the target elements are somehow missing (defensive, since prefix is a plain string)', () => {
    expect(() => renderPostRunSummary('doesNotExist')).not.toThrow();
  });
});

describe('game-over screen title (regression: used to say "YOU FELL")', () => {
  it('the static HTML now says YOU DIED', async () => {
    const fs = await import('fs');
    const html = fs.readFileSync('./index.html', 'utf-8');
    expect(html).toContain('YOU DIED');
    expect(html).not.toContain('YOU FELL');
  });
});

describe('post-run build icons are hoverable (regression: were static, non-interactive divs with no tooltip)', async () => {
  const { tooltipEl } = await import('../src/dom.js');

  it('hovering a final-build item shows its real tooltip', () => {
    const dagger = ITEMS.find(i => i.id === 'dagger');
    store.game.ownedItems.push({ item: dagger, cost: 9, applyCount: 1 });
    renderPostRunSummary('go');

    const icon = document.querySelector('#goBuildGrid .build-icon');
    expect(icon).not.toBeNull();
    icon.dispatchEvent(new Event('mouseenter'));
    expect(tooltipEl.classList.contains('hidden')).toBe(false);
    expect(tooltipEl.innerHTML).toContain(dagger.name);
  });
});
