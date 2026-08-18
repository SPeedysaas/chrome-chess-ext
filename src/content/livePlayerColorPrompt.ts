import { palette, radius, shadow } from './styleTokens';
import type { DetectorResult, Orientation } from '../detector/types';

const promptAttribute = 'data-chesscom-live-color-prompt';
const promptWidth = 184;
const promptGap = 8;

export interface LivePlayerColorPromptApi {
  request: (ownerId: string, result: DetectorResult, onChoose: (color: Orientation) => void) => void;
  dismiss: (ownerId: string) => void;
}

export function createLivePlayerColorPrompt(root: ParentNode = document): LivePlayerColorPromptApi {
  const handlers = new Map<string, (color: Orientation) => void>();
  let latestResult: DetectorResult | null = null;

  return {
    request(ownerId: string, result: DetectorResult, onChoose: (color: Orientation) => void): void {
      handlers.set(ownerId, onChoose);
      latestResult = result;
      renderPrompt(root, result, handlers);
    },
    dismiss(ownerId: string): void {
      handlers.delete(ownerId);
      if (handlers.size === 0) {
        latestResult = null;
        removePrompt(root);
        return;
      }

      if (latestResult) {
        renderPrompt(root, latestResult, handlers);
      }
    }
  };
}

function renderPrompt(
  root: ParentNode,
  result: DetectorResult,
  handlers: Map<string, (color: Orientation) => void>
): void {
  removePrompt(root);
  const board = boardElement(root);
  if (!board) {
    return;
  }

  ensureBoardPositioning(board);
  const boardRect = board.getBoundingClientRect();
  const prompt = document.createElement('div');
  prompt.setAttribute(promptAttribute, 'true');
  Object.assign(prompt.style, {
    position: 'absolute',
    left: `${chooseSideLeft(boardRect, root)}px`,
    top: `${documentY(boardRect.top, root)}px`,
    width: `${promptWidth}px`,
    border: `1px solid ${palette.borderSubtle}`,
    borderRadius: radius.md,
    background: palette.surfaceRaised,
    boxShadow: shadow.panel,
    padding: '8px',
    zIndex: '2147483647',
    pointerEvents: 'auto',
    color: palette.textPrimary,
    font: '700 12px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  } satisfies Partial<CSSStyleDeclaration>);

  const title = document.createElement('div');
  title.textContent = 'You are';
  Object.assign(title.style, {
    marginBottom: '8px',
    color: palette.textSecondary
  } satisfies Partial<CSSStyleDeclaration>);

  const boardPlayers = document.createElement('div');
  boardPlayers.style.display = 'grid';
  boardPlayers.style.gap = '6px';

  for (const color of ['white', 'black'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = colorLabel(color, result);
    button.setAttribute('data-live-color', color);
    Object.assign(button.style, {
      width: '100%',
      padding: '7px 8px',
      border: `1px solid ${color === 'white' ? palette.borderStrong : palette.borderSubtle}`,
      borderRadius: radius.sm,
      background: color === 'white' ? palette.cream : palette.surface,
      color: color === 'white' ? palette.inkPrimary : palette.textPrimary,
      cursor: 'pointer',
      textAlign: 'left'
    } satisfies Partial<CSSStyleDeclaration>);

    button.addEventListener('click', () => {
      const currentHandlers = [...handlers.values()];
      handlers.clear();
      removePrompt(root);
      for (const handler of currentHandlers) {
        handler(color);
      }
    });

    boardPlayers.append(button);
  }

  prompt.append(title, boardPlayers);
  board.append(prompt);
}

function colorLabel(color: Orientation, result: DetectorResult): string {
  const player = color === 'white' ? result.players?.white?.name : result.players?.black?.name;
  return player ? `${color === 'white' ? 'White' : 'Black'}: ${player}` : (color === 'white' ? 'White' : 'Black');
}

function chooseSideLeft(boardRect: DOMRect, root: ParentNode): number {
  const pageX = scrollX(root);
  const viewportWidth = ownerWindow(root)?.innerWidth ?? 0;
  const viewportRight = pageX + viewportWidth;
  const preferredRight = Math.round(boardRect.right + pageX + promptGap);
  const preferredLeft = Math.round(boardRect.left + pageX - promptWidth - promptGap);
  const minLeft = pageX + promptGap;
  const maxLeft = Math.max(minLeft, viewportRight - promptWidth - promptGap);

  if (preferredRight + promptWidth <= viewportRight - promptGap) {
    return Math.max(preferredRight, minLeft);
  }

  if (preferredLeft >= minLeft) {
    return preferredLeft;
  }

  return Math.min(Math.max(preferredLeft, minLeft), maxLeft);
}

function removePrompt(root: ParentNode): void {
  root.querySelector(`[${promptAttribute}="true"]`)?.remove();
}

function boardElement(root: ParentNode): HTMLElement | null {
  for (const selector of ['wc-chess-board', 'chess-board', 'div.board', 'main [class*="board" i]']) {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) {
      return element;
    }
  }

  return null;
}

function ensureBoardPositioning(board: HTMLElement): void {
  const position = getComputedStyle(board).position;
  if (position === '' || position === 'static') {
    board.style.position = 'relative';
  }
}

function documentY(viewportY: number, root: ParentNode): number {
  return Math.round(viewportY + scrollY(root));
}

function scrollX(root: ParentNode): number {
  const win = ownerWindow(root);
  return win?.scrollX ?? win?.pageXOffset ?? 0;
}

function scrollY(root: ParentNode): number {
  const win = ownerWindow(root);
  return win?.scrollY ?? win?.pageYOffset ?? 0;
}

function ownerWindow(root: ParentNode): Window | null {
  return ownerDocument(root).defaultView;
}

function ownerDocument(root: ParentNode): Document {
  return root instanceof Document ? root : root.ownerDocument ?? document;
}
