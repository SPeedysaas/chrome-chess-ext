import { describe, expect, it } from 'vitest';
import { findAttackBalanceTactics } from '../../src/detector/attackBalanceAnalyzer';

describe('attack balance analyzer', () => {
  it('marks a piece as balanced when nonzero attackers equal defenders', () => {
    expect(findAttackBalanceTactics({
      d4: 'wN',
      e5: 'bP',
      e3: 'wP'
    })).toEqual([{
      square: 'd4',
      piece: 'wN',
      attackers: 1,
      defenders: 1,
      state: 'balanced'
    }]);
  });

  it('marks a piece as overloaded when attackers exceed defenders', () => {
    expect(findAttackBalanceTactics({
      d4: 'wN',
      e5: 'bP',
      c5: 'bP',
      e3: 'wP'
    })).toEqual([{
      square: 'd4',
      piece: 'wN',
      attackers: 2,
      defenders: 1,
      state: 'overloaded'
    }]);
  });

  it('marks one attacker and zero defenders as overloaded', () => {
    expect(findAttackBalanceTactics({
      d4: 'wN',
      e5: 'bP'
    })).toEqual([{
      square: 'd4',
      piece: 'wN',
      attackers: 1,
      defenders: 0,
      state: 'overloaded'
    }]);
  });

  it('does not mark pieces with zero attackers and zero defenders', () => {
    expect(findAttackBalanceTactics({
      a1: 'wR',
      h8: 'bK'
    })).toEqual([]);
  });

  it('does not mark pieces with more defenders than attackers', () => {
    expect(findAttackBalanceTactics({
      d4: 'wN',
      e5: 'bP',
      e3: 'wP',
      c3: 'wP'
    })).toEqual([]);
  });
});
