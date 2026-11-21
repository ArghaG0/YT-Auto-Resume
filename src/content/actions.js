/**
 * Action & Shadow DOM Piercing Engine
 */

import { SELECTORS, LIMITS } from '../common/constants.js';
import { isElementVisible } from './detector.js';

/**
 * Recursively locates the clickable native button within an element, its children, or its Shadow Roots.
 * Depth-bounded to prevent recursive runaway on malformed trees.
 * @param {Element} element
 * @param {number} [depth=0]
 * @param {number} [maxDepth=LIMITS.SHADOW_MAX_DEPTH]
 * @returns {HTMLButtonElement|Element|null}
 */
export function resolveClickableButton(element, depth = 0, maxDepth = LIMITS.SHADOW_MAX_DEPTH) {
  if (!element || depth > maxDepth) return null;

  // 1. Direct interactive check on the element itself
  const tagName = element.tagName ? element.tagName.toLowerCase() : '';
  const role = element.getAttribute ? element.getAttribute('role') : null;
  const isDirectInteractive = tagName === 'button' || role === 'button';

  if (isDirectInteractive) {
    const isDisabled = element.disabled || element.getAttribute('aria-disabled') === 'true';
    if (isElementVisible(element) && !isDisabled) {
      return element;
    }
    return null;
  }

  // 2. If the element hosts an open shadowRoot, search inside it
  if (element.shadowRoot) {
    // Check direct button in shadow root
    const shadowNativeBtn = element.shadowRoot.querySelector(SELECTORS.NATIVE_BUTTON);
    if (shadowNativeBtn && isElementVisible(shadowNativeBtn) && !shadowNativeBtn.disabled) {
      return shadowNativeBtn;
    }

    const shadowRoleBtn = element.shadowRoot.querySelector('[role="button"]');
    if (shadowRoleBtn && isElementVisible(shadowRoleBtn) && shadowRoleBtn.getAttribute('aria-disabled') !== 'true') {
      return shadowRoleBtn;
    }

    // Traverse children inside shadowRoot
    const shadowChildren = element.shadowRoot.children || [];
    for (const child of shadowChildren) {
      const resolved = resolveClickableButton(child, depth + 1, maxDepth);
      if (resolved) return resolved;
    }
  }

  // 3. Search direct native button or role="button" in light DOM
  const directNativeBtn = element.querySelector(SELECTORS.NATIVE_BUTTON);
  if (directNativeBtn && isElementVisible(directNativeBtn) && !directNativeBtn.disabled) {
    return directNativeBtn;
  }

  const directRoleBtn = element.querySelector('[role="button"]');
  if (directRoleBtn && isElementVisible(directRoleBtn) && directRoleBtn.getAttribute('aria-disabled') !== 'true') {
    return directRoleBtn;
  }

  // 4. Recursively traverse child elements (e.g. yt-button-shape, wrappers)
  const children = element.children || [];
  for (const child of children) {
    const resolved = resolveClickableButton(child, depth + 1, maxDepth);
    if (resolved) return resolved;
  }

  return null;
}

/**
 * Finds the explicit continuation button within the confirmed prompt.
 * Traverses Web Component shadow boundaries recursively.
 * @param {Element} promptElement
 * @returns {HTMLButtonElement|Element|null}
 */
export function findContinueButton(promptElement) {
  if (!promptElement) return null;

  // Primary target: #confirm-button inside the confirm dialog
  const confirmBtnContainer = promptElement.querySelector(SELECTORS.CONFIRM_BUTTON);
  if (confirmBtnContainer && isElementVisible(confirmBtnContainer)) {
    const resolved = resolveClickableButton(confirmBtnContainer);
    if (resolved && isElementVisible(resolved) && !resolved.disabled) {
      return resolved;
    }
  }

  // Secondary fallback: Any yt-button-renderer inside dialog buttons container
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

/**
 * Dispatches a programmatic synthetic click event to activate the continuation button.
 * Preserves standard .click() without pointer event simulation.
 * @param {Element} buttonElement
 * @returns {{ success: boolean, reason?: string }}
 */
export function dispatchContinueAction(buttonElement) {
  if (!buttonElement) {
    return { success: false, reason: 'Button element is null or undefined' };
  }

  try {
    buttonElement.focus?.();
    buttonElement.click();
    return { success: true };
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
