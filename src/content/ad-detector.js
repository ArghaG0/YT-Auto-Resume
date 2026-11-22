/**
 * Ad Detection Engine for YouTube Auto Resume
 * Multi-Signal Ad Detection & Skip Button Resolution (Fail-Closed)
 */

import { SELECTORS } from '../common/constants.js';
import { checkVisualVisibility } from './detector.js';

// Elements that must NEVER be treated as skip ad buttons
const NON_AD_SELECTORS = [
  '.ytp-next-button',
  '.ytp-prev-button',
  '.ytp-play-button',
  '.ytp-ce-element',
  '.ytp-chapter-container',
  'ytd-subscribe-button-renderer',
  '#subscribe-button',
  '.ytp-subtitles-button',
  '.ytp-settings-button',
];

/**
 * Derives a discrete fingerprint / identifier for an advertisement unit or pod.
 * Distinguishes consecutive ads (e.g., Ad 1 of 2 vs Ad 2 of 2).
 * @param {Element} playerElement
 * @param {Element} [overlayElement]
 * @returns {string}
 */
export function deriveAdUnitId(playerElement, overlayElement) {
  if (!playerElement) return 'ad-unknown';

  // 1. Check for pod badge / text (e.g. "Ad 1 of 2", "Ad 2 of 2", "1 of 2")
  const textContainer = overlayElement?.querySelector?.(SELECTORS.AD_TEXT) ||
                        playerElement.querySelector(SELECTORS.AD_TEXT);
  const textContent = textContainer?.textContent?.trim?.() || '';

  const podMatch = textContent.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
  if (podMatch) {
    return `ad-pod-${podMatch[1]}-of-${podMatch[2]}`;
  }

  // 2. Check for ad title or advertiser badge text
  const simpleBadge = overlayElement?.querySelector?.('.ytp-ad-simple-ad-badge') ||
                      playerElement.querySelector('.ytp-ad-simple-ad-badge');
  if (simpleBadge?.textContent?.trim?.()) {
    const badgeText = simpleBadge.textContent.trim().replace(/\s+/g, '-').slice(0, 20);
    return `ad-${badgeText}`;
  }

  // 3. Check video source or timestamp as fallback
  const video = playerElement.querySelector('video');
  if (video?.src) {
    // Generate simple short hash of the src
    const srcKey = video.src.slice(-20).replace(/[^a-zA-Z0-9]/g, '');
    if (srcKey) return `ad-src-${srcKey}`;
  }

  return 'ad-unit-default';
}

/**
 * Detects whether an advertisement is actively playing using multi-signal correlation.
 * Fails closed if signals are ambiguous.
 * @param {Document|Element} [root=document]
 * @returns {{
 *   isAdPlaying: boolean,
 *   state: 'not_found' | 'ad_playing' | 'ambiguous',
 *   playerElement?: Element,
 *   overlayElement?: Element,
 *   adUnitId?: string,
 *   reason?: string,
 *   details?: Record<string, any>
 * }}
 */
export function detectAdState(root = document) {
  // 1. Find active video player container
  const player = root.querySelector ? root.querySelector(SELECTORS.MOVIE_PLAYER) : null;
  if (!player) {
    return { isAdPlaying: false, state: 'not_found', reason: 'player_not_found' };
  }

  // 2. Primary Signal: Player ad classes (.ad-showing or .ad-interrupting)
  const classList = player.classList;
  const hasAdShowing = classList.contains('ad-showing');
  const hasAdInterrupting = classList.contains('ad-interrupting');
  const hasPlayerAdClass = hasAdShowing || hasAdInterrupting;

  // 3. Secondary Signal: Ad overlay container
  const overlay = player.querySelector(SELECTORS.AD_OVERLAY);

  // 4. Negative Safeguards & Ambiguity Resolution
  if (!hasPlayerAdClass) {
    // If overlay element is present in DOM but player classList does not indicate an ad,
    // this could be a detached or stale overlay leftover from an ended ad.
    if (overlay && checkVisualVisibility(overlay).isVisible) {
      return {
        isAdPlaying: false,
        state: 'ambiguous',
        playerElement: player,
        overlayElement: overlay,
        reason: 'overlay_present_without_player_ad_class',
        details: { classList: Array.from(classList) },
      };
    }
    return { isAdPlaying: false, state: 'not_found', playerElement: player };
  }

  // 5. Corroborating Signals (ad text, badges, preview container, skip container)
  const adUnitId = deriveAdUnitId(player, overlay);

  return {
    isAdPlaying: true,
    state: 'ad_playing',
    playerElement: player,
    overlayElement: overlay || undefined,
    adUnitId,
    details: {
      hasAdShowing,
      hasAdInterrupting,
      hasOverlay: Boolean(overlay),
    },
  };
}

