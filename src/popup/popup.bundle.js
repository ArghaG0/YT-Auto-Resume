(() => {
  // src/common/constants.js
  var DEFAULT_SETTINGS = {
    enabled: false,
    youtubeEnabled: true,
    youtubeMusicEnabled: false,
    diagnosticsEnabled: false
  };
  var STORAGE_KEYS = {
    SETTINGS: "yt_auto_resume_settings",
    DIAGNOSTICS: "yt_auto_resume_diagnostics"
  };

  // src/common/storage.js
  async function getSettings() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        return { ...DEFAULT_SETTINGS };
      }
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      const stored = result?.[STORAGE_KEYS.SETTINGS];
      if (!stored || typeof stored !== "object") {
        return { ...DEFAULT_SETTINGS };
      }
      return {
        enabled: typeof stored.enabled === "boolean" ? stored.enabled : DEFAULT_SETTINGS.enabled,
        youtubeEnabled: typeof stored.youtubeEnabled === "boolean" ? stored.youtubeEnabled : DEFAULT_SETTINGS.youtubeEnabled,
        youtubeMusicEnabled: typeof stored.youtubeMusicEnabled === "boolean" ? stored.youtubeMusicEnabled : DEFAULT_SETTINGS.youtubeMusicEnabled,
        diagnosticsEnabled: typeof stored.diagnosticsEnabled === "boolean" ? stored.diagnosticsEnabled : DEFAULT_SETTINGS.diagnosticsEnabled
      };
    } catch (err) {
      console.warn("[YouTube Auto Resume] Error reading settings, falling back to defaults:", err);
      return { ...DEFAULT_SETTINGS };
    }
  }
  async function saveSettings(partialSettings) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        return false;
      }
      const current = await getSettings();
      const updated = { ...current, ...partialSettings };
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
      return true;
    } catch (err) {
      console.error("[YouTube Auto Resume] Failed to save settings:", err);
      return false;
    }
  }

  // src/popup/popup.js
  document.addEventListener("DOMContentLoaded", async () => {
    const masterToggle = document.getElementById("master-toggle");
    const statusDot = document.getElementById("status-dot");
    const statusLabel = document.getElementById("status-label");
    const openOptionsBtn = document.getElementById("open-options-btn");
    const versionText = document.getElementById("version-text");
    if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) {
        versionText.textContent = `v${manifest.version}`;
      }
    }
    const settings = await getSettings();
    if (masterToggle) {
      masterToggle.checked = settings.enabled;
    }
    let isYouTubeTab = false;
    try {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.url) {
          const url = new URL(activeTab.url);
          isYouTubeTab = url.hostname.includes("youtube.com");
        }
      }
    } catch {
      isYouTubeTab = false;
    }
    function updateStatusDisplay(enabled) {
      if (!statusDot || !statusLabel) return;
      if (!isYouTubeTab) {
        statusDot.className = "status-dot warning";
        statusLabel.textContent = "Active tab is not YouTube";
        return;
      }
      if (enabled) {
        statusDot.className = "status-dot active";
        statusLabel.textContent = "Active on YouTube";
      } else {
        statusDot.className = "status-dot inactive";
        statusLabel.textContent = "Auto Resume disabled";
      }
    }
    updateStatusDisplay(settings.enabled);
    masterToggle?.addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      await saveSettings({ enabled: isChecked });
      updateStatusDisplay(isChecked);
    });
    openOptionsBtn?.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
    });
  });
})();
