import { afterEach, describe, expect, it } from 'vitest';
import { removeForkOverlay, updateForkOverlay } from '../../src/content/forkOverlay';
import type { DetectorResult } from '../../src/detector/types';

const result: DetectorResult = {
  status: 'ok',
  gameId: 'fork-test',
  mode: 'analysis',
  modeConfidence: 1,
  boardConfidence: 1,
  board: {
    b2: 'wP',
    e2: 'wN',
    b5: 'bQ',
    d5: 'bR',
    g1: 'wK',
    g8: 'bK'
  },
  fen: '6k1/8/8/1q1r4/8/8/1P2N3/6K1 w - - 0 1',
  orientation: 'white',
  reconciledFromMoveList: false,
  sharing: { allowed: true, reason: 'analysis-page' },
  evidence: []
};

describe('fork overlay', () => {
  afterEach(() => {
    removeForkOverlay();
    document.body.innerHTML = '';
  });

  it('adds a destination-square marker for a possible fork', () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';

    updateForkOverlay(result);

    const marker = document.querySelector<HTMLElement>('[data-chesscom-fork-square="true"]');
    expect(marker?.textContent).toBe('D');
    expect(marker?.getAttribute('aria-label')).toBe('Defended fork available on c3 targeting b5 and d5');
    expect(marker?.style.left).toBe('25%');
    expect(marker?.style.top).toBe('62.5%');
  });

  it('adds a source-piece badge for the piece that can make the fork', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-52"></div>
      </wc-chess-board>
    `;

    updateForkOverlay(result);

    const badge = document.querySelector<HTMLElement>('.piece.wn.square-52 [data-chesscom-fork-source="true"]');
    expect(badge?.textContent).toBe('D');
    expect(badge?.getAttribute('aria-label')).toBe('Knight can move to c3 to create a defended fork');
    expect(document.querySelector('[data-chesscom-fork-square="true"]')).not.toBeNull();
  });

  it('draws a visible-board fork for the non-active color', () => {
    document.body.innerHTML = `
      <wc-chess-board class="flipped">
        <div class="piece wn square-57"></div>
      </wc-chess-board>
    `;

    updateForkOverlay({
      ...result,
      fen: '1Q2nr1k/p3N3/2p5/2B5/8/1P4P1/q1P2P1P/5RK1 b - - 0 1',
      orientation: 'black'
    });

    const marker = document.querySelector<HTMLElement>('[data-chesscom-fork-square="true"]');
    const badge = document.querySelector<HTMLElement>('.piece.wn.square-57 [data-chesscom-fork-source="true"]');
    expect(marker?.getAttribute('aria-label')).toBe('Checking fork available on g6 targeting f8 and h8');
    expect(badge?.getAttribute('aria-label')).toBe('Knight can move to g6 to create a check fork');
  });

  it('draws a fork from board-only detection without a full FEN', () => {
    const { fen: _fen, ...boardOnlyResult } = result;

    document.body.innerHTML = `
      <wc-chess-board class="flipped">
        <div class="piece wn square-57"></div>
      </wc-chess-board>
    `;

    updateForkOverlay({
      ...boardOnlyResult,
      fenPlacement: '1Q2nr1k/p3N3/5p2/2B5/8/1P4P1/P4P1P/5RK1',
      orientation: 'black'
    });

    const marker = document.querySelector<HTMLElement>('[data-chesscom-fork-square="true"]');
    const badge = document.querySelector<HTMLElement>('.piece.wn.square-57 [data-chesscom-fork-source="true"]');
    expect(marker?.getAttribute('aria-label')).toBe('Checking fork available on g6 targeting f8 and h8');
    expect(badge?.getAttribute('aria-label')).toBe('Knight can move to g6 to create a check fork');
  });

  it('removes stale fork markers when the overlay is refreshed', () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';

    updateForkOverlay(result);
    updateForkOverlay({
      ...result,
      fen: '6k1/8/8/8/8/8/1P2N3/6K1 b - - 0 1'
    });

    expect(document.querySelector('[data-chesscom-fork-square="true"]')).toBeNull();
    expect(document.querySelector('[data-chesscom-fork-source="true"]')).toBeNull();
  });

  it('keeps existing markers when the same position is rendered again', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-52"></div>
      </wc-chess-board>
    `;

    updateForkOverlay(result);
    const firstMarker = document.querySelector('[data-chesscom-fork-square="true"]');
    const firstBadge = document.querySelector('[data-chesscom-fork-source="true"]');
    updateForkOverlay(result);

    expect(document.querySelector('[data-chesscom-fork-square="true"]')).toBe(firstMarker);
    expect(document.querySelector('[data-chesscom-fork-source="true"]')).toBe(firstBadge);
  });
});
