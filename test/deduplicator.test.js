import { describe, it, expect, beforeEach } from 'vitest';
import { PromptDeduplicator } from '../src/content/deduplicator.js';

describe('deduplicator.js - PromptDeduplicator (Reversible Leases)', () => {
  let deduplicator;
  let element;

  beforeEach(() => {
    deduplicator = new PromptDeduplicator(100); // 100ms cooldown for fast testing
    element = document.createElement('div');
  });

  it('permits action on an unhandled element initially', () => {
    expect(deduplicator.canAct(element)).toBe(true);
  });

  it('locks action while in pending verification state without setting attribute', () => {
    deduplicator.markPending(element);
    expect(deduplicator.isPending(element)).toBe(true);
    expect(deduplicator.canAct(element)).toBe(false);
    expect(element.getAttribute('data-auto-resume-handled')).toBeNull();
  });

  it('unmarks a pending element upon verification failure and allows retrying', () => {
    deduplicator.markPending(element);
    expect(deduplicator.canAct(element)).toBe(false);

    deduplicator.unmark(element);
    expect(deduplicator.isPending(element)).toBe(false);
    expect(deduplicator.canAct(element)).toBe(true);
  });

  it('commits permanent handled state and stamps attribute on markSuccess', () => {
    deduplicator.markPending(element);
    deduplicator.markSuccess(element);

    expect(deduplicator.isPending(element)).toBe(false);
    expect(deduplicator.canAct(element)).toBe(false);
    expect(element.getAttribute('data-auto-resume-handled')).toBe('true');
  });

  it('unmarks a handled element, stripping attribute and unlocking canAct', () => {
    deduplicator.markSuccess(element);
    expect(element.getAttribute('data-auto-resume-handled')).toBe('true');

    // Force cooldown expiry to isolate element unmarking
    deduplicator.lastActionTimestamp = 0;
    expect(deduplicator.canAct(element)).toBe(false);

    deduplicator.unmark(element);
    expect(element.hasAttribute('data-auto-resume-handled')).toBe(false);
    expect(deduplicator.canAct(element)).toBe(true);
  });

  it('enforces cooldown window across different elements', () => {
    const secondElement = document.createElement('div');
    deduplicator.markSuccess(element);

    expect(deduplicator.canAct(secondElement)).toBe(false);
    expect(deduplicator.isCooldownActive()).toBe(true);
  });

  it('allows actions on new element once cooldown expires', async () => {
    const secondElement = document.createElement('div');
    deduplicator.markSuccess(element);

    await new Promise((resolve) => setTimeout(resolve, 110));

    expect(deduplicator.isCooldownActive()).toBe(false);
    expect(deduplicator.canAct(secondElement)).toBe(true);
  });

  it('resets cooldown and strips attributes from all tracked DOM nodes when reset() is called', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.appendChild(first);
    document.body.appendChild(second);

    deduplicator.markSuccess(first);
    deduplicator.markPending(second);

    expect(first.getAttribute('data-auto-resume-handled')).toBe('true');

    deduplicator.reset();

    expect(deduplicator.isCooldownActive()).toBe(false);
    expect(first.hasAttribute('data-auto-resume-handled')).toBe(false);
    expect(deduplicator.canAct(first)).toBe(true);
    expect(deduplicator.canAct(second)).toBe(true);
  });
});
