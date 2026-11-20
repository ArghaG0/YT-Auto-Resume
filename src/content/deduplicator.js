/**
 * Deduplication & Cooldown Tracking Engine
 */

import { LIMITS } from '../common/constants.js';

export class PromptDeduplicator {
  /**
   * @param {number} [cooldownMs=LIMITS.COOLDOWN_MS]
   */
  constructor(cooldownMs = LIMITS.COOLDOWN_MS) {
    this.cooldownMs = cooldownMs;
    /** @type {WeakSet<Element>} */
    this.handledPrompts = new WeakSet();
    this.lastActionTimestamp = 0;
  }

  /**
   * Checks if an action can be performed on the given prompt element.
   * @param {Element} promptElement
   * @returns {boolean}
   */
  canAct(promptElement) {
    if (!promptElement) return false;

    // Check if element was already actioned
    if (this.handledPrompts.has(promptElement)) {
      return false;
    }

    if (promptElement.getAttribute('data-auto-resume-handled') === 'true') {
      return false;
    }

    // Check cooldown window
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
      promptElement.setAttribute('data-auto-resume-handled', 'true');
    } catch {
      // Element might be detached or read-only in edge cases
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
}
