import { selectors } from '../detector/selectors';
import type { DetectorResult, Orientation } from '../detector/types';
import type { GameCache } from '../detector/gameCache';
import { buildLiveAnalysisFen } from '../engine/liveFen';
import { resolveLiveUserColor, storeManualLiveUserColor } from '../engine/livePlayerColor';
import { LocalStockfishEngine } from '../engine/localStockfish';
import type { EngineLine, EngineScore } from '../engine/stockfishUci';
import { createLivePlayerColorPrompt, type LivePlayerColorPromptApi } from './livePlayerColorPrompt';
import { palette, radius, shadow } from './styleTokens';

const barAttribute = 'data-chesscom-eval-bar';
const labelAttribute = 'data-chesscom-eval-label';
const lightAttribute = 'data-chesscom-eval-light';
const topMovesPanelAttribute = 'data-chesscom-top-moves-panel';
const topMoveRowAttribute = 'data-chesscom-top-move-row';
const topMoveArrowOverlayAttribute = 'data-chesscom-top-move-arrows';
const topMoveArrowAttribute = 'data-chesscom-top-move-arrow';
const topMoveArrowRankAttribute = 'data-chesscom-top-move-arrow-rank';
const topMoveRevealButtonAttribute = 'data-chesscom-top-move-reveal';
const topMovesSavedLeftAttribute = 'data-chesscom-top-moves-left';
const topMovesSavedTopAttribute = 'data-chesscom-top-moves-top';
const showMovesButtonSavedLeftAttribute = 'data-chesscom-show-moves-left';
const showMovesButtonSavedTopAttribute = 'data-chesscom-show-moves-top';
const topMovesStorageKey = 'chesscom-board-detector:top-moves-position';
const showMovesButtonStorageKey = 'chesscom-board-detector:show-moves-position';
const durablePositions = new Map<string, SavedPosition>();
const barSelector = `[${barAttribute}="true"]`;
const topMovesPanelSelector = `[${topMovesPanelAttribute}="true"]`;
const topMoveArrowOverlaySelector = `[${topMoveArrowOverlayAttribute}=true]`;
const topMoveRevealButtonSelector = `[${topMoveRevealButtonAttribute}=true]`;
const evalDepths = [4, 8, 12] as const;
const defaultTopMoves = 3;
const minTopMoves = 1;
const maxTopMoves = 10;
const defaultTopMovesScale = 100;
const minTopMovesScale = 50;
const maxTopMovesScale = 300;
const boardOverlayZIndex = '10';
const pageOverlayZIndex = '2147483647';
const boardOverlayGap = 8;
const showMovesButtonApproxWidth = 104;
const maxVisibleArrowDropCentipawns = 200;
// Fraction of the distance from the square centre to its edge (in the move
// direction) at which the arrow tail begins. Computing it against the real edge
// keeps diagonal arrows from starting in the middle of the square.
const arrowStartSquareEdgeRatio = 0.6;
// Arrowhead proportions, relative to the shaft stroke width.
const arrowHeadLengthRatio = 1.8;
const arrowHeadWidthRatio = 2.0;
const topMoveArrowColor = palette.arrowBest;
const alternativeMoveArrowColor = palette.arrowAlt;
const svgNamespace = 'http://www.w3.org/2000/svg';

interface DrawableArrowLine {
  line: EngineLine;
  rank: number;
  dropCentipawns: number;
  quality: number;
}

interface SavedPosition {
  left: number;
  top: number;
}

const extensionChrome = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;
void extensionChrome?.storage?.local?.get([topMovesStorageKey, showMovesButtonStorageKey], (items) => {
  for (const key of [topMovesStorageKey, showMovesButtonStorageKey]) {
    const value = items?.[key] as Partial<SavedPosition> | undefined;
    if (typeof value?.left === 'number' && typeof value.top === 'number'
      && Number.isFinite(value.left) && Number.isFinite(value.top)) {
      durablePositions.set(key, { left: value.left, top: value.top });
    }
  }
});

interface CurrentOverlayRender {
  orientation: Orientation | undefined;
  analysisFen: string;
  lines: EngineLine[];
  score: EngineScore | null;
  analysisMode: EvalBarAnalysisMode;
  showTopMoves: boolean;
  showMovesButton: boolean;
  forceShowArrows: boolean;
  topMovesScale: number;
  manuallyRevealedArrowFen: string | null;
  overlaysVisible: boolean;
  revealTopMoveArrows: () => void;
}

interface DragPoint {
  x: number;
  y: number;
}

export interface EvalBarEngine {
  analyze: (fen: string, depth?: number) => Promise<EngineLine[]>;
  analyzeContinuously?: (fen: string, onUpdate: (lines: EngineLine[]) => void) => { stop: () => void };
  dispose: () => void;
}

export interface EvalBarController {
  update: (result: DetectorResult) => Promise<void>;
  dispose: () => void;
  getDebugState: () => EvalBarDebugState;
}

export interface EvalBarControllerOptions {
  root?: ParentNode;
  engineFactory?: () => EvalBarEngine;
  cache?: GameCache;
  username?: string;
  promptFactory?: () => LivePlayerColorPromptApi;
  topMoves?: number;
  showTopMoves?: boolean;
  showMovesButton?: boolean;
  showOpponentMovesOnly?: boolean;
  topMovesScale?: number;
}

export type EvalBarAnalysisMode = 'continuous' | 'bounded';

export interface EvalBarTopMoveDebugLine {
  rank: number;
  move: string;
  score: EngineScore;
  formattedScore: string;
  depth: number;
}

export interface EvalBarOpponentMovesDebug {
  enabled: boolean;
  liveGame: boolean;
  playerColor?: Orientation;
  opponentColor?: Orientation;
  positionSideToMove?: 'w' | 'b';
  analyzedSideToMove?: 'w' | 'b';
  overlaysVisible: boolean;
  forceShowArrows: boolean;
  showTopMoves: boolean;
  showMovesButton: boolean;
  topMoves: number;
  topMovesScale: number;
  visibleFen?: string;
  analysisFen?: string;
  reason: string;
}

export interface EvalBarDebugDetails {
  fen: string;
  analysisMode: EvalBarAnalysisMode;
  score?: EngineScore;
  formattedScore?: string;
  depth?: number;
  bestMove?: string;
  topMoveLines?: EvalBarTopMoveDebugLine[];
  opponentMoves?: EvalBarOpponentMovesDebug;
}

export type EvalBarDebugState =
  | { status: 'disabled' }
  | { status: 'inactive' }
  | { status: 'waiting-for-player-color'; opponentMoves?: EvalBarOpponentMovesDebug }
  | ({ status: 'analyzing' } & EvalBarDebugDetails)
  | ({ status: 'ready' } & EvalBarDebugDetails);

