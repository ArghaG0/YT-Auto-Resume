import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, saveSettings } from '../src/common/storage.js';
import { getDiagnosticLogs, clearDiagnosticLogs, logDiagnosticEvent } from '../src/common/logger.js';
import { DEFAULT_SETTINGS } from '../src/common/constants.js';

describe('options.js - Settings & Diagnostics Console', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {
      yt_auto_resume_settings: {
        enabled: true,
        youtubeEnabled: true,
        youtubeMusicEnabled: false,
        diagnosticsEnabled: true,
      },
      yt_auto_resume_diagnostics: [],
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
      runtime: {
        id: 'mock-options-id',
        getManifest: () => ({ version: '1.0.0' }),
      },
    };

    document.body.innerHTML = `
      <span id="version-text">v1.0.0</span>
      <input type="checkbox" id="youtube-toggle" checked>
      <input type="checkbox" id="diagnostics-toggle" checked>
      <div id="diagnostics-console-container" style="display: flex;"></div>
      <div id="console-box"></div>
      <span id="log-count-text"></span>
      <button id="copy-logs-btn">Copy Logs</button>
      <button id="clear-logs-btn">Clear Logs</button>
      <button id="reset-defaults-btn">Reset All</button>
    `;
  });

  it('updates surface settings independently', async () => {
    await saveSettings({ youtubeEnabled: false });
    const settings = await getSettings();

    expect(settings.youtubeEnabled).toBe(false);
    expect(settings.enabled).toBe(true); // preserved master toggle
  });

  it('stores and retrieves diagnostic logs for display', async () => {
    await logDiagnosticEvent('prompt_detected', 'Mock prompt visible');
    await logDiagnosticEvent('continue_clicked', 'Button clicked');

    const logs = await getDiagnosticLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].event).toBe('prompt_detected');
    expect(logs[1].event).toBe('continue_clicked');
  });

  it('clears all diagnostic logs on command', async () => {
    await logDiagnosticEvent('test_event');
    let logs = await getDiagnosticLogs();
    expect(logs.length).toBe(1);

    await clearDiagnosticLogs();
    logs = await getDiagnosticLogs();
    expect(logs.length).toBe(0);
  });

  it('resets settings to default values', async () => {
    await saveSettings({ enabled: true, youtubeEnabled: false, diagnosticsEnabled: true });
    await saveSettings(DEFAULT_SETTINGS);

    const reset = await getSettings();
    expect(reset).toEqual(DEFAULT_SETTINGS);
  });
});
