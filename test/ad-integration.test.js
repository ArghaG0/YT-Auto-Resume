import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YouTubeAutoResumeCoordinator } from '../src/content/content.js';
import { getDiagnosticLogs, clearDiagnosticLogs } from '../src/common/logger.js';

describe('ad-integration.test.js - Dual-Engine Coordinator (Ad Control End-to-End)', () => {
  let coordinator;
  let mockStorage = {};
  let storageListeners = [];

  beforeEach(() => {
    storageListeners = [];
    mockStorage = {
      yt_auto_resume_settings: {
        enabled: true,
        autoResumeEnabled: true,
        adControlEnabled: true,
        autoClickSkip: true,
        youtubeEnabled: true,
        youtubeMusicEnabled: false,
        diagnosticsEnabled: true,
      },
      yt_auto_resume_diagnostics: [],
    };

    globalThis.chrome = {
      runtime: {
        id: 'mock-coordinator-id',
      },
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

  afterEach(async () => {
    coordinator.destroy();
    await clearDiagnosticLogs();
  });

  it('detects ad state, attaches Tier 2 observer, and automatically clicks skip button', async () => {
    // 1. Setup YouTube player with active ad
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.classList.add('ad-showing');
    document.body.appendChild(player);

    const overlay = document.createElement('div');
    overlay.className = 'ytp-ad-player-overlay';
    player.appendChild(overlay);

    const skipContainer = document.createElement('div');
    skipContainer.className = 'ytp-ad-skip-button-container';
    skipContainer.style.display = 'block';

    let clickCount = 0;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'ytp-ad-skip-button-modern';
    skipBtn.style.display = 'block';
    skipBtn.textContent = 'Skip Ad';
    skipBtn.addEventListener('click', () => {
      clickCount++;
      // Simulate YouTube removing ad-showing shortly after skip click
      setTimeout(() => {
        player.classList.remove('ad-showing');
      }, 50);
    });

    skipContainer.appendChild(skipBtn);
    overlay.appendChild(skipContainer);

    // Initialize coordinator
    await coordinator.init();

    // Allow debounced evaluation (100ms) + verification check (200ms) + log queue flush
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(clickCount).toBe(1);

    const logs = await getDiagnosticLogs();
    const eventNames = logs.map((l) => l.event);

    expect(eventNames).toContain('ad_detected');
    expect(eventNames).toContain('ad_skip_clicked');
    expect(eventNames).toContain('ad_skip_verified');
  });

  it('handles countdown before skip button becomes interactable', async () => {
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.classList.add('ad-showing');
    document.body.appendChild(player);

    const overlay = document.createElement('div');
    overlay.className = 'ytp-ad-player-overlay';
    player.appendChild(overlay);

    // Countdown container active: "Skip in 5s"
    const preview = document.createElement('div');
    preview.className = 'ytp-ad-preview-container';
    preview.style.display = 'block';
    preview.textContent = 'You can skip ad in 5';
    overlay.appendChild(preview);

    await coordinator.init();

    // Allow debounced evaluation
    await new Promise((resolve) => setTimeout(resolve, 150));

    const logs = await getDiagnosticLogs();
    const eventNames = logs.map((l) => l.event);

    expect(eventNames).toContain('ad_detected');
    expect(eventNames).toContain('ad_skip_countdown_active');
    expect(eventNames).not.toContain('ad_skip_clicked');
  });

  it('prevents duplicate clicks on the same ad unit via deduplication guard', async () => {
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.classList.add('ad-showing');
    document.body.appendChild(player);

    const overlay = document.createElement('div');
    overlay.className = 'ytp-ad-player-overlay';
    player.appendChild(overlay);

    let clickCount = 0;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'ytp-ad-skip-button';
    skipBtn.style.display = 'block';
    skipBtn.addEventListener('click', () => {
      clickCount++;
    });
    overlay.appendChild(skipBtn);

    await coordinator.init();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(clickCount).toBe(1);

    // Trigger subsequent mutation on overlay
    overlay.dispatchEvent(new Event('DOMSubtreeModified'));
    await coordinator.evaluateAdSkip();

    // Click count should remain 1 due to deduplication guard
    expect(clickCount).toBe(1);
  });

  it('processes consecutive ad units in an ad pod (Ad 1 of 2 -> Ad 2 of 2)', async () => {
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.classList.add('ad-showing');
    document.body.appendChild(player);

    const overlay = document.createElement('div');
    overlay.className = 'ytp-ad-player-overlay';
    player.appendChild(overlay);

    const adText = document.createElement('div');
    adText.className = 'ytp-ad-text';
    adText.textContent = 'Ad 1 of 2';
    overlay.appendChild(adText);

    let clickedAds = [];
    const skipBtn = document.createElement('button');
    skipBtn.className = 'ytp-ad-skip-button';
    skipBtn.style.display = 'block';
    skipBtn.addEventListener('click', () => {
      clickedAds.push(adText.textContent);
      // Advance to Ad 2 of 2
      adText.textContent = 'Ad 2 of 2';
    });
    overlay.appendChild(skipBtn);

    await coordinator.init();

    // First ad evaluation
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(clickedAds).toContain('Ad 1 of 2');

    // Simulate pod advancement to Ad 2 of 2
    coordinator.adDeduplicator.lastClickTimestamp = 0; // bypass cooldown for unit test
    await coordinator.evaluateAdSkip();

    expect(clickedAds).toContain('Ad 2 of 2');
    expect(clickedAds.length).toBe(2);
  });

  it('strictly rejects ambiguous ad overlays when player does NOT have ad classes', async () => {
    const player = document.createElement('div');
    player.id = 'movie_player';
    // Deliberately no .ad-showing or .ad-interrupting
    document.body.appendChild(player);

    const overlay = document.createElement('div');
    overlay.className = 'ytp-ad-player-overlay';
    overlay.style.display = 'block';
    player.appendChild(overlay);

    await coordinator.init();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const logs = await getDiagnosticLogs();
    const eventNames = logs.map((l) => l.event);

    expect(eventNames).not.toContain('ad_skip_clicked');
  });

  it('does NOT click skip buttons when adControlEnabled is false', async () => {
    mockStorage.yt_auto_resume_settings.adControlEnabled = false;

    const player = document.createElement('div');
    player.id = 'movie_player';
    player.classList.add('ad-showing');
    document.body.appendChild(player);

    const overlay = document.createElement('div');
    overlay.className = 'ytp-ad-player-overlay';
    player.appendChild(overlay);

    let clickCount = 0;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'ytp-ad-skip-button';
    skipBtn.style.display = 'block';
    skipBtn.addEventListener('click', () => clickCount++);
    overlay.appendChild(skipBtn);

    await coordinator.init();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(clickCount).toBe(0);
  });

  it('resets ad deduplication and state machine on SPA navigation (yt-navigate-finish)', async () => {
    await coordinator.init();

    coordinator.adDeduplicator.markPending('test-unit');
    expect(coordinator.adDeduplicator.isPending('test-unit')).toBe(true);

    window.dispatchEvent(new CustomEvent('yt-navigate-finish'));

    expect(coordinator.adDeduplicator.isPending('test-unit')).toBe(false);
    expect(coordinator.adFsm.getState()).toBe('IDLE');
  });

  it('tears down Tier 2 observer when ad finishes (.ad-showing removed)', async () => {
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.classList.add('ad-showing');
    document.body.appendChild(player);

    await coordinator.init();

    expect(coordinator.adModuleObserver).not.toBeNull();

    // Simulate ad ending
    player.classList.remove('ad-showing');
    coordinator.onAdEnded();

    expect(coordinator.adModuleObserver).toBeNull();
    expect(coordinator.adFsm.getState()).toBe('IDLE');
  });
});