export function createEvalBarController(options: EvalBarControllerOptions = {}): EvalBarController {
  const root = options.root ?? document;
  const cache = options.cache;
  const username = options.username ?? 'NotAosSpeed';
  const topMoves = normalizeTopMoves(options.topMoves);
  const showTopMoves = options.showTopMoves ?? true;
  const showMovesButton = options.showMovesButton ?? true;
  const showOpponentMovesOnly = options.showOpponentMovesOnly ?? false;
  const topMovesScale = normalizeTopMovesScale(options.topMovesScale);
  const playerColorPrompt = options.promptFactory?.() ?? createLivePlayerColorPrompt(root);
  let engine: EvalBarEngine | null = null;
  let scoreEngine: EvalBarEngine | null = null;
  let activeGameId: string | null = null;
  let activeFen: string | null = null;
  let activeScoreFen: string | null = null;
  let activeAnalysisId = 0;
  let activeScoreAnalysisId = 0;
  let activeSession: { stop: () => void } | null = null;
  let lastScore: EngineScore | null = null;
  let lastVisibleLines: EngineLine[] = [];
  let lastAnalysisMode: EvalBarAnalysisMode = 'bounded';
  let manuallyRevealedArrowFen: string | null = null;
  let lastOverlaysVisible = true;
  let activeLiveUserColor: Orientation | null = null;
  let debugState: EvalBarDebugState = { status: 'inactive' };
  const evalPromptOwnerId = 'eval-bar';

  const ensureEngine = (): EvalBarEngine => {
    engine ??= options.engineFactory?.() ?? new LocalStockfishEngine({
      multipv: topMoves,
      depth: 10,
      minimumUpdateDepth: 4
    });
    return engine;
  };

  const ensureScoreEngine = (): EvalBarEngine => {
    scoreEngine ??= options.engineFactory?.() ?? new LocalStockfishEngine({
      multipv: 1,
      depth: 10,
      minimumUpdateDepth: 4
    });
    return scoreEngine;
  };

  const applyScoreLines = (
    analysisId: number,
    scoreFen: string,
    lines: EngineLine[],
    orientation?: Orientation
  ): void => {
    if (analysisId !== activeScoreAnalysisId || scoreFen !== activeScoreFen) {
      return;
    }

    const bestLine = sortedEngineLines(lines)
      .map((line) => ({
        ...line,
        score: scoreFromWhitePerspective(line.score, scoreFen)
      }))
      .find((line) => line.multipv === 1);
    if (!bestLine) {
      return;
    }

    lastScore = bestLine.score;
    updateEvalBarOverlay(bestLine.score, root, orientation);

    if (debugState.status === 'ready' || debugState.status === 'analyzing') {
      debugState = {
        ...debugState,
        score: bestLine.score,
        formattedScore: formatEvalScore(bestLine.score)
      };
    }
  };

  const applyLines = (
    analysisId: number,
    result: DetectorResult,
    analyzedFen: string,
    positionFen: string,
    lines: EngineLine[],
    analysisMode: EvalBarAnalysisMode,
    orientation?: Orientation
  ): void => {
    if (analysisId !== activeAnalysisId || analyzedFen !== activeFen) {
      return;
    }

    const visibleLines = sortedEngineLines(lines)
      .slice(0, topMoves)
      .map((line) => ({
        ...line,
        score: scoreFromWhitePerspective(line.score, analyzedFen)
      }));
    const bestLine = visibleLines.find((line) => line.multipv === 1) ?? visibleLines[0];
    if (bestLine) {
      const splitEvalFromOverlays = analyzedFen !== positionFen;
      const displayScore = splitEvalFromOverlays ? lastScore : bestLine.score;
      const analyzedSideToMove = sideToMoveFromFen(analyzedFen);
      const positionSideToMove = sideToMoveFromFen(positionFen);
      const topMovesVisible = shouldShowLiveOverlays(result, positionSideToMove, showOpponentMovesOnly, activeLiveUserColor);
      const forceShowArrows = shouldForceTopMoveArrows(result, showOpponentMovesOnly);
      const shouldDebugOpponentMoves = showOpponentMovesOnly;
      const opponentMovesDebug = shouldDebugOpponentMoves
        ? buildOpponentMovesDebug({
            result,
            playerColor: activeLiveUserColor,
            positionSideToMove,
            analyzedSideToMove,
            overlaysVisible: topMovesVisible,
            forceShowArrows,
            visibleFen: positionFen,
            analysisFen: analyzedFen,
            showOpponentMovesOnly,
            showTopMoves,
            showMovesButton,
            topMoves,
            topMovesScale
          })
        : undefined;
      const topMoveLines = visibleLines.map((line, index) => ({
        rank: index + 1,
        move: line.move,
        score: line.score,
        formattedScore: formatEvalScore(line.score),
        depth: line.depth
      }));
      lastVisibleLines = visibleLines;
      lastAnalysisMode = analysisMode;
      lastOverlaysVisible = topMovesVisible;
      if (!splitEvalFromOverlays && displayScore) {
        lastScore = displayScore;
        updateEvalBarOverlay(displayScore, root, orientation);
      }
      if (topMovesVisible) {
        updateTopMovesOverlay(visibleLines, root, {
          scale: topMovesScale,
          showMoves: showTopMoves,
          sideToMove: analyzedSideToMove
        });
        if (showTopMoves || forceShowArrows) {
          removeTopMoveRevealButton(root);
          updateTopMoveArrows(visibleLines, root, orientation, analyzedSideToMove);
        } else if (manuallyRevealedArrowFen === positionFen) {
          removeTopMoveRevealButton(root);
          updateTopMoveArrows(visibleLines, root, orientation, analyzedSideToMove);
        } else if (showMovesButton) {
          removeTopMoveArrows(root);
          updateTopMoveRevealButton(root, orientation, () => {
            if (activeFen !== analyzedFen) {
              return;
            }

            manuallyRevealedArrowFen = positionFen;
            removeTopMoveRevealButton(root);
            updateTopMoveArrows(visibleLines, root, orientation, analyzedSideToMove);
          });
        } else {
          removeTopMoveArrows(root);
          removeTopMoveRevealButton(root);
        }
      } else {
        removeTopMovesOverlay(root);
        removeTopMoveArrows(root);
        removeTopMoveRevealButton(root);
      }
      debugState = {
        status: 'ready',
        fen: splitEvalFromOverlays ? positionFen : analyzedFen,
        analysisMode,
        ...(displayScore
          ? {
              score: displayScore,
              formattedScore: formatEvalScore(displayScore)
            }
          : {}),
        depth: bestLine.depth,
        bestMove: bestLine.move,
        ...(shouldDebugOpponentMoves ? { topMoveLines } : {}),
        ...(opponentMovesDebug ? { opponentMoves: opponentMovesDebug } : {})
      };
    }
  };

  const controller: EvalBarController = {
    async update(result: DetectorResult): Promise<void> {
      if (result.gameId !== activeGameId) {
        activeGameId = result.gameId;
        activeSession?.stop();
        activeSession = null;
        activeFen = null;
        activeScoreFen = null;
        activeAnalysisId += 1;
        activeScoreAnalysisId += 1;
        lastScore = null;
        lastVisibleLines = [];
        lastAnalysisMode = 'bounded';
        manuallyRevealedArrowFen = null;
        activeLiveUserColor = null;
      }

      const fen = currentPositionFen(result, root);
      if (result.status !== 'ok' || !fen) {
        playerColorPrompt.dismiss(evalPromptOwnerId);
        activeSession?.stop();
        activeSession = null;
        activeFen = null;
        activeScoreFen = null;
        activeAnalysisId += 1;
        activeScoreAnalysisId += 1;
        lastScore = null;
        lastVisibleLines = [];
        lastAnalysisMode = 'bounded';
        manuallyRevealedArrowFen = null;
        lastOverlaysVisible = true;
        activeLiveUserColor = null;
        debugState = { status: 'inactive' };
        removeEvalBarOverlay(root);
        return;
      }

      if (showOpponentMovesOnly && result.mode === 'live') {
        const resolution = cache
          ? resolveLiveUserColor(result, cache, username)
          : { status: 'needs-choice' as const };
        if (resolution.status === 'known') {
          activeLiveUserColor = resolution.color;
          playerColorPrompt.dismiss(evalPromptOwnerId);
        } else {
          activeLiveUserColor = null;
          playerColorPrompt.request(evalPromptOwnerId, result, (color) => {
            if (cache) {
              storeManualLiveUserColor(cache, result.gameId, color);
            }
            activeLiveUserColor = color;
            void controller.update(result);
          });
          debugState = {
            status: 'waiting-for-player-color',
            opponentMoves: buildOpponentMovesDebug({
              result,
              playerColor: null,
              overlaysVisible: false,
              forceShowArrows: shouldForceTopMoveArrows(result, showOpponentMovesOnly),
              showOpponentMovesOnly,
              showTopMoves,
              showMovesButton,
              topMoves,
              topMovesScale
            })
          };
          removeTopMovesOverlay(root);
          removeTopMoveArrows(root);
          removeTopMoveRevealButton(root);
          return;
        }
      } else {
        activeLiveUserColor = null;
        playerColorPrompt.dismiss(evalPromptOwnerId);
      }

      const visibleFen = showOpponentMovesOnly && result.mode === 'live'
        ? buildLiveAnalysisFen(result, activeLiveUserColor ?? 'white', root, 'current') ?? fen
        : fen;
      const analysisTargetFen = visibleFen;
      const scoreTargetFen = visibleFen;
      const splitEvalFromOverlays = analysisTargetFen !== scoreTargetFen;
      if (!analysisTargetFen) {
        removeEvalBarOverlay(root);
        return;
      }
      const positionOverlaysVisible = shouldShowLiveOverlays(
        result,
        sideToMoveFromFen(visibleFen),
        showOpponentMovesOnly,
        activeLiveUserColor
      );
      if (!positionOverlaysVisible) {
        removeTopMovesOverlay(root);
        removeTopMoveArrows(root);
        removeTopMoveRevealButton(root);
      }

      if (splitEvalFromOverlays && scoreTargetFen !== activeScoreFen) {
        activeScoreFen = scoreTargetFen;
        const scoreAnalysisId = ++activeScoreAnalysisId;
        lastScore = { type: 'cp', value: 0 };
        updateEvalBarOverlay(lastScore, root, result.orientation);
        const currentScoreEngine = ensureScoreEngine();
        void (async () => {
          for (const depth of evalDepths) {
            const lines = await currentScoreEngine.analyze(scoreTargetFen, depth);
            applyScoreLines(scoreAnalysisId, scoreTargetFen, lines, result.orientation);
            if (scoreAnalysisId !== activeScoreAnalysisId || scoreTargetFen !== activeScoreFen) {
              break;
            }
          }
        })();
      } else if (!splitEvalFromOverlays) {
        activeScoreFen = null;
        activeScoreAnalysisId += 1;
      }

      if (analysisTargetFen === activeFen) {
        redrawCurrentOverlays(visibleFen, root, {
          orientation: result.orientation,
          analysisFen: analysisTargetFen,
          lines: lastVisibleLines,
          score: lastScore,
          analysisMode: lastAnalysisMode,
          showTopMoves,
          showMovesButton,
          forceShowArrows: shouldForceTopMoveArrows(result, showOpponentMovesOnly),
          topMovesScale,
          manuallyRevealedArrowFen,
          overlaysVisible: positionOverlaysVisible && lastOverlaysVisible,
          revealTopMoveArrows: () => {
            if (activeFen !== analysisTargetFen || lastVisibleLines.length === 0) {
              return;
            }

            manuallyRevealedArrowFen = visibleFen;
            removeTopMoveRevealButton(root);
            updateTopMoveArrows(lastVisibleLines, root, result.orientation, sideToMoveFromFen(analysisTargetFen));
          }
        });
        return;
      }

      activeSession?.stop();
      activeSession = null;
      activeFen = analysisTargetFen;
      manuallyRevealedArrowFen = null;
      const currentEngine = ensureEngine();
      if (!splitEvalFromOverlays) {
        lastScore = { type: 'cp', value: 0 };
      }
      lastVisibleLines = [];
      lastAnalysisMode = currentEngine.analyzeContinuously ? 'continuous' : 'bounded';
      lastOverlaysVisible = true;
      const analysisId = ++activeAnalysisId;
      if (!splitEvalFromOverlays) {
        updateEvalBarOverlay({ type: 'cp', value: 0 }, root, result.orientation);
      }

      if (currentEngine.analyzeContinuously) {
        debugState = {
          status: 'analyzing',
          fen: analysisTargetFen,
          analysisMode: 'continuous',
          ...(showOpponentMovesOnly
            ? {
                opponentMoves: buildOpponentMovesDebug({
                  result,
                  playerColor: activeLiveUserColor,
                  positionSideToMove: sideToMoveFromFen(visibleFen),
                  analyzedSideToMove: sideToMoveFromFen(analysisTargetFen),
                  overlaysVisible: shouldShowLiveOverlays(result, sideToMoveFromFen(visibleFen), showOpponentMovesOnly, activeLiveUserColor),
                  forceShowArrows: shouldForceTopMoveArrows(result, showOpponentMovesOnly),
                  visibleFen,
                  analysisFen: analysisTargetFen,
                  showOpponentMovesOnly,
                  showTopMoves,
                  showMovesButton,
                  topMoves,
                  topMovesScale
                })
              }
            : {})
        };
        activeSession = currentEngine.analyzeContinuously(
          analysisTargetFen,
          (lines) => applyLines(analysisId, result, analysisTargetFen, visibleFen, lines, 'continuous', result.orientation)
        );
        return;
      }

      debugState = {
        status: 'analyzing',
        fen: analysisTargetFen,
        analysisMode: 'bounded',
        ...(showOpponentMovesOnly
          ? {
              opponentMoves: buildOpponentMovesDebug({
                result,
                playerColor: activeLiveUserColor,
                positionSideToMove: sideToMoveFromFen(visibleFen),
                analyzedSideToMove: sideToMoveFromFen(analysisTargetFen),
                overlaysVisible: shouldShowLiveOverlays(result, sideToMoveFromFen(visibleFen), showOpponentMovesOnly, activeLiveUserColor),
                forceShowArrows: shouldForceTopMoveArrows(result, showOpponentMovesOnly),
                visibleFen,
                analysisFen: analysisTargetFen,
                showOpponentMovesOnly,
                showTopMoves,
                showMovesButton,
                topMoves,
                topMovesScale
              })
            }
          : {})
      };
      for (const depth of evalDepths) {
        const lines = await currentEngine.analyze(analysisTargetFen, depth);
        applyLines(analysisId, result, analysisTargetFen, visibleFen, lines, 'bounded', result.orientation);

        if (analysisId !== activeAnalysisId || analysisTargetFen !== activeFen) {
          break;
        }
      }
    },
    dispose(): void {
      activeSession?.stop();
      activeSession = null;
      activeGameId = null;
      activeFen = null;
      activeScoreFen = null;
      activeAnalysisId += 1;
      activeScoreAnalysisId += 1;
      lastScore = null;
      lastVisibleLines = [];
      lastAnalysisMode = 'bounded';
      manuallyRevealedArrowFen = null;
      lastOverlaysVisible = true;
      activeLiveUserColor = null;
      playerColorPrompt.dismiss(evalPromptOwnerId);
      engine?.dispose();
      engine = null;
      scoreEngine?.dispose();
      scoreEngine = null;
      debugState = { status: 'inactive' };
      removeEvalBarOverlay(root);
    },
    getDebugState(): EvalBarDebugState {
      return debugState;
    }
  };

  return controller;
}

