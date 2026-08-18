import { findForkMoves, type ForkKind } from '../detector/forkAnalyzer';
import { selectors } from '../detector/selectors';
import type { DetectorResult, Orientation, PieceCode, Square } from '../detector/types';
import { palette, radius, shadow } from './styleTokens';

const markerAttribute = 'data-chesscom-fork-square';
const sourceAttribute = 'data-chesscom-fork-source';
const overlaySelector = `[${markerAttribute}="true"], [${sourceAttribute}="true"]`;
const renderKeyAttribute = 'data-chesscom-fork-render-key';
const expectedCountAttribute = 'data-chesscom-fork-expected-count';
const renderedCountAttribute = 'data-chesscom-fork-rendered-count';

export function updateForkOverlay(result: DetectorResult, root: ParentNode = document): void {
  const forkFen = result.fen ?? result.fenPlacement;
  if (result.status !== 'ok' || !forkFen || !result.orientation) {
    removeForkOverlay(root);
    return;
  }

  const boardElement = queryFirst(root, selectors.board) as HTMLElement | null;
  if (!boardElement) {
    removeForkOverlay(root);
    return;
  }

  const renderKey = `${result.orientation}|${forkFen}`;
  if (hasCompleteCachedRender(boardElement, renderKey)) {
    return;
  }

  removeForkOverlay(root);
  ensureBoardPositioning(boardElement);
  const forks = findForkMoves(forkFen, { side: 'both' });
  let renderedCount = 0;

  for (const fork of forks) {
    boardElement.appendChild(createMarker(fork.to, result.orientation, fork.kind, fork.targetSquares));
    renderedCount += 1;

    const pieceElement = findPieceElement(boardElement, fork.from, result.orientation);
    if (pieceElement) {
      pieceElement.appendChild(createSourceBadge(fork.piece, fork.to, fork.kind));
      renderedCount += 1;
    }
  }

  storeRenderState(boardElement, renderKey, forks.length * 2, renderedCount);
}

export function removeForkOverlay(root: ParentNode = document): void {
  for (const marker of root.querySelectorAll(overlaySelector)) {
    marker.remove();
  }

  clearRenderState(root);
}

function createMarker(square: Square, orientation: Orientation, kind: ForkKind, targetSquares: Square[]): HTMLElement {
  const marker = document.createElement('span');
  marker.setAttribute(markerAttribute, 'true');
  marker.setAttribute('aria-label', `${formatKind(kind)} fork available on ${square} targeting ${targetSquares.join(' and ')}`);
  marker.textContent = labelForKind(kind);

  const position = positionForSquare(square, orientation);
  Object.assign(marker.style, {
    position: 'absolute',
    left: `${position.left}%`,
    top: `${position.top}%`,
    width: '12.5%',
    height: '12.5%',
    display: 'grid',
    placeItems: 'center',
    border: `4px solid ${colorForKind(kind)}`,
    borderRadius: '12%',
    background: colorForKind(kind, 0.24),
    color: '#fff',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.55)',
    boxShadow: 'inset 0 0 0 2px rgba(255, 255, 255, 0.55), 0 2px 7px rgba(0, 0, 0, 0.35)',
    font: '900 18px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    pointerEvents: 'none',
    zIndex: '3'
  } satisfies Partial<CSSStyleDeclaration>);

  return marker;
}

function createSourceBadge(piece: PieceCode, destination: Square, kind: ForkKind): HTMLElement {
  const badge = document.createElement('span');
  badge.setAttribute(sourceAttribute, 'true');
  badge.setAttribute('aria-label', `${pieceName(piece)} can move to ${destination} to create a ${kind} fork`);
  badge.textContent = labelForKind(kind);

  Object.assign(badge.style, {
    position: 'absolute',
    top: '2%',
    right: '0',
    width: '30%',
    minWidth: '18px',
    aspectRatio: '1 / 1',
    display: 'grid',
    placeItems: 'center',
    border: `2px solid ${palette.cream}`,
    borderRadius: radius.pill,
    background: colorForKind(kind),
    color: '#fff',
    boxShadow: shadow.badge,
    font: '900 16px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    pointerEvents: 'none',
    zIndex: '4'
  } satisfies Partial<CSSStyleDeclaration>);

  return badge;
}

function ensureBoardPositioning(boardElement: HTMLElement): void {
  const position = getComputedStyle(boardElement).position;
  if (position === '' || position === 'static') {
    boardElement.style.position = 'relative';
  }
}

function positionForSquare(square: Square, orientation: Orientation): { left: number; top: number } {
  const fileIndex = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankIndex = Number(square[1]) - 1;
  const boardFile = orientation === 'white' ? fileIndex : 7 - fileIndex;
  const boardRank = orientation === 'white' ? 7 - rankIndex : rankIndex;

  return {
    left: boardFile * 12.5,
    top: boardRank * 12.5
  };
}

function findPieceElement(boardElement: Element, square: Square, orientation: Orientation): HTMLElement | null {
  const squareClass = squareClassFromSquare(square, orientation);
  return boardElement.querySelector<HTMLElement>(`.piece.${squareClass}, [class~="${squareClass}"]`);
}

function squareClassFromSquare(square: Square, orientation: Orientation): string {
  const fileIndex = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankIndex = Number(square[1]) - 1;

  return `square-${fileIndex + 1}${rankIndex + 1}`;
}

function labelForKind(kind: ForkKind): string {
  if (kind === 'defended') {
    return 'D';
  }

  if (kind === 'check') {
    return '+';
  }

  if (kind === 'between') {
    return 'F';
  }

  return '!';
}

function formatKind(kind: ForkKind): string {
  return kind === 'check' ? 'Checking' : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
}

function pieceName(piece: PieceCode): string {
  const names: Record<PieceCode[1], string> = {
    P: 'Pawn',
    N: 'Knight',
    B: 'Bishop',
    R: 'Rook',
    Q: 'Queen',
    K: 'King'
  };

  return names[piece.charAt(1) as PieceCode[1]] ?? 'Piece';
}

function colorForKind(kind: ForkKind, alpha = 1): string {
  const colors: Record<ForkKind, [number, number, number]> = {
    basic: [232, 162, 61],
    defended: [129, 182, 76],
    check: [208, 76, 67],
    between: [88, 145, 196]
  };
  const [r, g, b] = colors[kind];
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

function hasCompleteCachedRender(boardElement: Element, renderKey: string): boolean {
  const expectedCount = parseCount(boardElement.getAttribute(expectedCountAttribute));
  const renderedCount = parseCount(boardElement.getAttribute(renderedCountAttribute));
  if (
    boardElement.getAttribute(renderKeyAttribute) !== renderKey
    || expectedCount === null
    || renderedCount === null
    || expectedCount !== renderedCount
  ) {
    return false;
  }

  return boardElement.querySelectorAll(overlaySelector).length === renderedCount;
}

function storeRenderState(boardElement: Element, renderKey: string, expectedCount: number, renderedCount: number): void {
  boardElement.setAttribute(renderKeyAttribute, renderKey);
  boardElement.setAttribute(expectedCountAttribute, String(expectedCount));
  boardElement.setAttribute(renderedCountAttribute, String(renderedCount));
}

function clearRenderState(root: ParentNode): void {
  for (const selector of selectors.board) {
    for (const board of root.querySelectorAll(selector)) {
      board.removeAttribute(renderKeyAttribute);
      board.removeAttribute(expectedCountAttribute);
      board.removeAttribute(renderedCountAttribute);
    }
  }
}

function parseCount(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) ? count : null;
}
