/**
 * Action & Shadow DOM Piercing Engine
 */

import { SELECTORS } from '../common/constants.js';
import { isElementVisible } from './detector.js';

/**
 * Recursively locates the clickable native button within an element or its Shadow Roots.
 * @param {Element} element
 * @returns {HTMLButtonElement|Element|null}
 */
export function resolveClickableButton(element) {
  if (!element) return null;

  // If the element hosts an open Shadow Root, inspect inside
  if (element.shadowRoot) {
    const shadowBtn = element.shadowRoot.querySelector(`${SELECTORS.NATIVE_BUTTON}, [role="button"]`);
    if (shadowBtn) {
      return isElementVisible(shadowBtn) && !shadowBtn.disabled ? shadowBtn : null;
    }
  }

  // Check direct children for native button or role="button"
  const directBtn = element.querySelector(`${SELECTORS.NATIVE_BUTTON}, [role="button"]`);
  if (directBtn) {
    return isElementVisible(directBtn) && !directBtn.disabled ? directBtn : null;
  }

  // If the element itself is interactive
  const isInteractive = element.tagName.toLowerCase() === 'button' || 
                        element.getAttribute('role') === 'button' ||
                        element.tagName.toLowerCase().includes('button');
  if (isInteractive) {
    const isDisabled = element.disabled || element.getAttribute('aria-disabled') === 'true';
    if (isElementVisible(element) && !isDisabled) {
      return element;
    }
  }

  return null;
}

/**
 * Finds the explicit continuation button within the confirmed prompt.
 * Traverses Web Component shadow boundaries.
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
