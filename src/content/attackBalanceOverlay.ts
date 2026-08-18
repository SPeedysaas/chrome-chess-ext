import { findAttackBalanceTactics, type AttackBalanceTactic } from '../detector/attackBalanceAnalyzer';
import { selectors } from '../detector/selectors';
import type { DetectorResult, Orientation, Square } from '../detector/types';
import { palette, radius, shadow } from './styleTokens';

const badgeAttribute = 'data-chesscom-attack-balance-badge';
const badgeSelector = `[${badgeAttribute}="true"]`;
const pinBadgeSelector = '[data-chesscom-pin-badge="true"]';
const renderKeyAttribute = 'data-chesscom-attack-balance-render-key';
const expectedCountAttribute = 'data-chesscom-attack-balance-expected-count';
const renderedCountAttribute = 'data-chesscom-attack-balance-rendered-count';

export function updateAttackBalanceOverlay(result: DetectorResult, root: ParentNode = document): void {
  if (result.status !== 'ok' || !result.board || !result.orientation) {
    removeAttackBalanceOverlay(root);
    return;
  }

  const boardElement = queryFirst(root, selectors.board) as HTMLElement | null;
  if (!boardElement) {
    removeAttackBalanceOverlay(root);
    return;
  }

  const renderKey = attackBalanceRenderKey(result.board, result.orientation, boardElement);
  if (hasCompleteCachedRender(boardElement, renderKey)) {
    return;
  }

  removeAttackBalanceOverlay(root);
  const tactics = findAttackBalanceTactics(result.board);

  for (const tactic of tactics) {
    ensureBoardPositioning(boardElement);
    boardElement.appendChild(createBadge(tactic, result.orientation, hasPinBadge(boardElement, tactic.square, result.orientation)));
  }

  storeRenderState(boardElement, renderKey, tactics.length, tactics.length);
}

export function removeAttackBalanceOverlay(root: ParentNode = document): void {
  for (const badge of root.querySelectorAll(badgeSelector)) {
    badge.remove();
  }

  clearRenderState(root);
}

function createBadge(tactic: AttackBalanceTactic, orientation: Orientation, hasPinnedBadge: boolean): HTMLElement {
  const badge = document.createElement('span');
  badge.setAttribute(badgeAttribute, 'true');
  badge.setAttribute('aria-label', `${capitalize(tactic.state)} piece: ${tactic.attackers} ${pluralize('attacker', tactic.attackers)} and ${tactic.defenders} ${pluralize('defender', tactic.defenders)}`);
  badge.textContent = badgeText(tactic);

  const position = positionForSquare(tactic.square, orientation);
  const corner = badgeCorner(tactic, hasPinnedBadge);
  Object.assign(badge.style, {
    position: 'absolute',
    left: `${position.left + corner.leftOffset}%`,
    top: `${position.top + 0.375}%`,
    width: '3.5%',
    minWidth: '18px',
    aspectRatio: '1 / 1',
    display: 'grid',
    justifyItems: 'center',
    alignItems: 'center',
    placeItems: 'center',
    border: `2px solid ${palette.cream}`,
    borderRadius: radius.pill,
    background: tactic.state === 'balanced' ? palette.info : palette.danger,
    color: '#fff',
    boxShadow: shadow.badge,
    font: '900 18px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    lineHeight: '1',
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: '4'
  } satisfies Partial<CSSStyleDeclaration>);

  return badge;
}

function badgeText(tactic: AttackBalanceTactic): string {
  if (tactic.state === 'balanced') {
    return '=';
  }

  return tactic.attackers - tactic.defenders >= 2 ? '!!' : '!';
}

function badgeCorner(tactic: AttackBalanceTactic, hasPinnedBadge: boolean): { leftOffset: number } {
  return tactic.state === 'balanced' && hasPinnedBadge
    ? { leftOffset: 0.5 }
    : { leftOffset: 9 };
}

function hasPinBadge(boardElement: Element, square: Square, orientation: Orientation): boolean {
  return findPieceElement(boardElement, square, orientation)?.querySelector(pinBadgeSelector) !== null;
}

function ensureBoardPositioning(boardElement: HTMLElement): void {
  const position = getComputedStyle(boardElement).position;
  if (position === '' || position === 'static') {
    boardElement.style.position = 'relative';
  }
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
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

function queryFirst(root: ParentNode, selectorList: readonly string[]): Element | null {
  for (const selector of selectorList) {
    const element = root.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return null;
}

function attackBalanceRenderKey(board: DetectorResult['board'], orientation: Orientation, boardElement: Element): string {
  return [
    orientation,
    pinBadgeSignature(boardElement),
    ...Object.entries(board ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([square, piece]) => `${square}:${piece}`)
  ].join('|');
}

function pinBadgeSignature(boardElement: Element): string {
  return Array.from(boardElement.querySelectorAll(pinBadgeSelector))
    .map((badge) => badge.parentElement?.getAttribute('class') ?? '')
    .sort()
    .join(',');
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

  return boardElement.querySelectorAll(badgeSelector).length === renderedCount;
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
