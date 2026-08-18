import { afterEach, describe, expect, it } from 'vitest';
import { removeAttackBalanceOverlay, updateAttackBalanceOverlay } from '../../src/content/attackBalanceOverlay';
import type { DetectorResult } from '../../src/detector/types';

const result: DetectorResult = {
  status: 'ok',
  gameId: 'attack-balance-test',
  mode: 'analysis',
  modeConfidence: 1,
  boardConfidence: 1,
  board: {
    d4: 'wN',
    e5: 'bP',
    e3: 'wP',
    a1: 'wR'
  },
  orientation: 'white',
  reconciledFromMoveList: false,
  sharing: { allowed: true, reason: 'analysis-page' },
  evidence: []
};

describe('attack balance overlay', () => {
  afterEach(() => {
    removeAttackBalanceOverlay();
    document.body.innerHTML = '';
  });

  it('adds a compact balanced badge with exact counts in the aria label', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44"></div>
        <div class="piece bp square-55"></div>
        <div class="piece wp square-53"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay(result);

    const badge = document.querySelector<HTMLElement>('wc-chess-board > [data-chesscom-attack-balance-badge="true"]');
    expect(badge?.textContent).toBe('=');
    expect(badge?.getAttribute('aria-label')).toBe('Balanced piece: 1 attacker and 1 defender');
    expect(badge?.style.position).toBe('absolute');
    expect(badge?.style.left).toBe('46.5%');
    expect(badge?.style.top).toBe('50.375%');
    expect(badge?.style.justifyItems).toBe('center');
    expect(badge?.style.alignItems).toBe('center');
    expect(badge?.style.textAlign).toBe('center');
    expect(badge?.style.lineHeight).toBe('1');
  });

  it('adds a compact overloaded badge for one more attacker than defender', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44"></div>
        <div class="piece bp square-55"></div>
        <div class="piece bp square-35"></div>
        <div class="piece wp square-53"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay({
      ...result,
      board: {
        d4: 'wN',
        e5: 'bP',
        c5: 'bP',
        e3: 'wP'
      }
    });

    const badge = document.querySelector<HTMLElement>('wc-chess-board > [data-chesscom-attack-balance-badge="true"]');
    expect(badge?.textContent).toBe('!');
    expect(badge?.getAttribute('aria-label')).toBe('Overloaded piece: 2 attackers and 1 defender');
  });

  it('adds a double exclamation badge for two or more attackers than defenders', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44"></div>
        <div class="piece bp square-55"></div>
        <div class="piece bp square-35"></div>
        <div class="piece bn square-65"></div>
        <div class="piece wp square-53"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay({
      ...result,
      board: {
        d4: 'wN',
        e5: 'bP',
        c5: 'bP',
        f5: 'bN',
        e3: 'wP'
      }
    });

    const badge = document.querySelector<HTMLElement>('wc-chess-board > [data-chesscom-attack-balance-badge="true"]');
    expect(badge?.textContent).toBe('!!');
    expect(badge?.getAttribute('aria-label')).toBe('Overloaded piece: 3 attackers and 1 defender');
  });

  it('moves a balanced badge to the top-left corner when the same piece already has a pin badge', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44">
          <span data-chesscom-pin-badge="true"></span>
        </div>
        <div class="piece bp square-55"></div>
        <div class="piece wp square-53"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay(result);

    const pinBadge = document.querySelector<HTMLElement>('.piece.wn.square-44 [data-chesscom-pin-badge="true"]');
    const balancedBadge = document.querySelector<HTMLElement>('wc-chess-board > [data-chesscom-attack-balance-badge="true"]');
    expect(pinBadge).not.toBeNull();
    expect(balancedBadge?.textContent).toBe('=');
    expect(balancedBadge?.style.left).toBe('38%');
    expect(balancedBadge?.style.top).toBe('50.375%');
  });

  it('keeps the badge outside the clicked piece so piece redraws do not remove it', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44"></div>
        <div class="piece bp square-55"></div>
        <div class="piece wp square-53"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay(result);

    const piece = document.querySelector<HTMLElement>('.piece.wn.square-44');
    piece?.replaceChildren();

    const badge = document.querySelector<HTMLElement>('wc-chess-board > [data-chesscom-attack-balance-badge="true"]');
    expect(badge?.textContent).toBe('=');
    expect(piece?.querySelector('[data-chesscom-attack-balance-badge="true"]')).toBeNull();
  });

  it('removes stale badges when refreshed', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44"></div>
        <div class="piece bp square-55"></div>
        <div class="piece wp square-53"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay(result);
    updateAttackBalanceOverlay({
      ...result,
      board: {
        d4: 'wN'
      }
    });

    expect(document.querySelector('[data-chesscom-attack-balance-badge="true"]')).toBeNull();
  });

  it('keeps existing badges when the same position is rendered again', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44"></div>
        <div class="piece bp square-55"></div>
        <div class="piece wp square-53"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay(result);
    const firstBadge = document.querySelector('[data-chesscom-attack-balance-badge="true"]');
    updateAttackBalanceOverlay(result);

    expect(document.querySelector('[data-chesscom-attack-balance-badge="true"]')).toBe(firstBadge);
  });

  it('does not render when the detector result is incomplete', () => {
    document.body.innerHTML = '<wc-chess-board><div class="piece wn square-44"></div></wc-chess-board>';
    const { board, ...incompleteResult } = result;

    updateAttackBalanceOverlay({
      ...incompleteResult,
      status: 'low-confidence'
    });

    expect(document.querySelector('[data-chesscom-attack-balance-badge="true"]')).toBeNull();
  });
});
