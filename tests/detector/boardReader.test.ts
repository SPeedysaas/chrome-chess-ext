import { describe, expect, it } from 'vitest';
import { fenPlacementFromBoard, readBoard, squareFromChessComClass } from '../../src/detector/boardReader';
import { findPinTactics } from '../../src/detector/pinAnalyzer';

describe('readBoard', () => {
  it('reads Chess.com-style piece classes from a white-oriented board', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-51"></div>
        <div class="piece bk square-58"></div>
      </chess-board>
    `;

    const result = readBoard(document);

    expect(result?.orientation).toBe('white');
    expect(result?.board.a2).toBe('wP');
    expect(result?.board.e8).toBe('bK');
    expect(result?.source).toBe('board-dom');
    expect(result?.confidence).toBeGreaterThan(0.8);
    expect(result?.fenPlacement).toBe('4k3/8/8/8/8/8/P7/4K3');
  });

  it('detects black orientation without rotating Chess.com square classes', () => {
    document.body.innerHTML = `
      <chess-board class="flipped">
        <div class="piece wp square-12"></div>
        <div class="piece bk square-58"></div>
      </chess-board>
    `;

    const result = readBoard(document);

    expect(result?.orientation).toBe('black');
    expect(result?.board.a2).toBe('wP');
    expect(result?.board.e8).toBe('bK');
  });

  it('reads flipped Chess.com wc board positions for tactical analysis', () => {
    document.body.innerHTML = `
      <wc-chess-board class="board flipped">
        <div class="piece br square-18"></div>
        <div class="piece bp square-27"></div>
        <div class="piece wb square-72"></div>
      </wc-chess-board>
    `;

    const result = readBoard(document);

    expect(result?.orientation).toBe('black');
    expect(result?.board.a8).toBe('bR');
    expect(result?.board.b7).toBe('bP');
    expect(result?.board.g2).toBe('wB');
    expect(result?.fenPlacement).toBe('r7/1p6/8/8/8/8/6B1/8');
    expect(findPinTactics(result!.board)).toEqual([
      expect.objectContaining({
        square: 'b7',
        piece: 'bP',
        targetSquare: 'a8',
        targetPiece: 'bR',
        attackerSquare: 'g2',
        attackerPiece: 'wB',
        kind: 'piece'
      })
    ]);
  });

  it('converts square classes directly', () => {
    expect(squareFromChessComClass('square-12', 'white')).toBe('a2');
    expect(squareFromChessComClass('square-12', 'black')).toBe('a2');
    expect(squareFromChessComClass('not-a-square', 'white')).toBeNull();
  });

  it('builds compressed FEN placement from a board map', () => {
    expect(fenPlacementFromBoard({ a1: 'wK', h8: 'bK', d4: 'wP' })).toBe('7k/8/8/8/3P4/8/8/K7');
  });
});
