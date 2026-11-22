import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdLifecycleStateMachine, AD_STATES } from '../src/content/ad-state-machine.js';

describe('ad-state-machine.js - Ad Lifecycle State Machine', () => {
  let fsm;

  beforeEach(() => {
    fsm = new AdLifecycleStateMachine();
  });

  it('initializes in IDLE state', () => {
    expect(fsm.getState()).toBe(AD_STATES.IDLE);
    expect(fsm.getContext()).toEqual({});
  });

  it('progresses through standard skippable ad lifecycle', () => {
    // 1. Ad detected
    expect(fsm.transition(AD_STATES.AD_DETECTED, { adUnitId: 'ad-1' })).toBe(true);
    expect(fsm.getState()).toBe(AD_STATES.AD_DETECTED);

    // 2. Waiting for countdown
    expect(fsm.transition(AD_STATES.WAITING_FOR_SKIP)).toBe(true);
    expect(fsm.getState()).toBe(AD_STATES.WAITING_FOR_SKIP);

    // 3. Skip button becomes ready
    expect(fsm.transition(AD_STATES.SKIP_READY)).toBe(true);
    expect(fsm.getState()).toBe(AD_STATES.SKIP_READY);

    // 4. Click dispatched
    expect(fsm.transition(AD_STATES.SKIP_ATTEMPTED)).toBe(true);
    expect(fsm.getState()).toBe(AD_STATES.SKIP_ATTEMPTED);

    // 5. Ad ended / verified
    expect(fsm.transition(AD_STATES.AD_ENDED)).toBe(true);
    expect(fsm.getState()).toBe(AD_STATES.AD_ENDED);

    // 6. Return to IDLE
    expect(fsm.transition(AD_STATES.IDLE)).toBe(true);
    expect(fsm.getState()).toBe(AD_STATES.IDLE);
  });

  it('supports consecutive ad transitions within an ad pod (Ad 1 of 2 -> Ad 2 of 2)', () => {
    fsm.transition(AD_STATES.AD_DETECTED, { adUnitId: 'ad-pod-1-of-2' });
    fsm.transition(AD_STATES.SKIP_READY);
    fsm.transition(AD_STATES.SKIP_ATTEMPTED);

    // Ad 2 starts immediately without player losing .ad-showing
    expect(fsm.transition(AD_STATES.AD_DETECTED, { adUnitId: 'ad-pod-2-of-2' })).toBe(true);
    expect(fsm.getState()).toBe(AD_STATES.AD_DETECTED);
    expect(fsm.getContext().adUnitId).toBe('ad-pod-2-of-2');
  });

  it('rejects invalid state transitions', () => {
    // Cannot transition directly from IDLE to SKIP_ATTEMPTED
    expect(fsm.transition(AD_STATES.SKIP_ATTEMPTED)).toBe(false);
    expect(fsm.getState()).toBe(AD_STATES.IDLE);
  });

  it('allows reset to IDLE from any state', () => {
    fsm.transition(AD_STATES.AD_DETECTED);
    fsm.transition(AD_STATES.WAITING_FOR_SKIP);

    fsm.reset();
    expect(fsm.getState()).toBe(AD_STATES.IDLE);
    expect(fsm.getContext()).toEqual({});
  });

  it('notifies registered transition listeners with previous and target states', () => {
    const listener = vi.fn();
    fsm.onTransition(listener);

    fsm.transition(AD_STATES.AD_DETECTED, { adUnitId: 'test-ad' });

    expect(listener).toHaveBeenCalledWith(AD_STATES.IDLE, AD_STATES.AD_DETECTED, { adUnitId: 'test-ad' });
  });

  it('unsubscribes listeners cleanly', () => {
    const listener = vi.fn();
    const unsubscribe = fsm.onTransition(listener);

    unsubscribe();
    fsm.transition(AD_STATES.AD_DETECTED);

    expect(listener).not.toHaveBeenCalled();
  });
});
