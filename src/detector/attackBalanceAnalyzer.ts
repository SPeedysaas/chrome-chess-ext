import type { BoardMap, PieceCode, Square } from './types';

export type AttackBalanceState = 'balanced' | 'overloaded';

export interface AttackBalanceTactic {
  square: Square;
  piece: PieceCode;
  attackers: number;
  defenders: number;
  state: AttackBalanceState;
}

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export function findAttackBalanceTactics(board: BoardMap): AttackBalanceTactic[] {
  const tactics: AttackBalanceTactic[] = [];

  for (const [square, piece] of Object.entries(board) as [Square, PieceCode][]) {
    if (!piece) {
      continue;
    }

    const attackers = countAttackers(board, square, piece);
    const defenders = countDefenders(board, square, piece);

    if (attackers === 0 && defenders === 0) {
      continue;
    }

    if (attackers === defenders) {
      tactics.push({ square, piece, attackers, defenders, state: 'balanced' });
      continue;
    }

    if (attackers > defenders) {
      tactics.push({ square, piece, attackers, defenders, state: 'overloaded' });
    }
  }

  return tactics.sort((a, b) => a.square.localeCompare(b.square));
}

function countAttackers(board: BoardMap, square: Square, piece: PieceCode): number {
  return countPiecesAttacking(board, square, (candidateSquare, candidatePiece) =>
    candidateSquare !== square && candidatePiece[0] !== piece[0]);
}

function countDefenders(board: BoardMap, square: Square, piece: PieceCode): number {
  return countPiecesAttacking(board, square, (candidateSquare, candidatePiece) =>
    candidateSquare !== square && candidatePiece[0] === piece[0]);
}

function countPiecesAttacking(
  board: BoardMap,
  target: Square,
  include: (candidateSquare: Square, candidatePiece: PieceCode) => boolean
): number {
  return (Object.entries(board) as [Square, PieceCode][])
    .filter(([candidateSquare, candidatePiece]) => candidatePiece && include(candidateSquare, candidatePiece))
    .filter(([candidateSquare, candidatePiece]) => attacksSquare(board, candidateSquare, candidatePiece, target))
    .length;
}

function attacksSquare(board: BoardMap, from: Square, piece: PieceCode, target: Square): boolean {
  const fromCoord = coord(from);
  const targetCoord = coord(target);
  const fileDelta = targetCoord.file - fromCoord.file;
  const rankDelta = targetCoord.rank - fromCoord.rank;
  const absFile = Math.abs(fileDelta);
  const absRank = Math.abs(rankDelta);

  switch (piece[1]) {
    case 'P': {
      const forward = piece[0] === 'w' ? 1 : -1;
      return absFile === 1 && rankDelta === forward;
    }
    case 'N':
      return (absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1);
    case 'B':
      return absFile === absRank && pathIsClear(board, fromCoord, targetCoord);
    case 'R':
      return (fileDelta === 0 || rankDelta === 0) && pathIsClear(board, fromCoord, targetCoord);
    case 'Q':
      return (fileDelta === 0 || rankDelta === 0 || absFile === absRank) && pathIsClear(board, fromCoord, targetCoord);
    case 'K':
      return Math.max(absFile, absRank) === 1;
    default:
      return false;
  }
}

function pathIsClear(board: BoardMap, from: Coord, target: Coord): boolean {
  const fileStep = Math.sign(target.file - from.file);
  const rankStep = Math.sign(target.rank - from.rank);

  for (
    let file = from.file + fileStep, rank = from.rank + rankStep;
    file !== target.file || rank !== target.rank;
    file += fileStep, rank += rankStep
  ) {
    if (board[squareFromCoord({ file, rank })]) {
      return false;
    }
  }

  return true;
}

interface Coord {
  file: number;
  rank: number;
}

function coord(square: Square): Coord {
  return {
    file: files.indexOf(square[0] as typeof files[number]),
    rank: ranks.indexOf(square[1] as typeof ranks[number])
  };
}

function squareFromCoord(value: Coord): Square {
  return `${files[value.file]}${ranks[value.rank]}` as Square;
}
