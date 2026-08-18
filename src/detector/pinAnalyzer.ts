import type { BoardMap, PieceCode, Square } from './types';

export interface StrictPin {
  square: Square;
  piece: PieceCode;
  targetSquare: Square;
  targetPiece: PieceCode;
  attackerSquare: Square;
  attackerPiece: PieceCode;
  severity: 'king' | 'material';
}

export interface PinTactic {
  square: Square;
  piece: PieceCode;
  targetSquare: Square;
  targetPiece: PieceCode;
  attackerSquare: Square;
  attackerPiece: PieceCode;
  severity: 'king' | 'material';
  state: 'active';
  kind: 'check' | 'piece';
}

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
const directions = [
  { file: 0, rank: 1, line: 'orthogonal' },
  { file: 1, rank: 1, line: 'diagonal' },
  { file: 1, rank: 0, line: 'orthogonal' },
  { file: 1, rank: -1, line: 'diagonal' },
  { file: 0, rank: -1, line: 'orthogonal' },
  { file: -1, rank: -1, line: 'diagonal' },
  { file: -1, rank: 0, line: 'orthogonal' },
  { file: -1, rank: 1, line: 'diagonal' }
] as const;

const pieceValues: Record<PieceCode[1], number> = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: Number.POSITIVE_INFINITY
};

export function findStrictPins(board: BoardMap): StrictPin[] {
  return findPinTactics(board)
    .map((pin) => ({
      square: pin.square,
      piece: pin.piece,
      targetSquare: pin.targetSquare,
      targetPiece: pin.targetPiece,
      attackerSquare: pin.attackerSquare,
      attackerPiece: pin.attackerPiece,
      severity: pin.severity
    }));
}

export function findPinTactics(board: BoardMap): PinTactic[] {
  const pins: PinTactic[] = [];

  for (const [targetSquare, targetPiece] of Object.entries(board) as [Square, PieceCode][]) {
    if (!targetPiece || targetPiece[1] === 'P') {
      continue;
    }

    for (const direction of directions) {
      const pin = findPinFromTarget(board, targetSquare, targetPiece, direction);
      if (pin) {
        pins.push(pin);
      }
    }
  }

  return pins.sort((a, b) => a.square.localeCompare(b.square));
}

function findPinFromTarget(
  board: BoardMap,
  targetSquare: Square,
  targetPiece: PieceCode,
  direction: typeof directions[number]
): PinTactic | null {
  let candidateSquare: Square | null = null;
  let candidatePiece: PieceCode | null = null;

  for (const square of squaresFrom(targetSquare, direction.file, direction.rank)) {
    const piece = board[square];
    if (!piece) {
      continue;
    }

    if (!candidatePiece) {
      if (piece[0] !== targetPiece[0] || !isHigherValueTarget(targetPiece, piece)) {
        return null;
      }

      candidateSquare = square;
      candidatePiece = piece;
      continue;
    }

    if (piece[0] === targetPiece[0]) {
      return null;
    }

    if (!attacksAlongLine(piece, direction.line)) {
      return null;
    }

    if (targetPiece[1] !== 'K' && !isHigherValueTarget(targetPiece, piece)) {
      return null;
    }

    return {
      square: candidateSquare!,
      piece: candidatePiece,
      targetSquare,
      targetPiece,
      attackerSquare: square,
      attackerPiece: piece,
      severity: targetPiece[1] === 'K' ? 'king' : 'material',
      state: 'active',
      kind: targetPiece[1] === 'K' ? 'check' : 'piece'
    };
  }

  return null;
}

function isHigherValueTarget(targetPiece: PieceCode, pinnedPiece: PieceCode): boolean {
  const targetType = targetPiece[1] as keyof typeof pieceValues | undefined;
  const pinnedType = pinnedPiece[1] as keyof typeof pieceValues | undefined;
  if (!targetType || !pinnedType) {
    return false;
  }

  return (pieceValues[targetType] ?? 0) > (pieceValues[pinnedType] ?? 0);
}

function attacksAlongLine(piece: PieceCode, line: 'orthogonal' | 'diagonal'): boolean {
  const type = piece[1];
  return type === 'Q'
    || (line === 'orthogonal' && type === 'R')
    || (line === 'diagonal' && type === 'B');
}

function* squaresFrom(square: Square, fileStep: number, rankStep: number): Generator<Square> {
  const fileIndex = files.indexOf(square[0] as typeof files[number]);
  const rankIndex = ranks.indexOf(square[1] as typeof ranks[number]);

  for (let file = fileIndex + fileStep, rank = rankIndex + rankStep;
    file >= 0 && file < 8 && rank >= 0 && rank < 8;
    file += fileStep, rank += rankStep) {
    yield `${files[file]}${ranks[rank]}` as Square;
  }
}
