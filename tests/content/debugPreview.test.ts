import { afterEach, describe, expect, it } from 'vitest';
import { removeDebugPreview, renderDebugPreview } from '../../src/content/debugPreview';
import type { DetectorResult } from '../../src/detector/types';

const result: DetectorResult = {
  status: 'ok',
  gameId: '169747037990',
  mode: 'replay',
  modeConfidence: 0.9,
  boardConfidence: 1,
  fenPlacement: '8/8/8/8/8/8/8/8',
  source: 'chesscom-share-dialog',
  players: {
    white: { name: 'Hikaru', rating: 2829 },
    black: { name: 'MagnusCarlsen', rating: 2864 }
  },
  reconciledFromMoveList: false,
  sharing: { allowed: true, reason: 'replay-page' },
  evidence: ['chesscom-share-dialog']
};

describe('debug preview', () => {
  afterEach(() => {
    removeDebugPreview();
  });

  it('renders the current detected chess position when debug is enabled', () => {
    renderDebugPreview(result);

    const preview = document.querySelector('#chesscom-board-detector-debug');
    const dialog = document.querySelector('#chesscom-board-detector-debug-window');
    expect(preview?.textContent).toContain('Game: replay');
    expect(preview?.textContent).toContain('replay');
    expect(preview?.textContent).toContain('8/8/8/8/8/8/8/8');
    expect(preview?.textContent).toContain('chesscom-share-dialog');
    expect(preview?.textContent).toContain('Hikaru');
    expect(preview?.textContent).toContain('MagnusCarlsen');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-label')).toBe('Chess.com board detector debug window');
  });

  it('renders live games explicitly when debug is enabled', () => {
    renderDebugPreview({
      ...result,
      mode: 'live',
      modeConfidence: 0.95,
      source: 'manual-live-board-dom',
      sharing: { allowed: false, reason: 'live-game' }
    });

    const preview = document.querySelector('#chesscom-board-detector-debug');
    expect(preview?.textContent).toContain('Game: live');
  });

  it('removes the debug preview when debug is disabled', () => {
    renderDebugPreview(result);
    removeDebugPreview();

    expect(document.querySelector('#chesscom-board-detector-debug')).toBeNull();
    expect(document.querySelector('#chesscom-board-detector-debug-button')).toBeNull();
  });

  it('toggles the debug window from the floating button', () => {
    renderDebugPreview(result);

    const button = document.querySelector<HTMLButtonElement>('#chesscom-board-detector-debug-button');
    const dialog = document.querySelector<HTMLElement>('#chesscom-board-detector-debug-window');

    expect(button).not.toBeNull();
    expect(dialog?.hidden).toBe(false);

    button?.click();
    expect(dialog?.hidden).toBe(true);

    button?.click();
    expect(dialog?.hidden).toBe(false);
  });

  it('isolates the debug overlay from page overflow when controls receive focus', () => {
    renderDebugPreview(result);

    const root = document.querySelector<HTMLElement>('#chesscom-board-detector-debug');
    const button = document.querySelector<HTMLButtonElement>('#chesscom-board-detector-debug-button');
    const dialog = document.querySelector<HTMLElement>('#chesscom-board-detector-debug-window');

    button?.focus();

    expect(root?.style.inset).toBe('0');
    expect(root?.style.overflow).toBe('clip');
    expect(root?.style.pointerEvents).toBe('none');
    expect(button?.style.position).toBe('absolute');
    expect(button?.style.pointerEvents).toBe('auto');
    expect(dialog?.style.position).toBe('absolute');
    expect(dialog?.style.pointerEvents).toBe('auto');
  });

  it('keeps the debug window closed when fresh detector results arrive', () => {
    renderDebugPreview(result);

    const close = document.querySelector<HTMLButtonElement>('[aria-label="Close debug window"]');
    const dialog = document.querySelector<HTMLElement>('#chesscom-board-detector-debug-window');

    close?.click();
    renderDebugPreview({ ...result, modeConfidence: 0.75 });

    expect(dialog?.hidden).toBe(true);
    expect(dialog?.style.display).toBe('none');
  });

  it('switches debug tabs to show the selected section only', () => {
    renderDebugPreview(result);

    const rawTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Raw');

    expect(document.querySelector('[data-debug-panel="overview"]')).not.toBeNull();
    expect(document.querySelector('[data-debug-panel="raw"]')).toBeNull();

    rawTab?.click();

    const selectedRawTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Raw');

    expect(document.querySelector('[data-debug-panel="overview"]')).toBeNull();
    expect(document.querySelector('[data-debug-panel="raw"]')).not.toBeNull();
    expect(selectedRawTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('drags the debug window from the title bar', () => {
    renderDebugPreview(result);

    const titleBar = document.querySelector<HTMLElement>('[data-debug-drag-handle="true"]');
    const dialog = document.querySelector<HTMLElement>('#chesscom-board-detector-debug-window');
    dialog!.getBoundingClientRect = () => ({
      x: 100,
      y: 80,
      left: 100,
      top: 80,
      right: 820,
      bottom: 500,
      width: 720,
      height: 420,
      toJSON: () => ({})
    });

    titleBar?.dispatchEvent(new MouseEvent('mousedown', { clientX: 120, clientY: 100, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 180, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(dialog?.style.left).toBe('200px');
    expect(dialog?.style.top).toBe('160px');
    expect(dialog?.style.right).toBe('auto');
    expect(dialog?.style.bottom).toBe('auto');
  });

  it('keeps the active panel scroll position when fresh detector results arrive', () => {
    renderDebugPreview(result);

    const rawTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Raw');
    rawTab?.click();

    const body = document.querySelector<HTMLElement>('[data-debug-panel="raw"]');
    body!.scrollTop = 180;

    renderDebugPreview({ ...result, modeConfidence: 0.75 });

    const refreshedBody = document.querySelector<HTMLElement>('[data-debug-panel="raw"]');
    expect(refreshedBody?.scrollTop).toBe(180);
  });

  it('renders a board preview and saved move sequence in the Position tab', () => {
    renderDebugPreview({
      ...result,
      fenPlacement: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',
      moveSequence: ['e4', 'e5', 'Nf3'],
      pgn: '[Event "Live Chess"]\n\n1. e4 e5 2. Nf3'
    });

    const positionTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Position');
    positionTab?.click();

    const positionPanel = document.querySelector('[data-debug-panel="position"]');
    expect(positionPanel?.querySelector('[data-debug-board-preview="true"]')).not.toBeNull();
    expect(positionPanel?.textContent).toContain('e4 e5 Nf3');
    expect(positionPanel?.textContent).toContain('1. e4 e5 2. Nf3');
  });

  it('limits mouse selection in debug rows to the value text', () => {
    renderDebugPreview({
      ...result,
      moveSequence: ['e4', 'e5', 'Nf3'],
      pgn: '[Event "Live Chess"]\n\n1. e4 e5 2. Nf3'
    });

    const positionTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Position');
    positionTab?.click();

    const pgnLabel = [...document.querySelectorAll<HTMLElement>('div')]
      .find((element) => element.textContent === 'Saved PGN');
    const pgnValue = pgnLabel?.nextElementSibling as HTMLElement | null;

    expect(pgnLabel?.style.userSelect).toBe('none');
    expect(pgnValue?.style.userSelect).toBe('text');
  });

  it('does not replace selected debug text when fresh detector results arrive', () => {
    renderDebugPreview({
      ...result,
      moveSequence: ['e4', 'e5', 'Nf3'],
      pgn: '[Event "Live Chess"]\n\n1. e4 e5 2. Nf3'
    });

    const positionTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Position');
    positionTab?.click();

    const pgnLabel = [...document.querySelectorAll<HTMLElement>('div')]
      .find((element) => element.textContent === 'Saved PGN');
    const pgnValue = pgnLabel?.nextElementSibling as HTMLElement | null;
    const range = document.createRange();
    range.selectNodeContents(pgnValue!);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    renderDebugPreview({ ...result, modeConfidence: 0.75 });

    expect(pgnValue?.isConnected).toBe(true);
    expect(document.getSelection()?.toString()).toContain('1. e4 e5 2. Nf3');
  });

  it('renders pinned pieces in the Position tab', () => {
    const { fenPlacement, ...boardOnlyResult } = result;
    renderDebugPreview({
      ...boardOnlyResult,
      board: {
        e1: 'wK',
        e2: 'wR',
        e8: 'bR'
      },
      orientation: 'white'
    });

    const positionTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Position');
    positionTab?.click();

    const positionPanel = document.querySelector('[data-debug-panel="position"]');
    expect(positionPanel?.textContent).toContain('Pinned Pieces');
    expect(positionPanel?.textContent).toContain('e2 wR');
    expect(positionPanel?.textContent).toContain('active check pin');
    expect(positionPanel?.textContent).toContain('target e1 wK');
    expect(positionPanel?.textContent).toContain('attacker e8 bR');
  });

  it('does not render potential pins for open lines in the Position tab', () => {
    const { fenPlacement, ...boardOnlyResult } = result;
    renderDebugPreview({
      ...boardOnlyResult,
      board: {
        g1: 'wK',
        f2: 'wP'
      },
      orientation: 'white'
    });

    const positionTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Position');
    positionTab?.click();

    const positionPanel = document.querySelector('[data-debug-panel="position"]');
    expect(positionPanel?.textContent).not.toContain('Potential Pins');
    expect(positionPanel?.textContent).not.toContain('f2 wP');
    expect(positionPanel?.textContent).not.toContain('potential check pin');
  });

  it('summarizes pinned pieces in the Overview tab', () => {
    const { fenPlacement, ...boardOnlyResult } = result;
    renderDebugPreview({
      ...boardOnlyResult,
      board: {
        e1: 'wK',
        e2: 'wR',
        e8: 'bR'
      },
      orientation: 'white'
    });

    const overviewPanel = document.querySelector('[data-debug-panel="overview"]');
    expect(overviewPanel?.textContent).toContain('Pinned Pieces');
    expect(overviewPanel?.textContent).toContain('1: e2 wR -> e1 wK by e8 bR (active check pin)');
  });

  it('summarizes fork highlights in the Overview tab', () => {
    renderDebugPreview({
      ...result,
      fen: '6k1/8/8/1q1r4/8/8/1P2N3/6K1 w - - 0 1'
    });

    const overviewPanel = document.querySelector('[data-debug-panel="overview"]');
    expect(overviewPanel?.textContent).toContain('Fork Highlights');
    expect(overviewPanel?.textContent).toContain('1: wN e2 -> c3 targets b5, d5 (defended)');
  });

  it('summarizes fork highlights from board-only detection', () => {
    const { fen: _fen, ...boardOnlyResult } = result;

    renderDebugPreview({
      ...boardOnlyResult,
      fenPlacement: '1Q2nr1k/p3N3/5p2/2B5/8/1P4P1/P4P1P/5RK1'
    });

    const overviewPanel = document.querySelector('[data-debug-panel="overview"]');
    expect(overviewPanel?.textContent).toContain('Fork Highlights');
    expect(overviewPanel?.textContent).toContain('1: wN e7 -> g6 targets f8, h8 (check)');
  });

  it('summarizes the live move alert in the Overview tab', () => {
    renderDebugPreview(result, { status: 'warning', safeMoveCount: 2 });

    const overviewPanel = document.querySelector('[data-debug-panel="overview"]');
    expect(overviewPanel?.textContent).toContain('Live Move Alert');
    expect(overviewPanel?.textContent).toContain('Only 2 safe moves here');
  });

  it('renders Stockfish analysis state in its own tab', () => {
    renderDebugPreview(result, {
      status: 'warning',
      safeMoveCount: 2,
      targetPlayer: 'Hikaru',
      targetColor: 'white',
      targetScoreCentipawns: 200,
      currentScoreCentipawns: 250
    });

    const stockfishTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Stockfish');
    stockfishTab?.click();

    const stockfishPanel = document.querySelector('[data-debug-panel="stockfish"]');
    expect(stockfishPanel).not.toBeNull();
    expect(stockfishPanel?.textContent).toContain('Stockfish Analysis');
    expect(stockfishPanel?.textContent).toContain('Status');
    expect(stockfishPanel?.textContent).toContain('warning');
    expect(stockfishPanel?.textContent).toContain('Safe moves');
    expect(stockfishPanel?.textContent).toContain('2');
    expect(stockfishPanel?.textContent).toContain('Summary');
    expect(stockfishPanel?.textContent).toContain('Only 2 safe moves here');
    expect(stockfishPanel?.textContent).toContain('Target player');
    expect(stockfishPanel?.textContent).toContain('Hikaru (white)');
    expect(stockfishPanel?.textContent).toContain('Target score');
    expect(stockfishPanel?.textContent).toContain('200 cp');
    expect(stockfishPanel?.textContent).toContain('Current score');
    expect(stockfishPanel?.textContent).toContain('250 cp');
  });

  it('renders eval-bar analysis debug state in the Stockfish tab', () => {
    renderDebugPreview(result, { status: 'inactive' }, {
      status: 'ready',
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      analysisMode: 'continuous',
      score: { type: 'cp', value: 85 },
      formattedScore: '0.9',
      depth: 6,
      bestMove: 'e2e4',
      opponentMoves: {
        enabled: true,
        liveGame: true,
        playerColor: 'white',
        opponentColor: 'black',
        positionSideToMove: 'b',
        analyzedSideToMove: 'b',
        overlaysVisible: true,
        forceShowArrows: true,
        showTopMoves: false,
        showMovesButton: true,
        topMoves: 2,
        topMovesScale: 150,
        visibleFen: '8/8/8/8/8/8/P7/4K2k b - - 0 1',
        analysisFen: '8/8/8/8/8/8/P7/4K2k b - - 0 1',
        reason: 'opponent to move'
      },
      topMoveLines: [
        {
          rank: 1,
          move: 'e7e5',
          score: { type: 'cp', value: 85 },
          formattedScore: '0.9',
          depth: 6
        }
      ]
    });

    const stockfishTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Stockfish');
    stockfishTab?.click();

    const stockfishPanel = document.querySelector('[data-debug-panel="stockfish"]');
    expect(stockfishPanel?.textContent).toContain('Eval Bar Analysis');
    expect(stockfishPanel?.textContent).toContain('Status');
    expect(stockfishPanel?.textContent).toContain('ready');
    expect(stockfishPanel?.textContent).toContain('Engine mode');
    expect(stockfishPanel?.textContent).toContain('continuous');
    expect(stockfishPanel?.textContent).toContain('FEN');
    expect(stockfishPanel?.textContent).toContain('8/8/8/8/8/8/P7/4K2k w - - 0 1');
    expect(stockfishPanel?.textContent).toContain('Current score');
    expect(stockfishPanel?.textContent).toContain('85 cp');
    expect(stockfishPanel?.textContent).toContain('Label');
    expect(stockfishPanel?.textContent).toContain('0.9');
    expect(stockfishPanel?.textContent).toContain('Depth');
    expect(stockfishPanel?.textContent).toContain('6');
    expect(stockfishPanel?.textContent).toContain('Best move');
    expect(stockfishPanel?.textContent).toContain('e2e4');
    expect(stockfishPanel?.textContent).toContain('Opponent Moves Debug');
    expect(stockfishPanel?.textContent).toContain('opponent to move');
    expect(stockfishPanel?.textContent).toContain('Player color');
    expect(stockfishPanel?.textContent).toContain('white');
    expect(stockfishPanel?.textContent).toContain('Position turn');
    expect(stockfishPanel?.textContent).toContain('b');
    expect(stockfishPanel?.textContent).toContain('Popup scale');
    expect(stockfishPanel?.textContent).toContain('150%');
    expect(stockfishPanel?.textContent).toContain('Top Move Lines');
    expect(stockfishPanel?.textContent).toContain('e7e5 | 85 cp | label 0.9 | depth 6');
  });

  it('renders chess piece glyphs in the board preview', () => {
    renderDebugPreview({
      ...result,
      fenPlacement: 'r6k/8/8/8/8/8/8/K6R'
    });

    const positionTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Position');
    positionTab?.click();

    const boardPreview = document.querySelector('[data-debug-board-preview="true"]');
    expect(boardPreview?.textContent).toContain('♜');
    expect(boardPreview?.textContent).toContain('♔');
    expect(boardPreview?.textContent).toContain('♖');
  });

  it('uses fixed equal row tracks for the board preview', () => {
    renderDebugPreview({
      ...result,
      fenPlacement: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
    });

    const positionTab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Position');
    positionTab?.click();

    const boardPreview = document.querySelector<HTMLElement>('[data-debug-board-preview="true"]');
    expect(boardPreview?.style.gridTemplateRows).toBe('repeat(8, minmax(0, 1fr))');
  });

  it('toggles the debug window with Alt+Shift+D', () => {
    renderDebugPreview(result);

    const dialog = document.querySelector<HTMLElement>('#chesscom-board-detector-debug-window');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', altKey: true, shiftKey: true }));

    expect(dialog?.hidden).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', altKey: true, shiftKey: true }));

    expect(dialog?.hidden).toBe(false);
  });
});
