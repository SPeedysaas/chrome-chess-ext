import { afterEach, describe, expect, it } from 'vitest';
import { buildLiveAnalysisFen } from '../../src/engine/liveFen';
import type { DetectorResult } from '../../src/detector/types';

describe('live analysis FEN', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('builds a full FEN when the user color is active in the turn UI', () => {
    document.body.innerHTML = `
      <div class="board-player-component board-player-bottom active">
        <a class="user-username">NotAosSpeed</a>
      </div>
    `;

    expect(buildLiveAnalysisFen(liveResult(), 'white', document)).toBe('8/8/8/8/8/8/P7/4K2k w - - 0 1');
  });

  it('builds a black-to-move FEN when the top player is active on a white-oriented board', () => {
    document.body.innerHTML = `
      <div class="board-player-component board-player-top clock-player-turn">
        <a class="user-username">NotAosSpeed</a>
      </div>
    `;

    expect(buildLiveAnalysisFen(liveResult(), 'black', document)).toBe('8/8/8/8/8/8/P7/4K2k b - - 0 1');
  });

  it('uses Chess.com active clock color classes when player placement is not marked active', () => {
    document.body.innerHTML = `
      <div class="board-layout-player board-layout-top player-component player-top">
        <div class="clock-component clock-top clock-white clock-player-turn">
          <span class="clock-time-monospace" data-cy="clock-time" role="timer">10:00</span>
        </div>
      </div>
      <div class="board-layout-player board-layout-bottom player-component player-bottom">
        <div class="clock-component clock-bottom clock-black">
          <span class="clock-time-monospace" data-cy="clock-time" role="timer">10:00</span>
        </div>
      </div>
    `;

    expect(buildLiveAnalysisFen({ ...liveResult(), orientation: 'black' }, 'black', document)).toBe('8/8/8/8/8/8/P7/4K2k w - - 0 1');
  });

  it('can target the opponent move instead of the user move', () => {
    document.body.innerHTML = `
      <div class="board-player-component board-player-bottom active">
        <a class="user-username">NotAosSpeed</a>
      </div>
    `;

    expect(buildLiveAnalysisFen(liveResult(), 'white', document, 'opponent')).toBe('8/8/8/8/8/8/P7/4K2k b - - 0 1');
  });

  it('falls back to move count parity when turn UI is unavailable', () => {
    expect(buildLiveAnalysisFen({ ...liveResult(), moveSequence: ['e4', 'e5'] }, 'white', document)).toBe('8/8/8/8/8/8/P7/4K2k w - - 0 2');
  });

  it('preserves castling rights when the replayed move history matches the live board', () => {
    const result = {
      ...liveResult(),
      fenPlacement: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R',
      moveSequence: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6']
    };

    expect(buildLiveAnalysisFen(result, 'white', document)).toBe(
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
    );
  });

  it('does not restore castling rights after a king has moved back', () => {
    const result = {
      ...liveResult(),
      fenPlacement: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR',
      moveSequence: ['e4', 'e5', 'Ke2', 'Ke7', 'Ke1', 'Ke8']
    };

    expect(buildLiveAnalysisFen(result, 'white', document)).toBe(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w - - 4 4'
    );
  });

  it('prefers the live turn UI over a stale move index', () => {
    document.body.innerHTML = `
      <div class="board-player-component board-player-top clock-player-turn">
        <a class="user-username">Opponent</a>
      </div>
    `;

    expect(buildLiveAnalysisFen({ ...liveResult(), moveIndex: 4 }, 'white', document)).toBe('8/8/8/8/8/8/P7/4K2k b - - 0 3');
  });

  it('returns null when side to move is not known', () => {
    document.body.innerHTML = '';

    expect(buildLiveAnalysisFen(liveResult(), 'white', document)).toBeNull();
  });

  it('returns null for transient board placements without both kings', () => {
    document.body.innerHTML = `
      <div class="board-player-component board-player-bottom active"></div>
    `;

    expect(buildLiveAnalysisFen({
      ...liveResult(),
      fenPlacement: '8/8/8/8/8/8/P7/4K3'
    }, 'white', document)).toBeNull();
  });
});

function liveResult(): DetectorResult {
  return {
    status: 'ok',
    gameId: '169747037990',
    mode: 'live',
    modeConfidence: 1,
    fenPlacement: '8/8/8/8/8/8/P7/4K2k',
    orientation: 'white',
    reconciledFromMoveList: false,
    sharing: { allowed: false, reason: 'live-game' },
    evidence: []
  };
}
