import { afterEach, describe, expect, it } from 'vitest';
import { removePinOverlay, updatePinOverlay } from '../../src/content/pinOverlay';
import type { DetectorResult } from '../../src/detector/types';

const result: DetectorResult = {
  status: 'ok',
  gameId: 'pin-test',
  mode: 'analysis',
  modeConfidence: 1,
  boardConfidence: 1,
  board: {
    e1: 'wK',
    e2: 'wP',
    e8: 'bR'
  },
  orientation: 'white',
  reconciledFromMoveList: false,
  sharing: { allowed: true, reason: 'analysis-page' },
  evidence: []
};

describe('pin overlay', () => {
  afterEach(() => {
    removePinOverlay();
    document.body.innerHTML = '';
  });

  it('adds a corner badge to a strictly pinned piece element', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wk square-51"></div>
        <div class="piece wp square-52"></div>
        <div class="piece br square-58"></div>
      </wc-chess-board>
    `;

    updatePinOverlay(result);

    const pinnedPiece = document.querySelector('.piece.wp.square-52');
    const badge = pinnedPiece?.querySelector('[data-chesscom-pin-badge="true"]');
    expect(badge?.textContent).toBe('K!');
    expect(badge?.getAttribute('aria-label')).toBe('Active check pin');
    expect((badge as HTMLElement | null)?.style.position).toBe('absolute');
  });

  it('uses a different badge for active pins to pieces', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wq square-11"></div>
        <div class="piece wn square-21"></div>
        <div class="piece br square-81"></div>
      </wc-chess-board>
    `;

    updatePinOverlay({
      ...result,
      board: {
        a1: 'wQ',
        b1: 'wN',
        h1: 'bR'
      }
    });

    const badge = document.querySelector('.piece.wn.square-21 [data-chesscom-pin-badge="true"]');
    expect(badge?.textContent).toBe('P!');
    expect(badge?.getAttribute('aria-label')).toBe('Active piece pin');
  });

  it('does not add badges for open lines without current attackers', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wk square-71"></div>
        <div class="piece wp square-62"></div>
      </wc-chess-board>
    `;

    updatePinOverlay({
      ...result,
      board: {
        g1: 'wK',
        f2: 'wP'
      }
    });

    const badge = document.querySelector('.piece.wp.square-62 [data-chesscom-pin-badge="true"]');
    expect(badge).toBeNull();
  });

  it('removes stale active badges when a piece is no longer pinned', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wk square-51"></div>
        <div class="piece wp square-52"></div>
        <div class="piece br square-58"></div>
      </wc-chess-board>
    `;

    updatePinOverlay(result);
    updatePinOverlay({
      ...result,
      board: {
        e1: 'wK',
        e2: 'wP'
      }
    });

    const badge = document.querySelector('[data-chesscom-pin-badge="true"]');
    expect(badge).toBeNull();
  });

  it('keeps existing badges when the same position is rendered again', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wk square-51"></div>
        <div class="piece wp square-52"></div>
        <div class="piece br square-58"></div>
      </wc-chess-board>
    `;

    updatePinOverlay(result);
    const firstBadge = document.querySelector('[data-chesscom-pin-badge="true"]');
    updatePinOverlay(result);

    expect(document.querySelector('[data-chesscom-pin-badge="true"]')).toBe(firstBadge);
  });

  it('keeps the badge attached to the pinned piece when selected-square overlays share its square class', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="highlight square-52"></div>
        <div class="piece wk square-51"></div>
        <div class="piece wp square-52"></div>
        <div class="piece br square-58"></div>
      </wc-chess-board>
    `;

    updatePinOverlay(result);

    const selectedSquareOverlay = document.querySelector('.highlight.square-52');
    const pinnedPiece = document.querySelector('.piece.wp.square-52');
    expect(selectedSquareOverlay?.querySelector('[data-chesscom-pin-badge="true"]')).toBeNull();
    expect(pinnedPiece?.querySelector('[data-chesscom-pin-badge="true"]')).not.toBeNull();
  });

  it('uses flipped board square classes for black orientation', () => {
    document.body.innerHTML = `
      <wc-chess-board class="flipped">
        <div class="piece wk square-51"></div>
        <div class="piece wp square-52"></div>
        <div class="piece br square-58"></div>
      </wc-chess-board>
    `;

    updatePinOverlay({
      ...result,
      orientation: 'black'
    });

    expect(document.querySelector('.piece.wp.square-52 [data-chesscom-pin-badge="true"]')).not.toBeNull();
  });
});
