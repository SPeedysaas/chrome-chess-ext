import type { EngineLine, EngineScore } from './stockfishUci';
import type { Orientation } from '../detector/types';

export interface MoveCliffThresholds {
  maxLines: number;
  safeBandCentipawns: number;
  cliffGapCentipawns: number;
}

export type MoveCliffResult =
  | { warning: false }
  | { warning: true; safeMoveCount: number; dropCentipawns: number };

export const DEFAULT_MOVE_CLIFF_THRESHOLDS: MoveCliffThresholds = {
  maxLines: 8,
  safeBandCentipawns: 80,
  cliffGapCentipawns: 200
};

export function detectMoveCliff(
  lines: readonly EngineLine[],
  userColor: Orientation,
  thresholds: MoveCliffThresholds = DEFAULT_MOVE_CLIFF_THRESHOLDS
): MoveCliffResult {
  const ranked = [...lines]
    .sort((a, b) => a.multipv - b.multipv)
    .slice(0, thresholds.maxLines)
    .map((line) => scoreForUser(line.score, userColor));

  if (ranked.length < 2) {
    return { warning: false };
  }

  const best = ranked[0]!;
  let safeMoveCount = 0;
  for (const score of ranked) {
    if (best - score <= thresholds.safeBandCentipawns) {
      safeMoveCount += 1;
      continue;
    }

    break;
  }

  if (safeMoveCount === 0 || safeMoveCount >= ranked.length) {
    return { warning: false };
  }

  const lastSafe = ranked[safeMoveCount - 1]!;
  const firstUnsafe = ranked[safeMoveCount]!;
  const dropCentipawns = lastSafe - firstUnsafe;

  return dropCentipawns >= thresholds.cliffGapCentipawns
    ? { warning: true, safeMoveCount, dropCentipawns }
    : { warning: false };
}

function scoreForUser(score: EngineScore, userColor: Orientation): number {
  const whitePerspective = score.type === 'mate'
    ? mateScore(score.value)
    : score.value;

  return userColor === 'white' ? whitePerspective : -whitePerspective;
}

function mateScore(value: number): number {
  const sign = Math.sign(value);
  return sign * (100000 - Math.abs(value) * 100);
}
