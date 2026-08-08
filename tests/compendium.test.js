import { describe, it, expect } from 'vitest';
import { ENEMY_TYPES } from '../src/data/enemies.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';

describe('boss compendium sort order (by first-appearance wave, then alphabetically)', () => {
  it('sorts bosses by minWave first, then by name for ties', () => {
    const bosses = ENEMY_TYPES.filter(e => e.boss)
      .sort((a,b) => (a.minWave-b.minWave) || a.name.localeCompare(b.name));

    for (let i = 1; i < bosses.length; i++) {
      const prev = bosses[i-1], cur = bosses[i];
      const inOrder = prev.minWave < cur.minWave ||
        (prev.minWave === cur.minWave && prev.name.localeCompare(cur.name) <= 0);
      expect(inOrder, `${prev.name} (wave ${prev.minWave}) should sort before ${cur.name} (wave ${cur.minWave})`).toBe(true);
    }
  });

  it('bosses sharing the same wave land in alphabetical order', () => {
    const bosses = ENEMY_TYPES.filter(e => e.boss)
      .sort((a,b) => (a.minWave-b.minWave) || a.name.localeCompare(b.name));
    const wave5 = bosses.filter(b => b.minWave === 5).map(b => b.name);
    expect(wave5).toEqual([...wave5].sort((a,b) => a.localeCompare(b)));
    expect(wave5.length).toBeGreaterThan(1); // sanity: this tie actually exists to test
  });
});

describe('boss descriptions (regression: every entry redundantly started with "A boss.")', () => {
  it('no boss description starts with the redundant "A boss." prefix', () => {
    const bosses = ENEMY_TYPES.filter(e => e.boss);
    for (const b of bosses) {
      expect(b.desc.startsWith('A boss.'), `${b.name}: "${b.desc}"`).toBe(false);
    }
  });
});

describe('compendium sort order', () => {
  it('items are sorted alphabetically within each rarity section', async () => {
    const { renderCompendium } = await import('../src/render/compendium.js');
    const { store } = await import('../src/state/store.js');
    const { ITEMS } = await import('../src/data/items.js');
    store.compendium = { items: ITEMS.map(i=>i.id), enemies: [], events: [], achievements: [] };
    renderCompendium('items');

    const sections = document.querySelectorAll('#compendiumGrid .grid-cards');
    for (const section of sections) {
      const names = Array.from(section.querySelectorAll('.cname')).map(el => el.textContent);
      const sorted = [...names].sort((a,b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    }
  });

  it('events are sorted alphabetically within buffs and debuffs', async () => {
    const { renderCompendium } = await import('../src/render/compendium.js');
    const { store } = await import('../src/state/store.js');
    const { EVENTS } = await import('../src/data/events.js');
    store.compendium = { items: [], enemies: [], events: EVENTS.map(e=>e.id), achievements: [] };
    renderCompendium('events');

    const sections = document.querySelectorAll('#compendiumGrid .grid-cards');
    for (const section of sections) {
      const names = Array.from(section.querySelectorAll('.cname')).map(el => el.textContent);
      const sorted = [...names].sort((a,b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    }
  });

  it('enemies stay sorted by first-appearance wave (not alphabetically), regular enemies and bosses each in their own section', async () => {
    const { renderCompendium } = await import('../src/render/compendium.js');
    const { store } = await import('../src/state/store.js');
    store.compendium = { items: [], enemies: ENEMY_TYPES.map(e=>e.id), events: [], achievements: [] };
    renderCompendium('enemies');

    const sections = document.querySelectorAll('#compendiumGrid .grid-cards');
    for (const section of sections) {
      const waveLines = Array.from(section.querySelectorAll('.cprice')).map(el => Number(el.textContent.match(/\d+/)[0]));
      const sorted = [...waveLines].sort((a,b) => a-b);
      expect(waveLines).toEqual(sorted);
    }
  });

  it('achievements keep their defined (logical, boss-grouped) order, not alphabetical', async () => {
    const { renderCompendium } = await import('../src/render/compendium.js');
    const { store } = await import('../src/state/store.js');
    store.compendium = { items: [], enemies: [], events: [], achievements: ACHIEVEMENTS.map(a=>a.id) };
    renderCompendium('achievements');

    const names = Array.from(document.querySelectorAll('#compendiumGrid .cname')).map(el => el.textContent);
    expect(names).toEqual(ACHIEVEMENTS.map(a=>a.name)); // exact defined order, unsorted
  });
});
