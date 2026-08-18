import { PageWatcher } from './pageWatcher';
import { removeAttackBalanceOverlay, updateAttackBalanceOverlay } from './attackBalanceOverlay';
import { readShareModalPgn } from './chessComSharePgnAutomation';
import { removeDebugPreview, renderDebugPreview } from './debugPreview';
import {
  createEvalBarController,
  removeEvalBarOverlay,
  type EvalBarController,
  type EvalBarControllerOptions,
  type EvalBarDebugState
} from './evalBar';
import { removeForkOverlay, updateForkOverlay } from './forkOverlay';
import { createLiveMoveAlertController, type LiveMoveAlertController } from './liveMoveAlert';
import { createLivePlayerColorPrompt } from './livePlayerColorPrompt';
import { removePinOverlay, updatePinOverlay } from './pinOverlay';
import { GameCache } from '../detector/gameCache';
import type { ChessComShareGame } from '../detector/chessComShareExtractor';
import { runDetectionCycle } from '../detector/pipeline';
import { DEFAULT_EXTENSION_SETTINGS, normalizeExtensionSettings, type ExtensionSettings } from '../extension/settings';
import { updateLichessImportButton } from './lichessImportButton';
import type { DetectorResult } from '../detector/types';

interface WatcherHandle {
  start: () => void;
  stop: () => void;
}

interface WatcherOptions {
  debounceMs: number;
  fallbackMs: number;
  onChange: () => void;
}

interface ShareAutomationState {
  completedKeys: Set<string>;
  inFlightKeys: Set<string>;
  failures: Map<string, { attempts: number; retryAfter: number }>;
}

const shareRetryBaseMs = 1000;
const maxShareAttempts = 3;

export interface StartDetectorOptions {
  cache?: GameCache;
  settings?: Partial<ExtensionSettings>;
  watcherFactory?: (options: WatcherOptions) => WatcherHandle;
  runDetection?: typeof runDetectionCycle;
  readSharePgn?: typeof readShareModalPgn;
  liveMoveAlertFactory?: (cache: GameCache, promptFactory?: () => ReturnType<typeof createLivePlayerColorPrompt>) => LiveMoveAlertController;
  evalBarFactory?: (options: Pick<EvalBarControllerOptions, 'showTopMoves' | 'showMovesButton' | 'showOpponentMovesOnly' | 'topMoves' | 'topMovesScale'>) => EvalBarController;
}

export function startChessComBoardDetector(options: StartDetectorOptions = {}): WatcherHandle | null {
  const settings = normalizeExtensionSettings(options.settings ?? DEFAULT_EXTENSION_SETTINGS);
  if (!settings.enabled) {
    return null;
  }

  const cache = options.cache ?? new GameCache();
  const livePlayerColorPrompt = createLivePlayerColorPrompt();
  const runDetection = options.runDetection ?? runDetectionCycle;
  const readSharePgn = options.readSharePgn ?? readShareModalPgn;
  const liveMoveAlert = options.liveMoveAlertFactory?.(cache, () => livePlayerColorPrompt) ?? createLiveMoveAlertController({ cache, promptFactory: () => livePlayerColorPrompt });
  const evalBarOptions = {
    cache,
    promptFactory: () => livePlayerColorPrompt,
    showTopMoves: settings.showTopMoves,
    showMovesButton: settings.showMovesButton,
    showOpponentMovesOnly: settings.showOpponentMovesOnly,
    topMoves: settings.evalTopMoves,
    topMovesScale: settings.topMovesScale
  };
  const evalBar = options.evalBarFactory?.(evalBarOptions) ?? createEvalBarController(evalBarOptions);
  const watcherFactory = options.watcherFactory ?? ((watcherOptions) => new PageWatcher(watcherOptions));
  const shareAutomationState: ShareAutomationState = {
    completedKeys: new Set<string>(),
    inFlightKeys: new Set<string>(),
    failures: new Map<string, { attempts: number; retryAfter: number }>()
  };
  let active = true;
  let generation = 1;

  const watcher = watcherFactory({
    debounceMs: settings.debounceMs,
    fallbackMs: settings.fallbackMs,
    onChange: () => {
      if (!active) {
        return;
      }

      const currentGeneration = generation;
      const isCurrent = (): boolean => active && generation === currentGeneration;
      const result = runDetection(cache);
      publishResult(result, settings, liveMoveAlert, evalBar, isCurrent);

      maybeEnrichWithSharePgn(result, readSharePgn, shareAutomationState, settings, liveMoveAlert, evalBar, isCurrent);
    }
  });

  const start = (): void => {
    generation += 1;
    active = true;
    watcher.start();
  };

  watcher.start();
  return {
    start,
    stop: () => {
      active = false;
      generation += 1;
      watcher.stop();
      liveMoveAlert.dispose();
      evalBar.dispose();
    }
  };
}

