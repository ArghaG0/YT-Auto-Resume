/**
 * Action & Shadow DOM Piercing Engine
 * Restricts interaction strictly to #confirm-button and prevents focus leakage
 */

import { SELECTORS, LIMITS } from '../common/constants.js';
import { isElementVisible } from './detector.js';

const CANCEL_TERMS = ['cancel', 'no', 'abbruch', 'annuler', 'cancelar', 'annulla', 'отмена', 'キャンセル', '취소', 'रद्द'];

/**
 * Checks if an element has cancellation or negative action semantics.
 * @param {Element} element
 * @returns {boolean}
 */
export function isCancelElement(element) {
  if (!element) return false;
  if (element.id === 'cancel-button' || element.closest?.('#cancel-button')) {
    return true;
  }
  const ariaLabel = (element.getAttribute?.('aria-label') || '').toLowerCase().trim();
  const text = (element.textContent || '').toLowerCase().trim();
  return CANCEL_TERMS.some((term) => ariaLabel === term || text === term);
}

/**
 * Recursively locates the clickable native button within an element, its children, or its Shadow Roots.
 * Depth-bounded to prevent recursive runaway on malformed trees.
 * Never resolves cancel or negative buttons.
 * @param {Element} element
 * @param {number} [depth=0]
 * @param {number} [maxDepth=LIMITS.SHADOW_MAX_DEPTH]
 * @returns {HTMLButtonElement|Element|null}
 */
export function resolveClickableButton(element, depth = 0, maxDepth = LIMITS.SHADOW_MAX_DEPTH) {
  if (!element || depth > maxDepth) return null;
  if (isCancelElement(element)) return null;

  // 1. Direct interactive check on the element itself
  const tagName = element.tagName ? element.tagName.toLowerCase() : '';
  const role = element.getAttribute ? element.getAttribute('role') : null;
  const isDirectInteractive = tagName === 'button' || role === 'button';

  if (isDirectInteractive) {
    const isDisabled = element.disabled || element.getAttribute('aria-disabled') === 'true';
    if (isElementVisible(element) && !isDisabled && !isCancelElement(element)) {
      return element;
    }
    return null;
  }

  // 2. If the element hosts an open shadowRoot, search inside it
  if (element.shadowRoot) {
    const shadowNativeBtn = element.shadowRoot.querySelector(SELECTORS.NATIVE_BUTTON);
    if (shadowNativeBtn && isElementVisible(shadowNativeBtn) && !shadowNativeBtn.disabled && !isCancelElement(shadowNativeBtn)) {
      return shadowNativeBtn;
    }

    const shadowRoleBtn = element.shadowRoot.querySelector('[role="button"]');
    if (shadowRoleBtn && isElementVisible(shadowRoleBtn) && shadowRoleBtn.getAttribute('aria-disabled') !== 'true' && !isCancelElement(shadowRoleBtn)) {
      return shadowRoleBtn;
    }

    const shadowChildren = element.shadowRoot.children || [];
    for (const child of shadowChildren) {
      const resolved = resolveClickableButton(child, depth + 1, maxDepth);
      if (resolved && !isCancelElement(resolved)) return resolved;
    }
  }

  // 3. Search direct native button or role="button" in light DOM
  const directNativeBtn = element.querySelector(SELECTORS.NATIVE_BUTTON);
  if (directNativeBtn && isElementVisible(directNativeBtn) && !directNativeBtn.disabled && !isCancelElement(directNativeBtn)) {
    return directNativeBtn;
  }

  const directRoleBtn = element.querySelector('[role="button"]');
  if (directRoleBtn && isElementVisible(directRoleBtn) && directRoleBtn.getAttribute('aria-disabled') !== 'true' && !isCancelElement(directRoleBtn)) {
    return directRoleBtn;
  }

  // 4. Recursively traverse child elements (e.g. yt-button-shape, wrappers)
  const children = element.children || [];
  for (const child of children) {
    const resolved = resolveClickableButton(child, depth + 1, maxDepth);
    if (resolved && !isCancelElement(resolved)) return resolved;
  }

  return null;
}

/**
 * Finds the explicit continuation button strictly within the confirmed prompt's #confirm-button.
 * Never touches #cancel-button and has zero unrestricted fallbacks.
 * @param {Element} promptElement
 * @returns {HTMLButtonElement|Element|null}
 */
export function findContinueButton(promptElement) {
  if (!promptElement) return null;

  // Primary and ONLY target: #confirm-button inside the confirm dialog
  const confirmBtnContainer = promptElement.querySelector(SELECTORS.CONFIRM_BUTTON);
  if (confirmBtnContainer && isElementVisible(confirmBtnContainer) && !isCancelElement(confirmBtnContainer)) {
    const resolved = resolveClickableButton(confirmBtnContainer);
    if (resolved && isElementVisible(resolved) && !resolved.disabled && !isCancelElement(resolved)) {
      return resolved;
    }
  }

  // Zero fallback to unrestricted button renderers: strictly avoids selecting #cancel-button
  return null;
}

/**
 * Dispatches a programmatic synthetic click event to activate the continuation button.
 * Preserves standard native .click() without focus shifting or synthetic pointer events.
 * @param {Element} buttonElement
 * @returns {{ success: boolean, reason?: string }}
 */
export function dispatchContinueAction(buttonElement) {
  if (!buttonElement) {
    return { success: false, reason: 'Button element is null or undefined' };
  }

  if (isCancelElement(buttonElement)) {
    return { success: false, reason: 'Refused to click cancel or negative element' };
  }

  try {
    // Explicitly do NOT call buttonElement.focus() to prevent focus leakage to media player controls
    buttonElement.click();
    return { success: true };
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
