import { readBoard } from './boardReader';
import { buildFingerprint, sameFingerprint } from './positionFingerprint';
import { decideSharing } from './shareController';
import { detectManualLivePosition } from './manualLiveDetector';
import { detectMode } from './modeDetector';
import { extractChessComShareGame } from './chessComShareExtractor';
import { buildPgnFromSanMoves, currentMoveIndexFromPage, extractSanMoves, moveIndexFromFenPlacement, reconcileMoveList } from './moveListReconciler';
import { extractPlayersFromDom } from './playerExtractor';
import type { GameCache } from './gameCache';
import type { BoardMap, BoardReadResult, DetectorResult, GamePlayers, PieceCode, Square } from './types';

export interface DetectionPipelineOptions {
  root?: ParentNode;
  url?: string;
  now?: () => number;
}

export function runDetectionCycle(cache: GameCache, options: DetectionPipelineOptions = {}): DetectorResult {
  const root = options.root ?? document;
  const url = options.url ?? globalThis.location?.href ?? '';
  const now = options.now ?? Date.now;
  const gameId = gameIdFromUrl(url);
  const mode = detectMode(root);
  const sharing = decideSharing(mode, {
    shareButtonPresent: hasChessComShareButton(root),
    hasActiveLiveControls: hasActiveLiveControls(root)
  });
  const fingerprint = buildFingerprint(root, gameId);
  const cached = cache.get(gameId);

  if (cached?.result && sameFingerprint(cached.fingerprint, fingerprint)) {
    const result = { ...cached.result, sharing, mode: mode.mode, modeConfidence: mode.confidence };
    cache.set(gameId, { fingerprint, result, updatedAt: now() });
    return result;
  }

  const baseResult = mode.mode === 'live'
    ? buildResult(gameId, mode.mode, mode.confidence, mode.evidence, sharing, detectManualLivePosition(root, mode))
    : buildReplayOrAnalysisResult(gameId, mode.mode, mode.confidence, mode.evidence, sharing, root, cache, url);
  const result = mode.mode === 'unknown'
    ? baseResult
    : mode.mode === 'live'
      ? enrichLivePageContext(baseResult, root)
      : enrichWithPageContext(baseResult, root, url);
  cache.set(gameId, { fingerprint, result, updatedAt: now() });

  return result;
}

function enrichWithPageContext(result: DetectorResult, root: ParentNode, url: string): DetectorResult {
  const moveSequence = extractSanMoves(root);
  const pgn = result.pgn ?? buildPgnFromSanMoves(moveSequence);
  const players = mergePlayers(result.players, extractPlayersFromDom(root, result.orientation ?? 'white'));
  const visibleBoardMoveIndex = result.source === 'board-dom' && result.fenPlacement && moveSequence.length > 0
    ? moveIndexFromFenPlacement(moveSequence, result.fenPlacement)
    : undefined;
  const moveIndex = result.moveIndex
    ?? visibleBoardMoveIndex
    ?? (moveSequence.length > 0 ? currentMoveIndexFromPage(root, url, moveSequence.length) : undefined);

  return {
    ...result,
    ...(players ? { players } : {}),
    ...(moveSequence.length > 0 ? { moveSequence } : {}),
    ...(moveIndex !== undefined ? { moveIndex } : {}),
    ...(pgn ? { pgn } : {})
  };
}

function enrichLivePageContext(result: DetectorResult, root: ParentNode): DetectorResult {
  const moveSequence = extractSanMoves(root);
  const players = mergePlayers(result.players, extractPlayersFromDom(root, result.orientation ?? 'white'));
  const visibleBoardMoveIndex = result.source === 'board-dom' && result.fenPlacement && moveSequence.length > 0
    ? moveIndexFromFenPlacement(moveSequence, result.fenPlacement)
    : undefined;
  const moveIndex = visibleBoardMoveIndex
    ?? (moveSequence.length > 0 ? currentMoveIndexFromPage(root, undefined, moveSequence.length) : undefined);

  return {
    ...result,
    ...(moveSequence.length > 0 ? { moveSequence } : {}),
    ...(moveIndex !== undefined ? { moveIndex } : {}),
    ...(players ? { players } : {})
  };
}

function mergePlayers(primary: GamePlayers | undefined, fallback: GamePlayers | undefined): GamePlayers | undefined {
  const players = {
    ...(fallback ?? {}),
    ...(primary ?? {})
  };

  return players.white || players.black ? players : undefined;
}

