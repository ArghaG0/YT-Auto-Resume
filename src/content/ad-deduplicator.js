/**
 * Ad Deduplication & Pod Tracking Engine
 * In-Memory Tracking (No YouTube DOM Mutation)
 */

import { LIMITS } from '../common/constants.js';

export class AdUnitDeduplicator {
  /**
   * @param {number} [cooldownMs=LIMITS.COOLDOWN_MS]
   */
  constructor(cooldownMs = LIMITS.COOLDOWN_MS) {
    this.cooldownMs = cooldownMs;
    /** @type {Set<string>} Ad units currently pending skip verification */
    this.pendingUnits = new Set();
    /** @type {Set<string>} Ad units successfully skipped */
    this.handledUnits = new Set();
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

    // 1. Check if unit is already pending outcome verification
    if (this.pendingUnits.has(adUnitId)) {
      return false;
    }

    // 2. Check if unit was already successfully skipped
    if (this.handledUnits.has(adUnitId)) {
      return false;
    }

    // 3. Check cooldown between skip attempts
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
}
