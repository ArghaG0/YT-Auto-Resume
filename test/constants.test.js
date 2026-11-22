import { describe, it, expect } from 'vitest';
import { SELECTORS, DEFAULT_SETTINGS, STORAGE_KEYS, DIAGNOSTIC_EVENTS, LIMITS } from '../src/common/constants.js';

describe('constants.js - Configuration & 100% Observability Event Schema', () => {
  it('defines valid DOM selectors for YouTube elements', () => {
    expect(SELECTORS.POPUP_CONTAINER).toBe('ytd-popup-container');
    expect(SELECTORS.CONFIRM_DIALOG_RENDERER).toBe('yt-confirm-dialog-renderer');
    expect(SELECTORS.CONFIRM_BUTTON).toBe('#confirm-button');
    expect(SELECTORS.NATIVE_BUTTON).toBe('button');
    expect(SELECTORS.MOVIE_PLAYER).toContain('#movie_player');
    expect(SELECTORS.AD_OVERLAY).toContain('.ytp-ad-player-overlay');
    expect(Array.isArray(SELECTORS.SKIP_BUTTONS)).toBe(true);
    expect(SELECTORS.SKIP_BUTTONS.length).toBeGreaterThan(0);
  });

  it('defines correct default settings schema', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      enabled: false,
      autoResumeEnabled: true,
      adControlEnabled: true,
      autoClickSkip: true,
      youtubeEnabled: true,
      youtubeMusicEnabled: false,
      diagnosticsEnabled: false,
    });
  });

  it('defines valid storage keys', () => {
    expect(STORAGE_KEYS.SETTINGS).toBe('yt_auto_resume_settings');
    expect(STORAGE_KEYS.DIAGNOSTICS).toBe('yt_auto_resume_diagnostics');
  });

  it('contains complete 100% observability diagnostic event constants across all stages', () => {
    const requiredEvents = [
      // Lifecycle
      'content_script_initialized',
      'settings_updated',
      'navigation_reset',
      'window_occluded',
      'window_restored',
      // Container
      'container_bootstrap_watching',
      'container_observed',
      'container_disconnected',
      'container_reconnected',
      // Debounce
      'debounce_max_wait_triggered',
      // Detection & Gating
      'prompt_detected',
      'prompt_candidate_not_visible',
      'prompt_already_handled',
      'ambiguous_prompt_ignored',
      'cooldown_throttled',
      'evaluation_skipped_disabled',
      // Button
      'button_resolved_shadow',
      'button_not_found',
      // Click
      'continue_clicked',
      'click_dispatch_failed',
      // Verification & Retries
      'playback_verified',
      'playback_verify_failed',
      'retry_attempted',
      'retry_exhausted',
      'action_execution_error',
      // Ad Control Lifecycle & Detection
      'ad_detected',
      'ad_ended',
      'ad_skip_countdown_active',
      'ad_skip_button_found',
      'ad_skip_button_not_ready',
      'ad_skip_clicked',
      'ad_skip_verified',
      'ad_skip_verify_failed',
      'ad_ambiguous_state_ignored',
      'ad_deduplication_throttled',
    ];

    for (const evt of requiredEvents) {
      expect(Object.values(DIAGNOSTIC_EVENTS)).toContain(evt);
    }
  });

  it('defines robust timing limits for debounce, verification, and retries', () => {
    expect(LIMITS.MAX_DIAGNOSTICS_ENTRIES).toBe(50);
    expect(LIMITS.DEBOUNCE_MS).toBe(50);
    expect(LIMITS.MAX_DEBOUNCE_WAIT_MS).toBe(200);
    expect(LIMITS.VERIFICATION_TIMEOUT_MS).toBe(1500);
    expect(LIMITS.MAX_RETRIES).toBe(3);
    expect(LIMITS.RETRY_DELAY_MS).toBe(1000);
    expect(LIMITS.SHADOW_MAX_DEPTH).toBe(4);
    expect(LIMITS.AD_DEBOUNCE_MS).toBe(100);
    expect(LIMITS.AD_VERIFICATION_INITIAL_DELAY_MS).toBe(500);
    expect(LIMITS.AD_VERIFICATION_MAX_TIMEOUT_MS).toBe(1500);
    expect(LIMITS.AD_MAX_SKIP_RETRIES).toBe(1);
  });
});