export function updateEvalBarOverlay(score: EngineScore, root: ParentNode = document, orientation?: Orientation): void {
  removeEvalBars(root);

  const board = boardElement(root);
  if (!board) {
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const boardOrientation = orientation ?? orientationFromBoard(board);
  const whiteFillPercent = evalFillPercent(score);
  const blackFillPercent = 100 - whiteFillPercent;
  const whitePlacement = boardOrientation === 'black' ? 'top' : 'bottom';
  const blackPlacement = whitePlacement === 'top' ? 'bottom' : 'top';
  const labelPlacement = scoreLabelPlacement(score, boardOrientation);
  const bar = document.createElement('div');
  bar.setAttribute(barAttribute, 'true');
  bar.setAttribute('aria-label', `Engine evaluation ${formatEvalScore(score)}`);

  const lightFill = document.createElement('div');
  lightFill.setAttribute(lightAttribute, 'true');
  Object.assign(lightFill.style, {
    position: 'absolute',
    left: '0',
    top: whitePlacement === 'top' ? '0' : '',
    bottom: whitePlacement === 'bottom' ? '0' : '',
    width: '100%',
    height: `${whiteFillPercent}%`,
    background: palette.evalWhite
  } satisfies Partial<CSSStyleDeclaration>);

  const darkFill = document.createElement('div');
  Object.assign(darkFill.style, {
    position: 'absolute',
    left: '0',
    top: blackPlacement === 'top' ? '0' : '',
    bottom: blackPlacement === 'bottom' ? '0' : '',
    width: '100%',
    height: `${blackFillPercent}%`,
    background: palette.evalBlack
  } satisfies Partial<CSSStyleDeclaration>);

  const label = document.createElement('div');
  label.setAttribute(labelAttribute, 'true');
  label.textContent = formatEvalScore(score);
  Object.assign(label.style, {
    position: 'absolute',
    left: '0px',
    right: '0px',
    top: labelPlacement === 'top' ? '5px' : '',
    bottom: labelPlacement === 'bottom' ? '5px' : '',
    display: 'flex',
    justifyContent: 'center',
    color: labelTextColor(score, boardOrientation),
    font: '700 11px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textAlign: 'center',
    zIndex: '1',
    pointerEvents: 'none'
  } satisfies Partial<CSSStyleDeclaration>);

  Object.assign(bar.style, {
    position: 'absolute',
    left: `${evalBarDocumentLeft(boardRect, root)}px`,
    top: `${documentY(boardRect.top, root)}px`,
    width: '30px',
    height: `${boardRect.height}px`,
    overflow: 'hidden',
    border: `1px solid ${palette.borderStrong}`,
    background: palette.evalBlack,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    zIndex: boardOverlayZIndex
  } satisfies Partial<CSSStyleDeclaration>);

  bar.append(lightFill, darkFill, label);
  ownerDocument(root).body.appendChild(bar);
}

export function removeEvalBarOverlay(root: ParentNode = document): void {
  removeEvalBars(root);
  removeTopMovesOverlay(root);
  removeTopMoveArrows(root);
  removeTopMoveRevealButton(root);
}

function redrawCurrentOverlays(positionFen: string, root: ParentNode, render: CurrentOverlayRender): void {
  if (render.score) {
    updateEvalBarOverlay(render.score, root, render.orientation);
  }

  if (!render.overlaysVisible) {
    removeTopMovesOverlay(root);
    removeTopMoveArrows(root);
    removeTopMoveRevealButton(root);
    return;
  }

  if (render.lines.length === 0) {
    return;
  }

  const sideToMove = sideToMoveFromFen(render.analysisFen);
  updateTopMovesOverlay(render.lines, root, {
    scale: render.topMovesScale,
    showMoves: render.showTopMoves,
    sideToMove
  });

  if (render.showTopMoves || render.forceShowArrows) {
    removeTopMoveRevealButton(root);
    updateTopMoveArrows(render.lines, root, render.orientation, sideToMove);
    return;
  }

  if (render.manuallyRevealedArrowFen === positionFen) {
    removeTopMoveRevealButton(root);
    updateTopMoveArrows(render.lines, root, render.orientation, sideToMove);
    return;
  }

  if (render.showMovesButton) {
    removeTopMoveArrows(root);
    updateTopMoveRevealButton(root, render.orientation, render.revealTopMoveArrows);
    return;
  }

  removeTopMoveArrows(root);
  removeTopMoveRevealButton(root);
}

export function formatEvalScore(score: EngineScore): string {
  if (score.type === 'mate') {
    return score.value < 0 ? `-M${Math.abs(score.value)}` : `M${score.value}`;
  }

  const sign = score.value < 0 ? -1 : 1;
  return String((sign * Math.round(Math.abs(score.value) / 10) / 10).toFixed(1));
}

export function evalFillPercent(score: EngineScore): number {
  if (score.type === 'mate') {
    return score.value < 0 ? 5 : 95;
  }

  return Math.min(Math.max(50 + score.value / 10, 10), 90);
}

function updateTopMovesOverlay(
  lines: EngineLine[],
  root: ParentNode = document,
  options: { scale?: number; showMoves?: boolean; sideToMove?: 'w' | 'b' } = {}
): void {
  if (lines.length === 0) {
    return;
  }

  const board = boardElement(root);
  if (!board) {
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const panel = root.querySelector<HTMLElement>(topMovesPanelSelector) ?? createTopMovesPanel(root);
  panel.replaceChildren();

  if (panel.dataset.chesscomTopMovesDragged !== 'true') {
    const savedPosition = savedTopMovesPanelPosition(root);
    const panelWidth = scaledPanelValue(128, options.scale);
    Object.assign(panel.style, {
      left: `${savedPosition?.left ?? defaultSideOverlayLeft(boardRect, root, panelWidth)}px`,
      top: `${savedPosition?.top ?? documentY(boardRect.top, root)}px`
    } satisfies Partial<CSSStyleDeclaration>);
    if (savedPosition) {
      panel.dataset.chesscomTopMovesDragged = 'true';
    }
  }

  ownerDocument(root).body.appendChild(panel);
  attachTopMovesDragHandlers(panel);
  applyTopMovesPanelStyle(panel, options.scale);

  const header = document.createElement('div');
  header.textContent = options.sideToMove === 'b' ? 'Black to move' : 'White to move';
  Object.assign(header.style, {
    marginBottom: `${scaledPanelValue(4, options.scale)}px`,
    color: palette.textSecondary,
    font: `700 ${scaledPanelValue(10, options.scale)}px/1.1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    whiteSpace: 'nowrap'
  } satisfies Partial<CSSStyleDeclaration>);
  panel.appendChild(header);

  lines.forEach((line, index) => {
    const row = document.createElement('div');
    row.setAttribute(topMoveRowAttribute, 'true');
    const showMoves = options.showMoves ?? true;
    Object.assign(row.style, {
      display: 'grid',
      gridTemplateColumns: showMoves
        ? `${scaledPanelValue(14, options.scale)}px auto minmax(${scaledPanelValue(38, options.scale)}px, 1fr)`
        : `${scaledPanelValue(14, options.scale)}px auto`,
      gap: `${scaledPanelValue(4, options.scale)}px`,
      alignItems: 'center',
      padding: `${scaledPanelValue(1, options.scale)}px 0`,
      whiteSpace: 'nowrap'
    } satisfies Partial<CSSStyleDeclaration>);

    const rank = document.createElement('span');
    rank.textContent = String(index + 1);
    Object.assign(rank.style, {
      color: palette.textMuted,
      fontWeight: '700'
    } satisfies Partial<CSSStyleDeclaration>);

    const score = document.createElement('span');
    score.textContent = formatEvalScore(line.score);
    Object.assign(score.style, {
      color: line.score.value < 0 ? palette.scoreNegative : palette.scorePositive,
      fontVariantNumeric: 'tabular-nums'
    } satisfies Partial<CSSStyleDeclaration>);

    if (showMoves) {
      const move = document.createElement('span');
      move.textContent = line.move;
      Object.assign(move.style, {
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      } satisfies Partial<CSSStyleDeclaration>);
      row.append(rank, score, move);
    } else {
      row.append(rank, score);
    }
    panel.appendChild(row);
  });
}

function createTopMovesPanel(root: ParentNode): HTMLElement {
  const panel = ownerDocument(root).createElement('div');
  panel.setAttribute(topMovesPanelAttribute, 'true');
  panel.setAttribute('aria-label', 'Top engine moves');
  return panel;
}

function applyTopMovesPanelStyle(panel: HTMLElement, scale?: number): void {
  Object.assign(panel.style, {
    position: 'absolute',
    minWidth: `${scaledPanelValue(96, scale)}px`,
    maxWidth: `${scaledPanelValue(128, scale)}px`,
    padding: `${scaledPanelValue(7, scale)}px ${scaledPanelValue(8, scale)}px`,
    border: `1px solid ${palette.borderSubtle}`,
    borderRadius: radius.lg,
    background: palette.surfaceRaised,
    boxShadow: shadow.panel,
    boxSizing: 'border-box',
    color: palette.textPrimary,
    cursor: 'move',
    font: `600 ${scaledPanelValue(10, scale)}px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    pointerEvents: 'auto',
    userSelect: 'none',
    zIndex: pageOverlayZIndex
  } satisfies Partial<CSSStyleDeclaration>);
}

function scaledPanelValue(value: number, scale: unknown): number {
  return Math.round(value * normalizeTopMovesScale(scale) / 100);
}

function attachTopMovesDragHandlers(panel: HTMLElement): void {
  if (panel.dataset.chesscomTopMovesDragBound === 'true') {
    return;
  }

  panel.dataset.chesscomTopMovesDragBound = 'true';
  attachDragHandlers(panel, {
    onStart: () => {
      panel.dataset.chesscomTopMovesDragged = 'true';
    },
    onMove: (left, top) => {
      saveTopMovesPanelPosition(panel, left, top);
    }
  });
}

function attachDragHandlers(
  element: HTMLElement,
  handlers: {
    onStart?: () => void;
    onMove?: (left: number, top: number) => void;
    onEnd?: (dragged: boolean) => void;
  }
): void {
  const startDrag = (event: MouseEvent): void => {
    if (event.type === 'mousedown' && event.button !== 0) {
      return;
    }

    if (event.type === 'pointerdown') {
      element.dataset.chesscomPointerDragActive = 'true';
    } else if (element.dataset.chesscomPointerDragActive === 'true') {
      return;
    }

    const startPoint = dragPoint(event);
    if (!startPoint) {
      return;
    }

    const doc = element.ownerDocument;
    const startLeft = parsePixelValue(element.style.left);
    const startTop = parsePixelValue(element.style.top);
    const moveEventType = event.type === 'pointerdown' ? 'pointermove' : 'mousemove';
    const upEventType = event.type === 'pointerdown' ? 'pointerup' : 'mouseup';
    let dragged = false;
    handlers.onStart?.();
    event.preventDefault();

    const onMove = (moveEvent: MouseEvent): void => {
      const currentPoint = dragPoint(moveEvent);
      if (!currentPoint) {
        return;
      }

      const nextLeft = Math.round(startLeft + currentPoint.x - startPoint.x);
      const nextTop = Math.round(startTop + currentPoint.y - startPoint.y);
      dragged = true;
      element.style.left = `${nextLeft}px`;
      element.style.top = `${nextTop}px`;
      handlers.onMove?.(nextLeft, nextTop);
    };

    const onUp = (): void => {
      doc.removeEventListener(moveEventType, onMove);
      doc.removeEventListener(upEventType, onUp);
      if (event.type === 'pointerdown') {
        delete element.dataset.chesscomPointerDragActive;
      }
      handlers.onEnd?.(dragged);
    };

    doc.addEventListener(moveEventType, onMove);
    doc.addEventListener(upEventType, onUp);
  };

  element.addEventListener('pointerdown', startDrag);
  element.addEventListener('mousedown', startDrag);
}

function dragPoint(event: MouseEvent): DragPoint | null {
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
    return null;
  }

  return { x: event.clientX, y: event.clientY };
}

function parsePixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function evalBarDocumentLeft(boardRect: DOMRect, root: ParentNode): number {
  const pageX = scrollX(root);
  return Math.max(Math.round(boardRect.left + pageX - 35), pageX);
}

function defaultSideOverlayLeft(boardRect: DOMRect, root: ParentNode, overlayWidth: number): number {
  const pageX = scrollX(root);
  const viewportWidth = ownerWindow(root)?.innerWidth ?? 0;
  const viewportRight = pageX + viewportWidth;
  const preferredRight = Math.round(boardRect.right + pageX + boardOverlayGap);
  const preferredLeft = Math.round(boardRect.left + pageX - overlayWidth - boardOverlayGap);
  const minLeft = pageX + boardOverlayGap;
  const maxLeft = Math.max(minLeft, viewportRight - overlayWidth - boardOverlayGap);
  const hasChessComGameSidebar = Boolean(ownerDocument(root).querySelector('#board-layout-sidebar'));
  const hasChessComNavigationSidebar = Boolean(ownerDocument(root).querySelector('#sidebar-main-menu'));
  const hasChessComWideGameLayout = hasChessComGameSidebar && hasChessComNavigationSidebar;
  const hasRoomLeftOfBoard = boardRect.left >= overlayWidth + boardOverlayGap * 2;

  if (hasChessComWideGameLayout && hasRoomLeftOfBoard) {
    return preferredLeft;
  }

  if (preferredRight + overlayWidth <= viewportRight - boardOverlayGap) {
    return Math.max(preferredRight, minLeft);
  }

  if (preferredLeft >= minLeft) {
    return preferredLeft;
  }

  const clampedRight = Math.min(Math.max(preferredRight, minLeft), maxLeft);
  const clampedLeft = Math.min(Math.max(preferredLeft, minLeft), maxLeft);
  const rightOverlap = overlayBoardOverlap(clampedRight, overlayWidth, boardRect, pageX);
  const leftOverlap = overlayBoardOverlap(clampedLeft, overlayWidth, boardRect, pageX);
  return leftOverlap <= rightOverlap ? clampedLeft : clampedRight;
}

function documentY(viewportY: number, root: ParentNode): number {
  return Math.round(viewportY + scrollY(root));
}

function overlayBoardOverlap(overlayLeft: number, overlayWidth: number, boardRect: DOMRect, pageX: number): number {
  const boardLeft = boardRect.left + pageX;
  const boardRight = boardRect.right + pageX;
  const overlayRight = overlayLeft + overlayWidth;
  return Math.max(0, Math.min(overlayRight, boardRight) - Math.max(overlayLeft, boardLeft));
}

function scrollX(root: ParentNode): number {
  const win = ownerWindow(root);
  return win?.scrollX ?? win?.pageXOffset ?? 0;
}

function scrollY(root: ParentNode): number {
  const win = ownerWindow(root);
  return win?.scrollY ?? win?.pageYOffset ?? 0;
}

function saveTopMovesPanelPosition(panel: HTMLElement, left: number, top: number): void {
  const body = panel.ownerDocument.body;
  body.setAttribute(topMovesSavedLeftAttribute, String(left));
  body.setAttribute(topMovesSavedTopAttribute, String(top));
  saveStoredPosition(panel.ownerDocument, topMovesStorageKey, { left, top });
}

function savedTopMovesPanelPosition(root: ParentNode): SavedPosition | null {
  return savedBodyPosition(root, topMovesSavedLeftAttribute, topMovesSavedTopAttribute)
    ?? readStoredPosition(root, topMovesStorageKey);
}

function removeEvalBars(root: ParentNode = document): void {
  for (const bar of root.querySelectorAll(barSelector)) {
    bar.remove();
  }
}

function removeTopMovesOverlay(root: ParentNode = document): void {
  for (const panel of root.querySelectorAll(topMovesPanelSelector)) {
    panel.remove();
  }
}

function updateTopMoveArrows(
  lines: EngineLine[],
  root: ParentNode,
  orientation: Orientation | undefined,
  sideToMove: 'w' | 'b'
): void {
  removeTopMoveArrows(root);

  const board = boardElement(root);
  if (!board || lines.length === 0) {
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const boardOrientation = orientation ?? orientationFromBoard(board);
  const arrowLines = drawableArrowLines(lines, sideToMove);
  if (arrowLines.length === 0) {
    return;
  }

  ensureBoardPositioning(board);
  const doc = ownerDocument(root);
  const svg = doc.createElementNS(svgNamespace, 'svg');
  svg.setAttribute(topMoveArrowOverlayAttribute, 'true');
  svg.setAttribute('viewBox', `0 0 ${Math.round(boardRect.width)} ${Math.round(boardRect.height)}`);
  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
    zIndex: '11'
  } satisfies Partial<CSSStyleDeclaration>);

  const defs = doc.createElementNS(svgNamespace, 'defs');
  svg.appendChild(defs);
  arrowLines.forEach((arrowLine) => {
    appendTopMoveArrow(svg, defs, arrowLine, boardRect, boardOrientation);
  });
  board.appendChild(svg);
}

