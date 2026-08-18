import { Chess } from 'chess.js';
import type { GameCache } from './gameCache';
import type { PageMode } from './types';

export interface ReconciliationResult {
  ok: boolean;
  fen?: string;
  moveIndex?: number;
  reason?: 'empty-move-list' | 'invalid-san' | 'live-mode-blocked';
}

export interface ReconciliationOptions {
  cache?: GameCache;
  gameId?: string;
  url?: string;
}

export function reconcileMoveList(root: ParentNode, mode: PageMode, options: ReconciliationOptions = {}): ReconciliationResult {
  if (mode === 'live' || mode === 'unknown') {
    return { ok: false, reason: 'live-mode-blocked' };
  }

  const moves = extractSanMoves(root);
  if (moves.length === 0) {
    return { ok: false, reason: 'empty-move-list' };
  }

  const currentMoveIndex = currentMoveIndexFromPage(root, options.url, moves.length);
  const cachedPositions = options.cache && options.gameId
    ? options.cache.getFenPositionCache(options.gameId, moves)?.positions
    : undefined;
  if (cachedPositions) {
    return {
      ok: true,
      fen: fenAtMoveIndex(cachedPositions, currentMoveIndex),
      moveIndex: currentMoveIndex
    };
  }

  const positions = fenPositionsFromSanMoves(moves);
  if (!positions) {
    return { ok: false, reason: 'invalid-san' };
  }

  if (options.cache && options.gameId) {
    options.cache.setFenPositionCache(options.gameId, moves, positions);
  }

  return {
    ok: true,
    fen: fenAtMoveIndex(positions, currentMoveIndex),
    moveIndex: currentMoveIndex
  };
}

export function moveIndexFromFenPlacement(moves: readonly string[], fenPlacement: string): number | undefined {
  const positions = fenPositionsFromSanMoves(moves);
  if (!positions) {
    return undefined;
  }

  const normalizedPlacement = fenPlacementFromFen(fenPlacement);
  for (let index = positions.length - 1; index >= 0; index -= 1) {
    if (fenPlacementFromFen(positions[index] ?? '') === normalizedPlacement) {
      return index;
    }
  }

  return undefined;
}

export function buildPgnFromSanMoves(moves: string[]): string | undefined {
  if (moves.length === 0) {
    return undefined;
  }

  const chess = new Chess();
  for (const move of moves) {
    try {
      const applied = chess.move(move);
      if (!applied) {
        return undefined;
      }
    } catch {
      return undefined;
    }
  }

  const pgn = chess.pgn();
  return pgn.trim() || undefined;
}

export function extractSanMoves(root: ParentNode): string[] {
  const plyMoves = Array.from(root.querySelectorAll('[data-node].node, [data-node][class*="move" i]'))
    .map(moveTextFromPlyElement)
    .filter((move): move is string => Boolean(move));
  if (plyMoves.length > 0) {
    return plyMoves;
  }

  const moveContainers = Array.from(root.querySelectorAll('.move-list, .vertical-move-list, [data-cy*="move-list" i]'));
  const primarySourceElements = moveContainers.length > 0
    ? moveContainers.flatMap((container) => Array.from(container.querySelectorAll('.node, button')))
    : Array.from(root.querySelectorAll('.node, button'));
  const sourceElements = primarySourceElements.length > 0
    ? primarySourceElements
    : moveContainers.length > 0
      ? moveContainers.flatMap((container) => Array.from(container.querySelectorAll('span')))
      : Array.from(root.querySelectorAll('span'));

  const text = sourceElements
    .map((element) => element.textContent ?? '')
    .join(' ');

  return sanTokensFromText(text);
}

function moveTextFromPlyElement(element: Element): string | undefined {
  const figurine = element.querySelector('[data-figurine]')?.getAttribute('data-figurine') ?? '';
  const text = sanTokensFromText(element.textContent ?? '').join('');
  const move = `${figurine}${text}`;

  return move || undefined;
}

export function currentMoveIndexFromPage(root: ParentNode, url: string | undefined, finalMoveIndex: number): number {
  const selectedElement = Array.from(root.querySelectorAll('[data-node]'))
    .find((element) => isCurrentMoveElement(element));
  const selectedMoveIndex = selectedElement
    ? moveIndexFromDataNode(selectedElement.getAttribute('data-node'))
    : undefined;
  if (selectedMoveIndex !== undefined) {
    return clampMoveIndex(selectedMoveIndex, finalMoveIndex);
  }

  const urlMoveIndex = moveIndexFromUrl(url);
  if (urlMoveIndex !== undefined) {
    return clampMoveIndex(urlMoveIndex, finalMoveIndex);
  }

  return finalMoveIndex;
}

function isCurrentMoveElement(element: Element): boolean {
  const stateText = [
    element.getAttribute('aria-selected'),
    element.getAttribute('aria-current'),
    element.getAttribute('data-active'),
    element.getAttribute('data-selected'),
    element.getAttribute('class')
  ].filter(Boolean).join(' ');

  return /\b(?:true|active|selected|current)\b/i.test(stateText);
}

function moveIndexFromDataNode(value: string | null): number | undefined {
  const match = /(\d+)$/.exec(value ?? '');
  if (!match?.[1]) {
    return undefined;
  }

  return Number.parseInt(match[1], 10) + 1;
}

function moveIndexFromUrl(url: string | undefined): number | undefined {
  if (!url) {
    return undefined;
  }

  const match = /[?&]move=(\d+)\b/.exec(url);
  if (!match?.[1]) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
}

function clampMoveIndex(moveIndex: number, finalMoveIndex: number): number {
  return Math.max(0, Math.min(moveIndex, finalMoveIndex));
}

function fenPositionsFromSanMoves(moves: readonly string[]): string[] | undefined {
  const chess = new Chess();
  const positions = [chess.fen()];
  for (const move of moves) {
    try {
      const applied = chess.move(move);
      if (!applied) {
        return undefined;
      }
    } catch {
      return undefined;
    }
    positions.push(chess.fen());
  }

  return positions;
}

function fenAtMoveIndex(positions: readonly string[], moveIndex: number): string {
  return positions[moveIndex] ?? positions[positions.length - 1] ?? new Chess().fen();
}

function fenPlacementFromFen(fen: string): string {
  return fen.trim().split(/\s+/)[0] ?? fen;
}

function sanTokensFromText(text: string): string[] {
  return text
    .replace(/\{[^}]*}/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^\d+\.?$/.test(token))
    .filter((token) => !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token));
}
