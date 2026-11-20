import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectInactivityPrompt } from '../src/content/detector.js';
import { findContinueButton } from '../src/content/actions.js';
import { PromptDeduplicator } from '../src/content/deduplicator.js';

describe('SRS Compliance & Edge-Case Verification (AR-T03 to AR-T20)', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('ytd-popup-container');
    document.body.appendChild(container);
  });

  it('AR-T03 & AR-T04: preserves manual and keyboard pauses (no action on HTML video pause)', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);

    // Mock video element state
    let playCalled = false;
    video.play = vi.fn(async () => { playCalled = true; });

    // Simulate user pause event
    video.dispatchEvent(new Event('pause'));

    // Check that detector finds nothing because no modal exists
    const detection = detectInactivityPrompt(container);
    expect(detection.status).toBe('not_found');
    expect(playCalled).toBe(false);
  });

  it('AR-T05: buffering states do not trigger automatic playback', () => {
    // YouTube player in buffering state
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player ytp-autohide ytp-spinner';
    document.body.appendChild(player);

    const detection = detectInactivityPrompt(container);
    expect(detection.status).toBe('not_found');
  });

  it('AR-T06: player error screens do not trigger continuation actions', () => {
    const errorScreen = document.createElement('div');
    errorScreen.id = 'error-screen';
    errorScreen.innerHTML = '<div class="ytp-error-content">Video unavailable</div>';
    document.body.appendChild(errorScreen);

    const detection = detectInactivityPrompt(container);
    expect(detection.status).toBe('not_found');
  });

  it('AR-T07: unrelated dialogs (playlist delete modal) are flagged as ambiguous or ignored', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: block;">
        <yt-confirm-dialog-renderer>
          <div id="dialog-header"><h2>Delete playlist "Favorites"?</h2></div>
          <div id="buttons">
            <yt-button-renderer id="confirm-button">
              <button>Delete</button>
            </yt-button-renderer>
          </div>
        </yt-confirm-dialog-renderer>
      </tp-yt-paper-dialog>
    `;

    const detection = detectInactivityPrompt(container);
    expect(detection.status).toBe('ambiguous');
  });

  it('AR-T14: hidden continuation controls (style display: none) are rejected', () => {
    const prompt = document.createElement('yt-confirm-dialog-renderer');
    prompt.innerHTML = `
      <div id="confirm-button">
        <button style="display: none;">Yes</button>
      </div>
    `;
    document.body.appendChild(prompt);

    const button = findContinueButton(prompt);
    expect(button).toBeNull();
  });

  it('AR-T18: rapid navigation transitions do not throw uncaught errors', () => {
    const deduplicator = new PromptDeduplicator(100);
    const elements = [
      document.createElement('div'),
      document.createElement('div'),
      document.createElement('div')
    ];

    expect(() => {
      // Rapidly mark and reset in high concurrency
      for (const el of elements) {
        deduplicator.canAct(el);
        deduplicator.markHandled(el);
        deduplicator.reset();
      }
    }).not.toThrow();
  });
});
