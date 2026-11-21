import { describe, it, expect, beforeEach } from 'vitest';
import { detectInactivityPrompt } from '../src/content/detector.js';

describe('detector.js - detectInactivityPrompt (Safety & Rejection Engine)', () => {
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
    expect(result.textSnippet).toContain('video paused. continue watching?');
  });

  it('detects non-English prompts across multiple languages (Spanish, German, Japanese, French, Hindi, Korean)', () => {
    const localizedTitles = [
      '¿Quieres seguir viendo el video?',
      'Video pausiert. Weitersehen?',
      '動画が一時停止しました。続きを視聴しますか？',
      'Vidéo mise en pause. Continuer à regarder ?',
      'वीडियो रोक दिया गया है. क्या आप देखना जारी रखना चाहते हैं?',
      '동영상이 일시중지되었습니다. 이어서 시청하시겠습니까?',
      'Il video è stato messo in pausa. Vuoi continuare a guardare?',
      'Vídeo pausado. Continuar assistindo?',
      'Видео приостановлено. Продолжить просмотр?'
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
    expect(result.reason).toContain('rejected_keyword');
  });

  it('classifies skip and next-video dialogs as ambiguous', () => {
    const skipTitles = [
      'Skip to next video?',
      'Up next: Summer Chill Mix',
      'Play next track in queue?',
      'Nächstes Video abspielen?',
    ];

    for (const title of skipTitles) {
      container.innerHTML = `
        <tp-yt-paper-dialog role="dialog" style="display: block;">
          <yt-confirm-dialog-renderer>
            <div id="dialog-header"><h2>${title}</h2></div>
            <div id="buttons">
              <yt-button-renderer id="confirm-button">
                <button>Next</button>
              </yt-button-renderer>
            </div>
          </yt-confirm-dialog-renderer>
        </tp-yt-paper-dialog>
      `;

      const result = detectInactivityPrompt(container);
      expect(result.status).toBe('ambiguous');
      expect(result.reason).toContain('rejected_keyword');
    }
  });

  it('classifies playback-error and video unavailable dialogs as ambiguous', () => {
    const errorTitles = [
      'Playback error occurred. Try again?',
      'This video is unavailable in your region.',
      'Failed to load video stream.',
    ];

    for (const title of errorTitles) {
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
      expect(result.status).toBe('ambiguous');
    }
  });

  it('classifies playlist queue alteration dialogs as ambiguous', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: block;">
        <yt-confirm-dialog-renderer>
          <div id="dialog-header"><h2>Replace current queue?</h2></div>
          <div id="buttons">
            <yt-button-renderer id="confirm-button">
              <button>Replace</button>
            </yt-button-renderer>
          </div>
        </yt-confirm-dialog-renderer>
      </tp-yt-paper-dialog>
    `;

    const result = detectInactivityPrompt(container);
    expect(result.status).toBe('ambiguous');
    expect(result.reason).toContain('rejected_keyword');
  });

  it('treats uncertain dialogs lacking positive inactivity cues as ambiguous', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: block;">
        <yt-confirm-dialog-renderer>
          <div id="dialog-header"><h2>Are you sure you want to proceed?</h2></div>
          <div id="buttons">
            <yt-button-renderer id="confirm-button">
              <button>Confirm</button>
            </yt-button-renderer>
          </div>
        </yt-confirm-dialog-renderer>
      </tp-yt-paper-dialog>
    `;

    const result = detectInactivityPrompt(container);
    expect(result.status).toBe('ambiguous');
    expect(result.reason).toBe('lacks_inactivity_cues');
  });
});
