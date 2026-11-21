/**
 * Options Script for YouTube Auto Resume
 */

import { getSettings, saveSettings } from '../common/storage.js';
import { getDiagnosticLogs, clearDiagnosticLogs } from '../common/logger.js';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../common/constants.js';

document.addEventListener('DOMContentLoaded', async () => {
  const youtubeToggle = document.getElementById('youtube-toggle');
  const diagnosticsToggle = document.getElementById('diagnostics-toggle');
  const diagnosticsContainer = document.getElementById('diagnostics-console-container');
  const consoleBox = document.getElementById('console-box');
  const logCountText = document.getElementById('log-count-text');
  const copyLogsBtn = document.getElementById('copy-logs-btn');
  const clearLogsBtn = document.getElementById('clear-logs-btn');
  const resetDefaultsBtn = document.getElementById('reset-defaults-btn');
  const versionText = document.getElementById('version-text');

  // Load version from manifest
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest && manifest.version) {
      versionText.textContent = `v${manifest.version}`;
    }
  }

  // Load initial settings
  const settings = await getSettings();
  if (youtubeToggle) youtubeToggle.checked = settings.youtubeEnabled;
  if (diagnosticsToggle) diagnosticsToggle.checked = settings.diagnosticsEnabled;

  function updateConsoleVisibility(enabled) {
    if (diagnosticsContainer) {
      diagnosticsContainer.style.display = enabled ? 'flex' : 'none';
    }
    if (enabled) {
      renderDiagnostics();
    }
  }

  updateConsoleVisibility(settings.diagnosticsEnabled);

  // Surface toggles
  youtubeToggle?.addEventListener('change', async (e) => {
    await saveSettings({ youtubeEnabled: e.target.checked });
  });

  diagnosticsToggle?.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    await saveSettings({ diagnosticsEnabled: isChecked });
    updateConsoleVisibility(isChecked);
  });

  // Render logs in monospace console
  async function renderDiagnostics() {
    if (!consoleBox) return;

    const logs = await getDiagnosticLogs();
    if (logCountText) {
      logCountText.textContent = `Log History (${logs.length} / 50)`;
    }

    if (logs.length === 0) {
      consoleBox.innerHTML = '<p class="empty-logs">No diagnostic events recorded yet.</p>';
      return;
    }

    consoleBox.innerHTML = '';
    for (const log of logs) {
      const row = document.createElement('div');
      row.className = 'log-entry';

      const timeStr = new Date(log.timestamp).toLocaleTimeString();
      row.innerHTML = `
        <span class="log-time">[${timeStr}]</span>
        <span class="log-event ${log.event}">${log.event}</span>
        <span class="log-details">${log.details ? `— ${log.details}` : ''}</span>
      `;
      consoleBox.appendChild(row);
    }
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }

  // Copy logs button
  copyLogsBtn?.addEventListener('click', async () => {
    const logs = await getDiagnosticLogs();
    if (logs.length === 0) return;

    const formatted = JSON.stringify(logs, null, 2);
    try {
      await navigator.clipboard.writeText(formatted);
      const originalText = copyLogsBtn.textContent;
      copyLogsBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyLogsBtn.textContent = originalText;
      }, 1500);
    } catch {
      console.warn('Failed to copy logs to clipboard');
    }
  });

  // Clear logs button
  clearLogsBtn?.addEventListener('click', async () => {
    await clearDiagnosticLogs();
    await renderDiagnostics();
  });

  // Reset to defaults
  resetDefaultsBtn?.addEventListener('click', async () => {
    const confirmed = window.confirm('Reset all YouTube Auto Resume settings to default?');
    if (confirmed) {
      await saveSettings(DEFAULT_SETTINGS);
      if (youtubeToggle) youtubeToggle.checked = DEFAULT_SETTINGS.youtubeEnabled;
      if (diagnosticsToggle) diagnosticsToggle.checked = DEFAULT_SETTINGS.diagnosticsEnabled;
      updateConsoleVisibility(DEFAULT_SETTINGS.diagnosticsEnabled);
      await clearDiagnosticLogs();
    }
  });

  // Live-update log console when new events are logged from YouTube tabs
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEYS.DIAGNOSTICS]) {
        renderDiagnostics();
      }
    });
  }
});
