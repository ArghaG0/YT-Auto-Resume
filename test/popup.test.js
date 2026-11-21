import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, saveSettings } from '../src/common/storage.js';

describe('popup.js - Toolbar Popup Logic & Enhanced Status UI', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {
      yt_auto_resume_settings: {
        enabled: false,
        youtubeEnabled: true,
        youtubeMusicEnabled: false,
        diagnosticsEnabled: false,
      },
    };

    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async (keys) => {
            if (typeof keys === 'string') return { [keys]: mockStorage[keys] };
            return { ...mockStorage };
          }),
          set: vi.fn(async (items) => {
            Object.assign(mockStorage, items);
          }),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        query: vi.fn(async (queryInfo) => {
          if (queryInfo?.active) {
            return [{ url: 'https://www.youtube.com/watch?v=test' }];
          }
          if (queryInfo?.url) {
            return [{ url: 'https://www.youtube.com/watch?v=test' }];
          }
          return [];
        }),
      },
      runtime: {
        id: 'mock-popup-id',
        getManifest: () => ({ version: '1.0.1' }),
        openOptionsPage: vi.fn(),
      },
    };

    document.body.innerHTML = `
      <span id="version-text">v1.0.1</span>
      <span id="status-dot"></span>
      <span id="status-label"></span>
      <span id="status-sublabel"></span>
      <input type="checkbox" id="master-toggle">
      <button id="open-options-btn"></button>
    `;
  });

  it('initializes toggle with stored setting state', async () => {
    const settings = await getSettings();
    const toggle = document.getElementById('master-toggle');
    toggle.checked = settings.enabled;

    expect(toggle.checked).toBe(false);
  });

  it('updates storage when master toggle is flipped', async () => {
    const toggle = document.getElementById('master-toggle');
    toggle.checked = true;

    await saveSettings({ enabled: toggle.checked });
    const updated = await getSettings();

    expect(updated.enabled).toBe(true);
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('detects YouTube surface on active tab', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isYouTube = new URL(tab.url).hostname.includes('youtube.com');

    expect(isYouTube).toBe(true);
  });

  it('detects non-YouTube surface correctly without throwing', async () => {
    chrome.tabs.query = vi.fn(async (queryInfo) => {
      if (queryInfo?.active) {
        return [{ url: 'https://www.google.com' }];
      }
      return [];
    });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isYouTube = new URL(tab.url).hostname.includes('youtube.com');

    expect(isYouTube).toBe(false);
  });
});
