import { describe, expect, it } from 'vitest';
import { findForkMoves } from '../../src/detector/forkAnalyzer';

describe('findForkMoves', () => {
  it('finds a defended destination square that would fork two valuable pieces', () => {
    const forks = findForkMoves('6k1/8/8/1q1r4/8/8/1P2N3/6K1 w - - 0 1');

    expect(forks).toEqual([
      expect.objectContaining({
        from: 'e2',
        to: 'c3',
        piece: 'wN',
        kind: 'defended',
        targetSquares: ['b5', 'd5']
      })
    ]);
  });

  it('ignores a fork when the opponent can immediately capture the forking piece', () => {
    const forks = findForkMoves('6k1/8/8/1q1r4/1p6/8/4N3/6K1 w - - 0 1');

    expect(forks).not.toContainEqual(expect.objectContaining({
      from: 'e2',
      to: 'c3',
      piece: 'wN',
      targetSquares: ['b5', 'd5']
    }));
  });

  it('ignores a defended fork when recapturing does not save a valuable target', () => {
    const forks = findForkMoves(
      'r2qk2r/ppp2ppp/n2p1b1n/3Pp3/2P1P1b1/2N2N2/PP3PPP/R2QKB1R b - - 0 1',
      { side: 'both' }
    );

    expect(forks).not.toContainEqual(expect.objectContaining({
      from: 'd1',
      to: 'a4',
      piece: 'wQ',
      targetSquares: ['a6', 'e8']
    }));
  });

  it('does not count the moved piece as defending its fork destination', () => {
    const forks = findForkMoves('6k1/8/8/1q1r4/8/8/4N3/6K1 w - - 0 1');

    expect(forks).toContainEqual(expect.objectContaining({
      from: 'e2',
      to: 'c3',
      piece: 'wN',
      kind: 'basic',
      targetSquares: ['b5', 'd5']
    }));
  });

  it('ignores queen forks against lower-value material that can be answered', () => {
    const forks = findForkMoves(
      '5rk1/3b1ppp/1Q1b4/1P1p4/2q1P3/5N1P/5PP1/R5K1 b - - 0 1',
      { side: 'both' }
    );

    expect(forks).not.toContainEqual(expect.objectContaining({
      from: 'c4',
      to: 'c3',
      piece: 'bQ',
      targetSquares: ['a1', 'f3']
    }));
    expect(forks).not.toContainEqual(expect.objectContaining({
      from: 'b6',
      to: 'd6',
      piece: 'wQ',
      targetSquares: ['d7', 'f8']
    }));
  });

  it('marks a fork destination as checking when the move attacks the king', () => {
    const forks = findForkMoves('8/8/8/7k/4q3/8/4N3/K7 w - - 0 1');

    expect(forks).toContainEqual(expect.objectContaining({
      from: 'e2',
      to: 'g3',
      piece: 'wN',
      kind: 'check',
      targetSquares: ['e4', 'h5']
    }));
  });

  it('marks a fork destination as between pieces when targets are on opposite lines', () => {
    const forks = findForkMoves('7k/4b3/8/8/R7/8/K5B1/4q3 w - - 0 1');

    expect(forks).toContainEqual(expect.objectContaining({
      from: 'a4',
      to: 'e4',
      piece: 'wR',
      kind: 'between',
      targetSquares: ['e1', 'e7']
    }));
  });

  it('can find visible-board fork moves for the non-active color', () => {
    const forks = findForkMoves(
      '1Q2nr1k/p3N3/2p5/2B5/8/1P4P1/q1P2P1P/5RK1 b - - 0 1',
      { side: 'both' }
    );

    expect(forks).toContainEqual(expect.objectContaining({
      from: 'e7',
      to: 'g6',
      piece: 'wN',
      kind: 'check',
      targetSquares: ['f8', 'h8']
    }));
  });

  it('ignores invalid board-only placements instead of throwing', () => {
    expect(findForkMoves('8/8/8/8/8/8/8/8')).toEqual([]);
  });
});
