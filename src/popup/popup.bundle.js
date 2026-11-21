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
  var settingsCache = null;
  function isExtensionContextValid() {
    if (typeof chrome === "undefined" || !chrome) {
      return false;
    }
    if ("runtime" in chrome && chrome.runtime) {
      return Boolean(chrome.runtime.id);
    }
    return Boolean(chrome.storage);
  }
  async function getSettings() {
    try {
      if (!isExtensionContextValid() || !chrome.storage?.local) {
        return settingsCache ? { ...settingsCache } : { ...DEFAULT_SETTINGS };
      }
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      const stored = result?.[STORAGE_KEYS.SETTINGS];
      if (!stored || typeof stored !== "object") {
        settingsCache = { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS };
      }
      const resolved = {
        enabled: typeof stored.enabled === "boolean" ? stored.enabled : DEFAULT_SETTINGS.enabled,
        youtubeEnabled: typeof stored.youtubeEnabled === "boolean" ? stored.youtubeEnabled : DEFAULT_SETTINGS.youtubeEnabled,
        youtubeMusicEnabled: typeof stored.youtubeMusicEnabled === "boolean" ? stored.youtubeMusicEnabled : DEFAULT_SETTINGS.youtubeMusicEnabled,
        diagnosticsEnabled: typeof stored.diagnosticsEnabled === "boolean" ? stored.diagnosticsEnabled : DEFAULT_SETTINGS.diagnosticsEnabled
      };
      settingsCache = { ...resolved };
      return resolved;
    } catch (err) {
      const isInvalidated = err instanceof Error && err.message?.includes("Extension context invalidated");
      if (!isInvalidated) {
        console.warn("[YouTube Auto Resume] Error reading settings, falling back to defaults:", err);
      }
      return settingsCache ? { ...settingsCache } : { ...DEFAULT_SETTINGS };
    }
  }
  async function saveSettings(partialSettings) {
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
      const isInvalidated = err instanceof Error && err.message?.includes("Extension context invalidated");
      if (!isInvalidated) {
        console.error("[YouTube Auto Resume] Failed to save settings:", err);
      }
      return false;
    }
  }

  // src/popup/popup.js
  document.addEventListener("DOMContentLoaded", async () => {
    const masterToggle = document.getElementById("master-toggle");
    const statusDot = document.getElementById("status-dot");
    const statusLabel = document.getElementById("status-label");
    const statusSublabel = document.getElementById("status-sublabel");
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
    let isYouTubeActive = false;
    let hasBackgroundYouTubeTab = false;
    try {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.url) {
          const url = new URL(activeTab.url);
          isYouTubeActive = url.hostname.includes("youtube.com");
        }
        const allYtTabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
        if (allYtTabs && allYtTabs.length > 0) {
          hasBackgroundYouTubeTab = true;
        }
      }
    } catch {
      isYouTubeActive = false;
      hasBackgroundYouTubeTab = false;
    }
    function updateStatusDisplay(enabled) {
      if (!statusDot || !statusLabel) return;
      if (!enabled) {
        statusDot.className = "status-dot inactive";
        statusLabel.textContent = "Auto Resume Disabled";
        if (statusSublabel) {
          statusSublabel.textContent = "Toggle switch below to enable";
        }
        return;
      }
      statusDot.className = "status-dot active";
      if (isYouTubeActive) {
        statusLabel.textContent = "Active on YouTube";
        if (statusSublabel) {
          statusSublabel.textContent = "Monitoring this tab in foreground & background";
        }
      } else if (hasBackgroundYouTubeTab) {
        statusLabel.textContent = "Auto Resume Active";
        if (statusSublabel) {
          statusSublabel.textContent = "Guarding YouTube in background tab";
        }
      } else {
        statusLabel.textContent = "Auto Resume Active";
        if (statusSublabel) {
          statusSublabel.textContent = "Ready to resume YouTube when opened";
        }
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
