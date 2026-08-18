import { buildLiveAnalysisFen } from '../engine/liveFen';
import { LocalStockfishEngine } from '../engine/localStockfish';
import { DEFAULT_MOVE_CLIFF_THRESHOLDS, detectMoveCliff } from '../engine/moveCliff';
import { resolveLiveUserColor, storeManualLiveUserColor } from '../engine/livePlayerColor';
import { selectors } from '../detector/selectors';
import { createLivePlayerColorPrompt, type LivePlayerColorPromptApi } from './livePlayerColorPrompt';
import { palette, radius, shadow } from './styleTokens';
import type { GameCache } from '../detector/gameCache';
import type { DetectorResult, Orientation } from '../detector/types';
import type { EngineLine } from '../engine/stockfishUci';

const alertAttribute = 'data-chesscom-live-move-alert';
const defaultUsername = 'NotAosSpeed';
const liveMoveAlertPromptOwnerId = 'live-move-alert';

export interface LiveMoveEngine {
  analyze: (fen: string) => Promise<EngineLine[]>;
  analyzeContinuously?: (fen: string, onUpdate: (lines: EngineLine[]) => void) => { stop: () => void };
  dispose: () => void;
}

export interface LiveMoveAlertController {
  update: (result: DetectorResult) => Promise<void>;
  dispose: () => void;
  getDebugState: () => LiveMoveAlertDebugState;
}

export interface LiveMoveAlertDebugDetails {
  targetPlayer?: string;
  targetColor?: Orientation;
  targetScoreCentipawns?: number;
  currentScoreCentipawns?: number;
}

export type LiveMoveAlertDebugState =
  | { status: 'disabled' }
  | { status: 'inactive' }
  | { status: 'waiting-for-player-color' }
  | ({ status: 'analyzing' } & LiveMoveAlertDebugDetails)
  | ({ status: 'no-cliff' } & LiveMoveAlertDebugDetails)
  | ({ status: 'warning'; safeMoveCount: number } & LiveMoveAlertDebugDetails);

export interface LiveMoveAlertControllerOptions {
  cache: GameCache;
  root?: ParentNode;
  username?: string;
  engineFactory?: () => LiveMoveEngine;
  promptFactory?: () => LivePlayerColorPromptApi;
}

export function createLiveMoveAlertController(options: LiveMoveAlertControllerOptions): LiveMoveAlertController {
  const root = options.root ?? document;
  const username = options.username ?? defaultUsername;
  let engine: LiveMoveEngine | null = null;
  let activeGameId: string | null = null;
  let lastFen: string | null = null;
  let activeAnalysisId = 0;
  let activeSession: { stop: () => void } | null = null;
  let debugState: LiveMoveAlertDebugState = { status: 'inactive' };
  const playerColorPrompt = options.promptFactory?.() ?? createLivePlayerColorPrompt(root);

  const ensureEngine = (): LiveMoveEngine => {
    engine ??= options.engineFactory?.() ?? new LocalStockfishEngine();
    return engine;
  };

  const analyze = async (result: DetectorResult, color: Orientation): Promise<void> => {
    const fen = buildLiveAnalysisFen(result, color, root);
    if (!fen) {
      removeAlert(root);
      debugState = { status: 'inactive' };
      return;
    }

    if (lastFen === fen) {
      return;
    }

    activeSession?.stop();
    activeSession = null;
    lastFen = fen;
    const analysisId = ++activeAnalysisId;
    const debugDetails = stockfishDebugDetails(result, color, username);
    debugState = { status: 'analyzing', ...debugDetails };

    const applyLines = (lines: EngineLine[]): void => {
      if (analysisId !== activeAnalysisId || lastFen !== fen) {
        return;
      }

      const cliff = detectMoveCliff(lines, color);
      if (cliff.warning) {
        renderAlert(root, cliff.safeMoveCount);
        debugState = {
          status: 'warning',
          safeMoveCount: cliff.safeMoveCount,
          ...debugDetails,
          currentScoreCentipawns: cliff.dropCentipawns
        };
      } else {
        removeAlert(root);
        debugState = { status: 'no-cliff', ...debugDetails };
      }
    };

    const engine = ensureEngine();
    if (engine.analyzeContinuously) {
      activeSession = engine.analyzeContinuously(fen, applyLines);
      return;
    }

    const lines = await engine.analyze(fen);
    applyLines(lines);
  };

  return {
    async update(result: DetectorResult): Promise<void> {
      if (result.gameId !== activeGameId) {
        activeGameId = result.gameId;
        lastFen = null;
        activeSession?.stop();
        activeSession = null;
        activeAnalysisId += 1;
      }

      if (result.mode !== 'live' || result.status !== 'ok') {
        playerColorPrompt.dismiss(liveMoveAlertPromptOwnerId);
        removeAlert(root);
        activeSession?.stop();
        activeSession = null;
        activeAnalysisId += 1;
        debugState = { status: 'inactive' };
        return;
      }

      const resolution = resolveLiveUserColor(result, options.cache, username);
      if (resolution.status === 'known') {
        playerColorPrompt.dismiss(liveMoveAlertPromptOwnerId);
        await analyze(result, resolution.color);
        return;
      }

      if (resolution.status === 'needs-choice') {
        removeAlert(root);
        debugState = { status: 'waiting-for-player-color' };
        playerColorPrompt.request(liveMoveAlertPromptOwnerId, result, (color) => {
          storeManualLiveUserColor(options.cache, result.gameId, color);
          void analyze(result, color);
        });
      }
    },
    dispose(): void {
      removeAlert(root);
      playerColorPrompt.dismiss(liveMoveAlertPromptOwnerId);
      activeSession?.stop();
      activeSession = null;
      activeAnalysisId += 1;
      engine?.dispose();
      engine = null;
      debugState = { status: 'inactive' };
    },
    getDebugState(): LiveMoveAlertDebugState {
      return debugState;
    }
  };
}

function stockfishDebugDetails(
  result: DetectorResult,
  color: Orientation,
  username: string
): LiveMoveAlertDebugDetails {
  return {
    targetPlayer: result.players?.[color]?.name ?? username,
    targetColor: color,
    targetScoreCentipawns: DEFAULT_MOVE_CLIFF_THRESHOLDS.cliffGapCentipawns
  };
}

function renderAlert(root: ParentNode, safeMoveCount: number): void {
  removeAlert(root);
  const board = boardElement(root);
  if (!board) {
    return;
  }

  ensureBoardPositioning(board);
  const alert = document.createElement('div');
  alert.setAttribute(alertAttribute, 'true');
  alert.setAttribute('role', 'alert');
  alert.textContent = `Only ${safeMoveCount} safe ${safeMoveCount === 1 ? 'move' : 'moves'} here`;
  Object.assign(alert.style, overlayStyle(palette.danger));
  board.appendChild(alert);
}

function removeAlert(root: ParentNode): void {
  root.querySelector(`[${alertAttribute}="true"]`)?.remove();
}

function boardElement(root: ParentNode): HTMLElement | null {
  for (const selector of selectors.board) {
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

function overlayStyle(background: string): Partial<CSSStyleDeclaration> {
  return {
    position: 'absolute',
    left: '50%',
    top: '2%',
    transform: 'translateX(-50%)',
    zIndex: '12',
    border: '2px solid rgba(255,255,255,0.85)',
    borderRadius: radius.md,
    background,
    color: '#fff',
    boxShadow: shadow.raised,
    padding: '6px 9px',
    font: '800 13px/1.15 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    pointerEvents: 'auto',
    whiteSpace: 'nowrap'
  };
}
