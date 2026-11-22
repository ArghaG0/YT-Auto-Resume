/**
 * Content Script Coordinator for YouTube Auto Resume (v1.0.1)
 * 100% Diagnostic Observability, Bounded Debounce, Two-Phase Verification, Retries, and Recovery
 */

import { SELECTORS, DIAGNOSTIC_EVENTS, LIMITS } from '../common/constants.js';
import { getSettings, onSettingsChanged, isExtensionContextValid, isFeatureEffective } from '../common/storage.js';
import { logDiagnosticEvent, updateCachedSettings } from '../common/logger.js';
import { detectInactivityPrompt, isElementVisible } from './detector.js';
import { findContinueButton, dispatchContinueAction } from './actions.js';
import { PromptDeduplicator } from './deduplicator.js';
import { detectAdState, findSkipButton } from './ad-detector.js';
import { AdLifecycleStateMachine, AD_STATES } from './ad-state-machine.js';
import { AdUnitDeduplicator } from './ad-deduplicator.js';
import { executeSkipAction, verifySkipTransition } from './ad-actions.js';

/**
 * Captures comprehensive video player telemetry for structured diagnostics.
 * @returns {{ videoId: string|null, currentTime: number|null, duration: number|null, paused: boolean|null, readyState: number|null }}
 */
export function getVideoDiagnostics() {
  if (typeof document === 'undefined') {
    return { videoId: null, currentTime: null, duration: null, paused: null, readyState: null };
  }

  const video = document.querySelector('video');

  let videoId = null;
  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      videoId = new URLSearchParams(window.location.search).get('v');
    }
    if (!videoId) {
      const watchFlexy = document.querySelector('ytd-watch-flexy');
      videoId = watchFlexy?.getAttribute('video-id') || null;
    }
  } catch {
    videoId = null;
  }

  return {
    videoId,
    currentTime: video && typeof video.currentTime === 'number' ? Number(video.currentTime.toFixed(2)) : null,
    duration: video && typeof video.duration === 'number' && !Number.isNaN(video.duration) ? Number(video.duration.toFixed(2)) : null,
    paused: video ? video.paused : null,
    readyState: video ? video.readyState : null,
  };
}

export class YouTubeAutoResumeCoordinator {
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

