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
 * Validates actual DOM visual rendering separated from accessibility-tree attributes.
 * Evaluates connection state, inline styles, computed styles, opacity, bounding box,
 * and relevant ancestor visibility. Does NOT disqualify elements solely due to aria-hidden.
 * @param {Element} element
 * @returns {{ isVisible: boolean, reason?: string, details?: Record<string, any> }}
 */
export function checkVisualVisibility(element) {
  if (!element || !element.isConnected) {
    return { isVisible: false, reason: 'not_connected' };
  }

  // 1. Ancestor & self inline style validation
  let current = element;
  while (current && current.nodeType === 1) { // Node.ELEMENT_NODE
    if (current.style) {
      if (current.style.display === 'none') {
        return {
          isVisible: false,
          reason: current === element ? 'inline_display_none' : 'ancestor_inline_display_none',
          details: { target: current.tagName?.toLowerCase() },
        };
      }
      if (current.style.visibility === 'hidden' || current.style.visibility === 'collapse') {
        return {
          isVisible: false,
          reason: current === element ? 'inline_visibility_hidden' : 'ancestor_inline_visibility_hidden',
          details: { target: current.tagName?.toLowerCase() },
        };
      }
    }
    current = current.parentElement;
  }

  // 2. Computed style validation (display, visibility, opacity)
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const computed = window.getComputedStyle(element);
    if (computed.display === 'none') {
      return { isVisible: false, reason: 'computed_display_none' };
    }
    if (computed.visibility === 'hidden' || computed.visibility === 'collapse') {
      return { isVisible: false, reason: 'computed_visibility_hidden' };
    }
    const opacity = parseFloat(computed.opacity);
    if (!Number.isNaN(opacity) && opacity === 0) {
      return { isVisible: false, reason: 'opacity_zero' };
    }

    // Inspect relevant ancestors up to document root
    let ancestor = element.parentElement;
    while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
      const ancestorComputed = window.getComputedStyle(ancestor);
      if (ancestorComputed.display === 'none') {
        return {
          isVisible: false,
          reason: 'ancestor_computed_display_none',
          details: { ancestor: ancestor.tagName?.toLowerCase() },
        };
      }
      if (ancestorComputed.visibility === 'hidden' || ancestorComputed.visibility === 'collapse') {
        return {
          isVisible: false,
          reason: 'ancestor_computed_visibility_hidden',
          details: { ancestor: ancestor.tagName?.toLowerCase() },
        };
      }
      const ancestorOpacity = parseFloat(ancestorComputed.opacity);
      if (!Number.isNaN(ancestorOpacity) && ancestorOpacity === 0) {
        return {
          isVisible: false,
          reason: 'ancestor_opacity_zero',
          details: { ancestor: ancestor.tagName?.toLowerCase() },
        };
      }
      ancestor = ancestor.parentElement;
    }
  }

  // 3. Bounding rectangle validation (when layout engine is active or simulated)
  if (typeof element.getBoundingClientRect === 'function') {
    const rect = element.getBoundingClientRect();
    const hasLayoutEngine = typeof document !== 'undefined' && (
      (document.body && (document.body.getBoundingClientRect?.().width > 0 || document.body.clientWidth > 0)) ||
      (document.documentElement && (document.documentElement.getBoundingClientRect?.().width > 0 || document.documentElement.clientWidth > 0))
    );

    if (hasLayoutEngine && rect.width === 0 && rect.height === 0) {
      return {
        isVisible: false,
        reason: 'zero_bounding_rect',
        details: { width: rect.width, height: rect.height },
      };
    }
  }

  return { isVisible: true };
}

/**
 * Checks if a DOM element is visually rendered on screen.
 * @param {Element} element
 * @returns {boolean}
 */
export function isElementVisible(element) {
  return checkVisualVisibility(element).isVisible;
}

/**
 * Detects whether a supported YouTube inactivity prompt is active in the container.
 * Strictly verifies positive inactivity semantics and rejects uncertain, error, skip, or unrelated dialogs.
 * Does not classify dialogs as hidden solely due to aria-hidden="true".
 * @param {Element|Document} container
 * @returns {{ status: 'confirmed' | 'not_found' | 'candidate_not_visible' | 'ambiguous', promptElement?: Element, textSnippet?: string, reason?: string, details?: Record<string, any> }}
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

  // Extract full dialog text snippet for evaluation & diagnostics
  const dialogText = (confirmRenderer.textContent || '').toLowerCase().trim();
  const textSnippet = dialogText.slice(0, 120);

  // Check visual visibility of the parent dialog or renderer
  const parentDialog = confirmRenderer.closest(SELECTORS.PAPER_DIALOG) || confirmRenderer;
  const parentVisibility = checkVisualVisibility(parentDialog);

  if (!parentVisibility.isVisible) {
    const computed = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(parentDialog) : null;
    const rect = typeof parentDialog.getBoundingClientRect === 'function' ? parentDialog.getBoundingClientRect() : null;

    return {
      status: 'candidate_not_visible',
      promptElement: confirmRenderer,
      reason: parentVisibility.reason || 'parent_dialog_not_visible',
      details: {
        rejectionTarget: 'parent_dialog',
        parentTag: parentDialog.tagName?.toLowerCase(),
        ariaHidden: parentDialog.getAttribute('aria-hidden'),
        styleDisplay: parentDialog.style?.display || null,
        styleVisibility: parentDialog.style?.visibility || null,
        computedDisplay: computed?.display || null,
        computedVisibility: computed?.visibility || null,
        computedOpacity: computed?.opacity || null,
        isConnected: parentDialog.isConnected,
        rect: rect ? { width: rect.width, height: rect.height } : null,
        ...(parentVisibility.details || {}),
      },
      textSnippet,
    };
  }

  // Check for presence and visibility of confirm button
  const confirmBtn = confirmRenderer.querySelector(SELECTORS.CONFIRM_BUTTON);
  if (!confirmBtn) {
    return {
      status: 'candidate_not_visible',
      promptElement: confirmRenderer,
      reason: 'confirm_button_missing',
      details: {
        rejectionTarget: 'confirm_button',
        confirmRendererTag: confirmRenderer.tagName?.toLowerCase(),
        ariaHidden: confirmRenderer.getAttribute('aria-hidden'),
        isConnected: confirmRenderer.isConnected,
      },
      textSnippet,
    };
  }

  const btnVisibility = checkVisualVisibility(confirmBtn);
  if (!btnVisibility.isVisible) {
    const computedBtn = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(confirmBtn) : null;
    const rectBtn = typeof confirmBtn.getBoundingClientRect === 'function' ? confirmBtn.getBoundingClientRect() : null;

    return {
      status: 'candidate_not_visible',
      promptElement: confirmRenderer,
      reason: btnVisibility.reason || 'confirm_button_not_visible',
      details: {
        rejectionTarget: 'confirm_button',
        buttonTag: confirmBtn.tagName?.toLowerCase(),
        ariaHidden: confirmBtn.getAttribute('aria-hidden'),
        styleDisplay: confirmBtn.style?.display || null,
        styleVisibility: confirmBtn.style?.visibility || null,
        computedDisplay: computedBtn?.display || null,
        computedVisibility: computedBtn?.visibility || null,
        computedOpacity: computedBtn?.opacity || null,
        isConnected: confirmBtn.isConnected,
        rect: rectBtn ? { width: rectBtn.width, height: rectBtn.height } : null,
        ...(btnVisibility.details || {}),
      },
      textSnippet,
    };
  }

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
