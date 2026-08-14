import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '../src/state/store.js';
import { updateSettingButtons } from '../src/render/screens.js';

beforeEach(() => {
  store.settings = { fps:60, musicVolume:5, sfxVolume:5, uiSize:'medium', showFps:false, vsyncOn:true };
});

describe('volume sliders (regression: replaced the old musicOn/sfxOn on-off toggle buttons in v0.4.3)', () => {
  it('the settings screen has no leftover musicOn/sfxOn toggle buttons', () => {
    expect(document.querySelectorAll('[data-toggle="musicOn"]').length).toBe(0);
    expect(document.querySelectorAll('[data-toggle="sfxOn"]').length).toBe(0);
  });

  it('both sliders exist, ranging 0 to 5', () => {
    const music = document.getElementById('musicVolumeSlider');
    const sfx = document.getElementById('sfxVolumeSlider');
    expect(music.min).toBe('0'); expect(music.max).toBe('5');
    expect(sfx.min).toBe('0'); expect(sfx.max).toBe('5');
  });

  it('updateSettingButtons syncs slider position and label to the current settings, including at 0 (regression: assigning the number 0 to textContent produced an empty string in the test environment, a happy-dom quirk seen before elsewhere in this codebase — the fix is the same, always assign a real string)', () => {
    store.settings.musicVolume = 2;
    store.settings.sfxVolume = 0;
    updateSettingButtons();
    expect(document.getElementById('musicVolumeSlider').value).toBe('2');
    expect(document.getElementById('musicVolumeLabel').textContent).toBe('2');
    expect(document.getElementById('sfxVolumeSlider').value).toBe('0');
    expect(document.getElementById('sfxVolumeLabel').textContent).toBe('0');
  });

  it('the settings screen is organized into DISPLAY, AUDIO, and SAVE DATA sections', () => {
    const titles = Array.from(document.querySelectorAll('.setting-section-title')).map(el => el.textContent);
    expect(titles).toContain('DISPLAY');
    expect(titles).toContain('AUDIO');
    expect(titles).toContain('SAVE DATA');
  });
});
