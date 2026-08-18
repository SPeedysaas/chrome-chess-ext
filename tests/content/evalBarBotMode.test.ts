import { describe, expect, it } from 'vitest';
import { isChessComBotGame } from '../../src/content/evalBar';

describe('no-capture bot mode routing', () => {
  it('recognizes Chess.com computer and bot game routes', () => {
    expect(isChessComBotGame('https://www.chess.com/play/computer')).toBe(true);
    expect(isChessComBotGame('https://www.chess.com/play/bots/coach-danny')).toBe(true);
  });

  it('does not enable the constraint for human live games or other sites', () => {
    expect(isChessComBotGame('https://www.chess.com/play/online')).toBe(false);
    expect(isChessComBotGame('https://example.com/play/computer')).toBe(false);
  });
});
