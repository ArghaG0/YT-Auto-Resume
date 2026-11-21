/**
 * Diagnostics Logger with FIFO Ring Buffer Bounding and Async Serialization
 */

import { STORAGE_KEYS, LIMITS } from './constants.js';
import { getSettings } from './storage.js';

// Sequential promise queue to guarantee FIFO atomic read-modify-write
let logQueue = Promise.resolve();

/**
 * Records a diagnostic event if diagnostics mode is enabled.
 * Serialized through an internal queue to prevent race condition overwrites.
 * @param {string} event
 * @param {string|object} [details='']
 * @returns {Promise<void>}
 */
export async function logDiagnosticEvent(event, details = '') {
  logQueue = logQueue.then(async () => {
    try {
      const settings = await getSettings();
      if (!settings.diagnosticsEnabled) {
        return;
      }

      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
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
      console.warn('[YouTube Auto Resume] Diagnostics log failed:', err);
    }
  });

  return logQueue;
}

/**
 * Retrieves all stored diagnostic logs.
 * @returns {Promise<Array<{timestamp: string, event: string, details: string}>>}
 */
export async function getDiagnosticLogs() {
  await logQueue;
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return [];
    }

    const result = await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS);
    return Array.isArray(result?.[STORAGE_KEYS.DIAGNOSTICS])
      ? result[STORAGE_KEYS.DIAGNOSTICS]
      : [];
  } catch {
    return [];
  }
}

/**
 * Clears all diagnostic logs from storage.
 * @returns {Promise<void>}
 */
export async function clearDiagnosticLogs() {
  logQueue = logQueue.then(async () => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        return;
      }
      await chrome.storage.local.set({ [STORAGE_KEYS.DIAGNOSTICS]: [] });
    } catch (err) {
      console.error('[YouTube Auto Resume] Failed to clear diagnostics:', err);
    }
  });

  return logQueue;
}
