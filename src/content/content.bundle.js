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
    CONTAINER_FALLBACK: "body"
  };
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
  var DIAGNOSTIC_EVENTS = {
    PROMPT_DETECTED: "prompt_detected",
    CONTINUE_CLICKED: "continue_clicked",
    AMBIGUOUS_PROMPT_IGNORED: "ambiguous_prompt_ignored",
    COOLDOWN_THROTTLED: "cooldown_throttled",
    USER_PAUSE_IGNORED: "user_pause_ignored"
  };
  var LIMITS = {
    MAX_DIAGNOSTICS_ENTRIES: 50,
    COOLDOWN_MS: 3e3,
    DEBOUNCE_MS: 50
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
  function onSettingsChanged(callback) {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return () => {
      };
    }
    const listener = (changes, areaName) => {
      if (areaName === "local" && changes[STORAGE_KEYS.SETTINGS]) {
        const newValue = changes[STORAGE_KEYS.SETTINGS].newValue || DEFAULT_SETTINGS;
        callback({
          enabled: typeof newValue.enabled === "boolean" ? newValue.enabled : DEFAULT_SETTINGS.enabled,
          youtubeEnabled: typeof newValue.youtubeEnabled === "boolean" ? newValue.youtubeEnabled : DEFAULT_SETTINGS.youtubeEnabled,
          youtubeMusicEnabled: typeof newValue.youtubeMusicEnabled === "boolean" ? newValue.youtubeMusicEnabled : DEFAULT_SETTINGS.youtubeMusicEnabled,
          diagnosticsEnabled: typeof newValue.diagnosticsEnabled === "boolean" ? newValue.diagnosticsEnabled : DEFAULT_SETTINGS.diagnosticsEnabled
        });
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  // src/common/logger.js
  async function logDiagnosticEvent(event, details = "") {
    try {
      const settings = await getSettings();
      if (!settings.diagnosticsEnabled) {
        return;
      }
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
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
      console.warn("[YouTube Auto Resume] Diagnostics log failed:", err);
    }
  }

  // src/content/detector.js
  var AMBIGUOUS_KEYWORDS = [
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
    "\u0939\u091F\u093E\u090F\u0902"
  ];
  function isElementVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    if (element.style && (element.style.display === "none" || element.style.visibility === "hidden")) {
      return false;
    }
    if (typeof window !== "undefined" && window.getComputedStyle) {
      const computed = window.getComputedStyle(element);
      if (computed.display === "none" || computed.visibility === "hidden") {
        return false;
      }
    }
    return true;
  }
  function detectInactivityPrompt(container) {
    if (!container) {
      return { status: "not_found" };
    }
    const confirmRenderer = container.querySelector(SELECTORS.CONFIRM_DIALOG_RENDERER);
    if (!confirmRenderer) {
      return { status: "not_found" };
    }
    const parentDialog = confirmRenderer.closest(SELECTORS.PAPER_DIALOG) || confirmRenderer;
    if (!isElementVisible(parentDialog)) {
      return { status: "not_found" };
    }
    const confirmBtn = confirmRenderer.querySelector(SELECTORS.CONFIRM_BUTTON);
    if (!confirmBtn || !isElementVisible(confirmBtn)) {
      return { status: "not_found" };
    }
    const dialogText = (confirmRenderer.textContent || "").toLowerCase();
    for (const keyword of AMBIGUOUS_KEYWORDS) {
      if (dialogText.includes(keyword)) {
        return { status: "ambiguous", promptElement: confirmRenderer };
      }
    }
    return { status: "confirmed", promptElement: confirmRenderer };
  }

  // src/content/actions.js
  function resolveClickableButton(element) {
    if (!element) return null;
    if (element.shadowRoot) {
      const shadowBtn = element.shadowRoot.querySelector(`${SELECTORS.NATIVE_BUTTON}, [role="button"]`);
      if (shadowBtn) {
        return isElementVisible(shadowBtn) && !shadowBtn.disabled ? shadowBtn : null;
      }
    }
    const directBtn = element.querySelector(`${SELECTORS.NATIVE_BUTTON}, [role="button"]`);
    if (directBtn) {
      return isElementVisible(directBtn) && !directBtn.disabled ? directBtn : null;
    }
    const isInteractive = element.tagName.toLowerCase() === "button" || element.getAttribute("role") === "button" || element.tagName.toLowerCase().includes("button");
    if (isInteractive) {
      const isDisabled = element.disabled || element.getAttribute("aria-disabled") === "true";
      if (isElementVisible(element) && !isDisabled) {
        return element;
      }
    }
    return null;
  }
  function findContinueButton(promptElement) {
    if (!promptElement) return null;
    const confirmBtnContainer = promptElement.querySelector(SELECTORS.CONFIRM_BUTTON);
    if (confirmBtnContainer && isElementVisible(confirmBtnContainer)) {
      const resolved = resolveClickableButton(confirmBtnContainer);
      if (resolved && isElementVisible(resolved) && !resolved.disabled) {
        return resolved;
      }
    }
    const buttonRenderers = promptElement.querySelectorAll(SELECTORS.BUTTON_RENDERER);
    for (const renderer of buttonRenderers) {
      if (isElementVisible(renderer)) {
        const resolved = resolveClickableButton(renderer);
        if (resolved && isElementVisible(resolved) && !resolved.disabled) {
          return resolved;
        }
      }
    }
    return null;
  }
  function dispatchContinueAction(buttonElement) {
    if (!buttonElement) {
      return { success: false, reason: "Button element is null or undefined" };
    }
    try {
      buttonElement.focus?.();
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
      this.handledPrompts = /* @__PURE__ */ new WeakSet();
      this.lastActionTimestamp = 0;
    }
    /**
     * Checks if an action can be performed on the given prompt element.
     * @param {Element} promptElement
     * @returns {boolean}
     */
    canAct(promptElement) {
      if (!promptElement) return false;
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
     * Marks a prompt element as handled and updates cooldown timestamp.
     * @param {Element} promptElement
     */
    markHandled(promptElement) {
      if (!promptElement) return;
      this.handledPrompts.add(promptElement);
      try {
        promptElement.setAttribute("data-auto-resume-handled", "true");
      } catch {
      }
      this.lastActionTimestamp = Date.now();
    }
    /**
     * Checks if a cooldown period is currently active.
     * @returns {boolean}
     */
    isCooldownActive() {
      return Date.now() - this.lastActionTimestamp < this.cooldownMs;
    }
    /**
     * Resets deduplication state (e.g. on navigation or dialog removal).
     */
    reset() {
      this.lastActionTimestamp = 0;
    }
  };

  // src/content/content.js
  var YouTubeAutoResumeCoordinator = class {
    constructor() {
      this.settings = null;
      this.deduplicator = new PromptDeduplicator();
      this.scopedObserver = null;
      this.bootstrapObserver = null;
      this.debounceTimer = null;
      this.isInitialized = false;
    }
    /**
     * Initializes settings, listeners, and starts DOM observation.
     */
    async init() {
      if (this.isInitialized) return;
      this.isInitialized = true;
      this.settings = await getSettings();
      onSettingsChanged((newSettings) => {
        this.settings = newSettings;
        if (!this.settings.enabled) {
          this.deduplicator.reset();
        }
      });
      this.setupNavigationListeners();
      this.startObservation();
    }
    /**
     * Listens to YouTube's SPA navigation events to reset cooldown state.
     */
    setupNavigationListeners() {
      if (typeof window === "undefined") return;
      window.addEventListener("yt-navigate-finish", () => {
        this.deduplicator.reset();
      });
      window.addEventListener("yt-page-data-updated", () => {
        this.deduplicator.reset();
      });
    }
    /**
     * Scopes observation to <ytd-popup-container>.
     */
    startObservation() {
      if (typeof document === "undefined") return;
      const popupContainer = document.querySelector(SELECTORS.POPUP_CONTAINER);
      if (popupContainer) {
        this.attachScopedObserver(popupContainer);
        return;
      }
      const targetRoot = document.body || document.documentElement;
      if (!targetRoot) return;
      this.bootstrapObserver = new MutationObserver(() => {
        const container = document.querySelector(SELECTORS.POPUP_CONTAINER);
        if (container) {
          this.bootstrapObserver?.disconnect();
          this.bootstrapObserver = null;
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
      this.scopedObserver = new MutationObserver(() => {
        this.handleMutations(popupContainer);
      });
      this.scopedObserver.observe(popupContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "aria-hidden"]
      });
      this.handleMutations(popupContainer);
    }
    /**
     * Debounced mutation handler to evaluate prompts.
     * @param {Element} popupContainer
     */
    handleMutations(popupContainer) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.evaluatePrompt(popupContainer);
      }, LIMITS.DEBOUNCE_MS);
    }
    /**
     * Evaluates and acts on detected prompts if extension is enabled.
     * @param {Element} popupContainer
     */
    async evaluatePrompt(popupContainer) {
      if (!this.settings || !this.settings.enabled || !this.settings.youtubeEnabled) {
        return;
      }
      const detection = detectInactivityPrompt(popupContainer);
      if (detection.status === "confirmed" && detection.promptElement) {
        if (!this.deduplicator.canAct(detection.promptElement)) {
          if (this.deduplicator.isCooldownActive()) {
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.COOLDOWN_THROTTLED);
          }
          return;
        }
        const button = findContinueButton(detection.promptElement);
        if (button) {
          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PROMPT_DETECTED);
          const actionResult = dispatchContinueAction(button);
          if (actionResult.success) {
            this.deduplicator.markHandled(detection.promptElement);
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.CONTINUE_CLICKED);
          }
        }
      } else if (detection.status === "ambiguous") {
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AMBIGUOUS_PROMPT_IGNORED);
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
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      this.deduplicator.reset();
      this.isInitialized = false;
    }
  };
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    console.log("[YouTube Auto Resume] Content script initialized v1.0.0");
    const coordinator = new YouTubeAutoResumeCoordinator();
    coordinator.init();
  }
})();
