import type { GamePlayers } from './types';

export interface ChessComShareGame {
  fen: string;
  pgn?: string;
  players?: GamePlayers;
  source: 'chesscom-share-dialog';
  evidence: string[];
}

const FEN_PATTERN = /\b(?:[pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:[a-h][36]|-)\s+\d+\s+\d+\b/;
const EXTENSION_UI_ROOT_ID = 'chesscom-board-detector-debug';

export function extractChessComShareGame(root: ParentNode): ChessComShareGame | null {
  for (const dialog of findShareDialogs(root)) {
    const fen = extractFen(dialog);
    const pgn = extractPgn(dialog);
    if (!fen && !pgn) {
      continue;
    }
    const players = pgn ? extractPlayersFromPgn(pgn) : undefined;

    return {
      fen: fen ?? '',
      source: 'chesscom-share-dialog',
      ...(pgn ? { pgn } : {}),
      ...(players ? { players } : {}),
      evidence: [
        'chesscom-share-dialog',
        ...(fen ? ['share-dialog-fen'] : []),
        ...(pgn ? ['share-dialog-pgn'] : [])
      ]
    };
  }

  return null;
}

function findShareDialogs(root: ParentNode): Element[] {
  const candidates = Array.from(root.querySelectorAll('[role="dialog"], dialog[data-cy="share-menu-modal"], #share-modal, .modal, [class*="share" i]'))
    .filter(isPageElement);
  const pgnTextareas = Array.from(root.querySelectorAll('.share-menu-tab-pgn-textarea, textarea[name="pgn" i], textarea[aria-label="PGN" i]'))
    .filter(isPageElement);
  const textareaContainers = pgnTextareas.flatMap((textarea) => [
    textarea.closest('.share-menu-tab-pgn-section'),
    textarea.closest('[role="dialog"], dialog[data-cy="share-menu-modal"], #share-modal, .modal, [class*="share" i]')
  ]);
  const uniqueCandidates = Array.from(new Set([...textareaContainers, ...candidates].filter((candidate): candidate is Element => Boolean(candidate))));

  return uniqueCandidates.filter((candidate) => {
    const text = normalizedText(candidate);
    return /\b(?:FEN|PGN|Teilen|Share)\b/i.test(text) || candidate.querySelector('textarea[name="pgn" i], textarea[aria-label="PGN" i]');
  });
}

function isPageElement(element: Element): boolean {
  return element.id !== EXTENSION_UI_ROOT_ID && !element.closest(`#${EXTENSION_UI_ROOT_ID}`);
}

function extractFen(dialog: Element): string | undefined {
  const values = collectFieldValues(dialog);
  for (const value of values) {
    const match = value.match(FEN_PATTERN);
    if (match?.[0]) {
      return match[0].trim();
    }
  }

  return undefined;
}

function extractPgn(dialog: Element): string | undefined {
  const values = collectFieldValues(dialog);
  const pgn = values.find((value) => /\[Event\s+"/.test(value) || /\[Site\s+"Chess\.com"\]/.test(value));
  return pgn?.trim();
}

function extractPlayersFromPgn(pgn: string): GamePlayers | undefined {
  const white = extractPgnHeader(pgn, 'White');
  const black = extractPgnHeader(pgn, 'Black');
  if (!white && !black) {
    return undefined;
  }

  return {
    ...(white ? { white: { name: white } } : {}),
    ...(black ? { black: { name: black } } : {})
  };
}

function extractPgnHeader(pgn: string, name: string): string | undefined {
  const match = new RegExp(`\\[${name}\\s+"((?:\\\\.|[^"\\\\])*)"\\]`).exec(pgn);
  return match?.[1]?.replace(/\\"/g, '"').trim() || undefined;
}

function collectFieldValues(dialog: Element): string[] {
  return [
    ...Array.from(dialog.querySelectorAll('textarea, input')).map((element) => {
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        return element.value;
      }

      return '';
    }),
    ...Array.from(dialog.querySelectorAll('*')).map((element) => element.textContent ?? ''),
    dialog.textContent ?? ''
  ]
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizedText(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}