function publishResult(
  result: DetectorResult,
  settings: ExtensionSettings,
  liveMoveAlert: LiveMoveAlertController,
  evalBar: EvalBarController,
  isActive: () => boolean
): void {
  if (!isActive()) {
    return;
  }

  window.dispatchEvent(new CustomEvent('chesscom-board-detector:result', { detail: result }));
  updateLichessImportButton(result);
  const getEvalBarDebugState = (): EvalBarDebugState => (
    settings.evalBar ? evalBar.getDebugState() : { status: 'disabled' }
  );
  let evalBarUpdate: Promise<void> | null = null;

  if (settings.pinOverlay) {
    runFeatureUpdate('Pin overlay update', () => updatePinOverlay(result));
  } else {
    runFeatureUpdate('Pin overlay cleanup', () => removePinOverlay());
  }

  if (settings.forkOverlay) {
    runFeatureUpdate('Fork overlay update', () => updateForkOverlay(result));
  } else {
    runFeatureUpdate('Fork overlay cleanup', () => removeForkOverlay());
  }

  if (settings.attackBalanceOverlay) {
    runFeatureUpdate('Attack balance update', () => updateAttackBalanceOverlay(result));
  } else {
    runFeatureUpdate('Attack balance cleanup', () => removeAttackBalanceOverlay());
  }

  if (settings.evalBar) {
    evalBarUpdate = runAsyncFeatureUpdate('Eval bar update', () => evalBar.update(result));
  } else {
    runFeatureUpdate('Eval bar cleanup', () => evalBar.dispose());
  }

  if (settings.liveMoveAlert) {
    const liveMoveAlertUpdate = runAsyncFeatureUpdate('Live move alert update', () => liveMoveAlert.update(result));
    if (settings.debug) {
      void liveMoveAlertUpdate.then(() => {
        if (!isActive()) {
          return;
        }

        renderDebugPreview(result, liveMoveAlert.getDebugState(), getEvalBarDebugState());
      });
    }
  } else {
    runFeatureUpdate('Live move alert cleanup', () => liveMoveAlert.dispose());
  }

  if (settings.debug) {
    renderDebugPreview(
      result,
      settings.liveMoveAlert ? liveMoveAlert.getDebugState() : { status: 'disabled' },
      getEvalBarDebugState()
    );
    if (evalBarUpdate) {
      void evalBarUpdate.then(() => {
        if (!isActive()) {
          return;
        }

        renderDebugPreview(
          result,
          settings.liveMoveAlert ? liveMoveAlert.getDebugState() : { status: 'disabled' },
          getEvalBarDebugState()
        );
      });
    }
    console.debug('[Chess.com Board Detector]', result);
  } else {
    runFeatureUpdate('Debug preview cleanup', () => removeDebugPreview());
  }
}

function runFeatureUpdate(label: string, update: () => void): void {
  try {
    update();
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      return;
    }

    console.warn(`[Chess.com Board Detector] ${label} failed`, error);
  }
}

function runAsyncFeatureUpdate(label: string, update: () => Promise<void>): Promise<void> {
  try {
    const promise = update();
    void promise.catch((error: unknown) => {
      if (isExtensionContextInvalidated(error)) {
        return;
      }

      console.warn(`[Chess.com Board Detector] ${label} failed`, error);
    });
    return promise;
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      return Promise.resolve();
    }

    console.warn(`[Chess.com Board Detector] ${label} failed`, error);
    return Promise.resolve();
  }
}

