/**
 * Popup Script for YouTube Auto Resume
 */

import { getSettings, saveSettings } from '../common/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const masterToggle = document.getElementById('master-toggle');
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
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

  // Query active tab URL
  let isYouTubeTab = false;
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.url) {
        const url = new URL(activeTab.url);
        isYouTubeTab = url.hostname.includes('youtube.com');
      }
    }
  } catch {
    // Tab query error (e.g. restricted chrome:// tab)
    isYouTubeTab = false;
  }

  function updateStatusDisplay(enabled) {
    if (!statusDot || !statusLabel) return;

    if (!isYouTubeTab) {
      statusDot.className = 'status-dot warning';
      statusLabel.textContent = 'Active tab is not YouTube';
      return;
    }

    if (enabled) {
      statusDot.className = 'status-dot active';
      statusLabel.textContent = 'Active on YouTube';
    } else {
      statusDot.className = 'status-dot inactive';
      statusLabel.textContent = 'Auto Resume disabled';
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
