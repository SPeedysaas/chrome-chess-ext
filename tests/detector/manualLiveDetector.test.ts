import { describe, expect, it } from 'vitest';
import { detectManualLivePosition } from '../../src/detector/manualLiveDetector';

describe('detectManualLivePosition', () => {
  it('manually reads the visible board during a real-time live game', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Resign"></button>
      <button aria-label="Offer Draw"></button>
      <div class="clock-player-turn">04:31</div>
    `;

    const result = detectManualLivePosition(document, {
      mode: 'live',
      confidence: 0.92,
      evidence: ['running-clock', 'resign-button']
    });

    expect(result?.source).toBe('manual-live-board-dom');
    expect(result?.board.a2).toBe('wP');
    expect(result?.confidence).toBeGreaterThan(0.8);
    expect(result?.evidence).toContain('manual-live-detection');
  });

  it('does not run manual live detection on replay pages', () => {
    const result = detectManualLivePosition(document, {
      mode: 'replay',
      confidence: 0.91,
      evidence: ['replay-controls']
    });

    expect(result).toBeNull();
  });

  it('does not analyze the waiting board before a game has been queued', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button>Partie starten</button>
      <div class="clock">10:00</div>
      <div class="clock">10:00</div>
    `;

    const result = detectManualLivePosition(document, {
      mode: 'live',
      confidence: 0.75,
      evidence: ['game-sidebar', 'running-clock', 'playable-board']
    });

    expect(result).toBeNull();
  });
});
