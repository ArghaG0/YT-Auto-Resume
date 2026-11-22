/**
 * Constants, Selectors, and Configuration for YouTube Auto Resume
 */

export const SELECTORS = {
  POPUP_CONTAINER: 'ytd-popup-container',
  PAPER_DIALOG: 'tp-yt-paper-dialog',
  CONFIRM_DIALOG_RENDERER: 'yt-confirm-dialog-renderer',
  CONFIRM_BUTTON: '#confirm-button',
  BUTTON_RENDERER: 'yt-button-renderer',
  NATIVE_BUTTON: 'button',
  TITLE: '#dialog-header h2, .title, #title',
  CONTAINER_FALLBACK: 'body',

  // Ad Control Selectors
  MOVIE_PLAYER: '#movie_player, .html5-video-player',
  AD_OVERLAY: '.ytp-ad-player-overlay, .ytp-ad-module',
  AD_TEXT: '.ytp-ad-text',
  AD_PREVIEW: '.ytp-ad-preview-container',
  SKIP_BUTTON_CONTAINER: '.ytp-ad-skip-button-container',
  SKIP_BUTTONS: [
    '.ytp-ad-skip-button-modern button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-container button',
    'button.ytp-ad-skip-button',
    'button.ytp-ad-skip-button-text',
  ],
};

export const DEFAULT_SETTINGS = {
  enabled: false,
  autoResumeEnabled: true,
  adControlEnabled: true,
  autoClickSkip: true,
  youtubeEnabled: true,
  youtubeMusicEnabled: false,
  diagnosticsEnabled: false,
};

export const STORAGE_KEYS = {
  SETTINGS: 'yt_auto_resume_settings',
  DIAGNOSTICS: 'yt_auto_resume_diagnostics',
};

export const DIAGNOSTIC_EVENTS = {
  // Lifecycle & Configuration
  CONTENT_SCRIPT_INITIALIZED: 'content_script_initialized',
  SETTINGS_UPDATED: 'settings_updated',
  NAVIGATION_RESET: 'navigation_reset',
  WINDOW_OCCLUDED: 'window_occluded',
  WINDOW_RESTORED: 'window_restored',

  // DOM Observation & Container Health
  CONTAINER_BOOTSTRAP_WATCHING: 'container_bootstrap_watching',
  CONTAINER_OBSERVED: 'container_observed',
  CONTAINER_DISCONNECTED: 'container_disconnected',
  CONTAINER_RECONNECTED: 'container_reconnected',

  // Debouncing & Throttling
  DEBOUNCE_MAX_WAIT_TRIGGERED: 'debounce_max_wait_triggered',

  // Detection & Gating (Inactivity)
  PROMPT_DETECTED: 'prompt_detected',
  PROMPT_CANDIDATE_NOT_VISIBLE: 'prompt_candidate_not_visible',
  PROMPT_ALREADY_HANDLED: 'prompt_already_handled',
  AMBIGUOUS_PROMPT_IGNORED: 'ambiguous_prompt_ignored',
  COOLDOWN_THROTTLED: 'cooldown_throttled',
  EVALUATION_SKIPPED_DISABLED: 'evaluation_skipped_disabled',

  // Button Resolution & Action (Inactivity)
  BUTTON_RESOLVED_SHADOW: 'button_resolved_shadow',
  BUTTON_NOT_FOUND: 'button_not_found',
  CONTINUE_CLICKED: 'continue_clicked',
  CLICK_DISPATCH_FAILED: 'click_dispatch_failed',

  // Playback Verification & Retries (Inactivity)
  PLAYBACK_VERIFIED: 'playback_verified',
  PLAYBACK_VERIFY_FAILED: 'playback_verify_failed',
  RETRY_ATTEMPTED: 'retry_attempted',
  RETRY_EXHAUSTED: 'retry_exhausted',
  ACTION_EXECUTION_ERROR: 'action_execution_error',

  // Ad Control Lifecycle & Detection
  AD_DETECTED: 'ad_detected',
  AD_ENDED: 'ad_ended',
  AD_SKIP_COUNTDOWN_ACTIVE: 'ad_skip_countdown_active',
  AD_SKIP_BUTTON_FOUND: 'ad_skip_button_found',
  AD_SKIP_BUTTON_NOT_READY: 'ad_skip_button_not_ready',
  AD_SKIP_CLICKED: 'ad_skip_clicked',
  AD_SKIP_VERIFIED: 'ad_skip_verified',
  AD_SKIP_VERIFY_FAILED: 'ad_skip_verify_failed',
  AD_AMBIGUOUS_STATE_IGNORED: 'ad_ambiguous_state_ignored',
  AD_DEDUPLICATION_THROTTLED: 'ad_deduplication_throttled',
};

export const LIMITS = {
  MAX_DIAGNOSTICS_ENTRIES: 50,
  COOLDOWN_MS: 3000,
  DEBOUNCE_MS: 50,
  MAX_DEBOUNCE_WAIT_MS: 200,
  VERIFICATION_TIMEOUT_MS: 1500,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  SHADOW_MAX_DEPTH: 4,

  // Ad Control Limits
  AD_DEBOUNCE_MS: 100,
  AD_VERIFICATION_INITIAL_DELAY_MS: 500,
  AD_VERIFICATION_MAX_TIMEOUT_MS: 1500,
  AD_MAX_SKIP_RETRIES: 1,
};
