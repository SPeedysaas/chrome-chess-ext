import { describe, expect, it } from 'vitest';
import { findPinTactics, findStrictPins } from '../../src/detector/pinAnalyzer';
import type { BoardMap } from '../../src/detector/types';

describe('findStrictPins', () => {
  it('marks a piece between its king and an enemy sliding attacker', () => {
    const board: BoardMap = {
      e1: 'wK',
      e2: 'wP',
      e8: 'bR'
    };

    expect(findStrictPins(board)).toEqual([
      {
        square: 'e2',
        piece: 'wP',
        targetSquare: 'e1',
        targetPiece: 'wK',
        attackerSquare: 'e8',
        attackerPiece: 'bR',
        severity: 'king'
      }
    ]);
  });

  it('marks a piece pinned to a higher-value non-king target', () => {
    const board: BoardMap = {
      a1: 'wQ',
      b1: 'wN',
      h1: 'bR'
    };

    expect(findStrictPins(board)).toEqual([
      expect.objectContaining({
        square: 'b1',
        piece: 'wN',
        targetSquare: 'a1',
        targetPiece: 'wQ',
        attackerSquare: 'h1',
        attackerPiece: 'bR',
        severity: 'material'
      })
    ]);
  });

  it('does not mark same-value or lower-value targets', () => {
    const board: BoardMap = {
      a1: 'wN',
      b1: 'wQ',
      h1: 'bR'
    };

    expect(findStrictPins(board)).toEqual([]);
  });

  it('does not mark a queen attacking through a pawn to an equal-value queen', () => {
    const board: BoardMap = {
      d1: 'wQ',
      d6: 'bP',
      d8: 'bQ'
    };

    expect(findStrictPins(board)).toEqual([]);
  });

  it('does not mark a queen attacking through a pawn to a lower-value rook', () => {
    const board: BoardMap = {
      f3: 'wQ',
      f7: 'bP',
      f8: 'bR'
    };

    expect(findStrictPins(board)).toEqual([]);
  });

  it('does not mark a queen attacking through a pawn to a lower-value bishop', () => {
    const board: BoardMap = {
      d2: 'bQ',
      c2: 'wP',
      b2: 'wB'
    };

    expect(findStrictPins(board)).toEqual([]);
  });

  it('requires exactly one friendly piece between target and attacker', () => {
    const board: BoardMap = {
      e1: 'wK',
      e2: 'wP',
      e3: 'wN',
      e8: 'bR'
    };

    expect(findStrictPins(board)).toEqual([]);
  });
});

describe('findPinTactics', () => {
  it('labels active king pins as check pins', () => {
    const board: BoardMap = {
      g1: 'wK',
      f2: 'wP',
      e3: 'bB'
    };

    expect(findPinTactics(board)).toEqual([
      expect.objectContaining({
        square: 'f2',
        state: 'active',
        kind: 'check',
        targetSquare: 'g1',
        attackerSquare: 'e3'
      })
    ]);
  });

  it('labels active non-king pins as piece pins', () => {
    const board: BoardMap = {
      a1: 'wQ',
      b1: 'wN',
      h1: 'bR'
    };

    expect(findPinTactics(board)).toEqual([
      expect.objectContaining({
        square: 'b1',
        state: 'active',
        kind: 'piece',
        targetSquare: 'a1',
        attackerSquare: 'h1'
      })
    ]);
  });

  it('ignores open lines without a current attacker', () => {
    const board: BoardMap = {
      g1: 'wK',
      f2: 'wP'
    };

    expect(findPinTactics(board)).toEqual([]);
  });
});
