import { Chess } from 'chess.js';
import type { DetectorResult } from '../detector/types';

const BUTTON_ID = 'chesscom-lichess-import-button';
const STORAGE_PREFIX = 'lichessImport:';
const LICHESS_PASTE_URL = 'https://lichess.org/paste';

export interface PendingLichessImport {
  pgn: string;
  createdAt: number;
  sourceUrl: string;
}

export function updateLichessImportButton(result: DetectorResult, root: ParentNode = document): void {
  const existing = root.querySelector?.(`#${BUTTON_ID}`);

  if (!result.sharing.allowed) {
    existing?.remove();
    return;
  }

  const anchor = findButtonAnchor(root);
  const controlsContainer = findControlsContainer(root);
  if (!anchor && !controlsContainer) {
    existing?.remove();
    return;
  }

  const pgn = result.pgn?.trim() || buildPgnFromMoveList(root);
  if (!pgn) {
    existing?.remove();
    return;
  }

  const button = existing instanceof HTMLButtonElement ? existing : createButton();
  button.onclick = () => openLichessPaste(result.gameId, pgn);

  if (!button.isConnected) {
    if (anchor) {
      anchor.insertAdjacentElement('afterend', button);
    } else {
      controlsContainer?.append(button);
    }
  }
}

function createButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.title = 'Import PGN to Lichess analysis';
  button.setAttribute('aria-label', 'Import PGN to Lichess analysis');
  Object.assign(button.style, {
    width: '32px',
    height: '32px',
    marginLeft: '6px',
    padding: '5px',
    border: '0',
    borderRadius: '4px',
    background: 'transparent',
    cursor: 'pointer',
    verticalAlign: 'middle'
  });

  const img = document.createElement('img');
  img.alt = '';
  img.width = 22;
  img.height = 22;
  img.src = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('lichess-svgrepo-com.svg')
    : 'lichess-svgrepo-com.svg';
  img.style.display = 'block';

  button.append(img);
  return button;
}

function openLichessPaste(gameId: string, pgn: string): void {
  const importId = sanitizeImportId(gameId);
  const storageKey = `${STORAGE_PREFIX}${importId}`;
  const pendingImport: PendingLichessImport = {
    pgn,
    createdAt: Date.now(),
    sourceUrl: window.location.href
  };

  chrome.storage.local.set({ [storageKey]: pendingImport }, () => {
    if (chrome.tabs?.create) {
      chrome.tabs.create({
        url: `${LICHESS_PASTE_URL}#chesscom-import=${encodeURIComponent(importId)}`
      });
      return;
    }

    window.open(`${LICHESS_PASTE_URL}#chesscom-import=${encodeURIComponent(importId)}`, '_blank');
  });
}

function sanitizeImportId(gameId: string): string {
  return gameId.replace(/[^a-zA-Z0-9_-]/g, '') || String(Date.now());
}

function findButtonAnchor(root: ParentNode): Element | null {
  return Array.from(root.querySelectorAll('button, a')).find((element) => {
    const label = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.textContent,
      element.className
    ].join(' ');

    return /\b(?:Search|Suchen|Magnify|Lupe|magnifier|search)\b/i.test(label);
  }) ?? root.querySelector('[class*="search" i], [class*="magnif" i], [class*="zoom" i]')?.closest('button, a')
    ?? root.querySelector('.move-list-controls button:last-child, .analysis-controls button:last-child');
}

function findControlsContainer(root: ParentNode): Element | null {
  return root.querySelector('.move-list-controls, .analysis-controls, [class*="move-list-controls" i]');
}

function buildPgnFromMoveList(root: ParentNode): string | undefined {
  const moves = extractSanMoves(root);
  if (moves.length === 0) {
    return undefined;
  }

  const chess = new Chess();
  for (const move of moves) {
    try {
      chess.move(move);
    } catch {
      return undefined;
    }
  }

  const pgn = chess.pgn();
  return pgn.trim() || undefined;
}

function extractSanMoves(root: ParentNode): string[] {
  const containers = Array.from(root.querySelectorAll('.move-list, .vertical-move-list, [data-cy*="move-list" i]'));
  const sourceElements = containers.length > 0
    ? containers.flatMap((container) => Array.from(container.querySelectorAll('.node, span, button')))
    : [];

  return sourceElements
    .map((element) => element.textContent ?? '')
    .join(' ')
    .replace(/\{[^}]*}/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^\d+\.{0,3}$/.test(token))
    .filter((token) => !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token));
}