function drawableArrowLines(lines: EngineLine[], sideToMove: 'w' | 'b'): DrawableArrowLine[] {
  const entries = lines.map((line, index) => ({
    line,
    rank: index + 1,
    value: scoreComparableCentipawns(line.score, sideToMove)
  }));
  const bestValue = entries[0]?.value;
  if (bestValue === undefined) {
    return [];
  }

  return entries
    .map((entry) => {
      const dropCentipawns = Math.max(0, bestValue - entry.value);
      const quality = Math.max(0, 1 - dropCentipawns / maxVisibleArrowDropCentipawns);
      return { line: entry.line, rank: entry.rank, dropCentipawns, quality };
    })
    .filter((entry) => entry.rank === 1 || entry.dropCentipawns <= maxVisibleArrowDropCentipawns)
    .filter((entry) => parseUciMove(entry.line.move) !== null);
}

function scoreComparableCentipawns(score: EngineScore, sideToMove: 'w' | 'b'): number {
  const whiteValue = score.type === 'mate' ? mateComparableCentipawns(score.value) : score.value;
  return sideToMove === 'w' ? whiteValue : -whiteValue;
}

function mateComparableCentipawns(value: number): number {
  const magnitude = 100000 - Math.min(Math.abs(value), 999);
  return value < 0 ? -magnitude : magnitude;
}

