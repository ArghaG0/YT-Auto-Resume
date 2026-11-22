/**
 * Ad Lifecycle Finite State Machine (Deterministic & Pod-Aware)
 */

export const AD_STATES = {
  IDLE: 'IDLE',
  AD_DETECTED: 'AD_DETECTED',
  WAITING_FOR_SKIP: 'WAITING_FOR_SKIP',
  SKIP_READY: 'SKIP_READY',
  SKIP_ATTEMPTED: 'SKIP_ATTEMPTED',
  AD_ENDED: 'AD_ENDED',
};

// Transition matrix defining valid origin -> target state progressions
const VALID_TRANSITIONS = {
  [AD_STATES.IDLE]: [AD_STATES.AD_DETECTED, AD_STATES.IDLE],
  [AD_STATES.AD_DETECTED]: [
    AD_STATES.WAITING_FOR_SKIP,
    AD_STATES.SKIP_READY,
    AD_STATES.AD_ENDED,
    AD_STATES.IDLE,
  ],
  [AD_STATES.WAITING_FOR_SKIP]: [
    AD_STATES.SKIP_READY,
    AD_STATES.AD_DETECTED, // Ad pod transition (e.g. Ad 1 of 2 -> Ad 2 of 2)
    AD_STATES.AD_ENDED,
    AD_STATES.IDLE,
  ],
  [AD_STATES.SKIP_READY]: [
    AD_STATES.SKIP_ATTEMPTED,
    AD_STATES.AD_ENDED,
    AD_STATES.IDLE,
  ],
  [AD_STATES.SKIP_ATTEMPTED]: [
    AD_STATES.AD_ENDED,
    AD_STATES.AD_DETECTED, // Next ad in pod begins
    AD_STATES.WAITING_FOR_SKIP, // Retry on transition failure
    AD_STATES.IDLE,
  ],
  [AD_STATES.AD_ENDED]: [
    AD_STATES.IDLE,
    AD_STATES.AD_DETECTED, // Immediate subsequent ad sequence
  ],
};

export class AdLifecycleStateMachine {
  constructor() {
    this.state = AD_STATES.IDLE;
    this.context = {};
    this.listeners = new Set();
  }

  /**
   * Returns the current state of the FSM.
   * @returns {keyof typeof AD_STATES}
   */
  getState() {
    return this.state;
  }

  /**
   * Returns current context data associated with the active state.
   * @returns {Record<string, any>}
   */
  getContext() {
    return { ...this.context };
  }

  /**
   * Checks whether transitioning to targetState is valid from the current state.
   * Any state can transition to IDLE (e.g., reset or navigation).
   * @param {keyof typeof AD_STATES} targetState
   * @returns {boolean}
   */
  canTransition(targetState) {
    if (targetState === AD_STATES.IDLE) return true;
    const allowed = VALID_TRANSITIONS[this.state] || [];
    return allowed.includes(targetState);
  }

  /**
   * Executes a state transition if valid.
   * @param {keyof typeof AD_STATES} targetState
   * @param {Record<string, any>} [context={}]
   * @returns {boolean} Whether transition was accepted
   */
  transition(targetState, context = {}) {
    if (!this.canTransition(targetState)) {
      return false;
    }

    const previousState = this.state;
    this.state = targetState;
    this.context = { ...context };

    for (const listener of this.listeners) {
      try {
        listener(previousState, targetState, this.context);
      } catch (err) {
        console.error('[YouTube Auto Resume] Ad state listener error:', err);
      }
    }

    return true;
  }

  /**
   * Resets the state machine back to IDLE.
   * @param {Record<string, any>} [context={}]
   */
  reset(context = {}) {
    this.transition(AD_STATES.IDLE, context);
    this.context = {};
  }

  /**
   * Registers a callback invoked whenever a state transition occurs.
   * @param {(fromState: string, toState: string, context: Record<string, any>) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  onTransition(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
