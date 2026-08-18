import { describe, expect, it } from 'vitest';
import { GameCache } from '../../src/detector/gameCache';
import { extractSanMoves, moveIndexFromFenPlacement, reconcileMoveList } from '../../src/detector/moveListReconciler';

describe('reconcileMoveList', () => {
  it('extracts each Chess.com move-list ply once when nodes contain highlighted spans', () => {
    document.body.innerHTML = `
      <wc-simple-move-list data-cy="move-list" class="move-list">
        <div class="main-line-row move-list-row">
          <div data-node="0-0" class="node white-move main-line-ply">
            <span class="node-highlight-content">d4</span>
          </div>
          <div data-node="0-1" class="node black-move main-line-ply">
            <span class="node-highlight-content">d5</span>
          </div>
        </div>
        <div class="main-line-row move-list-row">
          <div data-node="0-2" class="node white-move main-line-ply">
            <span class="node-highlight-content">
              <span class="icon-font-chess knight-white" data-figurine="N"></span>
              f3
            </span>
          </div>
          <div data-node="0-3" class="node black-move main-line-ply">
            <span class="node-highlight-content">Nf6</span>
          </div>
        </div>
      </wc-simple-move-list>
    `;

    expect(extractSanMoves(document)).toEqual(['d4', 'd5', 'Nf3', 'Nf6']);
  });

  it('reconstructs final FEN from replay SAN text', () => {
    document.body.innerHTML = `
      <div class="move-list">
        <span class="node">1.</span>
        <span class="node">e4</span>
        <span class="node">e5</span>
        <span class="node">2.</span>
        <span class="node">Nf3</span>
        <span class="node">Nc6</span>
      </div>
    `;

    const result = reconcileMoveList(document, 'replay');

    expect(result.ok).toBe(true);
    expect(result.moveIndex).toBe(4);
    expect(result.fen).toBe('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
  });

  it('reuses cached FEN positions for a saved game when switching selected moves', () => {
    const cache = new GameCache();
    document.body.innerHTML = `
      <div class="move-list">
        <button data-node="0-0" class="node selected">e4</button>
        <button data-node="0-1" class="node">e5</button>
        <button data-node="0-2" class="node">Nf3</button>
        <button data-node="0-3" class="node">Nc6</button>
      </div>
    `;

    const first = reconcileMoveList(document, 'replay', { cache, gameId: 'saved-game' });
    document.querySelector('[data-node="0-0"]')!.className = 'node';
    document.querySelector('[data-node="0-2"]')!.className = 'node current';
    const second = reconcileMoveList(document, 'replay', { cache, gameId: 'saved-game' });

    expect(first.ok).toBe(true);
    expect(first.moveIndex).toBe(1);
    expect(first.fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(second.ok).toBe(true);
    expect(second.moveIndex).toBe(3);
    expect(second.fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
    expect(cache.getFenPositionCache('saved-game', ['e4', 'e5', 'Nf3', 'Nc6'])?.positions).toHaveLength(5);
  });

  it('finds the ply index that matches a visible board placement', () => {
    expect(moveIndexFromFenPlacement(
      ['e4', 'e5', 'Nf3'],
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR'
    )).toBe(2);
  });

  it('returns invalid-san for ambiguous or broken move text', () => {
    document.body.innerHTML = '<div class="move-list"><span>e4</span><span>DefinitelyBad</span></div>';

    expect(reconcileMoveList(document, 'replay')).toEqual({
      ok: false,
      reason: 'invalid-san'
    });
  });

  it('does not reconcile active live-game state', () => {
    document.body.innerHTML = '<div class="move-list"><span>e4</span></div>';

    expect(reconcileMoveList(document, 'live')).toEqual({
      ok: false,
      reason: 'live-mode-blocked'
    });
  });
});
