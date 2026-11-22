/**
 * Ad Skip Action & Transition Verification Engine
 */

import { LIMITS } from '../common/constants.js';
import { checkVisualVisibility } from './detector.js';
import { deriveAdUnitId } from './ad-detector.js';

/**
 * Validates and executes a safe native click on the skip button.
 * Includes synchronous pre-click interactability check.
 * @param {HTMLButtonElement|Element} buttonElement
 * @param {string} adUnitId
 * @param {Element} [playerElement]
 * @returns {{ success: boolean, reason?: string }}
 */
export function executeSkipAction(buttonElement, adUnitId, playerElement) {
  if (!buttonElement) {
    return { success: false, reason: 'button_null' };
  }

  // 1. Connection check
  if (!buttonElement.isConnected) {
    return { success: false, reason: 'button_not_connected' };
  }

  // 2. Ownership check
  if (playerElement && !playerElement.contains(buttonElement)) {
    return { success: false, reason: 'button_not_in_player' };
  }

  // 3. Disabled attributes check
  if (buttonElement.disabled === true ||
      buttonElement.getAttribute('disabled') !== null ||
      buttonElement.getAttribute('aria-disabled') === 'true') {
    return { success: false, reason: 'button_disabled' };
  }

  // 4. Visual rendering check
  const visibility = checkVisualVisibility(buttonElement);
  if (!visibility.isVisible) {
    return { success: false, reason: `button_not_visible:${visibility.reason}` };
  }

  // 5. Dispatch native click without focus shifting
  try {
    buttonElement.click();
    return { success: true };
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verifies that clicking the skip button caused playback to transition away from the skipped ad.
 * Evaluates whether .ad-showing was cleared or whether the ad pod advanced to the next unit.
 * @param {Element} playerElement
 * @param {string} originalAdUnitId
 * @param {number} [initialDelayMs=LIMITS.AD_VERIFICATION_INITIAL_DELAY_MS]
 * @param {number} [maxTimeoutMs=LIMITS.AD_VERIFICATION_MAX_TIMEOUT_MS]
 * @returns {Promise<{ verified: boolean, durationMs: number, reason: string }>}
 */
export function verifySkipTransition(
  playerElement,
  originalAdUnitId,
  _initialDelayMs = LIMITS.AD_VERIFICATION_INITIAL_DELAY_MS,
  maxTimeoutMs = LIMITS.AD_VERIFICATION_MAX_TIMEOUT_MS
) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    if (!playerElement || !playerElement.isConnected) {
      resolve({ verified: true, durationMs: 0, reason: 'player_detached' });
      return;
    }

    const checkInterval = 200;

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;

      // 1. Check if player has ceased ad playback
      const hasAdClass = playerElement.classList.contains('ad-showing') ||
                         playerElement.classList.contains('ad-interrupting');
      if (!hasAdClass) {
        clearInterval(intervalId);
        resolve({ verified: true, durationMs: elapsed, reason: 'ad_class_cleared' });
        return;
      }

      // 2. Check if ad pod advanced to the subsequent ad unit (e.g. Ad 1 of 2 -> Ad 2 of 2)
      const currentUnitId = deriveAdUnitId(playerElement);
      const isPodTransition = Boolean(
        originalAdUnitId &&
        currentUnitId &&
        originalAdUnitId.startsWith('ad-pod-') &&
        currentUnitId.startsWith('ad-pod-') &&
        currentUnitId !== originalAdUnitId
      );

      if (isPodTransition) {
        clearInterval(intervalId);
        resolve({ verified: true, durationMs: elapsed, reason: 'ad_pod_advanced' });
        return;
      }

      // 3. Timeout check
      if (elapsed >= maxTimeoutMs) {
        clearInterval(intervalId);
        resolve({ verified: false, durationMs: elapsed, reason: 'timeout_exceeded' });
      }
    }, checkInterval);
  });
}
