import { extractChessComShareGame, type ChessComShareGame } from '../detector/chessComShareExtractor';

export interface ReadShareModalPgnOptions {
  root?: ParentNode;
  attempts?: number;
  waitMs?: number;
}

const DEFAULT_ATTEMPTS = 20;
const DEFAULT_WAIT_MS = 100;

export function findShareButton(root: ParentNode = document): HTMLButtonElement | null {
  const primary = root.querySelector<HTMLButtonElement>('button[data-cy="sidebar-share-icon"]');
  if (primary) {
    return primary;
  }

  const glyphButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    button.querySelector('svg[data-glyph="graph-nodes-share"], [data-glyph="graph-nodes-share"]')
  );
  if (glyphButton) {
    return glyphButton;
  }

  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    const label = [
      button.getAttribute('aria-label'),
      button.getAttribute('title'),
      button.textContent
    ].join(' ');

    return /\b(?:Share|Teilen)\b/i.test(label);
  }) ?? null;
}

export async function readShareModalPgn(options: ReadShareModalPgnOptions = {}): Promise<ChessComShareGame | null> {
  const root = options.root ?? document;
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const wasOpen = Boolean(findOpenShareModal(root));
  const shareButton = findShareButton(root);

  if (!wasOpen && !shareButton) {
    return null;
  }

  if (!wasOpen) {
    shareButton?.click();
  }

  try {
    const modal = await waitFor(() => findOpenShareModal(root), attempts, waitMs);
    if (!modal) {
      return null;
    }

    selectPgnTab(modal);

    const textarea = await waitFor(() => {
      const field = findPgnTextarea(root);
      return field?.value.trim() ? field : null;
    }, attempts, waitMs);
    if (!textarea) {
      return null;
    }

    const shareGame = extractChessComShareGame(root);
    return shareGame?.pgn ? shareGame : null;
  } finally {
    if (!wasOpen) {
      closeShareModal(root);
    }
  }
}

function findOpenShareModal(root: ParentNode): Element | null {
  return root.querySelector('dialog[data-cy="share-menu-modal"][open], [data-cy="share-menu-modal"][open]');
}

function findPgnTextarea(root: ParentNode): HTMLTextAreaElement | null {
  return root.querySelector<HTMLTextAreaElement>('textarea[name="pgn"][aria-label="PGN"], .share-menu-tab-pgn-textarea');
}

function selectPgnTab(modal: Element): void {
  const tab = modal.querySelector<HTMLButtonElement>('button[data-cy="pgn-tab-button"], #tab-pgn');
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    tab.click();
  }
}

function closeShareModal(root: ParentNode): void {
  root.querySelector<HTMLButtonElement>('dialog[data-cy="share-menu-modal"] button[data-cy="modal-close-button"], [data-cy="share-menu-modal"] button[data-cy="modal-close-button"]')?.click();
}

async function waitFor<T>(read: () => T | null, attempts: number, waitMs: number): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = read();
    if (value) {
      return value;
    }

    if (attempt < attempts - 1) {
      await delay(waitMs);
    }
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
