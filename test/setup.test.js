import { describe, it, expect } from 'vitest';

describe('Test Environment Verification', () => {
  it('instantiates JSDOM and manipulates DOM nodes', () => {
    const div = document.createElement('div');
    div.id = 'test-node';
    div.textContent = 'YouTube Auto Resume Test Environment';
    document.body.appendChild(div);

    const retrieved = document.getElementById('test-node');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.textContent).toBe('YouTube Auto Resume Test Environment');
  });

  it('supports custom elements and shadow roots in JSDOM', () => {
    class MockButtonRenderer extends HTMLElement {
      constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const btn = document.createElement('button');
        btn.id = 'inner-btn';
        btn.textContent = 'Yes';
        shadow.appendChild(btn);
      }
    }
    customElements.define('mock-button-renderer', MockButtonRenderer);

    const el = document.createElement('mock-button-renderer');
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();
    const innerBtn = el.shadowRoot?.querySelector('#inner-btn');
    expect(innerBtn).not.toBeNull();
    expect(innerBtn?.textContent).toBe('Yes');
  });
});
