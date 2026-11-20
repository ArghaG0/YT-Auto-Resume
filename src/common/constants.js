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
};

export const DEFAULT_SETTINGS = {
  enabled: false,
  youtubeEnabled: true,
  youtubeMusicEnabled: false,
  diagnosticsEnabled: false,
};

export const STORAGE_KEYS = {
  SETTINGS: 'yt_auto_resume_settings',
  DIAGNOSTICS: 'yt_auto_resume_diagnostics',
};

export const DIAGNOSTIC_EVENTS = {
  PROMPT_DETECTED: 'prompt_detected',
  CONTINUE_CLICKED: 'continue_clicked',
  AMBIGUOUS_PROMPT_IGNORED: 'ambiguous_prompt_ignored',
  COOLDOWN_THROTTLED: 'cooldown_throttled',
  USER_PAUSE_IGNORED: 'user_pause_ignored',
};

export const LIMITS = {
  MAX_DIAGNOSTICS_ENTRIES: 50,
  COOLDOWN_MS: 3000,
  DEBOUNCE_MS: 50,
};
