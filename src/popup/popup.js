/**
 * Popup Script for YouTube Auto Resume (v1.0.1)
 * Enhanced Two-Tier Status Display (Reassuring Background Monitoring)
 */

import { getSettings, saveSettings } from '../common/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const masterToggle = document.getElementById('master-toggle');
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
        statusSublabel.textContent = 'Toggle switch below to enable';
      }
      return;
    }

    // Enabled state: Dot is always green
    statusDot.className = 'status-dot active';

    if (isYouTubeActive) {
      statusLabel.textContent = 'Active on YouTube';
      if (statusSublabel) {
        statusSublabel.textContent = 'Monitoring this tab in foreground & background';
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

  // Toggle change listener
  masterToggle?.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    await saveSettings({ enabled: isChecked });
    updateStatusDisplay(isChecked);
  });

  // Open Options page button
  openOptionsBtn?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
});
