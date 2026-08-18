import { selectors } from './selectors';
import type { BoardMap, BoardReadResult, Orientation, PieceCode, Square } from './types';

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
const pieceLetters = {
  p: 'P',
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
  k: 'K'
} as const;

export function readBoard(root: ParentNode = document, source: BoardReadResult['source'] = 'board-dom'): BoardReadResult | null {
  const boardElement = queryFirst(root, selectors.board);
  if (!boardElement) {
    return null;
  }

  const orientation = detectOrientation(boardElement);
  const board: BoardMap = {};
  const evidence = [`orientation-${orientation}`];

  for (const pieceElement of boardElement.querySelectorAll(selectors.pieces.join(','))) {
    const piece = pieceFromElement(pieceElement);
    const squareClass = Array.from(pieceElement.classList).find((className) => /^square-\d\d$/.test(className));
    const square = squareClass ? squareFromChessComClass(squareClass, orientation) : null;

    if (piece && square) {
      board[square] = piece;
    }
  }

  const pieceCount = Object.keys(board).length;
  if (pieceCount === 0) {
    return null;
  }

  return {
    board,
    fenPlacement: fenPlacementFromBoard(board),
    orientation,
    confidence: pieceCount >= 2 && pieceCount <= 32 ? 0.95 : 0.55,
    source,
    evidence: [...evidence, `pieces-${pieceCount}`]
  };
}

export function squareFromChessComClass(squareClass: string, orientation: Orientation): Square | null {
  const match = /square-(\d)(\d)/.exec(squareClass);
  if (!match) {
    return null;
  }

  const fileIndex = Number(match[1]) - 1;
  const rankIndex = Number(match[2]) - 1;
  if (fileIndex < 0 || fileIndex > 7 || rankIndex < 0 || rankIndex > 7) {
    return null;
  }

  const file = files[fileIndex];
  const rank = ranks[rankIndex];

  return file && rank ? `${file}${rank}` as Square : null;
}

export function fenPlacementFromBoard(board: BoardMap): string {
  const ranksDescending = [...ranks].reverse();

  return ranksDescending.map((rank) => {
    let empty = 0;
    let row = '';

    for (const file of files) {
      const piece = board[`${file}${rank}` as Square];
      if (!piece) {
        empty += 1;
        continue;
      }

      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }

      row += piece[0] === 'w' ? piece[1] : piece[1]?.toLowerCase();
    }

    return empty > 0 ? `${row}${empty}` : row;
  }).join('/');
}

function queryFirst(root: ParentNode, selectorList: readonly string[]): Element | null {
  for (const selector of selectorList) {
    const element = root.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return null;
}

function detectOrientation(boardElement: Element): Orientation {
  return boardElement.classList.contains('flipped') || boardElement.classList.contains('orientation-black')
    ? 'black'
    : 'white';
}

function pieceFromElement(element: Element): PieceCode | null {
  const classNames = Array.from(element.classList);
  const compact = classNames.find((className) => /^[wb][pnbrqk]$/.test(className.toLowerCase()));
  if (compact) {
    return compactToPieceCode(compact);
  }

  const color = classNames.includes('white') ? 'w' : classNames.includes('black') ? 'b' : null;
  const typeClass = classNames.find((className) => ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'].includes(className));
  if (!color || !typeClass) {
    return null;
  }

  const pieceInitial = typeClass === 'knight' ? 'N' : typeClass[0]?.toUpperCase();
  return pieceInitial ? `${color}${pieceInitial}` as PieceCode : null;
}

function compactToPieceCode(className: string): PieceCode | null {
  const normalized = className.toLowerCase();
  const color = normalized[0];
  const piece = normalized[1] as keyof typeof pieceLetters | undefined;
  if ((color !== 'w' && color !== 'b') || !piece) {
    return null;
  }

  const letter = pieceLetters[piece];
  return letter ? `${color}${letter}` as PieceCode : null;
}
