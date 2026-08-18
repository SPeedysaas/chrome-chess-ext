import { readBoard } from './boardReader';
import type { BoardReadResult, ModeResult } from './types';

export function detectManualLivePosition(root: ParentNode, mode: ModeResult): BoardReadResult | null {
  if (mode.mode !== 'live' || !hasActiveLiveGame(root)) {
    return null;
  }

  const board = readBoard(root, 'manual-live-board-dom');
  if (!board) {
    return null;
  }

  return {
    ...board,
    evidence: [...board.evidence, 'manual-live-detection']
  };
}

function hasActiveLiveGame(root: ParentNode): boolean {
  const hasInGameControl = Array.from(root.querySelectorAll('button')).some((button) => {
    const label = button.getAttribute('aria-label')?.toLowerCase() ?? '';
    return ['resign', 'draw', 'aufgeben', 'remis'].some((value) => label.includes(value));
  });
  if (hasInGameControl) {
    return true;
  }

  const activeClock = root.querySelector('.clock-player-turn, [data-cy="clock-time"][role="timer"]');
  return Boolean(activeClock?.textContent && /\d{1,2}:\d{2}/.test(activeClock.textContent));
}