function appendTopMoveArrow(
  svg: SVGSVGElement,
  defs: SVGDefsElement,
  arrowLine: DrawableArrowLine,
  boardRect: DOMRect,
  orientation: Orientation
): void {
  const move = parseUciMove(arrowLine.line.move);
  if (!move) {
    return;
  }

  const strokeWidth = topMoveStrokeWidth(boardRect.width, arrowLine);
  const endpoints = topMoveArrowEndpoints(move.from, move.to, boardRect, orientation, strokeWidth);
  if (!endpoints) {
    return;
  }

  const { from, to, markerLength } = endpoints;
  const color = arrowLine.rank === 1 ? topMoveArrowColor : alternativeMoveArrowColor;
  const opacity = arrowLine.rank === 1 ? 0.9 : 0.35 + arrowLine.quality * 0.35;
  const headWidth = Math.round(strokeWidth * arrowHeadWidthRatio);
  const markerId = `chesscom-top-move-arrow-${arrowLine.rank}`;
  const marker = svg.ownerDocument.createElementNS(svgNamespace, 'marker');
  marker.setAttribute('id', markerId);
  marker.setAttribute('markerWidth', String(markerLength));
  marker.setAttribute('markerHeight', String(headWidth));
  marker.setAttribute('markerUnits', 'userSpaceOnUse');
  // refX=0 anchors the arrowhead base at the shaft's end so the head extends
  // forward to the tip with no shaft running underneath it.
  marker.setAttribute('refX', '0');
  marker.setAttribute('refY', String(headWidth / 2));
  marker.setAttribute('viewBox', `0 0 ${markerLength} ${headWidth}`);
  marker.setAttribute('orient', 'auto');

  const head = svg.ownerDocument.createElementNS(svgNamespace, 'path');
  head.setAttribute('d', `M 0 0 L ${markerLength} ${headWidth / 2} L 0 ${headWidth} z`);
  head.setAttribute('fill', color);
  marker.appendChild(head);
  defs.appendChild(marker);

  const line = svg.ownerDocument.createElementNS(svgNamespace, 'line');
  line.setAttribute(topMoveArrowAttribute, 'true');
  line.setAttribute(topMoveArrowRankAttribute, String(arrowLine.rank));
  line.setAttribute('data-rank', String(arrowLine.rank));
  line.setAttribute('x1', String(from.x));
  line.setAttribute('y1', String(from.y));
  line.setAttribute('x2', String(to.x));
  line.setAttribute('y2', String(to.y));
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', String(strokeWidth));
  line.setAttribute('stroke-linecap', 'butt');
  line.setAttribute('opacity', String(Math.round(opacity * 100) / 100));
  line.setAttribute('marker-end', `url(#${markerId})`);
  svg.appendChild(line);
}

