import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';
import type { BoardMap, PieceCode, Square } from './types';

export type ForkKind = 'basic' | 'defended' | 'check' | 'between';

export interface ForkMove {
  from: Square;
  to: Square;
  piece: PieceCode;
  kind: ForkKind;
  targetSquares: Square[];
}

export interface FindForkMovesOptions {
  side?: 'active' | 'both';
}

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
const valuableTargets = new Set(['n', 'b', 'r', 'q', 'k']);
const materialTargets = new Set(['n', 'b', 'r', 'q']);
const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

export function findForkMoves(fen: string, options: FindForkMovesOptions = {}): ForkMove[] {
  const fens = fensForSearch(fen, options.side ?? 'active');
  const forks = fens.flatMap((fenForSide) => findForkMovesForActiveSide(fenForSide));
  const seen = new Set<string>();

  return forks
    .filter((fork) => {
      const key = `${fork.from}:${fork.to}:${fork.piece}:${fork.targetSquares.join(',')}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.to.localeCompare(b.to) || a.from.localeCompare(b.from));
}

function fensForSearch(fen: string, side: 'active' | 'both'): string[] {
  const fields = fen.trim().split(/\s+/);
  if (fields.length === 1 && isFenPlacement(fields[0] ?? '')) {
    return fensForBothSides(`${fields[0]} w - - 0 1`);
  }

  return side === 'both' ? fensForBothSides(fen) : [fen];
}

function findForkMovesForActiveSide(fen: string): ForkMove[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }

  const moves = chess.moves({ verbose: true });
  const forks: ForkMove[] = [];

  for (const move of moves) {
    const after = new Chess(move.after);
    const board = boardFromFen(move.after);
    const movedPiece = pieceCode(move.color, move.promotion ?? move.piece);
    const targetSquares = attackedValuableTargets(board, move.to as Square, movedPiece);

    if (targetSquares.length < 2) {
      continue;
    }

    if (!isMaterialWinningFork(after, move.to as Square, movedPiece, targetSquares)) {
      continue;
    }

    forks.push({
      from: move.from as Square,
      to: move.to as Square,
      piece: movedPiece,
      kind: classifyFork(board, move, after.isCheck(), targetSquares),
      targetSquares
    });
  }

  return forks;
}

function isMaterialWinningFork(afterFork: Chess, forkSquare: Square, forkPiece: PieceCode, targetSquares: Square[]): boolean {
  const boardAfterFork = boardFromFen(afterFork.fen());
  const hasMaterialTarget = targetSquares.some((targetSquare) => {
    const targetPiece = boardAfterFork[targetSquare];
    return targetPiece && targetPiece[0] !== forkPiece[0] && materialTargets.has(targetPiece.charAt(1).toLowerCase());
  });
  const hasKingTarget = targetSquares.some((targetSquare) => {
    const targetPiece = boardAfterFork[targetSquare];
    return targetPiece && targetPiece[0] !== forkPiece[0] && targetPiece[1] === 'K';
  });
  const targetFilter = hasKingTarget || forkPiece[1] === 'Q'
    ? hasProfitableMaterialTarget
    : hasRemainingMaterialTarget;

  if (!hasMaterialTarget || !targetFilter(boardAfterFork, forkSquare, forkPiece, targetSquares)) {
    return false;
  }

  const replies = afterFork.moves({ verbose: true });
  if (replies.length === 0) {
    return true;
  }

  return replies.every((reply) => {
    const board = boardFromFen(reply.after);
    if (board[forkSquare] === forkPiece) {
      return targetFilter(board, forkSquare, forkPiece, targetSquares);
    }

    return isFavorableRecaptureAvailable(board, reply, forkSquare, forkPiece);
  });
}

function isFavorableRecaptureAvailable(board: BoardMap, reply: Move, forkSquare: Square, forkPiece: PieceCode): boolean {
  if (reply.to !== forkSquare || !reply.captured) {
    return false;
  }

  const capturingPiece = pieceCode(reply.color, reply.piece);
  const forkColor = forkPiece[0] as Color;
  return pieceValue(capturingPiece) > pieceValue(forkPiece) && isSquareDefended(board, forkSquare, forkColor, forkSquare);
}

function hasRemainingMaterialTarget(
  board: BoardMap,
  forkSquare: Square,
  forkPiece: PieceCode,
  targetSquares: Square[]
): boolean {
  return targetSquares.some((targetSquare) => {
    const targetPiece = board[targetSquare];
    if (!targetPiece) {
      return false;
    }

    return (
      targetPiece[0] !== forkPiece[0] &&
      materialTargets.has(targetPiece.charAt(1).toLowerCase()) &&
      attacksSquare(board, forkSquare, forkPiece, targetSquare)
    );
  });
}

function hasProfitableMaterialTarget(
  board: BoardMap,
  forkSquare: Square,
  forkPiece: PieceCode,
  targetSquares: Square[]
): boolean {
  return targetSquares.some((targetSquare) => {
    const targetPiece = board[targetSquare];
    if (!targetPiece) {
      return false;
    }

    return (
      targetPiece[0] !== forkPiece[0] &&
      materialTargets.has(targetPiece.charAt(1).toLowerCase()) &&
      attacksSquare(board, forkSquare, forkPiece, targetSquare) &&
      isProfitableCapture(board, forkSquare, forkPiece, targetSquare, targetPiece)
    );
  });
}

function isProfitableCapture(
  board: BoardMap,
  forkSquare: Square,
  forkPiece: PieceCode,
  targetSquare: Square,
  targetPiece: PieceCode
): boolean {
  const boardAfterCapture = { ...board };
  delete boardAfterCapture[forkSquare];
  boardAfterCapture[targetSquare] = forkPiece;

  const targetDefended = isSquareDefended(
    boardAfterCapture,
    targetSquare,
    targetPiece[0] as Color,
    targetSquare
  );

  return !targetDefended || pieceValue(targetPiece) > pieceValue(forkPiece);
}

function pieceValue(piece: PieceCode): number {
  return pieceValues[piece.charAt(1).toLowerCase()] ?? 0;
}

function fensForBothSides(fen: string): string[] {
  const fields = fen.trim().split(/\s+/);
  const activeColor = fields[1];
  if (fields.length !== 6 || (activeColor !== 'w' && activeColor !== 'b')) {
    return [fen];
  }

  const otherColor = activeColor === 'w' ? 'b' : 'w';
  const otherSideFen = [...fields];
  otherSideFen[1] = otherColor;

  return [fen, otherSideFen.join(' ')];
}

function isFenPlacement(value: string): boolean {
  return value.split('/').length === 8;
}

function classifyFork(board: BoardMap, move: Move, givesCheck: boolean, targetSquares: Square[]): ForkKind {
  if (isBetweenTargets(move.to as Square, targetSquares)) {
    return 'between';
  }

  if (givesCheck) {
    return 'check';
  }

  if (isSquareDefended(board, move.to as Square, move.color, move.to as Square)) {
    return 'defended';
  }

  return 'basic';
}

function attackedValuableTargets(board: BoardMap, from: Square, piece: PieceCode): Square[] {
  const color = piece[0];
  return Object.entries(board)
    .filter((entry): entry is [Square, PieceCode] => Boolean(entry[1]))
    .filter(([, targetPiece]) => targetPiece[0] !== color && valuableTargets.has(targetPiece.charAt(1).toLowerCase()))
    .filter(([targetSquare]) => attacksSquare(board, from, piece, targetSquare))
    .map(([targetSquare]) => targetSquare)
    .sort();
}

function isSquareDefended(board: BoardMap, square: Square, color: Color, excludeSquare: Square): boolean {
  return Object.entries(board)
    .filter((entry): entry is [Square, PieceCode] => Boolean(entry[1]))
    .some(([from, piece]) => from !== excludeSquare && piece[0] === color && attacksSquare(board, from, piece, square));
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

function isBetweenTargets(square: Square, targetSquares: Square[]): boolean {
  const center = coord(square);
  const directions = targetSquares
    .map((targetSquare) => directionBetween(center, coord(targetSquare)))
    .filter((direction): direction is Coord => direction !== null);

  return directions.some((direction) =>
    directions.some((other) => direction.file === -other.file && direction.rank === -other.rank)
  );
}

function directionBetween(from: Coord, target: Coord): Coord | null {
  const fileDelta = target.file - from.file;
  const rankDelta = target.rank - from.rank;

  if (fileDelta !== 0 && rankDelta !== 0 && Math.abs(fileDelta) !== Math.abs(rankDelta)) {
    return null;
  }

  return {
    file: Math.sign(fileDelta),
    rank: Math.sign(rankDelta)
  };
}

function boardFromFen(fen: string): BoardMap {
  const placement = fen.split(/\s+/)[0] ?? '';
  const board: BoardMap = {};

  placement.split('/').forEach((row, rowIndex) => {
    let fileIndex = 0;
    const rank = ranks[7 - rowIndex];
    if (!rank) {
      return;
    }

    for (const char of row) {
      if (/\d/.test(char)) {
        fileIndex += Number(char);
        continue;
      }

      const file = files[fileIndex];
      if (!file) {
        continue;
      }

      board[`${file}${rank}` as Square] = fenCharToPieceCode(char);
      fileIndex += 1;
    }
  });

  return board;
}

function fenCharToPieceCode(char: string): PieceCode {
  const color = char === char.toUpperCase() ? 'w' : 'b';
  return `${color}${char.toUpperCase()}` as PieceCode;
}

function pieceCode(color: Color, piece: PieceSymbol): PieceCode {
  return `${color}${piece.toUpperCase()}` as PieceCode;
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
