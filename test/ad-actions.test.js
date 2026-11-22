import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeSkipAction, verifySkipTransition } from '../src/content/ad-actions.js';

describe('ad-actions.js - Skip Execution & Transition Verification', () => {
  let player;
  let activeTimers = [];

  beforeEach(() => {
    activeTimers = [];
    document.body.innerHTML = '';
    player = document.createElement('div');
    player.id = 'movie_player';
    player.classList.add('ad-showing');
    document.body.appendChild(player);
  });

  afterEach(() => {
    for (const id of activeTimers) {
      clearTimeout(id);
    }
    activeTimers = [];
  });

  describe('executeSkipAction()', () => {
    it('fails when button is null or undefined', () => {
      const result = executeSkipAction(null, 'ad-1', player);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('button_null');
    });

    it('fails when button is not connected to the DOM', () => {
      const detachedBtn = document.createElement('button');
      const result = executeSkipAction(detachedBtn, 'ad-1', player);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('button_not_connected');
    });

    it('fails when button does not belong to the player element', () => {
      const outsideBtn = document.createElement('button');
      document.body.appendChild(outsideBtn);

      const result = executeSkipAction(outsideBtn, 'ad-1', player);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('button_not_in_player');
    });

    it('fails when button is disabled', () => {
      const btn = document.createElement('button');
      btn.disabled = true;
      player.appendChild(btn);

      const result = executeSkipAction(btn, 'ad-1', player);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('button_disabled');
    });

    it('fails when button is visually hidden (display: none)', () => {
      const btn = document.createElement('button');
      btn.style.display = 'none';
      player.appendChild(btn);

      const result = executeSkipAction(btn, 'ad-1', player);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('button_not_visible');
    });

    it('successfully dispatches native click on verified skip button', () => {
      const btn = document.createElement('button');
      btn.className = 'ytp-ad-skip-button-modern';
      btn.style.display = 'block';
      let clicked = false;
      btn.addEventListener('click', () => {
        clicked = true;
      });
      player.appendChild(btn);

      const result = executeSkipAction(btn, 'ad-1', player);
      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
    });
  });

  describe('verifySkipTransition()', () => {
    it('verifies transition when player ceases ad playback (.ad-showing removed)', async () => {
      const verifyPromise = verifySkipTransition(player, 'ad-1', 100, 800);

      // Simulate player removing ad class after 250ms
      const t1 = setTimeout(() => {
        player.classList.remove('ad-showing');
      }, 250);
      activeTimers.push(t1);

      const outcome = await verifyPromise;
      expect(outcome.verified).toBe(true);
      expect(outcome.reason).toBe('ad_class_cleared');
      expect(outcome.durationMs).toBeGreaterThanOrEqual(200);
    });

    it('verifies transition when ad pod advances to next unit', async () => {
      const adText = document.createElement('div');
      adText.className = 'ytp-ad-text';
      adText.textContent = 'Ad 1 of 2';
      player.appendChild(adText);

      const verifyPromise = verifySkipTransition(player, 'ad-pod-1-of-2', 100, 800);

      // Simulate pod advancing to Ad 2 of 2 after 250ms
      const t2 = setTimeout(() => {
        adText.textContent = 'Ad 2 of 2';
      }, 250);
      activeTimers.push(t2);

      const outcome = await verifyPromise;
      expect(outcome.verified).toBe(true);
      expect(outcome.reason).toBe('ad_pod_advanced');
    });

    it('reports failure when transition times out and ad remains unchanged', async () => {
      // Set short max timeout for test
      const outcome = await verifySkipTransition(player, 'ad-1', 100, 300);

      expect(outcome.verified).toBe(false);
      expect(outcome.reason).toBe('timeout_exceeded');
    });
  });
});
