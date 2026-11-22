import { describe, it, expect, beforeEach } from 'vitest';
import { AdUnitDeduplicator } from '../src/content/ad-deduplicator.js';

describe('ad-deduplicator.js - Ad Unit Deduplication & Pod Tracking', () => {
  let deduplicator;

  beforeEach(() => {
    deduplicator = new AdUnitDeduplicator(200); // 200ms cooldown for tests
  });

  it('allows skipping a new ad unit initially', () => {
    expect(deduplicator.canSkip('ad-1')).toBe(true);
  });

  it('locks out duplicate skip attempts while ad is pending verification', () => {
    deduplicator.markPending('ad-1');

    expect(deduplicator.isPending('ad-1')).toBe(true);
    expect(deduplicator.canSkip('ad-1')).toBe(false);
  });

  it('locks out skip attempts after ad is marked as successfully skipped', () => {
    deduplicator.markPending('ad-1');
    deduplicator.markSuccess('ad-1');

    expect(deduplicator.isHandled('ad-1')).toBe(true);
    expect(deduplicator.canSkip('ad-1')).toBe(false);
  });

  it('allows subsequent ad units in an ad pod to be skipped independently', async () => {
    deduplicator.markPending('ad-pod-1-of-2');
    deduplicator.markSuccess('ad-pod-1-of-2');

    // Wait past cooldown
    await new Promise((r) => setTimeout(r, 220));

    // Next ad unit in pod
    expect(deduplicator.canSkip('ad-pod-2-of-2')).toBe(true);
  });

  it('allows retrying an ad unit when unmark() is called', () => {
    deduplicator.markPending('ad-retry');
    expect(deduplicator.canSkip('ad-retry')).toBe(false);

    deduplicator.unmark('ad-retry');
    // Unit is unmarked, but cooldown may still apply if tested within window
    deduplicator.lastClickTimestamp = 0; // reset cooldown for assertion
    expect(deduplicator.canSkip('ad-retry')).toBe(true);
  });

  it('tracks and updates active ad unit ID', () => {
    deduplicator.setActiveUnitId('ad-active-1');
    expect(deduplicator.getActiveUnitId()).toBe('ad-active-1');

    deduplicator.setActiveUnitId(null);
    expect(deduplicator.getActiveUnitId()).toBeNull();
  });

  it('resets all tracking data cleanly', () => {
    deduplicator.markPending('ad-1');
    deduplicator.markSuccess('ad-2');
    deduplicator.setActiveUnitId('ad-1');

    deduplicator.reset();

    expect(deduplicator.isPending('ad-1')).toBe(false);
    expect(deduplicator.isHandled('ad-2')).toBe(false);
    expect(deduplicator.getActiveUnitId()).toBeNull();
    expect(deduplicator.canSkip('ad-1')).toBe(true);
  });
});