function topMoveArrowEndpoints(
  fromSquare: string,
  toSquare: string,
  boardRect: DOMRect,
  orientation: Orientation,
  strokeWidth: number
): { from: { x: number; y: number }; to: { x: number; y: number }; markerLength: number } | null {
  const fromCenter = squareCenter(fromSquare, boardRect, orientation);
  const toCenter = squareCenter(toSquare, boardRect, orientation);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }

  const squareSize = Math.min(boardRect.width, boardRect.height) / 8;
  const ux = dx / length;
  const uy = dy / length;
  // Distance from the square centre to the edge the move points toward. For a
  // diagonal this is larger than half a square, so the tail hugs the real edge
  // instead of stopping near the centre.
  const edgeDistance = squareSize * 0.5 / Math.max(Math.abs(ux), Math.abs(uy));
  const startOffset = edgeDistance * arrowStartSquareEdgeRatio;
  const markerLength = Math.round(strokeWidth * arrowHeadLengthRatio);
  const endOffset = markerLength;

  return {
    from: {
      x: Math.round(fromCenter.x + ux * startOffset),
      y: Math.round(fromCenter.y + uy * startOffset)
    },
    to: {
      x: Math.round(toCenter.x - ux * endOffset),
      y: Math.round(toCenter.y - uy * endOffset)
    },
    markerLength
  };
}

