import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, saveSettings } from '../src/common/storage.js';
import { logDiagnosticEvent, getDiagnosticLogs, clearDiagnosticLogs } from '../src/common/logger.js';
import { DEFAULT_SETTINGS, LIMITS } from '../src/common/constants.js';

describe('storage.js & logger.js - Storage and Bounded Diagnostics', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    // Setup mock chrome.storage.local
    globalThis.chrome = {
      storage: {
        local: {
          get: async (keys) => {
            if (typeof keys === 'string') {
              return { [keys]: mockStorage[keys] };
            }
            return { ...mockStorage };
          },
          set: async (items) => {
            Object.assign(mockStorage, items);
          },
        },
      },
    };
  });

  it('returns default settings when storage is empty', async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and updates settings partially', async () => {
    const saveResult = await saveSettings({ enabled: true, diagnosticsEnabled: true });
    expect(saveResult).toBe(true);

    const updated = await getSettings();
    expect(updated.enabled).toBe(true);
    expect(updated.diagnosticsEnabled).toBe(true);
    expect(updated.youtubeEnabled).toBe(true); // preserved default
  });

  it('falls back safely when stored settings are corrupted or malformed', async () => {
    mockStorage['yt_auto_resume_settings'] = 'invalid-json-string';
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('records diagnostic logs only when diagnosticsEnabled is true', async () => {
    // When disabled (default)
    await logDiagnosticEvent('prompt_detected', 'testing');
    let logs = await getDiagnosticLogs();
    expect(logs.length).toBe(0);

    // Enable diagnostics
    await saveSettings({ diagnosticsEnabled: true });
    await logDiagnosticEvent('prompt_detected', 'first event');
    logs = await getDiagnosticLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].event).toBe('prompt_detected');
    expect(logs[0].details).toBe('first event');
  });

  it('enforces FIFO ring buffer strictly capped at LIMITS.MAX_DIAGNOSTICS_ENTRIES (50)', async () => {
    await saveSettings({ diagnosticsEnabled: true });

    // Insert 60 events
    for (let i = 1; i <= 60; i++) {
      await logDiagnosticEvent('event_batch', `event_${i}`);
    }

    const logs = await getDiagnosticLogs();
    expect(logs.length).toBe(LIMITS.MAX_DIAGNOSTICS_ENTRIES); // exactly 50
    expect(logs[0].details).toBe('event_11'); // oldest 10 dropped
    expect(logs[logs.length - 1].details).toBe('event_60'); // newest preserved
  });

  it('clears diagnostic logs when clearDiagnosticLogs() is invoked', async () => {
    await saveSettings({ diagnosticsEnabled: true });
    await logDiagnosticEvent('test_event');

    let logs = await getDiagnosticLogs();
    expect(logs.length).toBe(1);

    await clearDiagnosticLogs();
    logs = await getDiagnosticLogs();
    expect(logs.length).toBe(0);
  });
});
