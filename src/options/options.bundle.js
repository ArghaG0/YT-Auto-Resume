(() => {
  // src/common/constants.js
  var DEFAULT_SETTINGS = {
    enabled: false,
    autoResumeEnabled: true,
    adControlEnabled: true,
    autoClickSkip: true,
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
        autoResumeEnabled: typeof stored.autoResumeEnabled === "boolean" ? stored.autoResumeEnabled : DEFAULT_SETTINGS.autoResumeEnabled,
        adControlEnabled: typeof stored.adControlEnabled === "boolean" ? stored.adControlEnabled : DEFAULT_SETTINGS.adControlEnabled,
        autoClickSkip: typeof stored.autoClickSkip === "boolean" ? stored.autoClickSkip : DEFAULT_SETTINGS.autoClickSkip,
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

  // src/common/logger.js
  var logQueue = Promise.resolve();
  async function getDiagnosticLogs() {
    if (!isExtensionContextValid()) {
      return [];
    }
    await logQueue;
    try {
      if (!isExtensionContextValid() || !chrome.storage?.local) {
        return [];
      }
      const result = await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS);
      return Array.isArray(result?.[STORAGE_KEYS.DIAGNOSTICS]) ? result[STORAGE_KEYS.DIAGNOSTICS] : [];
    } catch (err) {
      const isInvalidated = err instanceof Error && err.message?.includes("Extension context invalidated");
      if (!isInvalidated) {
        console.warn("[YouTube Auto Resume] Failed to get diagnostic logs:", err);
      }
      return [];
    }
  }
  async function clearDiagnosticLogs() {
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
        const isInvalidated = err instanceof Error && err.message?.includes("Extension context invalidated");
        if (!isInvalidated) {
          console.error("[YouTube Auto Resume] Failed to clear diagnostics:", err);
        }
      }
    });
    return logQueue;
  }

  // src/options/options.js
  document.addEventListener("DOMContentLoaded", async () => {
    const autoResumeToggle = document.getElementById("auto-resume-toggle");
    const autoSkipToggle = document.getElementById("auto-skip-toggle");
    const youtubeToggle = document.getElementById("youtube-toggle");
    const diagnosticsToggle = document.getElementById("diagnostics-toggle");
    const diagnosticsContainer = document.getElementById("diagnostics-console-container");
    const consoleBox = document.getElementById("console-box");
    const logCountText = document.getElementById("log-count-text");
    const copyLogsBtn = document.getElementById("copy-logs-btn");
    const clearLogsBtn = document.getElementById("clear-logs-btn");
    const resetDefaultsBtn = document.getElementById("reset-defaults-btn");
    const versionText = document.getElementById("version-text");
    const filterBtns = document.querySelectorAll(".btn-filter");
    let activeFilter = "all";
    if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) {
        versionText.textContent = `v${manifest.version}`;
      }
    }
    const settings = await getSettings();
    if (autoResumeToggle) autoResumeToggle.checked = settings.autoResumeEnabled;
    if (autoSkipToggle) autoSkipToggle.checked = settings.adControlEnabled && settings.autoClickSkip;
    if (youtubeToggle) youtubeToggle.checked = settings.youtubeEnabled;
    if (diagnosticsToggle) diagnosticsToggle.checked = settings.diagnosticsEnabled;
    function updateConsoleVisibility(enabled) {
      if (diagnosticsContainer) {
        diagnosticsContainer.style.display = enabled ? "flex" : "none";
      }
      if (enabled) {
        renderDiagnostics();
      }
    }
    updateConsoleVisibility(settings.diagnosticsEnabled);
    autoResumeToggle?.addEventListener("change", async (e) => {
      await saveSettings({ autoResumeEnabled: e.target.checked });
    });
    autoSkipToggle?.addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      await saveSettings({ adControlEnabled: isChecked, autoClickSkip: isChecked });
    });
    youtubeToggle?.addEventListener("change", async (e) => {
      await saveSettings({ youtubeEnabled: e.target.checked });
    });
    diagnosticsToggle?.addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      await saveSettings({ diagnosticsEnabled: isChecked });
      updateConsoleVisibility(isChecked);
    });
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.getAttribute("data-filter") || "all";
        renderDiagnostics();
      });
    });
    function getEventCategory(eventName) {
      if (eventName.startsWith("ad_")) return "ad";
      if (eventName.includes("prompt") || eventName.includes("continue") || eventName.includes("playback") || eventName.includes("retry")) {
        return "resume";
      }
      return "system";
    }
    async function renderDiagnostics() {
      if (!consoleBox) return;
      const allLogs = await getDiagnosticLogs();
      const filteredLogs = allLogs.filter((log) => {
        if (activeFilter === "all") return true;
        const cat = getEventCategory(log.event);
        return cat === activeFilter;
      });
      if (logCountText) {
        logCountText.textContent = `Log History (${filteredLogs.length} / ${allLogs.length})`;
      }
      if (filteredLogs.length === 0) {
        consoleBox.innerHTML = '<p class="empty-logs">No diagnostic events matching this filter.</p>';
        return;
      }
      consoleBox.innerHTML = "";
      for (const log of filteredLogs) {
        const row = document.createElement("div");
        row.className = "log-entry";
        const timeStr = new Date(log.timestamp).toLocaleTimeString();
        const cat = getEventCategory(log.event);
        const badgeClass = cat === "ad" ? "badge-ad" : cat === "resume" ? "badge-resume" : "badge-system";
        const badgeText = cat === "ad" ? "[AD]" : cat === "resume" ? "[RESUME]" : "[SYS]";
        row.innerHTML = `
        <span class="log-time">[${timeStr}]</span>
        <span class="log-badge ${badgeClass}">${badgeText}</span>
        <span class="log-event ${log.event}">${log.event}</span>
        <span class="log-details">${log.details ? `\u2014 ${log.details}` : ""}</span>
      `;
        consoleBox.appendChild(row);
      }
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }
    copyLogsBtn?.addEventListener("click", async () => {
      const logs = await getDiagnosticLogs();
      if (logs.length === 0) return;
      const formatted = JSON.stringify(logs, null, 2);
      try {
        await navigator.clipboard.writeText(formatted);
        const originalText = copyLogsBtn.textContent;
        copyLogsBtn.textContent = "Copied!";
        setTimeout(() => {
          copyLogsBtn.textContent = originalText;
        }, 1500);
      } catch {
        console.warn("Failed to copy logs to clipboard");
      }
    });
    clearLogsBtn?.addEventListener("click", async () => {
      await clearDiagnosticLogs();
      await renderDiagnostics();
    });
    resetDefaultsBtn?.addEventListener("click", async () => {
      const confirmed = window.confirm("Reset all YouTube Auto Resume settings to default?");
      if (confirmed) {
        await saveSettings(DEFAULT_SETTINGS);
        if (autoResumeToggle) autoResumeToggle.checked = DEFAULT_SETTINGS.autoResumeEnabled;
        if (autoSkipToggle) autoSkipToggle.checked = DEFAULT_SETTINGS.adControlEnabled && DEFAULT_SETTINGS.autoClickSkip;
        if (youtubeToggle) youtubeToggle.checked = DEFAULT_SETTINGS.youtubeEnabled;
        if (diagnosticsToggle) diagnosticsToggle.checked = DEFAULT_SETTINGS.diagnosticsEnabled;
        updateConsoleVisibility(DEFAULT_SETTINGS.diagnosticsEnabled);
        await clearDiagnosticLogs();
      }
    });
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes[STORAGE_KEYS.DIAGNOSTICS]) {
          renderDiagnostics();
        }
      });
    }
  });
})();