function topMoveStrokeWidth(boardWidth: number, arrowLine: DrawableArrowLine): number {
  const topWidth = Math.min(Math.max(Math.round(boardWidth * 0.023), 8), 18);
  if (arrowLine.rank === 1) {
    return topWidth;
  }

  const minimum = Math.max(3, Math.round(topWidth * 0.2));
  const maximum = Math.max(minimum, Math.round(topWidth * 0.9));
  return Math.round(minimum + (maximum - minimum) * arrowLine.quality);
}

function parseUciMove(move: string): { from: string; to: string } | null {
  if (!/^[a-h][1-8][a-h][1-8]/.test(move)) {
    return null;
  }

  return { from: move.slice(0, 2), to: move.slice(2, 4) };
}

function squareCenter(square: string, boardRect: DOMRect, orientation: Orientation): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square.charAt(1)) - 1;
  const squareSize = Math.min(boardRect.width, boardRect.height) / 8;
  const column = orientation === 'black' ? 7 - file : file;
  const row = orientation === 'black' ? rank : 7 - rank;

  return {
    x: Math.round((column + 0.5) * squareSize),
    y: Math.round((row + 0.5) * squareSize)
  };
}

function updateTopMoveRevealButton(root: ParentNode, _orientation: Orientation | undefined, onClick: () => void): void {
  removeTopMoveRevealButton(root);

  const board = boardElement(root);
  if (!board) {
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const button = ownerDocument(root).createElement('button');
  button.type = 'button';
  button.textContent = 'Show moves';
  button.setAttribute(topMoveRevealButtonAttribute, 'true');
  button.addEventListener('click', onClick);
  const savedPosition = savedShowMovesButtonPosition(root);
  button.style.position = 'absolute';
  button.style.left = `${savedPosition?.left ?? defaultSideOverlayLeft(boardRect, root, showMovesButtonApproxWidth)}px`;
  button.style.top = `${savedPosition?.top ?? documentY(boardRect.bottom - 34, root)}px`;
  button.style.border = `1px solid ${palette.greenDark}`;
  button.style.borderRadius = radius.md;
  button.style.background = palette.green;
  button.style.color = palette.textOnGreen;
  button.style.padding = '7px 12px';
  button.style.boxShadow = shadow.raised;
  button.style.cursor = 'pointer';
  button.style.font = '800 12px/1 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  button.style.zIndex = pageOverlayZIndex;
  attachShowMovesButtonDragHandlers(button);
  ownerDocument(root).body.appendChild(button);
}

function attachShowMovesButtonDragHandlers(button: HTMLElement): void {
  attachDragHandlers(button, {
    onMove: (left, top) => {
      saveShowMovesButtonPosition(button, left, top);
    },
    onEnd: (dragged) => {
      if (dragged) {
        button.dataset.chesscomSuppressClick = 'true';
      }
    }
  });

  button.addEventListener('click', (event) => {
    if (button.dataset.chesscomSuppressClick !== 'true') {
      return;
    }

    delete button.dataset.chesscomSuppressClick;
    event.stopImmediatePropagation();
  }, { capture: true });
}

function saveShowMovesButtonPosition(button: HTMLElement, left: number, top: number): void {
  const body = button.ownerDocument.body;
  body.setAttribute(showMovesButtonSavedLeftAttribute, String(left));
  body.setAttribute(showMovesButtonSavedTopAttribute, String(top));
  saveStoredPosition(button.ownerDocument, showMovesButtonStorageKey, { left, top });
}

function savedShowMovesButtonPosition(root: ParentNode): SavedPosition | null {
  return savedBodyPosition(root, showMovesButtonSavedLeftAttribute, showMovesButtonSavedTopAttribute)
    ?? readStoredPosition(root, showMovesButtonStorageKey);
}

function savedBodyPosition(root: ParentNode, leftAttribute: string, topAttribute: string): SavedPosition | null {
  const body = ownerDocument(root).body;
  const left = Number.parseFloat(body.getAttribute(leftAttribute) ?? '');
  const top = Number.parseFloat(body.getAttribute(topAttribute) ?? '');

  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null;
  }

  return { left, top };
}

function readStoredPosition(root: ParentNode, key: string): SavedPosition | null {
  const storage = ownerDocument(root).defaultView?.sessionStorage;
  const persistentStorage = ownerDocument(root).defaultView?.localStorage;
  for (const candidate of [persistentStorage, storage]) {
    if (!candidate) {
      continue;
    }

    try {
      const rawValue = candidate.getItem(key);
      if (!rawValue) {
        continue;
      }

      const parsed = JSON.parse(rawValue) as Partial<SavedPosition>;
      const left = parsed.left;
      const top = parsed.top;
      if (typeof left === 'number' && typeof top === 'number' && Number.isFinite(left) && Number.isFinite(top)) {
        return { left, top };
      }
    } catch {
      // Continue to the session fallback when persistent storage is blocked or malformed.
    }
  }

  return extensionChrome ? durablePositions.get(key) ?? null : null;
}

