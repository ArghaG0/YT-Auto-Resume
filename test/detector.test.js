import { describe, it, expect, beforeEach } from 'vitest';
import { detectInactivityPrompt, isElementVisible, checkVisualVisibility } from '../src/content/detector.js';

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

  it('detects a visible dialog even if it carries aria-hidden="true" (prevents false negative)', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: flex;" aria-hidden="true">
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

  it('rejects a hidden dialog with display: none even when aria-hidden="true" is set', () => {
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
    expect(result.status).toBe('candidate_not_visible');
    expect(result.reason).toBe('inline_display_none');
    expect(result.details.ariaHidden).toBe('true');
    expect(result.details.styleDisplay).toBe('none');
  });

  it('rejects a dialog with display: none (inline style)', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: none;">
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
    expect(result.status).toBe('candidate_not_visible');
    expect(result.reason).toBe('inline_display_none');
  });

  it('rejects a dialog with computed display: none from CSS or class', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" class="hidden-dialog">
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
    const dialog = container.querySelector('tp-yt-paper-dialog');
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (el) => {
      if (el === dialog) {
        return { display: 'none', visibility: 'visible', opacity: '1' };
      }
      return originalGetComputedStyle(el);
    };

    try {
      const result = detectInactivityPrompt(container);
      expect(result.status).toBe('candidate_not_visible');
      expect(result.reason).toBe('computed_display_none');
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  it('rejects a dialog with visibility: hidden', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="visibility: hidden;">
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
    expect(result.status).toBe('candidate_not_visible');
    expect(result.reason).toBe('inline_visibility_hidden');
  });

  it('rejects a dialog during early opening transition when opacity is 0', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: flex; opacity: 0;">
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
    expect(result.status).toBe('candidate_not_visible');
    expect(result.reason).toBe('opacity_zero');
  });

  it('detects a dialog as confirmed once opening transition reaches visible opacity', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: flex; opacity: 0.8;">
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
  });

  it('rejects a dialog during closing transition when display is switched to none or opacity to 0', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: flex; opacity: 1;">
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

    expect(detectInactivityPrompt(container).status).toBe('confirmed');

    // Simulate closing transition initiated: opacity faded to 0
    const dialog = container.querySelector('tp-yt-paper-dialog');
    dialog.style.opacity = '0';
    const closingResult1 = detectInactivityPrompt(container);
    expect(closingResult1.status).toBe('candidate_not_visible');
    expect(closingResult1.reason).toBe('opacity_zero');

    // Transition completed: display set to none
    dialog.style.display = 'none';
    const closingResult2 = detectInactivityPrompt(container);
    expect(closingResult2.status).toBe('candidate_not_visible');
    expect(closingResult2.reason).toBe('inline_display_none');
  });

  it('rejects a dialog with zero bounding rect when layout engine is active', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: flex;">
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

    const dialog = container.querySelector('tp-yt-paper-dialog');

    // Simulate browser layout engine active by mocking body width > 0
    const originalBodyRect = document.body.getBoundingClientRect;
    document.body.getBoundingClientRect = () => ({ width: 1920, height: 1080, top: 0, bottom: 1080, left: 0, right: 1920 });
    dialog.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 });

    try {
      const result = detectInactivityPrompt(container);
      expect(result.status).toBe('candidate_not_visible');
      expect(result.reason).toBe('zero_bounding_rect');
      expect(result.details.rect).toEqual({ width: 0, height: 0 });
    } finally {
      document.body.getBoundingClientRect = originalBodyRect;
    }
  });

  it('rejects a dialog candidate when confirm button is hidden or missing', () => {
    container.innerHTML = `
      <tp-yt-paper-dialog role="dialog" style="display: flex;">
        <yt-confirm-dialog-renderer>
          <div id="dialog-header"><h2>Video paused. Continue watching?</h2></div>
          <div id="buttons">
            <!-- confirm button missing -->
          </div>
        </yt-confirm-dialog-renderer>
      </tp-yt-paper-dialog>
    `;

    const result = detectInactivityPrompt(container);
    expect(result.status).toBe('candidate_not_visible');
    expect(result.reason).toBe('confirm_button_missing');
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

  it('ignores hidden dialogs with display: none or aria-hidden="true" by marking candidate_not_visible', () => {
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
    expect(result.status).toBe('candidate_not_visible');
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

describe('checkVisualVisibility & isElementVisible utility validation', () => {
  it('returns isVisible: true for standard connected visible elements', () => {
    const el = document.createElement('div');
    el.style.display = 'block';
    document.body.appendChild(el);

    expect(isElementVisible(el)).toBe(true);
    expect(checkVisualVisibility(el).isVisible).toBe(true);
  });

  it('identifies disconnected elements as not visible with not_connected reason', () => {
    const el = document.createElement('div');
    expect(isElementVisible(el)).toBe(false);
    expect(checkVisualVisibility(el).reason).toBe('not_connected');
  });

  it('identifies ancestor display: none as reason for invisibility', () => {
    const parent = document.createElement('div');
    parent.style.display = 'none';
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    expect(isElementVisible(child)).toBe(false);
    expect(checkVisualVisibility(child).reason).toBe('ancestor_inline_display_none');
  });
});
