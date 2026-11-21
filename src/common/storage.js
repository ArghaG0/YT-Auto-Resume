/**
 * Storage Abstraction Layer for YouTube Auto Resume
 */

import { DEFAULT_SETTINGS, STORAGE_KEYS } from './constants.js';

// In-memory cache of settings to eliminate redundant storage IPC reads
let settingsCache = null;

/**
 * Returns the currently cached settings if available.
 * @returns {typeof DEFAULT_SETTINGS | null}
 */
export function getCachedSettings() {
  return settingsCache ? { ...settingsCache } : null;
}

/**
 * Manually updates the in-memory settings cache.
 * @param {Record<string, any>|null} settings
 */
export function updateCachedSettings(settings) {
  settingsCache = settings ? { ...settings } : null;
}

/**
 * Synchronously checks if the extension context is still active and valid.
 * In Chromium, chrome.runtime.id becomes undefined the instant the extension is reloaded or unloaded.
 * @returns {boolean}
 */
export function isExtensionContextValid() {
  if (typeof chrome === 'undefined' || !chrome) {
    return false;
  }
  if ('runtime' in chrome && chrome.runtime) {
    return Boolean(chrome.runtime.id);
  }
  return Boolean(chrome.storage);
}

/**
 * Retrieves the current settings with fallback to cached settings or defaults.
 * Does not invoke storage or throw when extension context is invalidated.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function getSettings() {
  try {
    if (!isExtensionContextValid() || !chrome.storage?.local) {
      return settingsCache ? { ...settingsCache } : { ...DEFAULT_SETTINGS };
    }

    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result?.[STORAGE_KEYS.SETTINGS];

    if (!stored || typeof stored !== 'object') {
      settingsCache = { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS };
    }

    const resolved = {
      enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_SETTINGS.enabled,
      youtubeEnabled: typeof stored.youtubeEnabled === 'boolean' ? stored.youtubeEnabled : DEFAULT_SETTINGS.youtubeEnabled,
      youtubeMusicEnabled: typeof stored.youtubeMusicEnabled === 'boolean' ? stored.youtubeMusicEnabled : DEFAULT_SETTINGS.youtubeMusicEnabled,
      diagnosticsEnabled: typeof stored.diagnosticsEnabled === 'boolean' ? stored.diagnosticsEnabled : DEFAULT_SETTINGS.diagnosticsEnabled,
    };
    settingsCache = { ...resolved };
    return resolved;
  } catch (err) {
    const isInvalidated = err instanceof Error && err.message?.includes('Extension context invalidated');
    if (!isInvalidated) {
      console.warn('[YouTube Auto Resume] Error reading settings, falling back to defaults:', err);
    }
    return settingsCache ? { ...settingsCache } : { ...DEFAULT_SETTINGS };
  }
}

/**
 * Updates settings with partial values.
 * Does not invoke storage or throw when extension context is invalidated.
 * @param {Partial<typeof DEFAULT_SETTINGS>} partialSettings
 * @returns {Promise<boolean>}
 */
export async function saveSettings(partialSettings) {
  try {
    if (!isExtensionContextValid() || !chrome.storage?.local) {
      return false;
    }

    const current = await getSettings();
    const updated = { ...current, ...partialSettings };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
    settingsCache = { ...updated };
    return true;
  } catch (err) {
    const isInvalidated = err instanceof Error && err.message?.includes('Extension context invalidated');
    if (!isInvalidated) {
      console.error('[YouTube Auto Resume] Failed to save settings:', err);
    }
    return false;
  }
}

/**
 * Registers a listener for settings changes.
 * @param {(newSettings: typeof DEFAULT_SETTINGS) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onSettingsChanged(callback) {
  if (!isExtensionContextValid() || !chrome.storage?.onChanged) {
    return () => {};
  }

  const listener = (changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.SETTINGS]) {
      const newValue = changes[STORAGE_KEYS.SETTINGS].newValue || DEFAULT_SETTINGS;
      const updated = {
        enabled: typeof newValue.enabled === 'boolean' ? newValue.enabled : DEFAULT_SETTINGS.enabled,
        youtubeEnabled: typeof newValue.youtubeEnabled === 'boolean' ? newValue.youtubeEnabled : DEFAULT_SETTINGS.youtubeEnabled,
        youtubeMusicEnabled: typeof newValue.youtubeMusicEnabled === 'boolean' ? newValue.youtubeMusicEnabled : DEFAULT_SETTINGS.youtubeMusicEnabled,
        diagnosticsEnabled: typeof newValue.diagnosticsEnabled === 'boolean' ? newValue.diagnosticsEnabled : DEFAULT_SETTINGS.diagnosticsEnabled,
      };
      settingsCache = { ...updated };
      callback(updated);
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    if (isExtensionContextValid() && chrome.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(listener);
    }
  };
}
