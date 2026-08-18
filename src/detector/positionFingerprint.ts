import { selectors } from './selectors';

export interface PositionFingerprint {
  gameId: string;
  orientationText: string;
  pieceText: string;
  moveListText: string;
  controlText: string;
}

export function buildFingerprint(root: ParentNode, gameId: string): PositionFingerprint {
  const board = root.querySelector(selectors.board.join(','));
  const pieces = Array.from(board?.querySelectorAll(selectors.pieces.join(',')) ?? [])
    .map((piece) => piece.getAttribute('class') ?? '')
    .sort()
    .join('|');

  return {
    gameId,
    orientationText: board?.getAttribute('class') ?? '',
    pieceText: pieces,
    moveListText: textFromFirst(root, selectors.moveList),
    controlText: textFromSelectors(root, [
      'button[aria-label*="Resign" i]',
      'button[aria-label*="Draw" i]',
      ...selectors.replayControls,
      ...selectors.analysisControls
    ])
  };
}

export function sameFingerprint(a: PositionFingerprint | undefined, b: PositionFingerprint): boolean {
  if (!a) {
    return false;
  }

  return a.gameId === b.gameId
    && a.orientationText === b.orientationText
    && a.pieceText === b.pieceText
    && a.moveListText === b.moveListText
    && a.controlText === b.controlText;
}

function textFromFirst(root: ParentNode, selectorList: readonly string[]): string {
  for (const selector of selectorList) {
    const element = root.querySelector(selector);
    if (element) {
      return normalize(element.textContent ?? '');
    }
  }

  return '';
}

function textFromSelectors(root: ParentNode, selectorList: string[]): string {
  return selectorList
    .flatMap((selector) => Array.from(root.querySelectorAll(selector)))
    .map((element) => normalize(`${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`))
    .filter(Boolean)
    .join('|');
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
