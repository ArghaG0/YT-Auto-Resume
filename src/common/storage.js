/**
 * Storage Abstraction Layer for YouTube Auto Resume
 */

import { DEFAULT_SETTINGS, STORAGE_KEYS } from './constants.js';

/**
 * Retrieves the current settings with fallback to defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function getSettings() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return { ...DEFAULT_SETTINGS };
    }

    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result?.[STORAGE_KEYS.SETTINGS];

    if (!stored || typeof stored !== 'object') {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_SETTINGS.enabled,
      youtubeEnabled: typeof stored.youtubeEnabled === 'boolean' ? stored.youtubeEnabled : DEFAULT_SETTINGS.youtubeEnabled,
      youtubeMusicEnabled: typeof stored.youtubeMusicEnabled === 'boolean' ? stored.youtubeMusicEnabled : DEFAULT_SETTINGS.youtubeMusicEnabled,
      diagnosticsEnabled: typeof stored.diagnosticsEnabled === 'boolean' ? stored.diagnosticsEnabled : DEFAULT_SETTINGS.diagnosticsEnabled,
    };
  } catch (err) {
    console.warn('[YouTube Auto Resume] Error reading settings, falling back to defaults:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Updates settings with partial values.
 * @param {Partial<typeof DEFAULT_SETTINGS>} partialSettings
 * @returns {Promise<boolean>}
 */
export async function saveSettings(partialSettings) {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return false;
    }

    const current = await getSettings();
    const updated = { ...current, ...partialSettings };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
    return true;
  } catch (err) {
    console.error('[YouTube Auto Resume] Failed to save settings:', err);
    return false;
  }
}

/**
 * Registers a listener for settings changes.
 * @param {(newSettings: typeof DEFAULT_SETTINGS) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onSettingsChanged(callback) {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return () => {};
  }

  const listener = (changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.SETTINGS]) {
      const newValue = changes[STORAGE_KEYS.SETTINGS].newValue || DEFAULT_SETTINGS;
      callback({
        enabled: typeof newValue.enabled === 'boolean' ? newValue.enabled : DEFAULT_SETTINGS.enabled,
        youtubeEnabled: typeof newValue.youtubeEnabled === 'boolean' ? newValue.youtubeEnabled : DEFAULT_SETTINGS.youtubeEnabled,
        youtubeMusicEnabled: typeof newValue.youtubeMusicEnabled === 'boolean' ? newValue.youtubeMusicEnabled : DEFAULT_SETTINGS.youtubeMusicEnabled,
        diagnosticsEnabled: typeof newValue.diagnosticsEnabled === 'boolean' ? newValue.diagnosticsEnabled : DEFAULT_SETTINGS.diagnosticsEnabled,
      });
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
