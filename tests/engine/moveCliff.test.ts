import { describe, expect, it } from 'vitest';
import { detectMoveCliff } from '../../src/engine/moveCliff';
import type { EngineLine } from '../../src/engine/stockfishUci';

describe('move cliff detection', () => {
  it('returns no cliff when many moves stay close to best', () => {
    expect(detectMoveCliff([
      cp(1, 40),
      cp(2, 10),
      cp(3, -20),
      cp(4, -40)
    ], 'white')).toEqual({ warning: false });
  });

  it('warns when two safe moves are followed by a severe drop', () => {
    expect(detectMoveCliff([
      cp(1, 60),
      cp(2, 10),
      cp(3, -230),
      cp(4, -260)
    ], 'white')).toEqual({
      warning: true,
      safeMoveCount: 2,
      dropCentipawns: 240
    });
  });

  it('uses a dynamic safe band across up to eight lines', () => {
    expect(detectMoveCliff([
      cp(1, 80),
      cp(2, 70),
      cp(3, 50),
      cp(4, 40),
      cp(5, 20),
      cp(6, 0),
      cp(7, -220),
      cp(8, -300),
      cp(9, -900)
    ], 'white')).toEqual({
      warning: true,
      safeMoveCount: 6,
      dropCentipawns: 220
    });
  });

  it('normalizes evaluations from black perspective', () => {
    expect(detectMoveCliff([
      cp(1, -60),
      cp(2, -20),
      cp(3, 260)
    ], 'black')).toEqual({
      warning: true,
      safeMoveCount: 2,
      dropCentipawns: 280
    });
  });

  it('treats forced mate against the user as a severe cliff', () => {
    expect(detectMoveCliff([
      mate(1, 3),
      mate(2, -2)
    ], 'white')).toEqual({
      warning: true,
      safeMoveCount: 1,
      dropCentipawns: 199500
    });
  });
});

function cp(multipv: number, value: number): EngineLine {
  return { depth: 12, multipv, score: { type: 'cp', value }, move: `m${multipv}` };
}

function mate(multipv: number, value: number): EngineLine {
  return { depth: 12, multipv, score: { type: 'mate', value }, move: `m${multipv}` };
}
