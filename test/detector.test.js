import { describe, it, expect, beforeEach } from 'vitest';
import { detectInactivityPrompt } from '../src/content/detector.js';

describe('detector.js - detectInactivityPrompt', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('ytd-popup-container');
    document.body.appendChild(container);
  });

  it('returns not_found when container is empty', () => {
    const result = detectInactivityPrompt(container);
    expect(result.status).toBe('not_found');
  });

  it('detects a standard visible English inactivity prompt', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: block;">
        <yt-confirm-dialog-renderer>
          <div id="dialog-header"><h2>Video paused. Continue watching?</h2></div>
          <div id="buttons">
            <yt-button-renderer id="confirm-button">
              <button>Yes</button>
            </yt-button-renderer>
          </div>
        </yt-confirm-dialog-renderer>
      </tp-yt-paper-dialog>
    `;

    const result = detectInactivityPrompt(container);
    expect(result.status).toBe('confirmed');
    expect(result.promptElement).not.toBeNull();
  });

  it('detects non-English prompts (i18n resilience: Spanish, German, Japanese)', () => {
    const localizedTitles = [
      '¿Quieres seguir viendo el video?',
      'Video pausiert. Weitersehen?',
      '動画が一時停止しました。続きを視聴しますか？',
      'Vidéo mise en pause. Continuer à regarder ?',
      'वीडियो रोक दिया गया है. क्या आप देखना जारी रखना चाहते हैं?'
    ];

    for (const title of localizedTitles) {
      container.innerHTML = `
        <tp-yt-paper-dialog role="dialog" style="display: block;">
          <yt-confirm-dialog-renderer>
            <div id="dialog-header"><h2>${title}</h2></div>
            <div id="buttons">
              <yt-button-renderer id="confirm-button">
                <button>OK</button>
              </yt-button-renderer>
            </div>
          </yt-confirm-dialog-renderer>
        </tp-yt-paper-dialog>
      `;

      const result = detectInactivityPrompt(container);
      expect(result.status).toBe('confirmed');
    }
  });

  it('ignores hidden dialogs with display: none or aria-hidden="true"', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: none;" aria-hidden="true">
        <yt-confirm-dialog-renderer>
          <div id="buttons">
            <yt-button-renderer id="confirm-button">
              <button>Yes</button>
            </yt-button-renderer>
          </div>
        </yt-confirm-dialog-renderer>
      </tp-yt-paper-dialog>
    `;

    const result = detectInactivityPrompt(container);
    expect(result.status).toBe('not_found');
  });

  it('classifies unsubscribe modals as ambiguous to prevent destructive clicks', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: block;">
        <yt-confirm-dialog-renderer>
          <div id="dialog-header"><h2>Unsubscribe from Channel?</h2></div>
          <div id="buttons">
            <yt-button-renderer id="confirm-button">
              <button>Unsubscribe</button>
            </yt-button-renderer>
          </div>
        </yt-confirm-dialog-renderer>
      </tp-yt-paper-dialog>
    `;

    const result = detectInactivityPrompt(container);
    expect(result.status).toBe('ambiguous');
  });
});
