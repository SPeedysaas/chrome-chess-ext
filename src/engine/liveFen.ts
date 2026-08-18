import { Chess } from 'chess.js';
import type { DetectorResult, Orientation } from '../detector/types';

export type LiveAnalysisTarget = 'current' | 'user' | 'opponent';

export function buildLiveAnalysisFen(
  result: DetectorResult,
  userColor: Orientation,
  root: ParentNode = document,
  target: LiveAnalysisTarget = 'current'
): string | null {
  if (result.status !== 'ok' || result.mode !== 'live' || !result.fenPlacement) {
    return null;
  }

  if (!hasBothKings(result.fenPlacement)) {
    return null;
  }

  const sideToMove = inferSideToMove(result, root);
  if (!sideToMove) {
    return null;
  }

  const moveIndex = result.moveIndex ?? result.moveSequence?.length;
  const fullmove = moveIndex !== undefined ? Math.floor(moveIndex / 2) + 1 : 1;
  const targetSideToMove = target === 'current'
    ? sideToMove
    : target === 'opponent'
      ? oppositeColor(userColor)
      : userColor;
  const replayedState = replayedFenState(result, moveIndex);
  const castling = replayedState?.castling ?? '-';
  const enPassant = replayedState?.sideToMove === targetSideToMove
    ? replayedState.enPassant
    : '-';
  const halfmove = replayedState?.halfmove ?? '0';
  return `${result.fenPlacement} ${targetSideToMove.charAt(0)} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

function replayedFenState(
  result: DetectorResult,
  moveIndex: number | undefined
): { sideToMove: Orientation; castling: string; enPassant: string; halfmove: string } | null {
  if (!result.moveSequence || moveIndex === undefined || moveIndex > result.moveSequence.length) {
    return null;
  }

  const chess = new Chess();
  try {
    for (const move of result.moveSequence.slice(0, moveIndex)) {
      if (!chess.move(move)) {
        return null;
      }
    }
  } catch {
    return null;
  }

  const [placement, activeColor, castling, enPassant, halfmove] = chess.fen().split(/\s+/);
  if (placement !== result.fenPlacement) {
    return null;
  }

  return {
    sideToMove: activeColor === 'b' ? 'black' : 'white',
    castling: castling ?? '-',
    enPassant: enPassant ?? '-',
    halfmove: halfmove ?? '0'
  };
}

function inferSideToMove(
  result: DetectorResult,
  root: ParentNode
): Orientation | null {
  const activeClockColor = activeClockSide(root);
  if (activeClockColor) {
    return activeClockColor;
  }

  const activePlacement = activePlayerPlacement(root);
  if (activePlacement) {
    return colorForPlacement(activePlacement, result.orientation ?? 'white');
  }

  if (result.moveIndex !== undefined) {
    return result.moveIndex % 2 === 0 ? 'white' : 'black';
  }

  if (result.moveSequence && result.moveSequence.length > 0) {
    return result.moveSequence.length % 2 === 0 ? 'white' : 'black';
  }

  return null;
}

function activeClockSide(root: ParentNode): Orientation | null {
  const activeClock = root.querySelector('.clock-player-turn, [class*="clock-player-turn" i]');
  const classText = String(activeClock?.className ?? '');
  if (/\bclock-white\b/i.test(classText)) {
    return 'white';
  }

  if (/\bclock-black\b/i.test(classText)) {
    return 'black';
  }

  return null;
}

function activePlayerPlacement(root: ParentNode): 'top' | 'bottom' | null {
  const players = Array.from(root.querySelectorAll('.board-player-component, [class*="board-player" i], [class*="player-component" i]'));
  for (const element of players) {
    const classText = String(element.className);
    const active = /\b(?:active|clock-player-turn|player-to-move|is-turn)\b/i.test(classText)
      || element.querySelector('.clock-player-turn, [class*="clock-player-turn" i], [class*="active" i]') !== null;
    if (!active) {
      continue;
    }

    if (/\b(?:top|above)\b/i.test(classText)) {
      return 'top';
    }

    if (/\b(?:bottom|below)\b/i.test(classText)) {
      return 'bottom';
    }
  }

  return null;
}

function colorForPlacement(placement: 'top' | 'bottom', orientation: Orientation): Orientation {
  if (orientation === 'black') {
    return placement === 'bottom' ? 'black' : 'white';
  }

  return placement === 'bottom' ? 'white' : 'black';
}

function oppositeColor(color: Orientation): Orientation {
  return color === 'white' ? 'black' : 'white';
}

function hasBothKings(fenPlacement: string): boolean {
  return countMatches(fenPlacement, 'K') === 1 && countMatches(fenPlacement, 'k') === 1;
}

function countMatches(value: string, char: string): number {
  let count = 0;
  for (const current of value) {
    if (current === char) {
      count += 1;
    }
  }
  return count;
}
