import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YouTubeAutoResumeCoordinator } from '../src/content/content.js';
import { getDiagnosticLogs } from '../src/common/logger.js';
import { LIMITS } from '../src/common/constants.js';

describe('minimized-resilience.test.js - Minimized Window & Verification Suite', () => {
  let coordinator;
  let mockStorage = {};
  let storageListeners = [];

  beforeEach(() => {
    storageListeners = [];
    mockStorage = {
      yt_auto_resume_settings: {
        enabled: true,
        youtubeEnabled: true,
        youtubeMusicEnabled: false,
        diagnosticsEnabled: true,
      },
      yt_auto_resume_diagnostics: [],
    };

    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async (keys) => {
            if (typeof keys === 'string') return { [keys]: mockStorage[keys] };
            return { ...mockStorage };
          }),
          set: vi.fn(async (items) => {
            Object.assign(mockStorage, items);
          }),
        },
        onChanged: {
          addListener: vi.fn((fn) => storageListeners.push(fn)),
          removeListener: vi.fn(),
        },
      },
    };

    document.body.innerHTML = '';
    coordinator = new YouTubeAutoResumeCoordinator();
  });

  afterEach(() => {
    coordinator.destroy();
    vi.restoreAllMocks();
  });

  function createMockPromptDialog(onBtnClick) {
    const dialog = document.createElement('tp-yt-paper-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.style.display = 'block';

    const renderer = document.createElement('yt-confirm-dialog-renderer');
    const header = document.createElement('div');
    header.innerHTML = '<h2>Video paused. Continue watching?</h2>';

    const btnContainer = document.createElement('div');
    btnContainer.id = 'confirm-button';

    const btn = document.createElement('button');
    btn.textContent = 'Yes';
    if (onBtnClick) {
      btn.addEventListener('click', onBtnClick);
    }

    btnContainer.appendChild(btn);
    renderer.appendChild(header);
    renderer.appendChild(btnContainer);
    dialog.appendChild(renderer);

    return dialog;
  }

  it('verifies playback resumption when video element resumes playing', async () => {
    const popupContainer = document.createElement('ytd-popup-container');
    document.body.appendChild(popupContainer);

    // Create mock video element in paused state
    const video = document.createElement('video');
    Object.defineProperty(video, 'paused', { value: true, writable: true });
    Object.defineProperty(video, 'readyState', { value: 4, writable: true });
    document.body.appendChild(video);

    await coordinator.init();

    // When button is clicked, simulate YouTube resuming the video
    const dialog = createMockPromptDialog(() => {
      video.paused = false;
      video.dispatchEvent(new Event('playing'));
    });

    popupContainer.appendChild(dialog);

    // Wait for bounded debounce + verification
    await new Promise((resolve) => setTimeout(resolve, 80));

    const logs = await getDiagnosticLogs();
    const eventNames = logs.map((l) => l.event);

    expect(eventNames).toContain('prompt_detected');
    expect(eventNames).toContain('continue_clicked');
    expect(eventNames).toContain('playback_verified');
    expect(coordinator.deduplicator.canAct(dialog.querySelector('yt-confirm-dialog-renderer'))).toBe(false);
  });

  it('unmarks prompt and attempts retries when video fails to resume', async () => {
    // Shorten verification and retry timeouts for fast test execution
    const origVerify = LIMITS.VERIFICATION_TIMEOUT_MS;
    const origDelay = LIMITS.RETRY_DELAY_MS;
    LIMITS.VERIFICATION_TIMEOUT_MS = 60;
    LIMITS.RETRY_DELAY_MS = 40;

    try {
      const popupContainer = document.createElement('ytd-popup-container');
      document.body.appendChild(popupContainer);

      // Video remains paused
      const video = document.createElement('video');
      Object.defineProperty(video, 'paused', { value: true, writable: true });
      document.body.appendChild(video);

      await coordinator.init();

      let clickAttempts = 0;
      const dialog = createMockPromptDialog(() => {
        clickAttempts++;
      });

      popupContainer.appendChild(dialog);

      // Wait enough time for 3 attempts (each: 60ms verify + 40ms delay = ~350ms total)
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(clickAttempts).toBe(3);

      const logs = await getDiagnosticLogs();
      const eventNames = logs.map((l) => l.event);

      expect(eventNames).toContain('retry_attempted');
      expect(eventNames).toContain('playback_verify_failed');
      expect(eventNames).toContain('retry_exhausted');

      // Crucial: deduplicator unmarks prompt on exhaustion so subsequent DOM changes can retry
      const renderer = dialog.querySelector('yt-confirm-dialog-renderer');
      expect(renderer.hasAttribute('data-auto-resume-handled')).toBe(false);
    } finally {
      LIMITS.VERIFICATION_TIMEOUT_MS = origVerify;
      LIMITS.RETRY_DELAY_MS = origDelay;
    }
  });

  it('recovers from transient failure when video resumes on second retry attempt', async () => {
    const origVerify = LIMITS.VERIFICATION_TIMEOUT_MS;
    const origDelay = LIMITS.RETRY_DELAY_MS;
    LIMITS.VERIFICATION_TIMEOUT_MS = 50;
    LIMITS.RETRY_DELAY_MS = 30;

    try {
      const popupContainer = document.createElement('ytd-popup-container');
      document.body.appendChild(popupContainer);

      const video = document.createElement('video');
      Object.defineProperty(video, 'paused', { value: true, writable: true });
      document.body.appendChild(video);

      await coordinator.init();

      let clickCount = 0;
      const dialog = createMockPromptDialog(() => {
        clickCount++;
        if (clickCount === 2) {
          // On second attempt, YouTube resumes playback
          video.paused = false;
          video.dispatchEvent(new Event('playing'));
        }
      });

      popupContainer.appendChild(dialog);

      // Wait for 1st attempt failure + 2nd attempt success
      await new Promise((resolve) => setTimeout(resolve, 180));

      expect(clickCount).toBe(2);

      const logs = await getDiagnosticLogs();
      const eventNames = logs.map((l) => l.event);

      expect(eventNames).toContain('retry_attempted');
      expect(eventNames).toContain('playback_verified');
      expect(eventNames).not.toContain('retry_exhausted');
    } finally {
      LIMITS.VERIFICATION_TIMEOUT_MS = origVerify;
      LIMITS.RETRY_DELAY_MS = origDelay;
    }
  });

  it('flushes immediately on dialog injection to bypass background timer clamping', async () => {
    const popupContainer = document.createElement('ytd-popup-container');
    document.body.appendChild(popupContainer);

    await coordinator.init();

    let clicked = false;
    const dialog = createMockPromptDialog(() => {
      clicked = true;
    });

    popupContainer.appendChild(dialog);

    // Directly call handleMutations simulating a MutationRecord with addedNodes containing the dialog
    coordinator.handleMutations(popupContainer, [
      {
        type: 'childList',
        addedNodes: [dialog],
      },
    ]);

    // Wait a brief tick for async evaluatePrompt to finish
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(clicked).toBe(true);
  });

  it('tracks container disconnection and re-bootstraps observer when container is detached', async () => {
    const popupContainer = document.createElement('ytd-popup-container');
    document.body.appendChild(popupContainer);

    await coordinator.init();
    expect(coordinator.scopedObserver).not.toBeNull();

    // Detach container from DOM (simulating YouTube SPA route transition)
    popupContainer.remove();

    // Trigger health check
    const isHealthy = coordinator.checkContainerHealth(popupContainer);
    expect(isHealthy).toBe(false);

    // Wait for async logDiagnosticEvent to resolve
    await new Promise((resolve) => setTimeout(resolve, 20));

    const logs = await getDiagnosticLogs();
    const eventNames = logs.map((l) => l.event);
    expect(eventNames).toContain('container_disconnected');
    expect(coordinator.bootstrapObserver).not.toBeNull();

    // Inject replacement container
    const replacementContainer = document.createElement('ytd-popup-container');
    document.body.appendChild(replacementContainer);

    // Wait for bootstrap observer to detect replacement
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(coordinator.scopedObserver).not.toBeNull();
    const updatedLogs = await getDiagnosticLogs();
    const updatedEventNames = updatedLogs.map((l) => l.event);
    expect(updatedEventNames).toContain('container_reconnected');
  });

  it('records window occlusion state changes when visibilitychange fires', async () => {
    await coordinator.init();

    // Simulate window minimized
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Wait for async storage write
    await new Promise((resolve) => setTimeout(resolve, 20));

    let logs = await getDiagnosticLogs();
    let eventNames = logs.map((l) => l.event);
    expect(eventNames).toContain('window_occluded');

    // Simulate window restored
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await new Promise((resolve) => setTimeout(resolve, 20));

    logs = await getDiagnosticLogs();
    eventNames = logs.map((l) => l.event);
    expect(eventNames).toContain('window_restored');
  });
});
