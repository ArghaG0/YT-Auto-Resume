/**
 * Popup Script for YouTube Auto Resume (v1.0.1)
 * Enhanced Dual-Engine Status Display & Feature Toggles
 */

import { getSettings, saveSettings } from '../common/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const masterToggle = document.getElementById('master-toggle');
  const autoResumeToggle = document.getElementById('auto-resume-toggle');
  const autoSkipToggle = document.getElementById('auto-skip-toggle');
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  const statusSublabel = document.getElementById('status-sublabel');
  const openOptionsBtn = document.getElementById('open-options-btn');
  const versionText = document.getElementById('version-text');

  // Display version from manifest
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest && manifest.version) {
      versionText.textContent = `v${manifest.version}`;
    }
  }

  // Load current settings
  const settings = await getSettings();
  if (masterToggle) {
    masterToggle.checked = settings.enabled;
  }
  if (autoResumeToggle) {
    autoResumeToggle.checked = settings.autoResumeEnabled;
  }
  if (autoSkipToggle) {
    autoSkipToggle.checked = settings.adControlEnabled && settings.autoClickSkip;
  }

  // Query tab status: check both active tab and whether YouTube is open in any background tab
  let isYouTubeActive = false;
  let hasBackgroundYouTubeTab = false;

  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.url) {
        const url = new URL(activeTab.url);
        isYouTubeActive = url.hostname.includes('youtube.com');
      }

      // Query if YouTube is open in any tab in the browser (via host_permissions)
      const allYtTabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
      if (allYtTabs && allYtTabs.length > 0) {
        hasBackgroundYouTubeTab = true;
      }
    }
  } catch {
    isYouTubeActive = false;
    hasBackgroundYouTubeTab = false;
  }

  /**
   * Updates status indicator.
   * When enabled, the indicator is always reassuringly active (green dot).
   * @param {boolean} enabled
   */
  function updateStatusDisplay(enabled) {
    if (!statusDot || !statusLabel) return;

    if (!enabled) {
      statusDot.className = 'status-dot inactive';
      statusLabel.textContent = 'Auto Resume Disabled';
      if (statusSublabel) {
        statusSublabel.textContent = 'Toggle master switch below to enable';
      }
      return;
    }

    // Enabled state: Dot is green
    statusDot.className = 'status-dot active';

    if (isYouTubeActive) {
      statusLabel.textContent = 'Active on YouTube';
      if (statusSublabel) {
        statusSublabel.textContent = 'Guarding prompts & ads in foreground and background';
      }
    } else if (hasBackgroundYouTubeTab) {
      statusLabel.textContent = 'Auto Resume Active';
      if (statusSublabel) {
        statusSublabel.textContent = 'Guarding YouTube in background tab';
      }
    } else {
      statusLabel.textContent = 'Auto Resume Active';
      if (statusSublabel) {
        statusSublabel.textContent = 'Ready to resume YouTube when opened';
      }
    }
  }

  updateStatusDisplay(settings.enabled);

  // Master toggle listener
  masterToggle?.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    await saveSettings({ enabled: isChecked });
    updateStatusDisplay(isChecked);
  });

  // Feature toggles
  autoResumeToggle?.addEventListener('change', async (e) => {
    await saveSettings({ autoResumeEnabled: e.target.checked });
  });

  autoSkipToggle?.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    await saveSettings({ adControlEnabled: isChecked, autoClickSkip: isChecked });
  });

  // Open Options page button
  openOptionsBtn?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
});
