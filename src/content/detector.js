/**
 * Inactivity Prompt Detection Engine (i18n Resilient & Fail-Closed)
 */

import { SELECTORS } from '../common/constants.js';

// Negative/rejected keywords indicating destructive, subscription, navigation, error, or skip dialogs
const REJECTED_KEYWORDS = [
  // Subscriptions & Deletions
  'unsubscribe', 'désabonner', 'abbestellen', 'cancelar suscripción',
  'cancelar inscrição', 'annulla iscrizione', 'отписаться', '登録解除',
  '구독 취소', 'सदस्यता छोड़ें', 'delete', 'supprimer', 'löschen', 'eliminar',
  'excluir', 'elimina', 'удалить', '削除', '삭제', 'हटाएं',

  // Skip & Next Video Navigation
  'skip', 'next video', 'next track', 'up next', 'play next',
  'nächste', 'nächstes', 'siguiente', 'suivant', 'prossimo',
  'следующее', '次', '다음', 'अगला',

  // Playback Errors & Video Unavailable
  'playback error', 'error occurred', 'video unavailable',
  'unavailable in your region', 'failed to load', 'an error',
  'une erreur', 'ein fehler', 'ошибка', 'エラー', '오류',

  // Playlist & Queue Alterations
  'queue', 'playlist', 'clear queue', 'replace queue', 'replace playlist', 'clear playlist',
  'remove from playlist', 'save playlist', 'warteschlange', 'file d\'attente',

  // Feedback & Reporting
  'report', 'feedback', 'survey',
];

// Positive keywords indicating explicit inactivity prompts across supported languages
const INACTIVITY_KEYWORDS = [
  // English
  'video paused', 'paused', 'continue watching', 'still watching',
  // Spanish
  'video pausado', 'pausado', 'seguir viendo', 'continúa viendo',
  // German
  'video pausiert', 'pausiert', 'weitersehen',
  // Japanese
  '動画が一時停止', '一時停止', '続きを視聴',
  // French
  'vidéo mise en pause', 'mise en pause', 'continuer à regarder', 'continuer a regarder',
  // Hindi
  'वीडियो रोक दिया', 'रोक दिया गया', 'देखना जारी',
  // Italian
  'video è stato messo in pausa', 'messo in pausa', 'continuare a guardare',
  // Portuguese
  'vídeo pausado', 'pausado', 'continuar assistindo',
  // Russian
  'видео приостановлено', 'приостановлено', 'продолжить просмотр',
  // Korean
  '동영상이 일시중지', '일시중지', '이어서 시청',
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
 * Strictly verifies positive inactivity semantics and rejects uncertain, error, skip, or unrelated dialogs.
 * @param {Element|Document} container
 * @returns {{ status: 'confirmed' | 'not_found' | 'ambiguous', promptElement?: Element, textSnippet?: string, reason?: string }}
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

  // Extract full dialog text snippet for evaluation & diagnostics
  const dialogText = (confirmRenderer.textContent || '').toLowerCase().trim();
  const textSnippet = dialogText.slice(0, 120);

  // 1. Negative Check: Reject if dialog matches destructive, skip, error, or playlist keywords
  for (const keyword of REJECTED_KEYWORDS) {
    if (dialogText.includes(keyword)) {
      return {
        status: 'ambiguous',
        promptElement: confirmRenderer,
        reason: `rejected_keyword:${keyword}`,
        textSnippet,
      };
    }
  }

  // 2. Positive Check: Ensure dialog contains explicit inactivity/paused/continue cues
  const hasInactivityCue = INACTIVITY_KEYWORDS.some((keyword) => dialogText.includes(keyword));
  if (!hasInactivityCue) {
    return {
      status: 'ambiguous',
      promptElement: confirmRenderer,
      reason: 'lacks_inactivity_cues',
      textSnippet,
    };
  }

  // Confirmed authentic inactivity prompt
  return {
    status: 'confirmed',
    promptElement: confirmRenderer,
    textSnippet,
  };
}