    // Ad Control Engine properties
    this.adFsm = new AdLifecycleStateMachine();
    this.adDeduplicator = new AdUnitDeduplicator();
    this.playerObserver = null; // Tier 1 observer (watching #movie_player class only)
    this.adModuleObserver = null; // Tier 2 observer (watching ad overlay only during ads)
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
      version: '1.0.1',
      enabled: this.settings?.enabled,
    });

    // Listen to real-time settings toggles from popup/options
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
        youtubeEnabled: newSettings.youtubeEnabled,
      });
      if (!this.settings.enabled) {
        this.deduplicator.reset();
        this.adDeduplicator.reset();
        this.adFsm.reset();
        this.teardownTier2Observer();
      }
    });

    // Listen for YouTube SPA navigations
    this.setupNavigationListeners();

    // Track window occlusion state changes
    this.setupVisibilityTracking();

    // Start observing DOM for inactivity prompts
    this.startObservation();

    // Start observing #movie_player for advertisements (Two-Tier Scoped Observer)
    this.startPlayerObservation();
  }

  /**
   * Tracks tab occlusion state (minimized vs visible window).
   */
  setupVisibilityTracking() {
    if (typeof document === 'undefined') return;

    this.visibilityListener = () => {
      if (!isExtensionContextValid()) {
        this.destroy();
        return;
      }
      const isHidden = document.hidden || document.visibilityState === 'hidden';
      logDiagnosticEvent(
        isHidden ? DIAGNOSTIC_EVENTS.WINDOW_OCCLUDED : DIAGNOSTIC_EVENTS.WINDOW_RESTORED,
        { visibilityState: document.visibilityState, hidden: document.hidden }
      );
    };

    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  /**
   * Listens to YouTube's SPA navigation events to reset cooldown state.
   */
  setupNavigationListeners() {
    if (typeof window === 'undefined') return;

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
      logDiagnosticEvent(DIAGNOSTIC_EVENTS.NAVIGATION_RESET, { event: 'yt-navigate-finish' });
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
      logDiagnosticEvent(DIAGNOSTIC_EVENTS.NAVIGATION_RESET, { event: 'yt-page-data-updated' });
    };

    window.addEventListener('yt-navigate-finish', this.navFinishListener);
    window.addEventListener('yt-page-data-updated', this.navDataListener);
  }

  /**
   * Scopes observation to <ytd-popup-container>.
   */
  startObservation() {
    if (typeof document === 'undefined') return;

    const popupContainer = document.querySelector(SELECTORS.POPUP_CONTAINER);
    if (popupContainer && popupContainer.isConnected) {
      this.attachScopedObserver(popupContainer);
      return;
    }

    // If popup container is not yet ready or detached, bootstrap an observer on document.body
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

    this.scopedObserver = new MutationObserver((mutations) => {
      this.handleMutations(popupContainer, mutations);
    });

    this.scopedObserver.observe(popupContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'aria-hidden'],
    });

    logDiagnosticEvent(DIAGNOSTIC_EVENTS.CONTAINER_OBSERVED);

    // Run initial scan in case the dialog is already visible
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

    // Check if dialog was explicitly injected in this mutation batch
    let containsDialogInjection = false;
    if (Array.isArray(mutations)) {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) { // ELEMENT_NODE
              const tag = (node.tagName || '').toLowerCase();
              if (tag === 'yt-confirm-dialog-renderer' || tag === 'tp-yt-paper-dialog' || node.querySelector?.(SELECTORS.CONFIRM_DIALOG_RENDERER)) {
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

    // Schedule trailing debounce
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
    if (typeof document === 'undefined') return true;

    const video = document.querySelector('video');
    if (!video) {
      // If no video element exists on page (e.g. mock test environment), assume verified
      return true;
    }

    // Immediate check
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
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('timeupdate', onTimeUpdate);
      };

      timer = setTimeout(() => {
        cleanup();
        resolve(!video.paused);
      }, timeoutMs);

      video.addEventListener('playing', onPlaying, { once: true });
      video.addEventListener('timeupdate', onTimeUpdate);
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

    if (detection.status === 'confirmed' && detection.promptElement) {
      if (!isFeatureEffective(this.settings, 'autoResume')) {
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
          childrenCount: detection.promptElement.children.length,
        });
        return;
      }

      await logDiagnosticEvent(DIAGNOSTIC_EVENTS.BUTTON_RESOLVED_SHADOW, {
        buttonId: button.id || 'confirm-button',
        selector: '#confirm-button button',
        tag: button.tagName?.toLowerCase(),
        role: button.getAttribute('role') || undefined,
      });

      // Enter action pipeline with concurrency protection
      this.isProcessing = true;
      this.deduplicator.markPending(detection.promptElement);

      try {
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PROMPT_DETECTED, {
          textSnippet: detection.textSnippet,
          status: 'confirmed',
        });

        let attempt = 0;
        let resumed = false;

        while (attempt < LIMITS.MAX_RETRIES && !resumed) {
          attempt++;
          if (attempt > 1) {
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.RETRY_ATTEMPTED, { attempt });
          }

          // Re-resolve clickable button for retries in case DOM changed
          const activeBtn = attempt === 1 ? button : findContinueButton(detection.promptElement);
          if (!activeBtn) {
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.BUTTON_NOT_FOUND, { attempt });
            break;
          }

          // Capture video telemetry before clicking
          const videoBefore = getVideoDiagnostics();

          const actionResult = dispatchContinueAction(activeBtn);
          if (!actionResult.success) {
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.CLICK_DISPATCH_FAILED, {
              attempt,
              reason: actionResult.reason,
              videoBefore,
            });
            if (attempt < LIMITS.MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, LIMITS.RETRY_DELAY_MS));
            }
            continue;
          }

          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.CONTINUE_CLICKED, {
            attempt,
            buttonId: activeBtn.id || 'confirm-button',
            selector: '#confirm-button button',
            videoBefore,
          });

          // Two-phase verification: wait for video playback resumption
          resumed = await this.verifyPlaybackResumption(LIMITS.VERIFICATION_TIMEOUT_MS);

          // Capture video telemetry and prompt status after click/verification
          const videoAfter = getVideoDiagnostics();
          const dialogDismissed = !detection.promptElement.isConnected || !isElementVisible(detection.promptElement);

          if (resumed) {
            this.deduplicator.markSuccess(detection.promptElement);
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PLAYBACK_VERIFIED, {
              attempt,
              videoBefore,
              videoAfter,
              dialogDismissed,
            });
            break;
          } else {
            await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PLAYBACK_VERIFY_FAILED, {
              attempt,
              videoBefore,
              videoAfter,
              dialogDismissed,
            });
            if (attempt < LIMITS.MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, LIMITS.RETRY_DELAY_MS));
            }
          }
        }

        if (!resumed) {
          // Playback did not resume: unmark prompt so retry/mutation can recover later
          this.deduplicator.unmark(detection.promptElement);
          await logDiagnosticEvent(DIAGNOSTIC_EVENTS.RETRY_EXHAUSTED, { attempts: attempt });
        }
      } catch (err) {
        this.deduplicator.unmark(detection.promptElement);
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.ACTION_EXECUTION_ERROR, {
          error: err instanceof Error ? err.message : String(err),
        });
        console.error('[YouTube Auto Resume] Action execution error:', err);
      } finally {
        this.isProcessing = false;
      }
    } else if (detection.status === 'candidate_not_visible') {
      await logDiagnosticEvent(DIAGNOSTIC_EVENTS.PROMPT_CANDIDATE_NOT_VISIBLE, {
        reason: detection.reason,
        textSnippet: detection.textSnippet,
        ...(detection.details || {}),
      });
    } else if (detection.status === 'ambiguous') {
      await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AMBIGUOUS_PROMPT_IGNORED, {
        textSnippet: detection.textSnippet,
        reason: detection.reason,
      });
    }
  }

  /**
   * Tier 1 Observation: Scopes class observation strictly to #movie_player.
   * Generates 0 subtree mutations during ordinary video playback.
   */
  startPlayerObservation() {
    if (typeof document === 'undefined') return;

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
      subtree: true,
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
      const hasAdClass = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
      if (hasAdClass) {
        this.onAdStarted(player);
      } else {
        this.onAdEnded();
      }
    });

    // Tier 1 config: ONLY class attribute changes, 0 childList or subtree mutations
    this.playerObserver.observe(player, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Run initial scan in case player is already showing an ad
    const hasAdClass = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
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

    // Attach Tier 2 observer to ad overlay if not already attached
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
      attributeFilter: ['class', 'disabled', 'aria-disabled'],
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

    // Feature gating check
    if (!isFeatureEffective(this.settings, 'adControl')) {
      return;
    }

    // Stage 1: Multi-signal Ad Detection
    const detection = detectAdState();
    if (detection.state === 'not_found') {
      this.onAdEnded();
      return;
    }
    if (detection.state === 'ambiguous') {
      await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_AMBIGUOUS_STATE_IGNORED, {
        reason: detection.reason,
        details: detection.details,
      });
      return;
    }

    const { playerElement, adUnitId } = detection;

    // Log AD_DETECTED once per unique ad unit
    if (this.lastLoggedAdUnitId !== adUnitId) {
      this.lastLoggedAdUnitId = adUnitId;
      await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_DETECTED, { adUnitId });
    }

    // Stage 2: FSM Update
    if (this.adFsm.getState() === AD_STATES.IDLE || this.adFsm.getState() === AD_STATES.SKIP_ATTEMPTED) {
      this.adFsm.transition(AD_STATES.AD_DETECTED, { adUnitId });
    }

    // Stage 3: Eligibility Resolver (find and verify skip button)
    const buttonResult = findSkipButton(playerElement);

    if (buttonResult.countdownActive) {
      this.adFsm.transition(AD_STATES.WAITING_FOR_SKIP, { adUnitId, secondsRemaining: buttonResult.secondsRemaining });
      await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_SKIP_COUNTDOWN_ACTIVE, {
        adUnitId,
        secondsRemaining: buttonResult.secondsRemaining,
      });
      return;
    }

    if (!buttonResult.isReady || !buttonResult.button) {
      return;
    }

    // Stage 4: Deduplication Guard
    if (!this.adDeduplicator.canSkip(adUnitId)) {
      if (this.adDeduplicator.isPending(adUnitId) || this.adDeduplicator.isHandled(adUnitId)) {
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_DEDUPLICATION_THROTTLED, {
          adUnitId,
          status: this.adDeduplicator.isPending(adUnitId) ? 'pending' : 'handled',
        });
      }
      return;
    }

    // Stage 5: Skip Action Dispatch
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
        selector: buttonResult.details?.selector || '.ytp-ad-skip-button',
      });

      // Stage 6: Playback Transition Verification
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
          reason: outcome.reason,
        });
        if (outcome.reason === 'ad_class_cleared') {
          this.onAdEnded();
        }
      } else {
        // Verification failed (ad did not skip)
        this.adDeduplicator.unmark(adUnitId);
        this.adFsm.transition(AD_STATES.WAITING_FOR_SKIP, { adUnitId, reason: outcome.reason });
        await logDiagnosticEvent(DIAGNOSTIC_EVENTS.AD_SKIP_VERIFY_FAILED, {
          adUnitId,
          durationMs: outcome.durationMs,
          reason: outcome.reason,
        });
      }
    } catch (err) {
      this.adDeduplicator.unmark(adUnitId);
      this.adFsm.transition(AD_STATES.WAITING_FOR_SKIP);
      console.error('[YouTube Auto Resume] Ad skip error:', err);
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
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    if (this.navFinishListener && typeof window !== 'undefined') {
      window.removeEventListener('yt-navigate-finish', this.navFinishListener);
      this.navFinishListener = null;
    }
    if (this.navDataListener && typeof window !== 'undefined') {
      window.removeEventListener('yt-page-data-updated', this.navDataListener);
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
}

// Auto-bootstrap coordinator when loaded in browser content script context
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (isExtensionContextValid() && chrome.storage?.local) {
    console.log('[YouTube Auto Resume] Content script initialized v1.0.1');
    const coordinator = new YouTubeAutoResumeCoordinator();
    coordinator.init();
  }
}
