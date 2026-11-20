import { describe, it, expect, beforeEach } from 'vitest';
import { PromptDeduplicator } from '../src/content/deduplicator.js';

describe('deduplicator.js - PromptDeduplicator', () => {
  let deduplicator;
  let element;

  beforeEach(() => {
    deduplicator = new PromptDeduplicator(100); // 100ms cooldown for fast testing
    element = document.createElement('div');
  });

  it('permits action on an unhandled element initially', () => {
    expect(deduplicator.canAct(element)).toBe(true);
  });

  it('prevents multiple actions on the same element instance', () => {
    deduplicator.markHandled(element);
    expect(deduplicator.canAct(element)).toBe(false);
  });

  it('enforces cooldown window even for different elements', () => {
    const secondElement = document.createElement('div');
    deduplicator.markHandled(element);

    // Within cooldown, second element is blocked
    expect(deduplicator.canAct(secondElement)).toBe(false);
    expect(deduplicator.isCooldownActive()).toBe(true);
  });

  it('allows actions on new element once cooldown expires', async () => {
    const secondElement = document.createElement('div');
    deduplicator.markHandled(element);

    // Wait for cooldown to expire
    await new Promise((resolve) => setTimeout(resolve, 110));

    expect(deduplicator.isCooldownActive()).toBe(false);
    expect(deduplicator.canAct(secondElement)).toBe(true);
  });

  it('resets cooldown state when reset() is called', () => {
    const secondElement = document.createElement('div');
    deduplicator.markHandled(element);
    expect(deduplicator.canAct(secondElement)).toBe(false);

    deduplicator.reset();
    expect(deduplicator.isCooldownActive()).toBe(false);
    expect(deduplicator.canAct(secondElement)).toBe(true);
  });
});
