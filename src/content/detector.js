/**
 * Inactivity Prompt Detection Engine (i18n Resilient)
 */

import { SELECTORS } from '../common/constants.js';

// Negative keywords indicating destructive or subscription dialogs that must NOT be auto-clicked
const AMBIGUOUS_KEYWORDS = [
  'unsubscribe', 'désabonner', 'abbestellen', 'cancelar suscripción',
  'cancelar inscrição', 'annulla iscrizione', 'отписаться', '登録解除',
  '구독 취소', 'सदस्यता छोड़ें', 'delete', 'supprimer', 'löschen', 'eliminar',
  'excluir', 'elimina', 'удалить', '削除', '삭제', 'हटाएं'
];

/**
 * Checks if a DOM element is currently visible.
 * @param {Element} element
 * @returns {boolean}
 */
export function isElementVisible(element) {
  if (!element || !element.isConnected) {
    return false;
  }

  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  // Check inline styles
  if (element.style && (element.style.display === 'none' || element.style.visibility === 'hidden')) {
    return false;
  }

  // Check computed styles if available
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const computed = window.getComputedStyle(element);
    if (computed.display === 'none' || computed.visibility === 'hidden') {
      return false;
    }
  }

  return true;
}

/**
 * Detects whether a supported YouTube inactivity prompt is active in the container.
 * @param {Element|Document} container
 * @returns {{ status: 'confirmed' | 'not_found' | 'ambiguous', promptElement?: Element }}
 */
export function detectInactivityPrompt(container) {
  if (!container) {
    return { status: 'not_found' };
  }

  // Locate the confirm dialog renderer
  const confirmRenderer = container.querySelector(SELECTORS.CONFIRM_DIALOG_RENDERER);
  if (!confirmRenderer) {
    return { status: 'not_found' };
  }

  // Check visibility of the parent dialog or renderer
  const parentDialog = confirmRenderer.closest(SELECTORS.PAPER_DIALOG) || confirmRenderer;
  if (!isElementVisible(parentDialog)) {
    return { status: 'not_found' };
  }

  // Check for presence of confirm button
  const confirmBtn = confirmRenderer.querySelector(SELECTORS.CONFIRM_BUTTON);
  if (!confirmBtn || !isElementVisible(confirmBtn)) {
    return { status: 'not_found' };
  }

  // Inspect dialog text for ambiguous/destructive actions
  const dialogText = (confirmRenderer.textContent || '').toLowerCase();
  for (const keyword of AMBIGUOUS_KEYWORDS) {
    if (dialogText.includes(keyword)) {
      return { status: 'ambiguous', promptElement: confirmRenderer };
    }
  }

  // Confirmed inactivity prompt
  return { status: 'confirmed', promptElement: confirmRenderer };
}
