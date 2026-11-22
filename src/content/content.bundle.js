(() => {
  // src/common/constants.js
  var SELECTORS = {
    POPUP_CONTAINER: "ytd-popup-container",
    PAPER_DIALOG: "tp-yt-paper-dialog",
    CONFIRM_DIALOG_RENDERER: "yt-confirm-dialog-renderer",
    CONFIRM_BUTTON: "#confirm-button",
    BUTTON_RENDERER: "yt-button-renderer",
    NATIVE_BUTTON: "button",
    TITLE: "#dialog-header h2, .title, #title",
    CONTAINER_FALLBACK: "body",
    // Ad Control Selectors
    MOVIE_PLAYER: "#movie_player, .html5-video-player",
    AD_OVERLAY: ".ytp-ad-player-overlay, .ytp-ad-module",
    AD_TEXT: ".ytp-ad-text",
    AD_PREVIEW: ".ytp-ad-preview-container",
    SKIP_BUTTON_CONTAINER: ".ytp-ad-skip-button-container",
    SKIP_BUTTONS: [
      ".ytp-ad-skip-button-modern button",
      ".ytp-ad-skip-button-modern",
      ".ytp-skip-ad-button",
      ".ytp-ad-skip-button-container button",
      "button.ytp-ad-skip-button",
      "button.ytp-ad-skip-button-text"
    ]
  };
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
  var DIAGNOSTIC_EVENTS = {
    // Lifecycle & Configuration
    CONTENT_SCRIPT_INITIALIZED: "content_script_initialized",
    SETTINGS_UPDATED: "settings_updated",
    NAVIGATION_RESET: "navigation_reset",
    WINDOW_OCCLUDED: "window_occluded",
    WINDOW_RESTORED: "window_restored",
    // DOM Observation & Container Health
    CONTAINER_BOOTSTRAP_WATCHING: "container_bootstrap_watching",
    CONTAINER_OBSERVED: "container_observed",
    CONTAINER_DISCONNECTED: "container_disconnected",
    CONTAINER_RECONNECTED: "container_reconnected",
    // Debouncing & Throttling
    DEBOUNCE_MAX_WAIT_TRIGGERED: "debounce_max_wait_triggered",
    // Detection & Gating (Inactivity)
    PROMPT_DETECTED: "prompt_detected",
    PROMPT_CANDIDATE_NOT_VISIBLE: "prompt_candidate_not_visible",
    PROMPT_ALREADY_HANDLED: "prompt_already_handled",
    AMBIGUOUS_PROMPT_IGNORED: "ambiguous_prompt_ignored",
    COOLDOWN_THROTTLED: "cooldown_throttled",
    EVALUATION_SKIPPED_DISABLED: "evaluation_skipped_disabled",
    // Button Resolution & Action (Inactivity)
    BUTTON_RESOLVED_SHADOW: "button_resolved_shadow",
    BUTTON_NOT_FOUND: "button_not_found",
    CONTINUE_CLICKED: "continue_clicked",
    CLICK_DISPATCH_FAILED: "click_dispatch_failed",
    // Playback Verification & Retries (Inactivity)
    PLAYBACK_VERIFIED: "playback_verified",
    PLAYBACK_VERIFY_FAILED: "playback_verify_failed",
    RETRY_ATTEMPTED: "retry_attempted",
    RETRY_EXHAUSTED: "retry_exhausted",
    ACTION_EXECUTION_ERROR: "action_execution_error",
    // Ad Control Lifecycle & Detection
    AD_DETECTED: "ad_detected",
    AD_ENDED: "ad_ended",
    AD_SKIP_COUNTDOWN_ACTIVE: "ad_skip_countdown_active",
    AD_SKIP_BUTTON_FOUND: "ad_skip_button_found",
    AD_SKIP_BUTTON_NOT_READY: "ad_skip_button_not_ready",
    AD_SKIP_CLICKED: "ad_skip_clicked",
    AD_SKIP_VERIFIED: "ad_skip_verified",
    AD_SKIP_VERIFY_FAILED: "ad_skip_verify_failed",
    AD_AMBIGUOUS_STATE_IGNORED: "ad_ambiguous_state_ignored",
    AD_DEDUPLICATION_THROTTLED: "ad_deduplication_throttled"
  };
  var LIMITS = {
    MAX_DIAGNOSTICS_ENTRIES: 50,
    COOLDOWN_MS: 3e3,
    DEBOUNCE_MS: 50,
    MAX_DEBOUNCE_WAIT_MS: 200,
    VERIFICATION_TIMEOUT_MS: 1500,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1e3,
    SHADOW_MAX_DEPTH: 4,
    // Ad Control Limits
    AD_DEBOUNCE_MS: 100,
    AD_VERIFICATION_INITIAL_DELAY_MS: 500,
    AD_VERIFICATION_MAX_TIMEOUT_MS: 1500,
    AD_MAX_SKIP_RETRIES: 1
  };

  // src/common/storage.js
  var settingsCache = null;
  function getCachedSettings() {
    return settingsCache ? { ...settingsCache } : null;
  }
  function updateCachedSettings(settings) {
    settingsCache = settings ? { ...settings } : null;
  }
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
  function onSettingsChanged(callback) {
    if (!isExtensionContextValid() || !chrome.storage?.onChanged) {
      return () => {
      };
    }
    const listener = (changes, areaName) => {
      if (areaName === "local" && changes[STORAGE_KEYS.SETTINGS]) {
        const newValue = changes[STORAGE_KEYS.SETTINGS].newValue || DEFAULT_SETTINGS;
        const updated = {
          enabled: typeof newValue.enabled === "boolean" ? newValue.enabled : DEFAULT_SETTINGS.enabled,
          autoResumeEnabled: typeof newValue.autoResumeEnabled === "boolean" ? newValue.autoResumeEnabled : DEFAULT_SETTINGS.autoResumeEnabled,
          adControlEnabled: typeof newValue.adControlEnabled === "boolean" ? newValue.adControlEnabled : DEFAULT_SETTINGS.adControlEnabled,
          autoClickSkip: typeof newValue.autoClickSkip === "boolean" ? newValue.autoClickSkip : DEFAULT_SETTINGS.autoClickSkip,
          youtubeEnabled: typeof newValue.youtubeEnabled === "boolean" ? newValue.youtubeEnabled : DEFAULT_SETTINGS.youtubeEnabled,
          youtubeMusicEnabled: typeof newValue.youtubeMusicEnabled === "boolean" ? newValue.youtubeMusicEnabled : DEFAULT_SETTINGS.youtubeMusicEnabled,
          diagnosticsEnabled: typeof newValue.diagnosticsEnabled === "boolean" ? newValue.diagnosticsEnabled : DEFAULT_SETTINGS.diagnosticsEnabled
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
  function isFeatureEffective(settings, feature, domain = typeof window !== "undefined" ? window.location?.hostname || "" : "") {
    if (!settings || !settings.enabled) {
      return false;
    }
    const isTestOrLocal = !domain || domain === "localhost" || domain === "127.0.0.1";
    const isYouTube = isTestOrLocal || domain.includes("youtube.com") && !domain.includes("music.youtube.com");
    const isYouTubeMusic = domain.includes("music.youtube.com");
    const domainAllowed = isYouTube && settings.youtubeEnabled || isYouTubeMusic && settings.youtubeMusicEnabled;
    if (!domainAllowed) {
      return false;
    }
    if (feature === "autoResume") {
      return Boolean(settings.autoResumeEnabled);
    }
    if (feature === "adControl") {
      return Boolean(settings.adControlEnabled && settings.autoClickSkip);
    }
    return false;
  }

  // src/common/logger.js
  var logQueue = Promise.resolve();
  async function logDiagnosticEvent(event, details = "") {
    if (!isExtensionContextValid()) {
      return Promise.resolve();
    }
    logQueue = logQueue.then(async () => {
      try {
        if (!isExtensionContextValid() || !chrome.storage?.local) {
          return;
        }
        const settings = getCachedSettings() || await getSettings();
        if (!settings?.diagnosticsEnabled) {
          return;
        }
        const result = await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS);
        const existingLogs = Array.isArray(result?.[STORAGE_KEYS.DIAGNOSTICS]) ? result[STORAGE_KEYS.DIAGNOSTICS] : [];
        const newEntry = {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          event,
          details: typeof details === "string" ? details : JSON.stringify(details)
        };
        const updatedLogs = [...existingLogs, newEntry].slice(-LIMITS.MAX_DIAGNOSTICS_ENTRIES);
        await chrome.storage.local.set({ [STORAGE_KEYS.DIAGNOSTICS]: updatedLogs });
      } catch (err) {
        const isInvalidated = err instanceof Error && err.message?.includes("Extension context invalidated");
        if (!isInvalidated) {
          console.warn("[YouTube Auto Resume] Diagnostics log failed:", err);
        }
      }
    });
    return logQueue;
  }

  // src/content/detector.js
  var REJECTED_KEYWORDS = [
    // Subscriptions & Deletions
    "unsubscribe",
    "d\xE9sabonner",
    "abbestellen",
    "cancelar suscripci\xF3n",
    "cancelar inscri\xE7\xE3o",
    "annulla iscrizione",
    "\u043E\u0442\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F",
    "\u767B\u9332\u89E3\u9664",
    "\uAD6C\uB3C5 \uCDE8\uC18C",
    "\u0938\u0926\u0938\u094D\u092F\u0924\u093E \u091B\u094B\u0921\u093C\u0947\u0902",
    "delete",
    "supprimer",
    "l\xF6schen",
    "eliminar",
    "excluir",
    "elimina",
    "\u0443\u0434\u0430\u043B\u0438\u0442\u044C",
    "\u524A\u9664",
    "\uC0AD\uC81C",
    "\u0939\u091F\u093E\u090F\u0902",
    // Skip & Next Video Navigation
    "skip",
    "next video",
    "next track",
    "up next",
    "play next",
    "n\xE4chste",
    "n\xE4chstes",
    "siguiente",
    "suivant",
    "prossimo",
    "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0435",
    "\u6B21",
    "\uB2E4\uC74C",
    "\u0905\u0917\u0932\u093E",
    // Playback Errors & Video Unavailable
    "playback error",
    "error occurred",
    "video unavailable",
    "unavailable in your region",
    "failed to load",
    "an error",
    "une erreur",
    "ein fehler",
    "\u043E\u0448\u0438\u0431\u043A\u0430",
    "\u30A8\u30E9\u30FC",
    "\uC624\uB958",
    // Playlist & Queue Alterations
    "queue",
    "playlist",
    "clear queue",
    "replace queue",
    "replace playlist",
    "clear playlist",
    "remove from playlist",
    "save playlist",
    "warteschlange",
    "file d'attente",
    // Feedback & Reporting
    "report",
    "feedback",
    "survey"
  ];
  var INACTIVITY_KEYWORDS = [
    // English
    "video paused",
    "paused",
    "continue watching",
    "still watching",
    // Spanish
    "video pausado",
    "pausado",
    "seguir viendo",
    "contin\xFAa viendo",
    // German
    "video pausiert",
    "pausiert",
    "weitersehen",
    // Japanese
    "\u52D5\u753B\u304C\u4E00\u6642\u505C\u6B62",
    "\u4E00\u6642\u505C\u6B62",
    "\u7D9A\u304D\u3092\u8996\u8074",
    // French
    "vid\xE9o mise en pause",
    "mise en pause",
    "continuer \xE0 regarder",
    "continuer a regarder",
    // Hindi
    "\u0935\u0940\u0921\u093F\u092F\u094B \u0930\u094B\u0915 \u0926\u093F\u092F\u093E",
    "\u0930\u094B\u0915 \u0926\u093F\u092F\u093E \u0917\u092F\u093E",
    "\u0926\u0947\u0916\u0928\u093E \u091C\u093E\u0930\u0940",
    // Italian
    "video \xE8 stato messo in pausa",
    "messo in pausa",
    "continuare a guardare",
    // Portuguese
    "v\xEDdeo pausado",
    "pausado",
    "continuar assistindo",
    // Russian
    "\u0432\u0438\u0434\u0435\u043E \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E",
    "\u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E",
    "\u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440",
    // Korean
    "\uB3D9\uC601\uC0C1\uC774 \uC77C\uC2DC\uC911\uC9C0",
    "\uC77C\uC2DC\uC911\uC9C0",
    "\uC774\uC5B4\uC11C \uC2DC\uCCAD"
  ];
  function checkVisualVisibility(element) {
    if (!element || !element.isConnected) {
      return { isVisible: false, reason: "not_connected" };
    }
    let current = element;
    while (current && current.nodeType === 1) {
      if (current.style) {
        if (current.style.display === "none") {
          return {
            isVisible: false,
            reason: current === element ? "inline_display_none" : "ancestor_inline_display_none",
            details: { target: current.tagName?.toLowerCase() }
          };
        }
        if (current.style.visibility === "hidden" || current.style.visibility === "collapse") {
          return {
            isVisible: false,
            reason: current === element ? "inline_visibility_hidden" : "ancestor_inline_visibility_hidden",
            details: { target: current.tagName?.toLowerCase() }
          };
        }
      }
      current = current.parentElement;
    }
    if (typeof window !== "undefined" && window.getComputedStyle) {
      const computed = window.getComputedStyle(element);
      if (computed.display === "none") {
        return { isVisible: false, reason: "computed_display_none" };
      }
      if (computed.visibility === "hidden" || computed.visibility === "collapse") {
        return { isVisible: false, reason: "computed_visibility_hidden" };
      }
      const opacity = parseFloat(computed.opacity);
      if (!Number.isNaN(opacity) && opacity === 0) {
        return { isVisible: false, reason: "opacity_zero" };
      }
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
        const ancestorComputed = window.getComputedStyle(ancestor);
        if (ancestorComputed.display === "none") {
          return {
            isVisible: false,
            reason: "ancestor_computed_display_none",
            details: { ancestor: ancestor.tagName?.toLowerCase() }
          };
        }
        if (ancestorComputed.visibility === "hidden" || ancestorComputed.visibility === "collapse") {
          return {
            isVisible: false,
            reason: "ancestor_computed_visibility_hidden",
            details: { ancestor: ancestor.tagName?.toLowerCase() }
          };
        }
        const ancestorOpacity = parseFloat(ancestorComputed.opacity);
        if (!Number.isNaN(ancestorOpacity) && ancestorOpacity === 0) {
          return {
            isVisible: false,
            reason: "ancestor_opacity_zero",
            details: { ancestor: ancestor.tagName?.toLowerCase() }
          };
        }
        ancestor = ancestor.parentElement;
      }
    }
    if (typeof element.getBoundingClientRect === "function") {
      const rect = element.getBoundingClientRect();
      const hasLayoutEngine = typeof document !== "undefined" && (document.body && (document.body.getBoundingClientRect?.().width > 0 || document.body.clientWidth > 0) || document.documentElement && (document.documentElement.getBoundingClientRect?.().width > 0 || document.documentElement.clientWidth > 0));
      if (hasLayoutEngine && rect.width === 0 && rect.height === 0) {
        return {
          isVisible: false,
          reason: "zero_bounding_rect",
          details: { width: rect.width, height: rect.height }
        };
      }
    }
    return { isVisible: true };
  }
  function isElementVisible(element) {
    return checkVisualVisibility(element).isVisible;
  }
  function detectInactivityPrompt(container) {
    if (!container) {
      return { status: "not_found" };
    }
    const confirmRenderer = container.querySelector(SELECTORS.CONFIRM_DIALOG_RENDERER);
    if (!confirmRenderer) {
      return { status: "not_found" };
    }
    const dialogText = (confirmRenderer.textContent || "").toLowerCase().trim();
    const textSnippet = dialogText.slice(0, 120);
    const parentDialog = confirmRenderer.closest(SELECTORS.PAPER_DIALOG) || confirmRenderer;
    const parentVisibility = checkVisualVisibility(parentDialog);
    if (!parentVisibility.isVisible) {
      const computed = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(parentDialog) : null;
      const rect = typeof parentDialog.getBoundingClientRect === "function" ? parentDialog.getBoundingClientRect() : null;
      return {
        status: "candidate_not_visible",
        promptElement: confirmRenderer,
        reason: parentVisibility.reason || "parent_dialog_not_visible",
        details: {
          rejectionTarget: "parent_dialog",
          parentTag: parentDialog.tagName?.toLowerCase(),
          ariaHidden: parentDialog.getAttribute("aria-hidden"),
          styleDisplay: parentDialog.style?.display || null,
          styleVisibility: parentDialog.style?.visibility || null,
          computedDisplay: computed?.display || null,
          computedVisibility: computed?.visibility || null,
          computedOpacity: computed?.opacity || null,
          isConnected: parentDialog.isConnected,
          rect: rect ? { width: rect.width, height: rect.height } : null,
          ...parentVisibility.details || {}
        },
        textSnippet
      };
    }
    const confirmBtn = confirmRenderer.querySelector(SELECTORS.CONFIRM_BUTTON);
    if (!confirmBtn) {
      return {
        status: "candidate_not_visible",
        promptElement: confirmRenderer,
        reason: "confirm_button_missing",
        details: {
          rejectionTarget: "confirm_button",
          confirmRendererTag: confirmRenderer.tagName?.toLowerCase(),
          ariaHidden: confirmRenderer.getAttribute("aria-hidden"),
          isConnected: confirmRenderer.isConnected
        },
        textSnippet
      };
    }
    const btnVisibility = checkVisualVisibility(confirmBtn);
    if (!btnVisibility.isVisible) {
      const computedBtn = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(confirmBtn) : null;
      const rectBtn = typeof confirmBtn.getBoundingClientRect === "function" ? confirmBtn.getBoundingClientRect() : null;
      return {
        status: "candidate_not_visible",
        promptElement: confirmRenderer,
        reason: btnVisibility.reason || "confirm_button_not_visible",
        details: {
          rejectionTarget: "confirm_button",
          buttonTag: confirmBtn.tagName?.toLowerCase(),
          ariaHidden: confirmBtn.getAttribute("aria-hidden"),
          styleDisplay: confirmBtn.style?.display || null,
          styleVisibility: confirmBtn.style?.visibility || null,
          computedDisplay: computedBtn?.display || null,
          computedVisibility: computedBtn?.visibility || null,
          computedOpacity: computedBtn?.opacity || null,
          isConnected: confirmBtn.isConnected,
          rect: rectBtn ? { width: rectBtn.width, height: rectBtn.height } : null,
          ...btnVisibility.details || {}
        },
        textSnippet
      };
    }
    for (const keyword of REJECTED_KEYWORDS) {
      if (dialogText.includes(keyword)) {
        return {
          status: "ambiguous",
          promptElement: confirmRenderer,
          reason: `rejected_keyword:${keyword}`,
          textSnippet
        };
      }
    }
    const hasInactivityCue = INACTIVITY_KEYWORDS.some((keyword) => dialogText.includes(keyword));
    if (!hasInactivityCue) {
      return {
        status: "ambiguous",
        promptElement: confirmRenderer,
        reason: "lacks_inactivity_cues",
        textSnippet
      };
    }
    return {
      status: "confirmed",
      promptElement: confirmRenderer,
      textSnippet
    };
  }

  // src/content/actions.js
  var CANCEL_TERMS = ["cancel", "no", "abbruch", "annuler", "cancelar", "annulla", "\u043E\u0442\u043C\u0435\u043D\u0430", "\u30AD\u30E3\u30F3\u30BB\u30EB", "\uCDE8\uC18C", "\u0930\u0926\u094D\u0926"];
  function isCancelElement(element) {
    if (!element) return false;
    if (element.id === "cancel-button" || element.closest?.("#cancel-button")) {
      return true;
    }
    const ariaLabel = (element.getAttribute?.("aria-label") || "").toLowerCase().trim();
    const text = (element.textContent || "").toLowerCase().trim();
    return CANCEL_TERMS.some((term) => ariaLabel === term || text === term);
  }
  function resolveClickableButton(element, depth = 0, maxDepth = LIMITS.SHADOW_MAX_DEPTH) {
    if (!element || depth > maxDepth) return null;
    if (isCancelElement(element)) return null;
    const tagName = element.tagName ? element.tagName.toLowerCase() : "";
    const role = element.getAttribute ? element.getAttribute("role") : null;
    const isDirectInteractive = tagName === "button" || role === "button";
    if (isDirectInteractive) {
      const isDisabled = element.disabled || element.getAttribute("aria-disabled") === "true";
      if (isElementVisible(element) && !isDisabled && !isCancelElement(element)) {
        return element;
      }
      return null;
    }
    if (element.shadowRoot) {
      const shadowNativeBtn = element.shadowRoot.querySelector(SELECTORS.NATIVE_BUTTON);
      if (shadowNativeBtn && isElementVisible(shadowNativeBtn) && !shadowNativeBtn.disabled && !isCancelElement(shadowNativeBtn)) {
        return shadowNativeBtn;
      }
      const shadowRoleBtn = element.shadowRoot.querySelector('[role="button"]');
      if (shadowRoleBtn && isElementVisible(shadowRoleBtn) && shadowRoleBtn.getAttribute("aria-disabled") !== "true" && !isCancelElement(shadowRoleBtn)) {
        return shadowRoleBtn;
      }
      const shadowChildren = element.shadowRoot.children || [];
      for (const child of shadowChildren) {
        const resolved = resolveClickableButton(child, depth + 1, maxDepth);
        if (resolved && !isCancelElement(resolved)) return resolved;
      }
    }
    const directNativeBtn = element.querySelector(SELECTORS.NATIVE_BUTTON);
    if (directNativeBtn && isElementVisible(directNativeBtn) && !directNativeBtn.disabled && !isCancelElement(directNativeBtn)) {
      return directNativeBtn;
    }
    const directRoleBtn = element.querySelector('[role="button"]');
    if (directRoleBtn && isElementVisible(directRoleBtn) && directRoleBtn.getAttribute("aria-disabled") !== "true" && !isCancelElement(directRoleBtn)) {
      return directRoleBtn;
    }
    const children = element.children || [];
    for (const child of children) {
      const resolved = resolveClickableButton(child, depth + 1, maxDepth);
      if (resolved && !isCancelElement(resolved)) return resolved;
    }
    return null;
  }
  function findContinueButton(promptElement) {
    if (!promptElement) return null;
    const confirmBtnContainer = promptElement.querySelector(SELECTORS.CONFIRM_BUTTON);
    if (confirmBtnContainer && isElementVisible(confirmBtnContainer) && !isCancelElement(confirmBtnContainer)) {
      const resolved = resolveClickableButton(confirmBtnContainer);
      if (resolved && isElementVisible(resolved) && !resolved.disabled && !isCancelElement(resolved)) {
        return resolved;
      }
    }
    return null;
  }
  function dispatchContinueAction(buttonElement) {
    if (!buttonElement) {
      return { success: false, reason: "Button element is null or undefined" };
    }
    if (isCancelElement(buttonElement)) {
      return { success: false, reason: "Refused to click cancel or negative element" };
    }
    try {
      buttonElement.click();
      return { success: true };
    } catch (err) {
      return { success: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }

  // src/content/deduplicator.js
  var PromptDeduplicator = class {
    /**
     * @param {number} [cooldownMs=LIMITS.COOLDOWN_MS]
     */
    constructor(cooldownMs = LIMITS.COOLDOWN_MS) {
      this.cooldownMs = cooldownMs;
      this.pendingPrompts = /* @__PURE__ */ new WeakSet();
      this.handledPrompts = /* @__PURE__ */ new WeakSet();
      this.activePrompts = /* @__PURE__ */ new Set();
      this.lastActionTimestamp = 0;
    }
    /**
     * Checks if an action can be performed on the given prompt element.
     * @param {Element} promptElement
     * @returns {boolean}
     */
    canAct(promptElement) {
      if (!promptElement) return false;
      if (this.pendingPrompts.has(promptElement)) {
        return false;
      }
      if (this.handledPrompts.has(promptElement)) {
        return false;
      }
      if (promptElement.getAttribute("data-auto-resume-handled") === "true") {
        return false;
      }
      const now = Date.now();
      if (now - this.lastActionTimestamp < this.cooldownMs) {
        return false;
      }
      return true;
    }
    /**
     * Marks a prompt element as pending playback verification.
     * Locks out concurrent duplicate clicks during the verification window.
     * @param {Element} promptElement
     */
    markPending(promptElement) {
      if (!promptElement) return;
      this.pendingPrompts.add(promptElement);
      this.activePrompts.add(promptElement);
    }
    /**
     * Checks whether a prompt is currently pending verification.
     * @param {Element} promptElement
     * @returns {boolean}
     */
    isPending(promptElement) {
      if (!promptElement) return false;
      return this.pendingPrompts.has(promptElement);
    }
    /**
     * Marks a prompt element as successfully handled and updates cooldown timestamp.
     * @param {Element} promptElement
     */
    markSuccess(promptElement) {
      if (!promptElement) return;
      this.pendingPrompts.delete(promptElement);
      this.handledPrompts.add(promptElement);
      this.activePrompts.add(promptElement);
      try {
        promptElement.setAttribute("data-auto-resume-handled", "true");
      } catch {
      }
      this.lastActionTimestamp = Date.now();
    }
    /**
     * Alias for markSuccess to maintain backward compatibility.
     * @param {Element} promptElement
     */
    markHandled(promptElement) {
      this.markSuccess(promptElement);
    }
    /**
     * Releases verification lock and strips handled attributes, allowing retries.
     * @param {Element} promptElement
     */
    unmark(promptElement) {
      if (!promptElement) return;
      this.pendingPrompts.delete(promptElement);
      this.handledPrompts.delete(promptElement);
      try {
        if (promptElement.hasAttribute("data-auto-resume-handled")) {
          promptElement.removeAttribute("data-auto-resume-handled");
        }
      } catch {
      }
    }
    /**
     * Checks if a cooldown period is currently active.
     * @returns {boolean}
     */
    isCooldownActive() {
      return Date.now() - this.lastActionTimestamp < this.cooldownMs;
    }
    /**
     * Resets all deduplication and cooldown state, cleaning up DOM markers.
     */
    reset() {
      this.lastActionTimestamp = 0;
      this.pendingPrompts = /* @__PURE__ */ new WeakSet();
      this.handledPrompts = /* @__PURE__ */ new WeakSet();
      for (const el of this.activePrompts) {
        try {
          if (el && el.removeAttribute) {
            el.removeAttribute("data-auto-resume-handled");
          }
        } catch {
        }
      }
      this.activePrompts.clear();
    }
  };

  // src/content/ad-detector.js
  var NON_AD_SELECTORS = [
    ".ytp-next-button",
    ".ytp-prev-button",
    ".ytp-play-button",
    ".ytp-ce-element",
    ".ytp-chapter-container",
    "ytd-subscribe-button-renderer",
    "#subscribe-button",
    ".ytp-subtitles-button",
    ".ytp-settings-button"
  ];
  function deriveAdUnitId(playerElement, overlayElement) {
    if (!playerElement) return "ad-unknown";
    const textContainer = overlayElement?.querySelector?.(SELECTORS.AD_TEXT) || playerElement.querySelector(SELECTORS.AD_TEXT);
    const textContent = textContainer?.textContent?.trim?.() || "";
    const podMatch = textContent.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
    if (podMatch) {
      return `ad-pod-${podMatch[1]}-of-${podMatch[2]}`;
    }
    const simpleBadge = overlayElement?.querySelector?.(".ytp-ad-simple-ad-badge") || playerElement.querySelector(".ytp-ad-simple-ad-badge");
    if (simpleBadge?.textContent?.trim?.()) {
      const badgeText = simpleBadge.textContent.trim().replace(/\s+/g, "-").slice(0, 20);
      return `ad-${badgeText}`;
    }
    const video = playerElement.querySelector("video");
    if (video?.src) {
      const srcKey = video.src.slice(-20).replace(/[^a-zA-Z0-9]/g, "");
      if (srcKey) return `ad-src-${srcKey}`;
    }
    return "ad-unit-default";
  }
  function detectAdState(root = document) {
    const player = root.querySelector ? root.querySelector(SELECTORS.MOVIE_PLAYER) : null;
    if (!player) {
      return { isAdPlaying: false, state: "not_found", reason: "player_not_found" };
    }
    const classList = player.classList;
    const hasAdShowing = classList.contains("ad-showing");
    const hasAdInterrupting = classList.contains("ad-interrupting");
    const hasPlayerAdClass = hasAdShowing || hasAdInterrupting;
    const overlay = player.querySelector(SELECTORS.AD_OVERLAY);
    if (!hasPlayerAdClass) {
      if (overlay && checkVisualVisibility(overlay).isVisible) {
        return {
          isAdPlaying: false,
          state: "ambiguous",
          playerElement: player,
          overlayElement: overlay,
          reason: "overlay_present_without_player_ad_class",
          details: { classList: Array.from(classList) }
        };
      }
      return { isAdPlaying: false, state: "not_found", playerElement: player };
    }
    const adUnitId = deriveAdUnitId(player, overlay);
    return {
      isAdPlaying: true,
      state: "ad_playing",
      playerElement: player,
      overlayElement: overlay || void 0,
      adUnitId,
      details: {
        hasAdShowing,
        hasAdInterrupting,
        hasOverlay: Boolean(overlay)
      }
    };
  }
  function findSkipButton(playerOrOverlay) {
    if (!playerOrOverlay) {
      return { button: null, isReady: false, countdownActive: false, reason: "no_container" };
    }
    const preview = playerOrOverlay.querySelector(SELECTORS.AD_PREVIEW);
    if (preview && checkVisualVisibility(preview).isVisible) {
      const text = preview.textContent || "";
      const match = text.match(/(\d+)/);
      const secondsRemaining = match ? parseInt(match[1], 10) : void 0;
      if (secondsRemaining && secondsRemaining > 0) {
        return {
          button: null,
          isReady: false,
          countdownActive: true,
          secondsRemaining,
          reason: "countdown_active",
          details: { text }
        };
      }
    }
    for (const selector of SELECTORS.SKIP_BUTTONS) {
      const candidates = playerOrOverlay.querySelectorAll(selector);
      for (const candidate of candidates) {
        const isNonAd = NON_AD_SELECTORS.some((nonAdSel) => candidate.matches(nonAdSel) || candidate.closest(nonAdSel));
        if (isNonAd) continue;
        const isDisabledAttr = candidate.disabled === true || candidate.getAttribute("disabled") !== null || candidate.getAttribute("aria-disabled") === "true";
        if (isDisabledAttr) {
          continue;
        }
        const visibility = checkVisualVisibility(candidate);
        if (!visibility.isVisible) {
          continue;
        }
        if (typeof candidate.getBoundingClientRect === "function") {
          const rect = candidate.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0 && candidate.clientWidth > 0) {
            continue;
          }
        }
        const text = (candidate.textContent || "").trim().toLowerCase();
        const ariaLabel = (candidate.getAttribute("aria-label") || "").trim().toLowerCase();
        const className = (candidate.className || "").toString().toLowerCase();
        const hasSkipSemantic = className.includes("skip") || text.includes("skip") || ariaLabel.includes("skip") || text.includes("passer") || text.includes("\xFCberspringen") || text.includes("saltar") || text.includes("pular");
        const isKnownModernSkip = className.includes("ytp-ad-skip-button") || candidate.closest(".ytp-ad-skip-button-modern") !== null || candidate.closest(SELECTORS.SKIP_BUTTON_CONTAINER) !== null;
        if (hasSkipSemantic || isKnownModernSkip) {
          return {
            button: candidate,
            isReady: true,
            countdownActive: false,
            details: { selector, className }
          };
        }
      }
    }
    return { button: null, isReady: false, countdownActive: false, reason: "button_not_found" };
  }

  // src/content/ad-state-machine.js
  var AD_STATES = {
    IDLE: "IDLE",
    AD_DETECTED: "AD_DETECTED",
    WAITING_FOR_SKIP: "WAITING_FOR_SKIP",
    SKIP_READY: "SKIP_READY",
    SKIP_ATTEMPTED: "SKIP_ATTEMPTED",
    AD_ENDED: "AD_ENDED"
  };
  var VALID_TRANSITIONS = {
    [AD_STATES.IDLE]: [AD_STATES.AD_DETECTED, AD_STATES.IDLE],
    [AD_STATES.AD_DETECTED]: [
      AD_STATES.WAITING_FOR_SKIP,
      AD_STATES.SKIP_READY,
      AD_STATES.AD_ENDED,
      AD_STATES.IDLE
    ],
    [AD_STATES.WAITING_FOR_SKIP]: [
      AD_STATES.SKIP_READY,
      AD_STATES.AD_DETECTED,
      // Ad pod transition (e.g. Ad 1 of 2 -> Ad 2 of 2)
      AD_STATES.AD_ENDED,
      AD_STATES.IDLE
    ],
    [AD_STATES.SKIP_READY]: [
      AD_STATES.SKIP_ATTEMPTED,
      AD_STATES.AD_ENDED,
      AD_STATES.IDLE
    ],
    [AD_STATES.SKIP_ATTEMPTED]: [
      AD_STATES.AD_ENDED,
      AD_STATES.AD_DETECTED,
      // Next ad in pod begins
      AD_STATES.WAITING_FOR_SKIP,
      // Retry on transition failure
      AD_STATES.IDLE
    ],
    [AD_STATES.AD_ENDED]: [
      AD_STATES.IDLE,
      AD_STATES.AD_DETECTED
      // Immediate subsequent ad sequence
    ]
  };
  var AdLifecycleStateMachine = class {
    constructor() {
      this.state = AD_STATES.IDLE;
      this.context = {};
      this.listeners = /* @__PURE__ */ new Set();
    }
    /**
     * Returns the current state of the FSM.
     * @returns {keyof typeof AD_STATES}
     */
    getState() {
      return this.state;
    }
    /**
     * Returns current context data associated with the active state.
     * @returns {Record<string, any>}
     */
    getContext() {
      return { ...this.context };
    }
    /**
     * Checks whether transitioning to targetState is valid from the current state.
     * Any state can transition to IDLE (e.g., reset or navigation).
     * @param {keyof typeof AD_STATES} targetState
     * @returns {boolean}
     */
    canTransition(targetState) {
      if (targetState === AD_STATES.IDLE) return true;
      const allowed = VALID_TRANSITIONS[this.state] || [];
      return allowed.includes(targetState);
    }
    /**
     * Executes a state transition if valid.
     * @param {keyof typeof AD_STATES} targetState
     * @param {Record<string, any>} [context={}]
     * @returns {boolean} Whether transition was accepted
     */
    transition(targetState, context = {}) {
      if (!this.canTransition(targetState)) {
        return false;
      }
      const previousState = this.state;
      this.state = targetState;
      this.context = { ...context };
      for (const listener of this.listeners) {
        try {
          listener(previousState, targetState, this.context);
        } catch (err) {
          console.error("[YouTube Auto Resume] Ad state listener error:", err);
        }
      }
      return true;
    }
    /**
     * Resets the state machine back to IDLE.
     * @param {Record<string, any>} [context={}]
     */
    reset(context = {}) {
      this.transition(AD_STATES.IDLE, context);
      this.context = {};
    }
    /**
     * Registers a callback invoked whenever a state transition occurs.
     * @param {(fromState: string, toState: string, context: Record<string, any>) => void} listener
     * @returns {() => void} Unsubscribe function
     */
    onTransition(listener) {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
  };

  // src/content/ad-deduplicator.js
  var AdUnitDeduplicator = class {
    /**
     * @param {number} [cooldownMs=LIMITS.COOLDOWN_MS]
     */
    constructor(cooldownMs = LIMITS.COOLDOWN_MS) {
      this.cooldownMs = cooldownMs;
      this.pendingUnits = /* @__PURE__ */ new Set();
      this.handledUnits = /* @__PURE__ */ new Set();
      this.lastClickTimestamp = 0;
      this.currentActiveUnitId = null;
    }
    /**
     * Sets the currently active ad unit in the player.
     * @param {string|null} unitId
     */
    setActiveUnitId(unitId) {
      this.currentActiveUnitId = unitId || null;
    }
    /**
     * Returns the currently active ad unit ID.
     * @returns {string|null}
     */
    getActiveUnitId() {
      return this.currentActiveUnitId;
    }
    /**
     * Evaluates whether an ad unit is eligible to be clicked.
     * @param {string} adUnitId
     * @returns {boolean}
     */
    canSkip(adUnitId) {
      if (!adUnitId) return false;
      if (this.pendingUnits.has(adUnitId)) {
        return false;
      }
      if (this.handledUnits.has(adUnitId)) {
        return false;
      }
      const now = Date.now();
      if (now - this.lastClickTimestamp < this.cooldownMs) {
        return false;
      }
      return true;
    }
    /**
     * Marks an ad unit as pending outcome verification.
     * @param {string} adUnitId
     */
    markPending(adUnitId) {
      if (!adUnitId) return;
      this.pendingUnits.add(adUnitId);
      this.lastClickTimestamp = Date.now();
    }
    /**
     * Checks whether an ad unit is currently pending outcome verification.
     * @param {string} adUnitId
     * @returns {boolean}
     */
    isPending(adUnitId) {
      if (!adUnitId) return false;
      return this.pendingUnits.has(adUnitId);
    }
    /**
     * Marks an ad unit as successfully skipped.
     * @param {string} adUnitId
     */
    markSuccess(adUnitId) {
      if (!adUnitId) return;
      this.pendingUnits.delete(adUnitId);
      this.handledUnits.add(adUnitId);
    }
    /**
     * Checks whether an ad unit has already been successfully skipped.
     * @param {string} adUnitId
     * @returns {boolean}
     */
    isHandled(adUnitId) {
      if (!adUnitId) return false;
      return this.handledUnits.has(adUnitId);
    }
    /**
     * Releases verification lock for an ad unit, allowing a retry.
     * @param {string} adUnitId
     */
    unmark(adUnitId) {
      if (!adUnitId) return;
      this.pendingUnits.delete(adUnitId);
      this.handledUnits.delete(adUnitId);
    }
    /**
     * Checks if cooldown period is active.
     * @returns {boolean}
     */
    isCooldownActive() {
      return Date.now() - this.lastClickTimestamp < this.cooldownMs;
    }
    /**
     * Resets all tracking state (e.g. on navigation or when normal playback resumes).
     */
    reset() {
      this.pendingUnits.clear();
      this.handledUnits.clear();
      this.lastClickTimestamp = 0;
      this.currentActiveUnitId = null;
    }
  };

  // src/content/ad-actions.js
  function executeSkipAction(buttonElement, adUnitId, playerElement) {
    if (!buttonElement) {
      return { success: false, reason: "button_null" };
    }
    if (!buttonElement.isConnected) {
      return { success: false, reason: "button_not_connected" };
    }
    if (playerElement && !playerElement.contains(buttonElement)) {
      return { success: false, reason: "button_not_in_player" };
    }
    if (buttonElement.disabled === true || buttonElement.getAttribute("disabled") !== null || buttonElement.getAttribute("aria-disabled") === "true") {
      return { success: false, reason: "button_disabled" };
    }
    const visibility = checkVisualVisibility(buttonElement);
    if (!visibility.isVisible) {
      return { success: false, reason: `button_not_visible:${visibility.reason}` };
    }
    try {
      buttonElement.click();
      return { success: true };
    } catch (err) {
      return { success: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
  function verifySkipTransition(playerElement, originalAdUnitId, _initialDelayMs = LIMITS.AD_VERIFICATION_INITIAL_DELAY_MS, maxTimeoutMs = LIMITS.AD_VERIFICATION_MAX_TIMEOUT_MS) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      if (!playerElement || !playerElement.isConnected) {
        resolve({ verified: true, durationMs: 0, reason: "player_detached" });
        return;
      }
      const checkInterval = 200;
      const intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const hasAdClass = playerElement.classList.contains("ad-showing") || playerElement.classList.contains("ad-interrupting");
        if (!hasAdClass) {
          clearInterval(intervalId);
          resolve({ verified: true, durationMs: elapsed, reason: "ad_class_cleared" });
          return;
        }
        const currentUnitId = deriveAdUnitId(playerElement);
        const isPodTransition = Boolean(
          originalAdUnitId && currentUnitId && originalAdUnitId.startsWith("ad-pod-") && currentUnitId.startsWith("ad-pod-") && currentUnitId !== originalAdUnitId
        );
        if (isPodTransition) {
          clearInterval(intervalId);
          resolve({ verified: true, durationMs: elapsed, reason: "ad_pod_advanced" });
          return;
        }
        if (elapsed >= maxTimeoutMs) {
          clearInterval(intervalId);
          resolve({ verified: false, durationMs: elapsed, reason: "timeout_exceeded" });
        }
      }, checkInterval);
    });
  }

  // src/content/content.js
  function getVideoDiagnostics() {
    if (typeof document === "undefined") {
      return { videoId: null, currentTime: null, duration: null, paused: null, readyState: null };
    }
    const video = document.querySelector("video");
    let videoId = null;
    try {
      if (typeof window !== "undefined" && window.location?.search) {
        videoId = new URLSearchParams(window.location.search).get("v");
      }
      if (!videoId) {
        const watchFlexy = document.querySelector("ytd-watch-flexy");
        videoId = watchFlexy?.getAttribute("video-id") || null;
      }
    } catch {
      videoId = null;
    }
    return {
      videoId,
      currentTime: video && typeof video.currentTime === "number" ? Number(video.currentTime.toFixed(2)) : null,
      duration: video && typeof video.duration === "number" && !Number.isNaN(video.duration) ? Number(video.duration.toFixed(2)) : null,
      paused: video ? video.paused : null,
      readyState: video ? video.readyState : null
    };
  }
  var YouTubeAutoResumeCoordinator = class {
    constructor() {
      this.settings = null;
      this.deduplicator = new PromptDeduplicator();
      this.scopedObserver = null;
      this.bootstrapObserver = null;
      this.debounceTimer = null;
      this.debounceStartTime = 0;
      this.isProcessing = false;
      this.isInitialized = false;
      this.visibilityListener = null;
      this.navFinishListener = null;
      this.navDataListener = null;
      this.adFsm = new AdLifecycleStateMachine();
      this.adDeduplicator = new AdUnitDeduplicator();
      this.playerObserver = null;
      this.adModuleObserver = null;
      this.playerBootstrapObserver = null;
      this.adDebounceTimer = null;
      this.isAdProcessing = false;
      this.lastLoggedAdUnitId = null;
    }
    /**
     * Initializes settings, listeners, and starts DOM observation.
     */
    async init() {
      if (!isExtensionContextValid()) return;
      if (this.isInitialized) return;
      this.isInitialized = true;
      this.settings = await getSettings();
      updateCachedSettings(this.settings);
      await logDiagnosticEvent(DIAGNOSTIC_EVENTS.CONTENT_SCRIPT_INITIALIZED, {
        version: "1.0.1",
        enabled: this.settings?.enabled
      });
      onSettingsChanged(async (newSettings) => {
        if (!isExtensionContextValid()) {
          this.destroy();
          return;
        }
        this.settings = newSettings;
        updateCachedSettings(newSettings);
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.SETTINGS_UPDATED, {
          enabled: newSettings.enabled,
          autoResumeEnabled: newSettings.autoResumeEnabled,
          adControlEnabled: newSettings.adControlEnabled,
          autoClickSkip: newSettings.autoClickSkip,
          youtubeEnabled: newSettings.youtubeEnabled
        });
        if (!this.settings.enabled) {
          this.deduplicator.reset();
          this.adDeduplicator.reset();
          this.adFsm.reset();
          this.teardownTier2Observer();
        }
      });
      this.setupNavigationListeners();
      this.setupVisibilityTracking();
      this.startObservation();
      this.startPlayerObservation();
    }
    /**
     * Tracks tab occlusion state (minimized vs visible window).
     */
    setupVisibilityTracking() {
      if (typeof document === "undefined") return;
      this.visibilityListener = () => {
        if (!isExtensionContextValid()) {
          this.destroy();
          return;
        }
        const isHidden = document.hidden || document.visibilityState === "hidden";
        logDiagnosticEvent(
          isHidden ? DIAGNOSTIC_EVENTS.WINDOW_OCCLUDED : DIAGNOSTIC_EVENTS.WINDOW_RESTORED,
          { visibilityState: document.visibilityState, hidden: document.hidden }
        );
      };
      document.addEventListener("visibilitychange", this.visibilityListener);
    }
    /**
     * Listens to YouTube's SPA navigation events to reset cooldown state.
     */
    setupNavigationListeners() {
      if (typeof window === "undefined") return;
      this.navFinishListener = () => {
        if (!isExtensionContextValid()) {
          this.destroy();
          return;
        }
        this.deduplicator.reset();
        this.adDeduplicator.reset();
        this.adFsm.reset();
        this.teardownTier2Observer();
        this.lastLoggedAdUnitId = null;
        logDiagnosticEvent(DIAGNOSTIC_EVENTS.NAVIGATION_RESET, { event: "yt-navigate-finish" });
      };
      this.navDataListener = () => {
        if (!isExtensionContextValid()) {
          this.destroy();
          return;
        }
        this.deduplicator.reset();
        this.adDeduplicator.reset();
        this.adFsm.reset();
        this.teardownTier2Observer();
        this.lastLoggedAdUnitId = null;
        logDiagnosticEvent(DIAGNOSTIC_EVENTS.NAVIGATION_RESET, { event: "yt-page-data-updated" });
      };
      window.addEventListener("yt-navigate-finish", this.navFinishListener);
      window.addEventListener("yt-page-data-updated", this.navDataListener);
    }
    /**
     * Scopes observation to <ytd-popup-container>.
     */
    startObservation() {
      if (typeof document === "undefined") return;
      const popupContainer = document.querySelector(SELECTORS.POPUP_CONTAINER);
      if (popupContainer && popupContainer.isConnected) {
        this.attachScopedObserver(popupContainer);
        return;
      }
      const targetRoot = document.body || document.documentElement;
      if (!targetRoot) return;
      if (this.bootstrapObserver) {
        this.bootstrapObserver.disconnect();
      }
      logDiagnosticEvent(DIAGNOSTIC_EVENTS.CONTAINER_BOOTSTRAP_WATCHING);
      this.bootstrapObserver = new MutationObserver(() => {
        const container = document.querySelector(SELECTORS.POPUP_CONTAINER);
        if (container && container.isConnected) {
          this.bootstrapObserver?.disconnect();
          this.bootstrapObserver = null;
          logDiagnosticEvent(DIAGNOSTIC_EVENTS.CONTAINER_RECONNECTED);
          this.attachScopedObserver(container);
        }
      });
      this.bootstrapObserver.observe(targetRoot, {
        childList: true,
        subtree: true
      });
    }
    /**
     * Attaches the primary observer directly to <ytd-popup-container>.
     * @param {Element} popupContainer
     */
    attachScopedObserver(popupContainer) {
      if (this.scopedObserver) {
        this.scopedObserver.disconnect();
      }
      this.scopedObserver = new MutationObserver((mutations) => {
        this.handleMutations(popupContainer, mutations);
      });
      this.scopedObserver.observe(popupContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "aria-hidden"]
      });
      logDiagnosticEvent(DIAGNOSTIC_EVENTS.CONTAINER_OBSERVED);
      this.handleMutations(popupContainer, []);
    }
    /**
     * Health check to ensure the observed container has not been detached by YouTube SPA routing.
     * @param {Element} popupContainer
     * @returns {boolean}
     */
    checkContainerHealth(popupContainer) {
      if (!popupContainer || !popupContainer.isConnected) {
        logDiagnosticEvent(DIAGNOSTIC_EVENTS.CONTAINER_DISCONNECTED);
        if (this.scopedObserver) {
          this.scopedObserver.disconnect();
          this.scopedObserver = null;
        }
        this.startObservation();
        return false;
      }
      return true;
    }
    /**
     * Bounded debounce mutation handler.
     * Caps maximum debounce delay to prevent timer starvation under background window occlusion.
     * @param {Element} popupContainer
     * @param {MutationRecord[]} [mutations=[]]
     */
    handleMutations(popupContainer, mutations = []) {
      if (!isExtensionContextValid()) {
        this.destroy();
        return;
      }
      if (!this.checkContainerHealth(popupContainer)) return;
      const now = Date.now();
      if (!this.debounceStartTime) {
        this.debounceStartTime = now;
      }
      let containsDialogInjection = false;
      if (Array.isArray(mutations)) {
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length > 0) {
            for (const node of m.addedNodes) {
              if (node.nodeType === 1) {
                const tag = (node.tagName || "").toLowerCase();
                if (tag === "yt-confirm-dialog-renderer" || tag === "tp-yt-paper-dialog" || node.querySelector?.(SELECTORS.CONFIRM_DIALOG_RENDERER)) {
                  containsDialogInjection = true;
                  break;
                }
              }
            }
          }
          if (containsDialogInjection) break;
        }
      }
      const elapsed = now - this.debounceStartTime;
      const shouldFlushImmediately = containsDialogInjection || elapsed >= LIMITS.MAX_DEBOUNCE_WAIT_MS;
      if (shouldFlushImmediately) {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        this.debounceStartTime = 0;
        if (elapsed >= LIMITS.MAX_DEBOUNCE_WAIT_MS) {
          logDiagnosticEvent(DIAGNOSTIC_EVENTS.DEBOUNCE_MAX_WAIT_TRIGGERED, { elapsed });
        }
        this.evaluatePrompt(popupContainer);
        return;
      }
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.debounceStartTime = 0;
        this.evaluatePrompt(popupContainer);
      }, LIMITS.DEBOUNCE_MS);
    }
    /**
     * Verifies that the video player has actively resumed playback.
     * @param {number} [timeoutMs=LIMITS.VERIFICATION_TIMEOUT_MS]
     * @returns {Promise<boolean>}
     */
    async verifyPlaybackResumption(timeoutMs = LIMITS.VERIFICATION_TIMEOUT_MS) {
      if (typeof document === "undefined") return true;
      const video = document.querySelector("video");
      if (!video) {
        return true;
      }
      if (!video.paused && !video.ended && video.readyState >= 2) {
        return true;
      }
      return new Promise((resolve) => {
        let timer = null;
        const onPlaying = () => {
          cleanup();
          resolve(true);
        };
        const onTimeUpdate = () => {
          if (!video.paused) {
            cleanup();
            resolve(true);
          }
        };
        const cleanup = () => {
          if (timer) clearTimeout(timer);
          video.removeEventListener("playing", onPlaying);
          video.removeEventListener("timeupdate", onTimeUpdate);
        };
        timer = setTimeout(() => {
          cleanup();
          resolve(!video.paused);
        }, timeoutMs);
        video.addEventListener("playing", onPlaying, { once: true });
        video.addEventListener("timeupdate", onTimeUpdate);
      });
    }
    /**
     * Evaluates detected prompts with concurrency protection, verification, and controlled retries.
     * @param {Element} popupContainer
     */
    async evaluatePrompt(popupContainer) {
      if (!isExtensionContextValid()) {
        this.destroy();
        return;
      }
      if (this.isProcessing) return;
      if (!this.checkContainerHealth(popupContainer)) return;
      const detection = detectInactivityPrompt(popupContainer);
      if (detection.status === "confirmed" && detection.promptElement) {
        if (!isFeatureEffective(this.settings, "autoResume")) {
          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.EVALUATION_SKIPPED_DISABLED);
          return;
        }
        if (!this.deduplicator.canAct(detection.promptElement)) {
          if (this.deduplicator.isCooldownActive()) {
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.COOLDOWN_THROTTLED);
          } else {
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PROMPT_ALREADY_HANDLED);
          }
          return;
        }
        const button = findContinueButton(detection.promptElement);
        if (!button) {
          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.BUTTON_NOT_FOUND, {
            textSnippet: detection.textSnippet,
            childrenCount: detection.promptElement.children.length
          });
          return;
        }
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.BUTTON_RESOLVED_SHADOW, {
          buttonId: button.id || "confirm-button",
          selector: "#confirm-button button",
          tag: button.tagName?.toLowerCase(),
          role: button.getAttribute("role") || void 0
        });
        this.isProcessing = true;
        this.deduplicator.markPending(detection.promptElement);
        try {
          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PROMPT_DETECTED, {
            textSnippet: detection.textSnippet,
            status: "confirmed"
          });
          let attempt = 0;
          let resumed = false;
          while (attempt < LIMITS.MAX_RETRIES && !resumed) {
            attempt++;
            if (attempt > 1) {
              await logDiagnosticEvent(DIAGNOSTIC_EVENTS.RETRY_ATTEMPTED, { attempt });
            }
            const activeBtn = attempt === 1 ? button : findContinueButton(detection.promptElement);
            if (!activeBtn) {
              await logDiagnosticEvent(DIAGNOSTIC_EVENTS.BUTTON_NOT_FOUND, { attempt });
              break;
            }
            const videoBefore = getVideoDiagnostics();
            const actionResult = dispatchContinueAction(activeBtn);
            if (!actionResult.success) {
              await logDiagnosticEvent(DIAGNOSTIC_EVENTS.CLICK_DISPATCH_FAILED, {
                attempt,
                reason: actionResult.reason,
                videoBefore
              });
              if (attempt < LIMITS.MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, LIMITS.RETRY_DELAY_MS));
              }
              continue;
            }
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.CONTINUE_CLICKED, {
              attempt,
              buttonId: activeBtn.id || "confirm-button",
              selector: "#confirm-button button",
              videoBefore
            });
            resumed = await this.verifyPlaybackResumption(LIMITS.VERIFICATION_TIMEOUT_MS);
            const videoAfter = getVideoDiagnostics();
            const dialogDismissed = !detection.promptElement.isConnected || !isElementVisible(detection.promptElement);
            if (resumed) {
              this.deduplicator.markSuccess(detection.promptElement);
              await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PLAYBACK_VERIFIED, {
                attempt,
                videoBefore,
                videoAfter,
                dialogDismissed
              });
              break;
            } else {
              await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PLAYBACK_VERIFY_FAILED, {
                attempt,
                videoBefore,
                videoAfter,
                dialogDismissed
              });
              if (attempt < LIMITS.MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, LIMITS.RETRY_DELAY_MS));
              }
            }
          }
          if (!resumed) {
            this.deduplicator.unmark(detection.promptElement);
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.RETRY_EXHAUSTED, { attempts: attempt });
          }
        } catch (err) {
          this.deduplicator.unmark(detection.promptElement);
          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.ACTION_EXECUTION_ERROR, {
            error: err instanceof Error ? err.message : String(err)
          });
          console.error("[YouTube Auto Resume] Action execution error:", err);
        } finally {
          this.isProcessing = false;
        }
      } else if (detection.status === "candidate_not_visible") {
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PROMPT_CANDIDATE_NOT_VISIBLE, {
          reason: detection.reason,
          textSnippet: detection.textSnippet,
          ...detection.details || {}
        });
      } else if (detection.status === "ambiguous") {
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AMBIGUOUS_PROMPT_IGNORED, {
          textSnippet: detection.textSnippet,
          reason: detection.reason
        });
      }
    }
    /**
     * Tier 1 Observation: Scopes class observation strictly to #movie_player.
     * Generates 0 subtree mutations during ordinary video playback.
     */
    startPlayerObservation() {
      if (typeof document === "undefined") return;
      const player = document.querySelector(SELECTORS.MOVIE_PLAYER);
      if (player && player.isConnected) {
        this.attachPlayerObserver(player);
        return;
      }
      const targetRoot = document.body || document.documentElement;
      if (!targetRoot) return;
      if (this.playerBootstrapObserver) {
        this.playerBootstrapObserver.disconnect();
      }
      this.playerBootstrapObserver = new MutationObserver(() => {
        const p = document.querySelector(SELECTORS.MOVIE_PLAYER);
        if (p && p.isConnected) {
          this.playerBootstrapObserver?.disconnect();
          this.playerBootstrapObserver = null;
          this.attachPlayerObserver(p);
        }
      });
      this.playerBootstrapObserver.observe(targetRoot, {
        childList: true,
        subtree: true
      });
    }
    /**
     * Attaches Tier 1 observer strictly watching class mutations on the player.
     * @param {Element} player
     */
    attachPlayerObserver(player) {
      if (this.playerObserver) {
        this.playerObserver.disconnect();
      }
      this.playerObserver = new MutationObserver(() => {
        if (!isExtensionContextValid()) {
          this.destroy();
          return;
        }
        const hasAdClass2 = player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting");
        if (hasAdClass2) {
          this.onAdStarted(player);
        } else {
          this.onAdEnded();
        }
      });
      this.playerObserver.observe(player, {
        attributes: true,
        attributeFilter: ["class"]
      });
      const hasAdClass = player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting");
      if (hasAdClass) {
        this.onAdStarted(player);
      }
    }
    /**
     * Invoked when #movie_player enters ad playback state.
     * Attaches Tier 2 observer to the ad overlay and evaluates skip button.
     * @param {Element} player
     */
    onAdStarted(player) {
      if (!isExtensionContextValid()) {
        this.destroy();
        return;
      }
      if (this.adFsm.getState() === AD_STATES.IDLE) {
        this.adFsm.transition(AD_STATES.AD_DETECTED);
      }
      if (!this.adModuleObserver) {
        const overlay = player.querySelector(SELECTORS.AD_OVERLAY) || player;
        this.attachTier2Observer(overlay);
      }
      this.scheduleAdEvaluation();
    }
    /**
     * Attaches Tier 2 observer scoped strictly to the ad overlay module.
     * @param {Element} overlay
     */
    attachTier2Observer(overlay) {
      if (this.adModuleObserver) {
        this.adModuleObserver.disconnect();
      }
      this.adModuleObserver = new MutationObserver(() => {
        this.scheduleAdEvaluation();
      });
      this.adModuleObserver.observe(overlay, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "disabled", "aria-disabled"]
      });
    }
    /**
     * Tears down Tier 2 observer and clears timers when an ad finishes or resets.
     */
    teardownTier2Observer() {
      if (this.adModuleObserver) {
        this.adModuleObserver.disconnect();
        this.adModuleObserver = null;
      }
      if (this.adDebounceTimer) {
        clearTimeout(this.adDebounceTimer);
        this.adDebounceTimer = null;
      }
    }
    /**
     * Invoked when #movie_player exits ad playback state.
     */
    onAdEnded() {
      this.teardownTier2Observer();
      if (this.adFsm.getState() !== AD_STATES.IDLE) {
        this.adFsm.transition(AD_STATES.AD_ENDED);
        this.adFsm.transition(AD_STATES.IDLE);
      }
      this.lastLoggedAdUnitId = null;
    }
    /**
     * Debounces ad skip evaluation (100ms) to allow DOM controls to settle.
     */
    scheduleAdEvaluation() {
      if (this.adDebounceTimer) {
        clearTimeout(this.adDebounceTimer);
      }
      this.adDebounceTimer = setTimeout(() => {
        this.adDebounceTimer = null;
        this.evaluateAdSkip();
      }, LIMITS.AD_DEBOUNCE_MS);
    }
    /**
     * Executes the 6-stage Ad Skip Decision Pipeline:
     * 1. Ad Detection -> 2. FSM Update -> 3. Eligibility Resolver -> 4. Deduplication Guard -> 5. Skip Action -> 6. Transition Verifier
     */
    async evaluateAdSkip() {
      if (!isExtensionContextValid()) {
        this.destroy();
        return;
      }
      if (this.isAdProcessing) return;
      if (!isFeatureEffective(this.settings, "adControl")) {
        return;
      }
      const detection = detectAdState();
      if (detection.state === "not_found") {
        this.onAdEnded();
        return;
      }
      if (detection.state === "ambiguous") {
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_AMBIGUOUS_STATE_IGNORED, {
          reason: detection.reason,
          details: detection.details
        });
        return;
      }
      const { playerElement, adUnitId } = detection;
      if (this.lastLoggedAdUnitId !== adUnitId) {
        this.lastLoggedAdUnitId = adUnitId;
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_DETECTED, { adUnitId });
      }
      if (this.adFsm.getState() === AD_STATES.IDLE || this.adFsm.getState() === AD_STATES.SKIP_ATTEMPTED) {
        this.adFsm.transition(AD_STATES.AD_DETECTED, { adUnitId });
      }
      const buttonResult = findSkipButton(playerElement);
      if (buttonResult.countdownActive) {
        this.adFsm.transition(AD_STATES.WAITING_FOR_SKIP, { adUnitId, secondsRemaining: buttonResult.secondsRemaining });
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_SKIP_COUNTDOWN_ACTIVE, {
          adUnitId,
          secondsRemaining: buttonResult.secondsRemaining
        });
        return;
      }
      if (!buttonResult.isReady || !buttonResult.button) {
        return;
      }
      if (!this.adDeduplicator.canSkip(adUnitId)) {
        if (this.adDeduplicator.isPending(adUnitId) || this.adDeduplicator.isHandled(adUnitId)) {
          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_DEDUPLICATION_THROTTLED, {
            adUnitId,
            status: this.adDeduplicator.isPending(adUnitId) ? "pending" : "handled"
          });
        }
        return;
      }
      this.adFsm.transition(AD_STATES.SKIP_READY, { adUnitId, button: buttonResult.button });
      this.adDeduplicator.markPending(adUnitId);
      this.adFsm.transition(AD_STATES.SKIP_ATTEMPTED, { adUnitId });
      this.isAdProcessing = true;
      try {
        const actionResult = executeSkipAction(buttonResult.button, adUnitId, playerElement);
        if (!actionResult.success) {
          this.adDeduplicator.unmark(adUnitId);
          this.adFsm.transition(AD_STATES.WAITING_FOR_SKIP);
          return;
        }
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_SKIP_CLICKED, {
          adUnitId,
          selector: buttonResult.details?.selector || ".ytp-ad-skip-button"
        });
        const outcome = await verifySkipTransition(
          playerElement,
          adUnitId,
          LIMITS.AD_VERIFICATION_INITIAL_DELAY_MS,
          LIMITS.AD_VERIFICATION_MAX_TIMEOUT_MS
        );
        if (outcome.verified) {
          this.adDeduplicator.markSuccess(adUnitId);
          this.adFsm.transition(AD_STATES.AD_ENDED, { adUnitId, durationMs: outcome.durationMs });
          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_SKIP_VERIFIED, {
            adUnitId,
            latencyMs: outcome.durationMs,
            reason: outcome.reason
          });
          if (outcome.reason === "ad_class_cleared") {
            this.onAdEnded();
          }
        } else {
          this.adDeduplicator.unmark(adUnitId);
          this.adFsm.transition(AD_STATES.WAITING_FOR_SKIP, { adUnitId, reason: outcome.reason });
          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_SKIP_VERIFY_FAILED, {
            adUnitId,
            durationMs: outcome.durationMs,
            reason: outcome.reason
          });
        }
      } catch (err) {
        this.adDeduplicator.unmark(adUnitId);
        this.adFsm.transition(AD_STATES.WAITING_FOR_SKIP);
        console.error("[YouTube Auto Resume] Ad skip error:", err);
      } finally {
        this.isAdProcessing = false;
      }
    }
    /**
     * Disconnects all observers and resets state.
     */
    destroy() {
      if (this.bootstrapObserver) {
        this.bootstrapObserver.disconnect();
        this.bootstrapObserver = null;
      }
      if (this.scopedObserver) {
        this.scopedObserver.disconnect();
        this.scopedObserver = null;
      }
      if (this.playerBootstrapObserver) {
        this.playerBootstrapObserver.disconnect();
        this.playerBootstrapObserver = null;
      }
      if (this.playerObserver) {
        this.playerObserver.disconnect();
        this.playerObserver = null;
      }
      this.teardownTier2Observer();
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      if (this.visibilityListener && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", this.visibilityListener);
        this.visibilityListener = null;
      }
      if (this.navFinishListener && typeof window !== "undefined") {
        window.removeEventListener("yt-navigate-finish", this.navFinishListener);
        this.navFinishListener = null;
      }
      if (this.navDataListener && typeof window !== "undefined") {
        window.removeEventListener("yt-page-data-updated", this.navDataListener);
        this.navDataListener = null;
      }
      this.deduplicator.reset();
      this.adDeduplicator.reset();
      this.adFsm.reset();
      this.isProcessing = false;
      this.isAdProcessing = false;
      this.debounceStartTime = 0;
      this.isInitialized = false;
    }
  };
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (isExtensionContextValid() && chrome.storage?.local) {
      console.log("[YouTube Auto Resume] Content script initialized v1.0.1");
      const coordinator = new YouTubeAutoResumeCoordinator();
      coordinator.init();
    }
  }
})();
