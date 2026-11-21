/**
 * Diagnostics Logger with FIFO Ring Buffer Bounding and Async Serialization
 */

import { STORAGE_KEYS, LIMITS } from './constants.js';
import { getSettings, isExtensionContextValid, getCachedSettings, updateCachedSettings } from './storage.js';

// Re-export updateCachedSettings for compatibility
export { updateCachedSettings };

// Sequential promise queue to guarantee FIFO atomic read-modify-write
let logQueue = Promise.resolve();

/**
 * Records a diagnostic event if diagnostics mode is enabled.
 * Serialized through an internal queue to prevent race condition overwrites.
 * Synchronously checks context liveness and uses in-memory settings to avoid cascading errors.
 * @param {string} event
 * @param {string|object} [details='']
 * @returns {Promise<void>}
 */
export async function logDiagnosticEvent(event, details = '') {
  if (!isExtensionContextValid()) {
    return Promise.resolve();
  }

  logQueue = logQueue.then(async () => {
    try {
      if (!isExtensionContextValid() || !chrome.storage?.local) {
        return;
      }

      const settings = getCachedSettings() || (await getSettings());
      if (!settings?.diagnosticsEnabled) {
        return;
      }

      const result = await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS);
      const existingLogs = Array.isArray(result?.[STORAGE_KEYS.DIAGNOSTICS])
        ? result[STORAGE_KEYS.DIAGNOSTICS]
        : [];

      const newEntry = {
        timestamp: new Date().toISOString(),
        event,
        details: typeof details === 'string' ? details : JSON.stringify(details),
      };

      // Keep only the newest MAX_DIAGNOSTICS_ENTRIES (FIFO buffer)
      const updatedLogs = [...existingLogs, newEntry].slice(-LIMITS.MAX_DIAGNOSTICS_ENTRIES);

      await chrome.storage.local.set({ [STORAGE_KEYS.DIAGNOSTICS]: updatedLogs });
    } catch (err) {
      const isInvalidated = err instanceof Error && err.message?.includes('Extension context invalidated');
      if (!isInvalidated) {
        console.warn('[YouTube Auto Resume] Diagnostics log failed:', err);
      }
    }
  });

  return logQueue;
}

/**
 * Retrieves all stored diagnostic logs.
 * @returns {Promise<Array<{timestamp: string, event: string, details: string}>>}
 */
export async function getDiagnosticLogs() {
  if (!isExtensionContextValid()) {
    return [];
  }
  await logQueue;
  try {
    if (!isExtensionContextValid() || !chrome.storage?.local) {
      return [];
    }

    const result = await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS);
    return Array.isArray(result?.[STORAGE_KEYS.DIAGNOSTICS])
      ? result[STORAGE_KEYS.DIAGNOSTICS]
      : [];
  } catch (err) {
    const isInvalidated = err instanceof Error && err.message?.includes('Extension context invalidated');
    if (!isInvalidated) {
      console.warn('[YouTube Auto Resume] Failed to get diagnostic logs:', err);
    }
    return [];
  }
}

/**
 * Clears all diagnostic logs from storage.
 * @returns {Promise<void>}
 */
export async function clearDiagnosticLogs() {
  if (!isExtensionContextValid()) {
    return Promise.resolve();
  }
  logQueue = logQueue.then(async () => {
    try {
      if (!isExtensionContextValid() || !chrome.storage?.local) {
        return;
      }
      await chrome.storage.local.set({ [STORAGE_KEYS.DIAGNOSTICS]: [] });
    } catch (err) {
      const isInvalidated = err instanceof Error && err.message?.includes('Extension context invalidated');
      if (!isInvalidated) {
        console.error('[YouTube Auto Resume] Failed to clear diagnostics:', err);
      }
    }
  });

  return logQueue;
}