function buildReplayOrAnalysisResult(
  gameId: string,
  mode: DetectorResult['mode'],
  modeConfidence: number,
  modeEvidence: string[],
  sharing: DetectorResult['sharing'],
  root: ParentNode,
  cache: GameCache,
  url: string
): DetectorResult {
  const shareGame = mode === 'replay' || mode === 'analysis' ? extractChessComShareGame(root) : null;
  if (shareGame?.fen || shareGame?.pgn) {
    const shareDialogSharing: DetectorResult['sharing'] = {
      allowed: true,
      reason: mode === 'replay' ? 'replay-page' : 'analysis-page'
    };
    const shareResult: DetectorResult = {
      status: shareGame.fen ? 'ok' : 'low-confidence',
      gameId,
      mode,
      modeConfidence,
      source: shareGame.source,
      reconciledFromMoveList: false,
      sharing: sharing.allowed ? sharing : shareDialogSharing,
      evidence: [...modeEvidence, ...shareGame.evidence]
    };

    if (shareGame.fen) {
      shareResult.fen = shareGame.fen;
      shareResult.fenPlacement = fenPlacementFromFen(shareGame.fen);
      shareResult.boardConfidence = 1;
    }

    if (shareGame.pgn) {
      shareResult.pgn = shareGame.pgn;
    }

    if (shareGame.players) {
      shareResult.players = shareGame.players;
    }

    return {
      ...shareResult
    };
  }

  const boardResult = readBoard(root);
  if (boardResult) {
    return buildResult(gameId, mode, modeConfidence, modeEvidence, sharing, boardResult);
  }

  const reconciliation = reconcileMoveList(root, mode, { cache, gameId, url });
  if (reconciliation.ok && reconciliation.fen) {
    return buildReconciledResult(gameId, mode, modeConfidence, modeEvidence, sharing, reconciliation);
  }

  return buildResult(gameId, mode, modeConfidence, modeEvidence, sharing, null);
}

function buildReconciledResult(
  gameId: string,
  mode: DetectorResult['mode'],
  modeConfidence: number,
  modeEvidence: string[],
  sharing: DetectorResult['sharing'],
  reconciliation: ReturnType<typeof reconcileMoveList>
): DetectorResult {
  const fen = reconciliation.fen ?? '';
  const result: DetectorResult = {
    status: 'ok',
    gameId,
    mode,
    modeConfidence,
    board: boardFromFenPlacement(fenPlacementFromFen(fen)),
    fen,
    fenPlacement: fenPlacementFromFen(fen),
    orientation: 'white',
    source: 'move-list',
    reconciledFromMoveList: true,
    sharing,
    evidence: [...modeEvidence, 'move-list-reconciliation']
  };

  if (reconciliation.moveIndex !== undefined) {
    result.moveIndex = reconciliation.moveIndex;
  }

  return result;
}

function buildResult(
  gameId: string,
  mode: DetectorResult['mode'],
  modeConfidence: number,
  modeEvidence: string[],
  sharing: DetectorResult['sharing'],
  boardResult: BoardReadResult | null
): DetectorResult {
  if (!boardResult) {
    return {
      status: 'no-board',
      gameId,
      mode,
      modeConfidence,
      reconciledFromMoveList: false,
      sharing,
      evidence: modeEvidence
    };
  }

  return {
    status: boardResult.confidence >= 0.8 ? 'ok' : 'low-confidence',
    gameId,
    mode,
    modeConfidence,
    board: boardResult.board,
    fenPlacement: boardResult.fenPlacement,
    boardConfidence: boardResult.confidence,
    orientation: boardResult.orientation,
    source: boardResult.source,
    reconciledFromMoveList: false,
    sharing,
    evidence: [...modeEvidence, ...boardResult.evidence]
  };
}

function gameIdFromUrl(url: string): string {
  const match = /\/(?:game\/(?:(?:live|daily)\/)?|analysis\/game\/)(\d+)/.exec(url);
  if (match?.[1]) {
    return match[1];
  }

  return 'unknown-game';
}

function fenPlacementFromFen(fen: string): string {
  return fen.split(/\s+/)[0] ?? fen;
}

function boardFromFenPlacement(fenPlacement: string): BoardMap {
  const board: BoardMap = {};
  const ranks = fenPlacement.split('/');
  const pieceCodeByFen: Record<string, PieceCode> = {
    P: 'wP',
    N: 'wN',
    B: 'wB',
    R: 'wR',
    Q: 'wQ',
    K: 'wK',
    p: 'bP',
    n: 'bN',
    b: 'bB',
    r: 'bR',
    q: 'bQ',
    k: 'bK'
  };

  for (let fenRankIndex = 0; fenRankIndex < ranks.length; fenRankIndex += 1) {
    let fileIndex = 0;
    const rank = 8 - fenRankIndex;
    for (const token of ranks[fenRankIndex] ?? '') {
      if (/\d/.test(token)) {
        fileIndex += Number.parseInt(token, 10);
        continue;
      }

      const piece = pieceCodeByFen[token];
      if (!piece) {
        fileIndex += 1;
        continue;
      }

      const file = String.fromCharCode('a'.charCodeAt(0) + fileIndex);
      board[`${file}${rank}` as Square] = piece;
      fileIndex += 1;
    }
  }

  return board;
}

function hasChessComShareButton(root: ParentNode): boolean {
  return Boolean(root.querySelector('button[data-cy="sidebar-share-icon"]'))
    || Array.from(root.querySelectorAll('button')).some((button) =>
      button.querySelector('svg[data-glyph="graph-nodes-share"], [data-glyph="graph-nodes-share"]')
    );
}

function hasActiveLiveControls(root: ParentNode): boolean {
  const hasLiveButton = Array.from(root.querySelectorAll('button')).some((button) => {
    const label = button.getAttribute('aria-label')?.toLowerCase() ?? '';
    return ['resign', 'draw', 'aufgeben', 'remis'].some((value) => label.includes(value));
  });
  if (hasLiveButton) {
    return true;
  }

  const clock = root.querySelector('.clock-player-turn, [data-cy="clock-time"][role="timer"]');
  return Boolean(clock?.textContent && /\d{1,2}:\d{2}/.test(clock.textContent));
}
