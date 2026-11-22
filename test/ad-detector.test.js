import { describe, it, expect, beforeEach } from 'vitest';
import { detectAdState, findSkipButton, deriveAdUnitId } from '../src/content/ad-detector.js';

describe('ad-detector.js - Multi-Signal Ad & Skip Button Detection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('detectAdState()', () => {
    it('returns not_found when #movie_player is not present in the DOM', () => {
      const result = detectAdState();
      expect(result.isAdPlaying).toBe(false);
      expect(result.state).toBe('not_found');
      expect(result.reason).toBe('player_not_found');
    });

    it('returns not_found when player does not have .ad-showing or .ad-interrupting', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      document.body.appendChild(player);

      const result = detectAdState();
      expect(result.isAdPlaying).toBe(false);
      expect(result.state).toBe('not_found');
    });

    it('detects active ad when player has .ad-showing class', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.classList.add('ad-showing');
      document.body.appendChild(player);

      const result = detectAdState();
      expect(result.isAdPlaying).toBe(true);
      expect(result.state).toBe('ad_playing');
      expect(result.playerElement).toBe(player);
    });

    it('detects active ad when player has .ad-interrupting class', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.classList.add('ad-interrupting');
      document.body.appendChild(player);

      const result = detectAdState();
      expect(result.isAdPlaying).toBe(true);
      expect(result.state).toBe('ad_playing');
    });

    it('flags ambiguous state when overlay exists but player lacks ad classes', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      const overlay = document.createElement('div');
      overlay.className = 'ytp-ad-player-overlay';
      overlay.style.display = 'block';
      player.appendChild(overlay);
      document.body.appendChild(player);

      const result = detectAdState();
      expect(result.isAdPlaying).toBe(false);
      expect(result.state).toBe('ambiguous');
      expect(result.reason).toBe('overlay_present_without_player_ad_class');
    });

    it('extracts ad pod information in deriveAdUnitId', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.classList.add('ad-showing');

      const text = document.createElement('div');
      text.className = 'ytp-ad-text';
      text.textContent = 'Ad 1 of 2 · 0:15';
      player.appendChild(text);
      document.body.appendChild(player);

      const adUnitId = deriveAdUnitId(player);
      expect(adUnitId).toBe('ad-pod-1-of-2');
    });
  });

  describe('findSkipButton()', () => {
    it('detects active countdown and reports remaining seconds without selecting button', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.classList.add('ad-showing');

      const preview = document.createElement('div');
      preview.className = 'ytp-ad-preview-container';
      preview.style.display = 'block';
      preview.textContent = 'Video will play after ad · 5';
      player.appendChild(preview);

      const btn = document.createElement('button');
      btn.className = 'ytp-ad-skip-button-modern';
      btn.textContent = 'Skip Ad';
      btn.style.display = 'block';
      player.appendChild(btn);
      document.body.appendChild(player);

      const result = findSkipButton(player);
      expect(result.isReady).toBe(false);
      expect(result.countdownActive).toBe(true);
      expect(result.secondsRemaining).toBe(5);
      expect(result.button).toBeNull();
    });

    it('finds and verifies modern skip button when countdown has finished', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.classList.add('ad-showing');

      const container = document.createElement('div');
      container.className = 'ytp-ad-skip-button-container';
      container.style.display = 'block';

      const btn = document.createElement('button');
      btn.className = 'ytp-ad-skip-button-modern';
      btn.setAttribute('aria-label', 'Skip Ad');
      btn.style.display = 'block';
      container.appendChild(btn);
      player.appendChild(container);
      document.body.appendChild(player);

      const result = findSkipButton(player);
      expect(result.isReady).toBe(true);
      expect(result.button).toBe(btn);
    });

    it('disqualifies disabled skip buttons', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.classList.add('ad-showing');

      const btn = document.createElement('button');
      btn.className = 'ytp-ad-skip-button';
      btn.disabled = true;
      btn.style.display = 'block';
      player.appendChild(btn);
      document.body.appendChild(player);

      const result = findSkipButton(player);
      expect(result.isReady).toBe(false);
      expect(result.button).toBeNull();
    });

    it('disqualifies buttons with aria-disabled="true"', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.classList.add('ad-showing');

      const btn = document.createElement('div');
      btn.setAttribute('role', 'button');
      btn.className = 'ytp-ad-skip-button';
      btn.setAttribute('aria-disabled', 'true');
      btn.style.display = 'block';
      player.appendChild(btn);
      document.body.appendChild(player);

      const result = findSkipButton(player);
      expect(result.isReady).toBe(false);
      expect(result.button).toBeNull();
    });

    it('disqualifies visually hidden buttons (display: none)', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.classList.add('ad-showing');

      const btn = document.createElement('button');
      btn.className = 'ytp-ad-skip-button';
      btn.style.display = 'none';
      player.appendChild(btn);
      document.body.appendChild(player);

      const result = findSkipButton(player);
      expect(result.isReady).toBe(false);
      expect(result.button).toBeNull();
    });

    it('strictly avoids selecting non-ad controls like next video or subscribe buttons', () => {
      const player = document.createElement('div');
      player.id = 'movie_player';
      player.classList.add('ad-showing');

      const nextBtn = document.createElement('button');
      nextBtn.className = 'ytp-next-button';
      nextBtn.setAttribute('aria-label', 'Next (SHIFT+n)');
      nextBtn.style.display = 'block';
      player.appendChild(nextBtn);

      const subBtn = document.createElement('button');
      subBtn.className = 'ytp-subtitles-button';
      subBtn.style.display = 'block';
      player.appendChild(subBtn);
      document.body.appendChild(player);

      const result = findSkipButton(player);
      expect(result.isReady).toBe(false);
      expect(result.button).toBeNull();
    });
  });
});
