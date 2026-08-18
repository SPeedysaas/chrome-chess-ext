import { describe, expect, it } from 'vitest';
import { parseBestMove, parseInfoLine } from '../../src/engine/stockfishUci';

describe('Stockfish UCI parsing', () => {
  it('parses multipv centipawn evaluation lines', () => {
    expect(parseInfoLine('info depth 12 seldepth 18 multipv 2 score cp 34 pv e2e4 e7e5')).toEqual({
      depth: 12,
      multipv: 2,
      score: { type: 'cp', value: 34 },
      move: 'e2e4'
    });
  });

  it('parses mate evaluation lines', () => {
    expect(parseInfoLine('info depth 9 multipv 1 score mate -3 pv h2h4 d8h4')).toEqual({
      depth: 9,
      multipv: 1,
      score: { type: 'mate', value: -3 },
      move: 'h2h4'
    });
  });

  it('ignores incomplete info lines', () => {
    expect(parseInfoLine('info string NNUE evaluation using nn-ad9b42354671.nnue')).toBeNull();
  });

  it('parses bestmove lines', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
  });
});
