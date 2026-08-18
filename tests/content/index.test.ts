import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameCache } from '../../src/detector/gameCache';
import { startChessComBoardDetector } from '../../src/content/index';
import { removeDebugPreview } from '../../src/content/debugPreview';
import type { EvalBarDebugState } from '../../src/content/evalBar';
import type { LiveMoveAlertDebugState } from '../../src/content/liveMoveAlert';
import type { ChessComShareGame } from '../../src/detector/chessComShareExtractor';
import type { DetectorResult } from '../../src/detector/types';

describe('startChessComBoardDetector', () => {
  afterEach(() => {
    removeDebugPreview();
    document.body.innerHTML = '';
  });

  it('does not start page watching when the extension is disabled', () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: () => watcher,
      settings: { enabled: false, debug: false, pinOverlay: false, debounceMs: 150, fallbackMs: 5000 }
    });

    expect(watcher.start).not.toHaveBeenCalled();
  });

  it('keeps the watcher receiver when restarting through the returned handle', () => {
    const startReceivers: unknown[] = [];
    const watcher = {
      start(this: unknown) {
        startReceivers.push(this);
      },
      stop: vi.fn()
    };

    const handle = startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: () => watcher,
      settings: { enabled: true, debug: false, pinOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 }
    });

    handle?.start();

    expect(startReceivers).toEqual([watcher, watcher]);
  });

  it('logs detection results when debug is enabled', () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: true, pinOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'no-board',
        gameId: 'unknown-game',
        mode: 'unknown',
        modeConfidence: 0,
        reconciledFromMoveList: false,
        sharing: { allowed: false, reason: 'unknown-mode' },
        evidence: []
      })
    });

    expect(consoleDebug).toHaveBeenCalledWith('[Chess.com Board Detector]', expect.objectContaining({
      status: 'no-board'
    }));
    expect(document.querySelector('#chesscom-board-detector-debug')?.textContent).toContain('unknown');
    consoleDebug.mockRestore();
  });

  it('does not leave the debug preview visible when debug is disabled', () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'no-board',
        gameId: 'unknown-game',
        mode: 'unknown',
        modeConfidence: 0,
        reconciledFromMoveList: false,
        sharing: { allowed: false, reason: 'unknown-mode' },
        evidence: []
      })
    });

    expect(document.querySelector('#chesscom-board-detector-debug')).toBeNull();
  });

  it('removes attack balance badges when the setting is disabled', () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };

    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44">
          <span data-chesscom-attack-balance-badge="true"></span>
        </div>
      </wc-chess-board>
    `;

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: 'attack-balance-disabled',
        mode: 'analysis',
        modeConfidence: 1,
        board: {
          d4: 'wN',
          e5: 'bP'
        },
        orientation: 'white',
        reconciledFromMoveList: false,
        sharing: { allowed: true, reason: 'analysis-page' },
        evidence: []
      })
    });

    expect(document.querySelector('[data-chesscom-attack-balance-badge="true"]')).toBeNull();
  });

  it('updates the live move alert controller when enabled and disposes it when disabled', () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const liveMoveAlert = {
      update: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      getDebugState: vi.fn().mockReturnValue({ status: 'analyzing' as const })
    };
    const result: DetectorResult = {
      status: 'ok',
      gameId: '169747037990',
      mode: 'live',
      modeConfidence: 1,
      fenPlacement: '8/8/8/8/8/8/P7/4K2k',
      orientation: 'white',
      reconciledFromMoveList: false,
      sharing: { allowed: false, reason: 'live-game' },
      evidence: []
    };

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: false, liveMoveAlert: true, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => result,
      liveMoveAlertFactory: () => liveMoveAlert
    });

    expect(liveMoveAlert.update).toHaveBeenCalledWith(result);

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: false, liveMoveAlert: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => result,
      liveMoveAlertFactory: () => liveMoveAlert
    });

    expect(liveMoveAlert.dispose).toHaveBeenCalled();
  });

  it('updates the eval bar controller when enabled and disposes it when disabled', () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const evalBar = {
      update: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      getDebugState: vi.fn().mockReturnValue({ status: 'inactive' as const })
    };
    const result: DetectorResult = {
      status: 'ok',
      gameId: '169747037990',
      mode: 'analysis',
      modeConfidence: 1,
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      fenPlacement: '8/8/8/8/8/8/P7/4K2k',
      orientation: 'white',
      reconciledFromMoveList: false,
      sharing: { allowed: true, reason: 'analysis-page' },
      evidence: []
    };

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: true, liveMoveAlert: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => result,
      evalBarFactory: () => evalBar
    });

    expect(evalBar.update).toHaveBeenCalledWith(result);

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: false, liveMoveAlert: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => result,
      evalBarFactory: () => evalBar
    });

    expect(evalBar.dispose).toHaveBeenCalled();
  });

  it('keeps running when eval analysis rejects a transient invalid position', async () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const evalBar = {
      update: vi.fn().mockRejectedValue(new Error('Invalid FEN: missing black king')),
      dispose: vi.fn(),
      getDebugState: vi.fn().mockReturnValue({ status: 'inactive' as const })
    };

    expect(() => startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: true, liveMoveAlert: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169806017450',
        mode: 'analysis',
        modeConfidence: 1,
        fenPlacement: '8/8/8/8/8/8/P7/4K3',
        orientation: 'white',
        reconciledFromMoveList: false,
        sharing: { allowed: true, reason: 'analysis-page' },
        evidence: []
      }),
      evalBarFactory: () => evalBar
    })).not.toThrow();

    await Promise.resolve();

    expect(consoleWarn).toHaveBeenCalledWith(
      '[Chess.com Board Detector] Eval bar update failed',
      expect.any(Error)
    );
    consoleWarn.mockRestore();
  });

  it('does not warn when async updates are canceled by extension context invalidation', async () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const evalBar = {
      update: vi.fn().mockRejectedValue(new Error('Extension context invalidated.')),
      dispose: vi.fn(),
      getDebugState: vi.fn().mockReturnValue({ status: 'inactive' as const })
    };

    expect(() => startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: true, liveMoveAlert: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169806017450',
        mode: 'analysis',
        modeConfidence: 1,
        fenPlacement: '8/8/8/8/8/8/P7/4K3',
        orientation: 'white',
        reconciledFromMoveList: false,
        sharing: { allowed: true, reason: 'analysis-page' },
        evidence: []
      }),
      evalBarFactory: () => evalBar
    })).not.toThrow();

    await Promise.resolve();

    expect(consoleWarn).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('passes top moves settings to the eval bar controller', () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const evalBar = {
      update: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      getDebugState: vi.fn().mockReturnValue({ status: 'inactive' as const })
    };
    let capturedTopMoves: number | undefined;
    let capturedShowTopMoves: boolean | undefined;
    let capturedShowMovesButton: boolean | undefined;
    let capturedShowOpponentMovesOnly: boolean | undefined;
    let capturedTopMovesScale: number | undefined;

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: () => watcher,
      settings: {
        enabled: true,
        debug: false,
        pinOverlay: false,
        forkOverlay: false,
        attackBalanceOverlay: false,
        evalBar: true,
        evalTopMoves: 7,
        showTopMoves: false,
        showMovesButton: false,
        showOpponentMovesOnly: true,
        topMovesScale: 125,
        liveMoveAlert: false,
        debounceMs: 150,
        fallbackMs: 5000
      },
      evalBarFactory: (options) => {
        capturedTopMoves = options.topMoves;
        capturedShowTopMoves = options.showTopMoves;
        capturedShowMovesButton = options.showMovesButton;
        capturedShowOpponentMovesOnly = options.showOpponentMovesOnly;
        capturedTopMovesScale = options.topMovesScale;
        return evalBar;
      }
    });

    expect(capturedTopMoves).toBe(7);
    expect(capturedShowTopMoves).toBe(false);
    expect(capturedShowMovesButton).toBe(false);
    expect(capturedShowOpponentMovesOnly).toBe(true);
    expect(capturedTopMovesScale).toBe(125);
  });

  it('shows the eval bar analysis state in the debug Stockfish tab', () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    let debugState: EvalBarDebugState = { status: 'inactive' };
    const evalBar = {
      update: vi.fn(() => {
        debugState = {
          status: 'ready',
          fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
          analysisMode: 'continuous',
          score: { type: 'cp', value: 85 },
          formattedScore: '0.9',
          depth: 6,
          bestMove: 'e2e4'
        };
        return Promise.resolve();
      }),
      dispose: vi.fn(),
      getDebugState: vi.fn(() => debugState)
    };

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: true, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: true, liveMoveAlert: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169747037990',
        mode: 'analysis',
        modeConfidence: 1,
        fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
        fenPlacement: '8/8/8/8/8/8/P7/4K2k',
        orientation: 'white',
        reconciledFromMoveList: false,
        sharing: { allowed: true, reason: 'analysis-page' },
        evidence: []
      }),
      evalBarFactory: () => evalBar
    });

    const stockfishTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Stockfish');
    stockfishTab?.click();

    const stockfishPanel = document.querySelector('[data-debug-panel="stockfish"]');
    expect(stockfishPanel?.textContent).toContain('Eval Bar Analysis');
    expect(stockfishPanel?.textContent).toContain('ready');
    expect(stockfishPanel?.textContent).toContain('continuous');
    expect(stockfishPanel?.textContent).toContain('85 cp');
    expect(stockfishPanel?.textContent).toContain('e2e4');
  });

  it('shows the live move alert state in the debug overview', () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const liveMoveAlert = {
      update: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      getDebugState: vi.fn().mockReturnValue({ status: 'warning' as const, safeMoveCount: 1 })
    };

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: true, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: false, liveMoveAlert: true, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169747037990',
        mode: 'live',
        modeConfidence: 1,
        fenPlacement: '8/8/8/8/8/8/P7/4K2k',
        orientation: 'white',
        reconciledFromMoveList: false,
        sharing: { allowed: false, reason: 'live-game' },
        evidence: []
      }),
      liveMoveAlertFactory: () => liveMoveAlert
    });

    const overviewPanel = document.querySelector('[data-debug-panel="overview"]');
    expect(overviewPanel?.textContent).toContain('Live Move Alert');
    expect(overviewPanel?.textContent).toContain('Only 1 safe move here');
  });

  it('refreshes the debug window after the live move alert state changes asynchronously', async () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    let debugState: LiveMoveAlertDebugState = { status: 'inactive' };
    const liveMoveAlert = {
      update: vi.fn(async () => {
        await Promise.resolve();
        debugState = { status: 'warning', safeMoveCount: 1 };
      }),
      dispose: vi.fn(),
      getDebugState: vi.fn(() => debugState)
    };

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: true, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: false, liveMoveAlert: true, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169747037990',
        mode: 'live',
        modeConfidence: 1,
        fenPlacement: '8/8/8/8/8/8/P7/4K2k',
        orientation: 'white',
        reconciledFromMoveList: false,
        sharing: { allowed: false, reason: 'live-game' },
        evidence: []
      }),
      liveMoveAlertFactory: () => liveMoveAlert
    });

    expect(document.querySelector('#chesscom-board-detector-debug')?.textContent).toContain('inactive');

    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('#chesscom-board-detector-debug')?.textContent).toContain('Only 1 safe move here');
  });

  it('does not restore debug UI when an async update finishes after the detector stops', async () => {
    let finishUpdate: (() => void) | undefined;
    const updateFinished = new Promise<void>((resolve) => {
      finishUpdate = resolve;
    });
    let debugState: LiveMoveAlertDebugState = { status: 'inactive' };
    const liveMoveAlert = {
      update: vi.fn(async () => {
        await updateFinished;
        debugState = { status: 'warning', safeMoveCount: 1 };
      }),
      dispose: vi.fn(),
      getDebugState: vi.fn(() => debugState)
    };
    const handle = startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return { start: vi.fn(), stop: vi.fn() };
      },
      settings: { enabled: true, debug: true, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, evalBar: false, liveMoveAlert: true, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169747037990',
        mode: 'live',
        modeConfidence: 1,
        fenPlacement: '8/8/8/8/8/8/P7/4K2k',
        orientation: 'white',
        reconciledFromMoveList: false,
        sharing: { allowed: false, reason: 'live-game' },
        evidence: []
      }),
      liveMoveAlertFactory: () => liveMoveAlert
    });

    handle?.stop();
    removeDebugPreview();
    handle?.start();
    finishUpdate?.();
    await updateFinished;
    await Promise.resolve();

    expect(document.querySelector('#chesscom-board-detector-debug')).toBeNull();
  });

  it('enriches a share-eligible result with PGN from the Chess.com share modal automation', async () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const readSharePgn = vi.fn().mockResolvedValue({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '[Event "Live Chess"]\n[White "WhitePlayer"]\n[Black "BlackPlayer"]\n\n1. e4 e5 1-0',
      players: {
        white: { name: 'WhitePlayer' },
        black: { name: 'BlackPlayer' }
      },
      source: 'chesscom-share-dialog',
      evidence: ['chesscom-share-dialog', 'share-dialog-fen', 'share-dialog-pgn']
    });
    const dispatched: unknown[] = [];
    window.addEventListener('chesscom-board-detector:result', (event) => {
      dispatched.push((event as CustomEvent).detail);
    });
    document.body.innerHTML = '<section class="move-list-controls"></section>';

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169747037990',
        mode: 'analysis',
        modeConfidence: 0.75,
        fenPlacement: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
        reconciledFromMoveList: false,
        sharing: { allowed: true, reason: 'share-button' },
        evidence: ['analysis-layout', 'share-button-present']
      }),
      readSharePgn
    });
    await Promise.resolve();

    expect(readSharePgn).toHaveBeenCalledTimes(1);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]).toEqual(expect.objectContaining({
      pgn: expect.stringContaining('[Event "Live Chess"]'),
      source: 'chesscom-share-dialog',
      sharing: { allowed: true, reason: 'share-button' }
    }));
    expect(document.querySelector('#chesscom-lichess-import-button')).not.toBeNull();
  });

  it('replaces move-list fallback PGN with Chess.com share PGN when available', async () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const readSharePgn = vi.fn().mockResolvedValue({
      fen: '1Q4k1/B7/3n1pp1/q7/2B5/1P4P1/P4P1P/5RK1 b - - 2 29',
      pgn: '[Event "Live Chess"]\n[Site "Chess.com"]\n[White "Paulinedvn"]\n[Black "NotAosSpeed"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0',
      players: {
        white: { name: 'Paulinedvn' },
        black: { name: 'NotAosSpeed' }
      },
      source: 'chesscom-share-dialog',
      evidence: ['chesscom-share-dialog', 'share-dialog-fen', 'share-dialog-pgn']
    });
    const dispatched: unknown[] = [];
    window.addEventListener('chesscom-board-detector:result', (event) => {
      dispatched.push((event as CustomEvent).detail);
    });
    document.body.innerHTML = '<section class="move-list-controls"></section>';

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169758633822',
        mode: 'analysis',
        modeConfidence: 0.75,
        fen: '1Q4k1/B7/3n1pp1/q7/2B5/1P4P1/P4P1P/5RK1 b - - 2 29',
        fenPlacement: '1Q4k1/B7/3n1pp1/q7/2B5/1P4P1/P4P1P/5RK1',
        pgn: '1. e4 e5 2. Nf3 Nc6 *',
        source: 'move-list',
        reconciledFromMoveList: true,
        sharing: { allowed: true, reason: 'share-button' },
        evidence: ['analysis-layout', 'move-list-reconciliation', 'share-button-present']
      }),
      readSharePgn
    });
    await Promise.resolve();

    expect(readSharePgn).toHaveBeenCalledTimes(1);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]).toEqual(expect.objectContaining({
      pgn: expect.stringContaining('[White "Paulinedvn"]'),
      source: 'chesscom-share-dialog',
      reconciledFromMoveList: false
    }));
  });

  it('reads share PGN for confident replay pages that already have move-list fallback PGN', async () => {
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const readSharePgn = vi.fn().mockResolvedValue({
      fen: '',
      pgn: '[Event "Live Chess"]\n[Site "Chess.com"]\n[White "Paulinedvn"]\n[Black "NotAosSpeed"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
      source: 'chesscom-share-dialog',
      evidence: ['chesscom-share-dialog', 'share-dialog-pgn']
    });

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169758633822',
        mode: 'replay',
        modeConfidence: 0.95,
        pgn: '[Event "?"]\n[Site "?"]\n[Result "*"]\n\n1. e4 e5 *',
        source: 'move-list',
        reconciledFromMoveList: true,
        sharing: { allowed: true, reason: 'replay-page' },
        evidence: ['replay-controls', 'move-list-reconciliation']
      }),
      readSharePgn
    });
    await Promise.resolve();

    expect(readSharePgn).toHaveBeenCalledTimes(1);
  });

  it('does not repeatedly start share modal automation for an unchanged game', async () => {
    let onChange: (() => void) | undefined;
    const watcher = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const readSharePgn = vi.fn().mockResolvedValue(null);

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        onChange = options.onChange;
        return watcher;
      },
      settings: { enabled: true, debug: false, pinOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169747037990',
        mode: 'analysis',
        modeConfidence: 0.75,
        reconciledFromMoveList: false,
        sharing: { allowed: true, reason: 'share-button' },
        evidence: ['analysis-layout', 'share-button-present']
      }),
      readSharePgn
    });

    onChange?.();
    onChange?.();
    await Promise.resolve();

    expect(readSharePgn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient share modal failure after backoff', async () => {
    let onChange: (() => void) | undefined;
    const now = vi.spyOn(Date, 'now').mockReturnValue(100);
    const readSharePgn = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        fen: '',
        pgn: '[Event "Live Chess"]\n\n1. e4 e5 1-0',
        source: 'chesscom-share-dialog',
        evidence: ['chesscom-share-dialog', 'share-dialog-pgn']
      });

    startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        onChange = options.onChange;
        return { start: vi.fn(), stop: vi.fn() };
      },
      settings: { enabled: true, debug: false, pinOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169747037990',
        mode: 'analysis',
        modeConfidence: 0.75,
        reconciledFromMoveList: false,
        sharing: { allowed: true, reason: 'share-button' },
        evidence: ['analysis-layout', 'share-button-present']
      }),
      readSharePgn
    });

    onChange?.();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    onChange?.();
    expect(readSharePgn).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1100);
    onChange?.();
    await Promise.resolve();

    expect(readSharePgn).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('does not publish share enrichment after the detector stops', async () => {
    let resolveShare: ((value: ChessComShareGame | null) => void) | undefined;
    const shareResult = new Promise<ChessComShareGame | null>((resolve) => {
      resolveShare = resolve;
    });
    const dispatched: unknown[] = [];
    window.addEventListener('chesscom-board-detector:result', (event) => {
      dispatched.push((event as CustomEvent).detail);
    });
    const handle = startChessComBoardDetector({
      cache: new GameCache(),
      watcherFactory: (options) => {
        options.onChange();
        return { start: vi.fn(), stop: vi.fn() };
      },
      settings: { enabled: true, debug: false, pinOverlay: false, evalBar: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: '169747037990',
        mode: 'analysis',
        modeConfidence: 0.75,
        reconciledFromMoveList: false,
        sharing: { allowed: true, reason: 'share-button' },
        evidence: ['analysis-layout', 'share-button-present']
      }),
      readSharePgn: () => shareResult
    });

    handle?.stop();
    handle?.start();
    resolveShare?.({
      fen: '',
      pgn: '[Event "Live Chess"]\n\n1. e4 e5 1-0',
      source: 'chesscom-share-dialog',
      evidence: ['chesscom-share-dialog', 'share-dialog-pgn']
    });
    await shareResult;
    await Promise.resolve();

    expect(dispatched).toHaveLength(1);
  });
});