function saveStoredPosition(document: Document, key: string, position: SavedPosition): void {
  durablePositions.set(key, position);
  try {
    extensionChrome?.storage?.local?.set({ [key]: position });
  } catch {
    // Extension storage may be unavailable in isolated test/document contexts.
  }
  const serialized = JSON.stringify(position);
  for (const storage of [document.defaultView?.localStorage, document.defaultView?.sessionStorage]) {
    try {
      storage?.setItem(key, serialized);
    } catch {
      // Some browser privacy modes can block storage; body attributes still cover in-page updates.
    }
  }
}

function removeTopMoveArrows(root: ParentNode = document): void {
  for (const overlay of root.querySelectorAll(topMoveArrowOverlaySelector)) {
    overlay.remove();
  }
}

function removeTopMoveRevealButton(root: ParentNode = document): void {
  for (const button of root.querySelectorAll(topMoveRevealButtonSelector)) {
    button.remove();
  }
}

function sortedEngineLines(lines: EngineLine[]): EngineLine[] {
  return [...lines].sort((a, b) => a.multipv - b.multipv);
}

function normalizeTopMoves(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultTopMoves;
  }

  return Math.min(Math.max(Math.round(value), minTopMoves), maxTopMoves);
}

function normalizeTopMovesScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultTopMovesScale;
  }

  return Math.min(Math.max(Math.round(value), minTopMovesScale), maxTopMovesScale);
}

function analysisFen(
  result: DetectorResult
): string | null {
  if (result.fen && result.fen.trim().split(/\s+/).length >= 6 && hasBothKings(result.fen)) {
    return result.fen;
  }

  if (result.fenPlacement && hasBothKings(result.fenPlacement)) {
    const moveIndex = result.moveIndex ?? result.moveSequence?.length;
    const sideToMove = moveIndex === undefined || moveIndex % 2 === 0 ? 'w' : 'b';
    const fullmove = moveIndex === undefined ? 1 : Math.floor(moveIndex / 2) + 1;
    return `${result.fenPlacement} ${sideToMove} - - 0 ${fullmove}`;
  }

  return null;
}

function currentPositionFen(result: DetectorResult, root: ParentNode): string | null {
  if (result.mode === 'live') {
    return buildLiveAnalysisFen(result, 'white', root, 'current') ?? analysisFen(result);
  }

  return analysisFen(result);
}

function hasBothKings(fen: string): boolean {
  const placement = fen.trim().split(/\s+/)[0] ?? '';
  return countMatches(placement, 'K') === 1 && countMatches(placement, 'k') === 1;
}

function countMatches(value: string, char: string): number {
  let count = 0;
  for (const current of value) {
    if (current === char) {
      count += 1;
    }
  }
  return count;
}

function scoreFromWhitePerspective(score: EngineScore, fen: string): EngineScore {
  return sideToMoveFromFen(fen) === 'b' ? invertScore(score) : score;
}

function sideToMoveFromFen(fen: string): 'w' | 'b' {
  return fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';
}

function shouldShowLiveOverlays(
  result: DetectorResult,
  sideToMove: 'w' | 'b',
  showOpponentMovesOnly: boolean,
  userColor: Orientation | null
): boolean {
  if (!showOpponentMovesOnly || result.mode !== 'live') {
    return true;
  }

  if (!userColor) {
    return false;
  }

  return sideToMove !== colorToSide(userColor);
}

function buildOpponentMovesDebug(options: {
  result: DetectorResult;
  playerColor: Orientation | null;
  positionSideToMove?: 'w' | 'b';
  analyzedSideToMove?: 'w' | 'b';
  overlaysVisible: boolean;
  forceShowArrows: boolean;
  visibleFen?: string;
  analysisFen?: string;
  showOpponentMovesOnly: boolean;
  showTopMoves: boolean;
  showMovesButton: boolean;
  topMoves: number;
  topMovesScale: number;
}): EvalBarOpponentMovesDebug {
  const opponentColor = options.playerColor === 'white'
    ? 'black'
    : options.playerColor === 'black'
      ? 'white'
      : undefined;
  const debug: EvalBarOpponentMovesDebug = {
    enabled: options.showOpponentMovesOnly,
    liveGame: options.result.mode === 'live',
    overlaysVisible: options.overlaysVisible,
    forceShowArrows: options.forceShowArrows,
    showTopMoves: options.showTopMoves,
    showMovesButton: options.showMovesButton,
    topMoves: options.topMoves,
    topMovesScale: options.topMovesScale,
    reason: opponentMovesDebugReason(options.showOpponentMovesOnly, options.result.mode, options.playerColor, options.positionSideToMove, options.overlaysVisible)
  };

  if (options.playerColor) {
    debug.playerColor = options.playerColor;
  }

  if (opponentColor) {
    debug.opponentColor = opponentColor;
  }

  if (options.positionSideToMove) {
    debug.positionSideToMove = options.positionSideToMove;
  }

  if (options.analyzedSideToMove) {
    debug.analyzedSideToMove = options.analyzedSideToMove;
  }

  if (options.visibleFen) {
    debug.visibleFen = options.visibleFen;
  }

  if (options.analysisFen) {
    debug.analysisFen = options.analysisFen;
  }

  return debug;
}

function opponentMovesDebugReason(
  showOpponentMovesOnly: boolean,
  mode: DetectorResult['mode'],
  playerColor: Orientation | null,
  sideToMove: 'w' | 'b' | undefined,
  overlaysVisible: boolean
): string {
  void overlaysVisible;
  if (!showOpponentMovesOnly) {
    return 'opponent-only disabled';
  }

  if (mode !== 'live') {
    return sideToMove ? 'showing legal moves' : 'missing side to move';
  }

  if (!playerColor) {
    return 'waiting for player color';
  }

  if (!sideToMove) {
    return 'missing side to move';
  }

  return sideToMove === colorToSide(playerColor)
    ? 'user to move, opponent moves hidden'
    : 'opponent to move';
}

function colorToSide(color: Orientation): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b';
}

function shouldForceTopMoveArrows(result: DetectorResult, showOpponentMovesOnly: boolean): boolean {
  void result;
  return showOpponentMovesOnly;
}

function invertScore(score: EngineScore): EngineScore {
  return { ...score, value: -score.value };
}

function scoreLabelPlacement(score: EngineScore, orientation: Orientation): 'top' | 'bottom' {
  const scoreValue = score.value;
  const labelColor: Orientation = scoreValue < 0 ? 'black' : 'white';
  return colorPlacement(labelColor, orientation);
}

function labelTextColor(score: EngineScore, orientation: Orientation): string {
  const scoreValue = score.value;
  const labelColor: Orientation = scoreValue < 0 ? 'black' : 'white';
  return labelColor === 'black' ? palette.evalWhite : palette.inkSecondary;
}

function colorPlacement(color: Orientation, orientation: Orientation): 'top' | 'bottom' {
  if (orientation === 'black') {
    return color === 'black' ? 'bottom' : 'top';
  }

  return color === 'black' ? 'top' : 'bottom';
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

function orientationFromBoard(board: HTMLElement): Orientation {
  return board.classList.contains('flipped') || board.classList.contains('orientation-black')
    ? 'black'
    : 'white';
}

function ownerDocument(root: ParentNode): Document {
  return root instanceof Document ? root : root.ownerDocument ?? document;
}

function ownerWindow(root: ParentNode): Window | null {
  return ownerDocument(root).defaultView;
}
