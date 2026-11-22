import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, saveSettings, isExtensionContextValid, isFeatureEffective } from '../src/common/storage.js';
import { logDiagnosticEvent, getDiagnosticLogs, clearDiagnosticLogs, updateCachedSettings } from '../src/common/logger.js';
import { DEFAULT_SETTINGS, LIMITS } from '../src/common/constants.js';

describe('storage.js & logger.js - Storage and Bounded Diagnostics', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    updateCachedSettings(null);
    // Setup mock chrome.runtime and chrome.storage.local
    globalThis.chrome = {
      runtime: {
        id: 'mock-extension-id',
      },
      storage: {
        local: {
          get: vi.fn(async (keys) => {
            if (typeof keys === 'string') {
              return { [keys]: mockStorage[keys] };
            }
            return { ...mockStorage };
          }),
          set: vi.fn(async (items) => {
            Object.assign(mockStorage, items);
          }),
        },
      },
    };
  });

  it('correctly verifies extension context validity', () => {
    expect(isExtensionContextValid()).toBe(true);

    // When runtime ID is missing
    delete globalThis.chrome.runtime.id;
    expect(isExtensionContextValid()).toBe(false);

    // When runtime is undefined
    delete globalThis.chrome.runtime;
    delete globalThis.chrome.storage;
    expect(isExtensionContextValid()).toBe(false);

    // When chrome global is undefined
    const originalChrome = globalThis.chrome;
    delete globalThis.chrome;
    expect(isExtensionContextValid()).toBe(false);
    globalThis.chrome = originalChrome;
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

  it('gracefully suppresses warnings and returns default settings on Extension context invalidated', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    globalThis.chrome.storage.local.get = vi.fn().mockRejectedValue(new Error('Extension context invalidated.'));

    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('bails out safely without calling storage when context is invalid', async () => {
    delete globalThis.chrome.runtime.id;

    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(globalThis.chrome.storage.local.get).not.toHaveBeenCalled();

    const saveResult = await saveSettings({ enabled: true });
    expect(saveResult).toBe(false);
    expect(globalThis.chrome.storage.local.set).not.toHaveBeenCalled();
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

  it('uses in-memory cached settings to eliminate redundant storage reads in logger', async () => {
    updateCachedSettings({ diagnosticsEnabled: true });

    await logDiagnosticEvent('cached_event', 'cached_details');

    const logs = await getDiagnosticLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].event).toBe('cached_event');
  });

  it('silently ignores diagnostic logging when context is invalidated', async () => {
    updateCachedSettings({ diagnosticsEnabled: true });
    delete globalThis.chrome.runtime.id;

    await logDiagnosticEvent('ignored_event', 'should not throw');

    expect(globalThis.chrome.storage.local.get).not.toHaveBeenCalled();
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

  it('correctly evaluates effective feature states via isFeatureEffective', () => {
    const baseSettings = {
      enabled: true,
      autoResumeEnabled: true,
      adControlEnabled: true,
      autoClickSkip: true,
      youtubeEnabled: true,
      youtubeMusicEnabled: false,
      diagnosticsEnabled: false,
    };

    // Both features active on youtube.com
    expect(isFeatureEffective(baseSettings, 'autoResume', 'www.youtube.com')).toBe(true);
    expect(isFeatureEffective(baseSettings, 'adControl', 'www.youtube.com')).toBe(true);

    // Disabled when master toggle is off
    expect(isFeatureEffective({ ...baseSettings, enabled: false }, 'autoResume', 'www.youtube.com')).toBe(false);
    expect(isFeatureEffective({ ...baseSettings, enabled: false }, 'adControl', 'www.youtube.com')).toBe(false);

    // Sub-feature toggle off
    expect(isFeatureEffective({ ...baseSettings, autoResumeEnabled: false }, 'autoResume', 'www.youtube.com')).toBe(false);
    expect(isFeatureEffective({ ...baseSettings, adControlEnabled: false }, 'adControl', 'www.youtube.com')).toBe(false);
    expect(isFeatureEffective({ ...baseSettings, autoClickSkip: false }, 'adControl', 'www.youtube.com')).toBe(false);

    // Domain restrictions
    expect(isFeatureEffective(baseSettings, 'autoResume', 'music.youtube.com')).toBe(false);
    expect(isFeatureEffective({ ...baseSettings, youtubeMusicEnabled: true }, 'autoResume', 'music.youtube.com')).toBe(true);
    expect(isFeatureEffective(baseSettings, 'autoResume', 'example.com')).toBe(false);
  });

  it('provides backward-compatible defaults when stored settings lack new ad control flags', async () => {
    // Simulate legacy v1.0.1 settings object without ad control keys
    mockStorage['yt_auto_resume_settings'] = {
      enabled: true,
      youtubeEnabled: true,
      youtubeMusicEnabled: false,
      diagnosticsEnabled: false,
    };

    const settings = await getSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.autoResumeEnabled).toBe(true);
    expect(settings.adControlEnabled).toBe(true);
    expect(settings.autoClickSkip).toBe(true);
  });
});
