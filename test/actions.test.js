import { describe, it, expect, beforeEach } from 'vitest';
import { findContinueButton, resolveClickableButton, dispatchContinueAction } from '../src/content/actions.js';

describe('actions.js - Action & Deep Shadow DOM Piercing Engine', () => {
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

  it('pierces open Shadow Root within single-level Web Component', () => {
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

  it('pierces multi-level nested Shadow Roots (renderer -> shape -> shadow -> button)', () => {
    class MockShape extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          const shadow = this.attachShadow({ mode: 'open' });
          const btn = document.createElement('button');
          btn.id = 'nested-shape-btn';
          btn.textContent = 'Yes';
          shadow.appendChild(btn);
        }
      }
    }

    if (!customElements.get('mock-button-shape')) {
      customElements.define('mock-button-shape', MockShape);
    }

    class MockParentRenderer extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          const shadow = this.attachShadow({ mode: 'open' });
          const shape = document.createElement('mock-button-shape');
          shadow.appendChild(shape);
        }
      }
    }

    if (!customElements.get('mock-parent-renderer')) {
      customElements.define('mock-parent-renderer', MockParentRenderer);
    }

    promptContainer.innerHTML = `
      <div id="buttons">
        <mock-parent-renderer id="confirm-button"></mock-parent-renderer>
      </div>
    `;

    const btn = findContinueButton(promptContainer);
    expect(btn).not.toBeNull();
    expect(btn?.id).toBe('nested-shape-btn');
  });

  it('respects maxDepth boundary during recursive resolution', () => {
    const parent = document.createElement('div');
    let curr = parent;
    for (let i = 0; i < 6; i++) {
      const child = document.createElement('div');
      curr.appendChild(child);
      curr = child;
    }
    const deepBtn = document.createElement('button');
    deepBtn.id = 'too-deep-btn';
    curr.appendChild(deepBtn);

    // Default maxDepth is 4, depth of 7 will return null
    const resolved = resolveClickableButton(parent, 0, 4);
    expect(resolved).toBeNull();
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
