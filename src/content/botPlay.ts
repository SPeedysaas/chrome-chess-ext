import type { DetectorResult, Orientation, Square } from '../detector/types';
import { Chess } from 'chess.js';
import { buildLiveAnalysisFen } from '../engine/liveFen';
import { LocalStockfishEngine, type StockfishSearchOptions } from '../engine/localStockfish';
import type { EngineLine } from '../engine/stockfishUci';
import { isChessComBotGame } from './evalBar';

export interface BotPlayEngine {
  analyze: (fen: string, depth?: number, searchOptions?: StockfishSearchOptions) => Promise<EngineLine[]>;
  dispose: () => void;
}

export interface BotPlayController {
  update: (result: DetectorResult) => Promise<void>;
  dispose: () => void;
}

export interface BotPlayControllerOptions {
  enabled?: boolean;
  noCaptures?: boolean;
  depth?: number;
  root?: ParentNode;
  url?: () => string;
  engineFactory?: () => BotPlayEngine;
  playMove?: (move: string, orientation: Orientation, root: ParentNode) => boolean;
}

export function createBotPlayController(options: BotPlayControllerOptions = {}): BotPlayController {
  const enabled = options.enabled ?? false;
  const noCaptures = options.noCaptures ?? false;
  const depth = options.depth ?? 12;
  const root = options.root ?? document;
  const currentUrl = options.url ?? (() => globalThis.location?.href ?? '');
  const playMove = options.playMove ?? playUciMoveOnBoard;
  let engine: BotPlayEngine | null = null;
  let generation = 0;
  let lastPlayedFen: string | null = null;
  let pendingFen: string | null = null;

  return {
    async update(result: DetectorResult): Promise<void> {
      if (!enabled || !isChessComBotGame(currentUrl()) || result.status !== 'ok' || result.mode !== 'live' || !result.orientation) {
        return;
      }

      const fen = botPositionFen(result, root);
      if (!fen || sideToMove(fen) !== orientationSide(result.orientation) || fen === lastPlayedFen || fen === pendingFen) {
        return;
      }

      const requestGeneration = ++generation;
      pendingFen = fen;
      engine ??= options.engineFactory?.() ?? new LocalStockfishEngine({ multipv: 1, depth });

      try {
        const lines = await engine.analyze(fen, depth, { noCaptures });
        if (requestGeneration !== generation || pendingFen !== fen || !isChessComBotGame(currentUrl())) {
          return;
        }

        const currentFen = botPositionFen(result, root);
        const bestMove = lines.find((line) => line.multipv === 1)?.move ?? lines[0]?.move;
        if (currentFen === fen && bestMove && playMove(bestMove, result.orientation, root)) {
          lastPlayedFen = fen;
        }
      } finally {
        if (requestGeneration === generation) {
          pendingFen = null;
        }
      }
    },
    dispose(): void {
      generation += 1;
      pendingFen = null;
      lastPlayedFen = null;
      engine?.dispose();
      engine = null;
    }
  };
}

function botPositionFen(result: DetectorResult, root: ParentNode): string | null {
  const liveFen = buildLiveAnalysisFen(result, result.orientation ?? 'white', root, 'current');
  if (liveFen) {
    return liveFen;
  }

  if (!result.fenPlacement) {
    return null;
  }

  const chess = new Chess();
  if (!result.moveSequence || result.moveSequence.length === 0) {
    return chess.fen().split(/\s+/)[0] === result.fenPlacement ? chess.fen() : null;
  }

  try {
    for (const move of result.moveSequence) {
      chess.move(move);
    }
  } catch {
    return null;
  }

  return chess.fen().split(/\s+/)[0] === result.fenPlacement ? chess.fen() : null;
}

export function playUciMoveOnBoard(move: string, orientation: Orientation, root: ParentNode = document): boolean {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(move);
  const board = root.querySelector<HTMLElement>('chess-board, wc-chess-board, .board, [data-board-id]');
  if (!match || !board) {
    return false;
  }

  dispatchSquareClick(board, match[1] as Square, orientation);
  dispatchSquareClick(board, match[2] as Square, orientation);
  if (match[3]) {
    queueMicrotask(() => selectPromotion(root, match[3]!));
  }

  return true;
}

function dispatchSquareClick(board: HTMLElement, square: Square, orientation: Orientation): void {
  const rect = board.getBoundingClientRect();
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const visualFile = orientation === 'white' ? file : 7 - file;
  const visualRankFromTop = orientation === 'white' ? 7 - rank : rank;
  const clientX = rect.left + ((visualFile + 0.5) * rect.width) / 8;
  const clientY = rect.top + ((visualRankFromTop + 0.5) * rect.height) / 8;
  const eventInit: MouseEventInit = { bubbles: true, cancelable: true, clientX, clientY, button: 0 };

  board.dispatchEvent(createPointerOrMouseEvent('pointerdown', eventInit));
  board.dispatchEvent(createPointerOrMouseEvent('pointerup', eventInit));
  board.dispatchEvent(new MouseEvent('click', eventInit));
}

function createPointerOrMouseEvent(type: string, init: MouseEventInit): Event {
  return typeof PointerEvent === 'function' ? new PointerEvent(type, init) : new MouseEvent(type, init);
}

function selectPromotion(root: ParentNode, promotion: string): void {
  root.querySelector<HTMLElement>([
    `[data-piece="${promotion}"]`,
    `[data-piece-type="${promotion}"]`,
    `.promotion-piece.${promotion}`,
    `.promotion-piece.w${promotion}`,
    `.promotion-piece.b${promotion}`
  ].join(','))?.click();
}

function orientationSide(orientation: Orientation): 'w' | 'b' {
  return orientation === 'white' ? 'w' : 'b';
}

function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(/\s+/)[1] === 'b' ? 'b' : 'w';
}
