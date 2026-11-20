import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YouTubeAutoResumeCoordinator } from '../src/content/content.js';
import { getDiagnosticLogs } from '../src/common/logger.js';

describe('content.js - YouTubeAutoResumeCoordinator (End-to-End Integration)', () => {
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
  });

  it('observes <ytd-popup-container> and automatically confirms an injected prompt', async () => {
    const popupContainer = document.createElement('ytd-popup-container');
    document.body.appendChild(popupContainer);

    await coordinator.init();

    // Track button click
    let clickCount = 0;

    // Dynamically inject dialog into popup container
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
    btn.addEventListener('click', () => {
      clickCount++;
    });

    btnContainer.appendChild(btn);
    renderer.appendChild(header);
    renderer.appendChild(btnContainer);
    dialog.appendChild(renderer);

    popupContainer.appendChild(dialog);

    // Wait for debounced mutation evaluation (50ms debounce)
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(clickCount).toBe(1);

    // Verify diagnostic logs were recorded
    const logs = await getDiagnosticLogs();
    const eventNames = logs.map((l) => l.event);
    expect(eventNames).toContain('prompt_detected');
    expect(eventNames).toContain('continue_clicked');
  });

  it('does NOT act on prompts when master switch is disabled', async () => {
    mockStorage.yt_auto_resume_settings.enabled = false;

    const popupContainer = document.createElement('ytd-popup-container');
    document.body.appendChild(popupContainer);

    await coordinator.init();

    let clickCount = 0;
    const dialog = document.createElement('tp-yt-paper-dialog');
    dialog.innerHTML = `
      <yt-confirm-dialog-renderer>
        <div id="confirm-button"><button id="yes">Yes</button></div>
      </yt-confirm-dialog-renderer>
    `;
    const btn = dialog.querySelector('button');
    btn.addEventListener('click', () => { clickCount++; });

    popupContainer.appendChild(dialog);

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(clickCount).toBe(0);
  });

  it('resets deduplication state when yt-navigate-finish event fires', async () => {
    const popupContainer = document.createElement('ytd-popup-container');
    document.body.appendChild(popupContainer);

    await coordinator.init();

    expect(coordinator.deduplicator.lastActionTimestamp).toBe(0);
    coordinator.deduplicator.lastActionTimestamp = Date.now();
    expect(coordinator.deduplicator.isCooldownActive()).toBe(true);

    // Simulate YouTube SPA navigation finish
    window.dispatchEvent(new Event('yt-navigate-finish'));

    expect(coordinator.deduplicator.lastActionTimestamp).toBe(0);
    expect(coordinator.deduplicator.isCooldownActive()).toBe(false);
  });

  it('disconnects observers cleanly when destroy() is called', async () => {
    const popupContainer = document.createElement('ytd-popup-container');
    document.body.appendChild(popupContainer);

    await coordinator.init();
    expect(coordinator.isInitialized).toBe(true);

    coordinator.destroy();
    expect(coordinator.isInitialized).toBe(false);
    expect(coordinator.scopedObserver).toBeNull();
    expect(coordinator.bootstrapObserver).toBeNull();
  });
});
