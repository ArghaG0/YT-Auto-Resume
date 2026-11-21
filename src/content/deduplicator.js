/**
 * Deduplication & Cooldown Tracking Engine (Reversible Leases)
 */

import { LIMITS } from '../common/constants.js';

export class PromptDeduplicator {
  /**
   * @param {number} [cooldownMs=LIMITS.COOLDOWN_MS]
   */
  constructor(cooldownMs = LIMITS.COOLDOWN_MS) {
    this.cooldownMs = cooldownMs;
    /** @type {WeakSet<Element>} Prompts currently pending playback verification */
    this.pendingPrompts = new WeakSet();
    /** @type {WeakSet<Element>} Prompts successfully verified and confirmed */
    this.handledPrompts = new WeakSet();
    /** @type {Set<Element>} Active tracked elements for attribute cleanup upon reset */
    this.activePrompts = new Set();
    this.lastActionTimestamp = 0;
  }

  /**
   * Checks if an action can be performed on the given prompt element.
   * @param {Element} promptElement
   * @returns {boolean}
   */
  canAct(promptElement) {
    if (!promptElement) return false;

    // Check if element is currently pending verification
    if (this.pendingPrompts.has(promptElement)) {
      return false;
    }

    // Check if element was already permanently handled
    if (this.handledPrompts.has(promptElement)) {
      return false;
    }

    // Check DOM attribute
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
      promptElement.setAttribute('data-auto-resume-handled', 'true');
    } catch {
      // Element might be detached or read-only
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
      if (promptElement.hasAttribute('data-auto-resume-handled')) {
        promptElement.removeAttribute('data-auto-resume-handled');
      }
    } catch {
      // Element might be detached
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
    this.pendingPrompts = new WeakSet();
    this.handledPrompts = new WeakSet();

    for (const el of this.activePrompts) {
      try {
        if (el && el.removeAttribute) {
          el.removeAttribute('data-auto-resume-handled');
        }
      } catch {
        // Ignore detached nodes
      }
    }
    this.activePrompts.clear();
  }
}