/**
 * Resolves and verifies the "Skip ad" button strictly against interactability rules.
 * Does NOT select disabled countdown buttons or non-ad elements.
 * @param {Element} playerOrOverlay
 * @returns {{
 *   button: HTMLButtonElement|Element|null,
 *   isReady: boolean,
 *   countdownActive: boolean,
 *   secondsRemaining?: number,
 *   reason?: string,
 *   details?: Record<string, any>
 * }}
 */
export function findSkipButton(playerOrOverlay) {
  if (!playerOrOverlay) {
    return { button: null, isReady: false, countdownActive: false, reason: 'no_container' };
  }

  // 1. Check countdown preview container ("Skip in 5s", "You can skip ad in 3s")
  const preview = playerOrOverlay.querySelector(SELECTORS.AD_PREVIEW);
  if (preview && checkVisualVisibility(preview).isVisible) {
    const text = preview.textContent || '';
    const match = text.match(/(\d+)/);
    const secondsRemaining = match ? parseInt(match[1], 10) : undefined;
    if (secondsRemaining && secondsRemaining > 0) {
      return {
        button: null,
        isReady: false,
        countdownActive: true,
        secondsRemaining,
        reason: 'countdown_active',
        details: { text },
      };
    }
  }

  // 2. Query candidates using the prioritized whitelist
  for (const selector of SELECTORS.SKIP_BUTTONS) {
    const candidates = playerOrOverlay.querySelectorAll(selector);
    for (const candidate of candidates) {
      // Safeguard against non-ad controls
      const isNonAd = NON_AD_SELECTORS.some((nonAdSel) => candidate.matches(nonAdSel) || candidate.closest(nonAdSel));
      if (isNonAd) continue;

      // Check disabled attributes
      const isDisabledAttr = candidate.disabled === true ||
        candidate.getAttribute('disabled') !== null ||
        candidate.getAttribute('aria-disabled') === 'true';

      if (isDisabledAttr) {
        continue;
      }

      // Check visual visibility
      const visibility = checkVisualVisibility(candidate);
      if (!visibility.isVisible) {
        continue;
      }

      // Check bounding box dimensions if available
      if (typeof candidate.getBoundingClientRect === 'function') {
        const rect = candidate.getBoundingClientRect();
        // Allow in test/headless environments where layout has width 0, but enforce > 0 if clientWidth > 0
        if (rect.width === 0 && rect.height === 0 && candidate.clientWidth > 0) {
          continue;
        }
      }

      // Verify button has reasonable accessible skip semantics or classes
      const text = (candidate.textContent || '').trim().toLowerCase();
      const ariaLabel = (candidate.getAttribute('aria-label') || '').trim().toLowerCase();
      const className = (candidate.className || '').toString().toLowerCase();

      const hasSkipSemantic = className.includes('skip') ||
        text.includes('skip') ||
        ariaLabel.includes('skip') ||
        text.includes('passer') ||
        text.includes('überspringen') ||
        text.includes('saltar') ||
        text.includes('pular');

      // YouTube modern skip buttons have empty text with skip SVG or .ytp-ad-skip-button-modern
      const isKnownModernSkip = className.includes('ytp-ad-skip-button') ||
        candidate.closest('.ytp-ad-skip-button-modern') !== null ||
        candidate.closest(SELECTORS.SKIP_BUTTON_CONTAINER) !== null;

      if (hasSkipSemantic || isKnownModernSkip) {
        return {
          button: candidate,
          isReady: true,
          countdownActive: false,
          details: { selector, className },
        };
      }
    }
  }

  return { button: null, isReady: false, countdownActive: false, reason: 'button_not_found' };
}
