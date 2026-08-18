import { findPinTactics, type PinTactic } from '../detector/pinAnalyzer';
import { selectors } from '../detector/selectors';
import type { DetectorResult, Orientation, Square } from '../detector/types';
import { palette, radius, shadow } from './styleTokens';

const badgeAttribute = 'data-chesscom-pin-badge';
const badgeSelector = `[${badgeAttribute}="true"]`;
const renderKeyAttribute = 'data-chesscom-pin-render-key';
const expectedCountAttribute = 'data-chesscom-pin-expected-count';
const renderedCountAttribute = 'data-chesscom-pin-rendered-count';

export function updatePinOverlay(result: DetectorResult, root: ParentNode = document): void {
  if (result.status !== 'ok' || !result.board || !result.orientation) {
    removePinOverlay(root);
    return;
  }

  const boardElement = queryFirst(root, selectors.board);
  if (!boardElement) {
    removePinOverlay(root);
    return;
  }

  const renderKey = pinRenderKey(result.board, result.orientation);
  if (hasCompleteCachedRender(boardElement, badgeSelector, renderKey)) {
    return;
  }

  removePinOverlay(root);
  const pins = findPinTactics(result.board);
  let renderedCount = 0;

  for (const pin of pins) {
    const pieceElement = findPieceElement(boardElement, pin.square, result.orientation);
    if (!pieceElement) {
      continue;
    }

    pieceElement.appendChild(createBadge(pin));
    renderedCount += 1;
  }

  storeRenderState(boardElement, renderKey, pins.length, renderedCount);
}

export function removePinOverlay(root: ParentNode = document): void {
  for (const badge of root.querySelectorAll(badgeSelector)) {
    badge.remove();
  }

  clearRenderState(root);
}

function createBadge(pin: PinTactic): HTMLElement {
  const badge = document.createElement('span');
  badge.setAttribute(badgeAttribute, 'true');
  badge.setAttribute('aria-label', `${capitalize(pin.state)} ${pin.kind} pin`);
  badge.textContent = pin.kind === 'check' ? 'K!' : 'P!';

  Object.assign(badge.style, {
    position: 'absolute',
    top: '3%',
    right: '1%',
    width: '28%',
    minWidth: '18px',
    aspectRatio: '1 / 1',
    display: 'grid',
    placeItems: 'center',
    border: `2px solid ${palette.cream}`,
    borderRadius: radius.pill,
    background: pin.kind === 'check' ? palette.danger : palette.info,
    color: '#fff',
    boxShadow: shadow.badge,
    font: '900 18px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    pointerEvents: 'none',
    zIndex: '4'
  } satisfies Partial<CSSStyleDeclaration>);

  return badge;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function findPieceElement(boardElement: Element, square: Square, orientation: Orientation): HTMLElement | null {
  const squareClass = squareClassFromSquare(square, orientation);
  return boardElement.querySelector<HTMLElement>(`.piece.${squareClass}`);
}

function squareClassFromSquare(square: Square, orientation: Orientation): string {
  const fileIndex = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankIndex = Number(square[1]) - 1;

  return `square-${fileIndex + 1}${rankIndex + 1}`;
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

function pinRenderKey(board: DetectorResult['board'], orientation: Orientation): string {
  return [
    orientation,
    ...Object.entries(board ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([square, piece]) => `${square}:${piece}`)
  ].join('|');
}

function hasCompleteCachedRender(boardElement: Element, selector: string, renderKey: string): boolean {
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

  return boardElement.querySelectorAll(selector).length === renderedCount;
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