function maybeEnrichWithSharePgn(
  result: DetectorResult,
  readSharePgn: typeof readShareModalPgn,
  state: ShareAutomationState,
  settings: ExtensionSettings,
  liveMoveAlert: LiveMoveAlertController,
  evalBar: EvalBarController,
  isActive: () => boolean
): void {
  if (!shouldReadSharePgn(result)) {
    return;
  }

  const key = shareAutomationKey(result);
  const failure = state.failures.get(key);
  if (state.completedKeys.has(key)
    || state.inFlightKeys.has(key)
    || (failure && (failure.attempts >= maxShareAttempts || Date.now() < failure.retryAfter))) {
    return;
  }

  state.inFlightKeys.add(key);
  void readSharePgn()
    .then((shareGame) => {
      if (!isActive()) {
        return;
      }

      if (!shareGame?.pgn) {
        recordShareFailure(state, key);
        return;
      }

      state.completedKeys.add(key);
      state.failures.delete(key);
      publishResult(mergeShareGame(result, shareGame), settings, liveMoveAlert, evalBar, isActive);
    })
    .catch((error: unknown) => {
      if (isActive()) {
        recordShareFailure(state, key);
      }

      if (isExtensionContextInvalidated(error)) {
        return;
      }

      console.warn('[Chess.com Board Detector] Share PGN enrichment failed', error);
    })
    .finally(() => {
      state.inFlightKeys.delete(key);
    });
}

function recordShareFailure(state: ShareAutomationState, key: string): void {
  const attempts = (state.failures.get(key)?.attempts ?? 0) + 1;
  state.failures.set(key, {
    attempts,
    retryAfter: Date.now() + shareRetryBaseMs * 2 ** (attempts - 1)
  });
}

function shouldReadSharePgn(result: DetectorResult): boolean {
  return result.sharing.allowed
    && (result.source === 'move-list' || result.reconciledFromMoveList || !result.pgn)
    && result.mode !== 'live'
    && result.mode !== 'unknown'
    && result.source !== 'chesscom-share-dialog';
}

function shareAutomationKey(result: DetectorResult): string {
  return [
    result.gameId,
    result.mode,
    result.fen ?? result.fenPlacement ?? '',
    result.moveIndex ?? '',
    result.moveSequence?.join(' ') ?? ''
  ].join('|');
}

function mergeShareGame(result: DetectorResult, shareGame: ChessComShareGame): DetectorResult {
  const merged: DetectorResult = {
    ...result,
    status: 'ok',
    source: 'chesscom-share-dialog',
    reconciledFromMoveList: false,
    evidence: Array.from(new Set([
      ...result.evidence,
      'share-button-present',
      'share-modal-opened',
      ...shareGame.evidence
    ]))
  };

  if (shareGame.fen) {
    merged.fen = shareGame.fen;
    merged.fenPlacement = shareGame.fen.split(/\s+/)[0] ?? shareGame.fen;
    merged.boardConfidence = 1;
  }

  if (shareGame.pgn) {
    merged.pgn = shareGame.pgn;
  }

  if (shareGame.players) {
    merged.players = {
      ...(result.players ?? {}),
      ...shareGame.players
    };
  }

  return merged;
}

function isExtensionContextInvalidated(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /Extension context invalidated/i.test(error.message);
}

if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  let activeWatcher: WatcherHandle | null = null;

  const startWithSettings = (settings: ExtensionSettings): void => {
    activeWatcher?.stop();
    removeDebugPreview();
    removeAttackBalanceOverlay();
    removeEvalBarOverlay();
    removeForkOverlay();
    removePinOverlay();
    activeWatcher = startChessComBoardDetector({ settings });
  };

  chrome.storage?.sync?.get(DEFAULT_EXTENSION_SETTINGS, (storedSettings) => {
    startWithSettings(normalizeExtensionSettings(storedSettings));
  });

  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== 'sync') {
      return;
    }

    const changedSettings = Object.fromEntries(
      Object.entries(changes)
        .filter(([key]) => key in DEFAULT_EXTENSION_SETTINGS)
        .map(([key, change]) => [key, change.newValue])
    );

    if (Object.keys(changedSettings).length === 0) {
      return;
    }

    chrome.storage.sync.get(DEFAULT_EXTENSION_SETTINGS, (storedSettings) => {
      startWithSettings(normalizeExtensionSettings(storedSettings));
    });
  });
}
