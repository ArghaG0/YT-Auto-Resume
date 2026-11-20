import { describe, it, expect, beforeEach } from 'vitest';
import { findContinueButton, dispatchContinueAction } from '../src/content/actions.js';

describe('actions.js - Action & Shadow DOM Piercing Engine', () => {
  let promptContainer;

  beforeEach(() => {
    document.body.innerHTML = '';
    promptContainer = document.createElement('yt-confirm-dialog-renderer');
    document.body.appendChild(promptContainer);
  });

  it('finds native button in light DOM inside #confirm-button', () => {
    promptContainer.innerHTML = `
      <div id="buttons">
        <div id="confirm-button">
          <button id="target-btn">Yes</button>
        </div>
      </div>
    `;

    const btn = findContinueButton(promptContainer);
    expect(btn).not.toBeNull();
    expect(btn?.id).toBe('target-btn');
  });

  it('pierces open Shadow Root within Web Component to locate button', () => {
    class MockCustomButtonRenderer extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          const shadow = this.attachShadow({ mode: 'open' });
          const innerBtn = document.createElement('button');
          innerBtn.id = 'shadow-inner-btn';
          innerBtn.textContent = 'Continue';
          shadow.appendChild(innerBtn);
        }
      }
    }

    if (!customElements.get('mock-yt-button')) {
      customElements.define('mock-yt-button', MockCustomButtonRenderer);
    }

    promptContainer.innerHTML = `
      <div id="buttons">
        <mock-yt-button id="confirm-button"></mock-yt-button>
      </div>
    `;

    const btn = findContinueButton(promptContainer);
    expect(btn).not.toBeNull();
    expect(btn?.id).toBe('shadow-inner-btn');
  });

  it('ignores disabled button elements', () => {
    promptContainer.innerHTML = `
      <div id="buttons">
        <div id="confirm-button">
          <button disabled>Yes</button>
        </div>
      </div>
    `;

    const btn = findContinueButton(promptContainer);
    expect(btn).toBeNull();
  });

  it('successfully dispatches programmatic synthetic click', () => {
    let clicked = false;
    const button = document.createElement('button');
    button.addEventListener('click', () => {
      clicked = true;
    });
    document.body.appendChild(button);

    const result = dispatchContinueAction(button);
    expect(result.success).toBe(true);
    expect(clicked).toBe(true);
  });

  it('handles null button gracefully without crashing', () => {
    const result = dispatchContinueAction(null);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('null or undefined');
  });
});
