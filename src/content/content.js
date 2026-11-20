/**
 * Content Script Coordinator for YouTube Auto Resume
 */

import { SELECTORS, DIAGNOSTIC_EVENTS, LIMITS } from '../common/constants.js';
import { getSettings, onSettingsChanged } from '../common/storage.js';
import { logDiagnosticEvent } from '../common/logger.js';
import { detectInactivityPrompt } from './detector.js';
import { findContinueButton, dispatchContinueAction } from './actions.js';
import { PromptDeduplicator } from './deduplicator.js';

export class YouTubeAutoResumeCoordinator {
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

    // Listen to real-time settings toggles from popup/options
    onSettingsChanged((newSettings) => {
      this.settings = newSettings;
      if (!this.settings.enabled) {
        this.deduplicator.reset();
      }
    });

    // Listen for YouTube SPA navigations
    this.setupNavigationListeners();

    // Start observing DOM for inactivity prompts
    this.startObservation();
  }

  /**
   * Listens to YouTube's SPA navigation events to reset cooldown state.
   */
  setupNavigationListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('yt-navigate-finish', () => {
      this.deduplicator.reset();
    });

    window.addEventListener('yt-page-data-updated', () => {
      this.deduplicator.reset();
    });
  }

  /**
   * Scopes observation to <ytd-popup-container>.
   */
  startObservation() {
    if (typeof document === 'undefined') return;

    const popupContainer = document.querySelector(SELECTORS.POPUP_CONTAINER);
    if (popupContainer) {
      this.attachScopedObserver(popupContainer);
      return;
    }

    // If popup container is not yet ready, bootstrap an observer on document.body
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
      subtree: true,
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
      attributeFilter: ['style', 'class', 'aria-hidden'],
    });

    // Run initial scan in case the dialog is already visible
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
    const detection = detectInactivityPrompt(popupContainer);

    if (detection.status === 'confirmed' && detection.promptElement) {
      if (!this.settings || !this.settings.enabled) {
        console.log('[YouTube Auto Resume] Inactivity prompt detected, but extension is disabled in popup.');
        return;
      }
      if (!this.settings.youtubeEnabled) {
        return;
      }

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
    } else if (detection.status === 'ambiguous') {
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
}

// Auto-bootstrap coordinator when loaded in browser content script context
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  console.log('[YouTube Auto Resume] Content script initialized v1.0.0');
  const coordinator = new YouTubeAutoResumeCoordinator();
  coordinator.init();
}
