import { describe, expect, it } from 'vitest';
import { GameCache } from '../../src/detector/gameCache';
import { resolveLiveUserColor, storeManualLiveUserColor } from '../../src/engine/livePlayerColor';
import type { DetectorResult } from '../../src/detector/types';

describe('live player color resolution', () => {
  it('resolves NotAosSpeed as black while ignoring Elo metadata', () => {
    const result = liveResult({
      white: { name: 'Opponent', rating: 1702 },
      black: { name: 'NotAosSpeed', rating: 1511 }
    });

    expect(resolveLiveUserColor(result, new GameCache(), 'NotAosSpeed')).toEqual({
      status: 'known',
      color: 'black'
    });
  });

  it('matches the cached username case-insensitively', () => {
    const result = liveResult({
      white: { name: '  notaosspeed  ', rating: 9999 },
      black: { name: 'Opponent', rating: 1511 }
    });

    expect(resolveLiveUserColor(result, new GameCache(), 'NotAosSpeed')).toEqual({
      status: 'known',
      color: 'white'
    });
  });

  it('reuses a manual color cached for the live game', () => {
    const cache = new GameCache();
    storeManualLiveUserColor(cache, '169747037990', 'black');

    expect(resolveLiveUserColor(liveResult(), cache, 'NotAosSpeed')).toEqual({
      status: 'known',
      color: 'black'
    });
  });

  it('requires a manual choice when the live players are unknown', () => {
    expect(resolveLiveUserColor(liveResult(), new GameCache(), 'NotAosSpeed')).toEqual({
      status: 'needs-choice'
    });
  });

  it('does not resolve color outside live games', () => {
    expect(resolveLiveUserColor({ ...liveResult(), mode: 'analysis' }, new GameCache(), 'NotAosSpeed')).toEqual({
      status: 'inactive'
    });
  });
});

function liveResult(players?: DetectorResult['players']): DetectorResult {
  const result: DetectorResult = {
    status: 'ok',
    gameId: '169747037990',
    mode: 'live',
    modeConfidence: 1,
    fenPlacement: '8/8/8/8/8/8/8/8',
    reconciledFromMoveList: false,
    sharing: { allowed: false, reason: 'live-game' },
    evidence: []
  };
  if (players) {
    result.players = players;
  }

  return result;
}
