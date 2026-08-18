import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEvalBarController,
  evalFillPercent,
  formatEvalScore,
  removeEvalBarOverlay,
  updateEvalBarOverlay
} from '../../src/content/evalBar';
import { GameCache } from '../../src/detector/gameCache';
import type { DetectorResult } from '../../src/detector/types';
import type { EngineLine, EngineScore } from '../../src/engine/stockfishUci';

describe('eval bar overlay', () => {
  beforeEach(() => {
    setViewportSize(1400, 900);
    setWindowScroll(0, 0);
  });

  afterEach(() => {
    removeEvalBarOverlay();
    document.body.removeAttribute('data-chesscom-top-moves-left');
    document.body.removeAttribute('data-chesscom-top-moves-top');
    document.body.removeAttribute('data-chesscom-show-moves-left');
    document.body.removeAttribute('data-chesscom-show-moves-top');
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  it('formats centipawn and mate scores like a compact eval bar label', () => {
    expect(formatEvalScore({ type: 'cp', value: 85 })).toBe('0.9');
    expect(formatEvalScore({ type: 'cp', value: -143 })).toBe('-1.4');
    expect(formatEvalScore({ type: 'mate', value: 3 })).toBe('M3');
    expect(formatEvalScore({ type: 'mate', value: -2 })).toBe('-M2');
  });

  it('clamps the light fill height so extreme evals remain readable', () => {
    expect(evalFillPercent({ type: 'cp', value: 0 })).toBe(50);
    expect(evalFillPercent({ type: 'cp', value: 800 })).toBe(90);
    expect(evalFillPercent({ type: 'cp', value: -800 })).toBe(10);
    expect(evalFillPercent({ type: 'mate', value: 1 })).toBe(95);
    expect(evalFillPercent({ type: 'mate', value: -1 })).toBe(5);
  });

  it('renders a narrow bar to the left of a white-oriented board with the white side at the bottom', () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);

    updateEvalBarOverlay({ type: 'cp', value: 85 });

    const bar = document.querySelector<HTMLElement>('[data-chesscom-eval-bar="true"]');
    const label = document.querySelector<HTMLElement>('[data-chesscom-eval-label="true"]');
    const lightFill = document.querySelector<HTMLElement>('[data-chesscom-eval-light="true"]');
    const darkFill = bar?.children.item(1) as HTMLElement | null;

    expect(bar).not.toBeNull();
    expect(bar?.parentElement).toBe(document.body);
    expect(bar?.style.position).toBe('absolute');
    expect(bar?.style.zIndex).toBe('10');
    expect(bar?.style.left).toBe('213px');
    expect(bar?.style.top).toBe('187px');
    expect(bar?.style.height).toBe('784px');
    expect(label?.textContent).toBe('0.9');
    expect(label?.style.left).toBe('0px');
    expect(label?.style.right).toBe('0px');
    expect(label?.style.top).toBe('');
    expect(label?.style.bottom).toBe('5px');
    expect(label?.style.justifyContent).toBe('center');
    expect(lightFill?.style.height).toBe('58.5%');
    expect(lightFill?.style.top).toBe('');
    expect(lightFill?.style.bottom).toBe('0px');
    expect(darkFill?.style.height).toBe('41.5%');
    expect(darkFill?.style.top).toBe('0px');
    expect(darkFill?.style.bottom).toBe('');
  });

  it('positions the eval bar in document coordinates so page scrolling keeps it attached to the board', () => {
    setWindowScroll(30, 420);
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 48,
      y: 96,
      left: 48,
      top: 96,
      right: 548,
      bottom: 596,
      width: 500,
      height: 500,
      toJSON: () => ({})
    } as DOMRect);

    updateEvalBarOverlay({ type: 'cp', value: 20 });

    const bar = document.querySelector<HTMLElement>('[data-chesscom-eval-bar="true"]');

    expect(bar?.style.position).toBe('absolute');
    expect(bar?.style.left).toBe('43px');
    expect(bar?.style.top).toBe('516px');
    expect(bar?.style.height).toBe('500px');
  });

  it('keeps the white side at the top when the board is flipped to Black', () => {
    document.body.innerHTML = '<wc-chess-board class="flipped"></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);

    updateEvalBarOverlay({ type: 'cp', value: 85 });

    const label = document.querySelector<HTMLElement>('[data-chesscom-eval-label="true"]');
    const lightFill = document.querySelector<HTMLElement>('[data-chesscom-eval-light="true"]');

    expect(label?.textContent).toBe('0.9');
    expect(label?.style.top).toBe('5px');
    expect(label?.style.bottom).toBe('');
    expect(lightFill?.style.height).toBe('58.5%');
    expect(lightFill?.style.top).toBe('0px');
    expect(lightFill?.style.bottom).toBe('');
  });

  it('removes a stale bar when refreshed without a board', () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    updateEvalBarOverlay({ type: 'cp', value: 85 });

    document.body.innerHTML = '';
    updateEvalBarOverlay({ type: 'cp', value: 85 });

    expect(document.querySelector('[data-chesscom-eval-bar="true"]')).toBeNull();
  });

  it('removes the eval bar explicitly', () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    updateEvalBarOverlay({ type: 'mate', value: -2 } satisfies EngineScore);

    removeEvalBarOverlay();

    expect(document.querySelector('[data-chesscom-eval-bar="true"]')).toBeNull();
  });

  it('shows a neutral bar immediately while engine analysis is pending', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    const result: DetectorResult = {
      status: 'ok',
      gameId: 'eval-pending',
      mode: 'analysis',
      modeConfidence: 1,
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      fenPlacement: '8/8/8/8/8/8/P7/4K2k',
      orientation: 'white',
      reconciledFromMoveList: false,
      sharing: { allowed: true, reason: 'analysis-page' },
      evidence: []
    };
    const controller = createEvalBarController({
      engineFactory: () => ({
        analyze: () => new Promise(() => undefined),
        dispose: () => undefined
      })
    });

    void controller.update(result);

    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.0');
    controller.dispose();
  });

  it('places the top moves panel beside the visible board when a narrow viewport has no room on the right', async () => {
    setViewportSize(700, 700);
    setWindowScroll(20, 300);
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 180,
      y: 60,
      left: 180,
      top: 60,
      right: 580,
      bottom: 460,
      width: 400,
      height: 400,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' },
      { depth: 8, multipv: 2, score: { type: 'cp', value: 40 }, move: 'd2d4' }
    ]);

    const panel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');

    expect(panel?.style.position).toBe('absolute');
    expect(panel?.style.left).toBe('64px');
    expect(panel?.style.top).toBe('360px');

    controller.dispose();
  });

  it('does not analyze transient board placements without both kings', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    const analyze = vi.fn(async (): Promise<EngineLine[]> => [
      { depth: 10, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }
    ]);
    const result: DetectorResult = {
      status: 'ok',
      gameId: 'eval-invalid-fen',
      mode: 'analysis',
      modeConfidence: 1,
      fenPlacement: '8/8/8/8/8/8/P7/4K3',
      orientation: 'white',
      reconciledFromMoveList: false,
      sharing: { allowed: true, reason: 'analysis-page' },
      evidence: []
    };
    const controller = createEvalBarController({
      engineFactory: () => ({
        analyze,
        dispose: () => undefined
      })
    });

    await controller.update(result);

    expect(analyze).not.toHaveBeenCalled();
    expect(document.querySelector('[data-chesscom-eval-bar="true"]')).toBeNull();
    expect(controller.getDebugState()).toEqual({ status: 'inactive' });

    controller.dispose();
  });

  it('falls back to bounded engine analysis when continuous analysis is unavailable', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    const result: DetectorResult = {
      status: 'ok',
      gameId: 'eval-depth',
      mode: 'analysis',
      modeConfidence: 1,
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      fenPlacement: '8/8/8/8/8/8/P7/4K2k',
      orientation: 'white',
      reconciledFromMoveList: false,
      sharing: { allowed: true, reason: 'analysis-page' },
      evidence: []
    };
    const controller = createEvalBarController({
      engineFactory: () => ({
        analyze: async () => [{ depth: 10, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }],
        dispose: () => undefined
      })
    });

    await controller.update(result);

    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.9');
    controller.dispose();
  });

  it('updates from continuous Stockfish analysis when available', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    const result: DetectorResult = {
      status: 'ok',
      gameId: 'eval-continuous',
      mode: 'analysis',
      modeConfidence: 1,
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      fenPlacement: '8/8/8/8/8/8/P7/4K2k',
      orientation: 'white',
      reconciledFromMoveList: false,
      sharing: { allowed: true, reason: 'analysis-page' },
      evidence: []
    };
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const stop = vi.fn();
    const boundedAnalyze = vi.fn(async () => []);
    const controller = createEvalBarController({
      engineFactory: () => ({
        analyze: boundedAnalyze,
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop };
        },
        dispose: () => undefined
      })
    });

    await controller.update(result);
    emitEngineUpdate(onUpdate, [{ depth: 6, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]);

    expect(boundedAnalyze).not.toHaveBeenCalled();
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.9');

    controller.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('renders configured top move rows with white-perspective evals', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({
      fenPlacement: '4kb1r/rp2ppp/pqn2n2/2pp4/3P1Bb1/P1P1PN1P/1PQNBBP1/R3K2R',
      moveIndex: 19
    }));
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: -170 }, move: 'g4f3' },
      { depth: 8, multipv: 2, score: { type: 'cp', value: 40 }, move: 'd8c7' },
      { depth: 8, multipv: 3, score: { type: 'cp', value: -10 }, move: 'b6b2' }
    ]);

    const panel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');
    const rows = [...document.querySelectorAll<HTMLElement>('[data-chesscom-top-move-row="true"]')];

    expect(panel).not.toBeNull();
    expect(panel?.style.position).toBe('absolute');
    expect(panel?.style.zIndex).toBe('2147483647');
    expect(panel?.style.left).toBe('1040px');
    expect(panel?.style.minWidth).toBe('96px');
    expect(panel?.style.maxWidth).toBe('128px');
    expect(panel?.textContent).toContain('Black to move');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('1');
    expect(rows[0]?.textContent).toContain('g4f3');
    expect(rows[0]?.textContent).toContain('1.7');
    expect(rows[0]?.style.gridTemplateColumns).toBe('14px auto minmax(38px, 1fr)');
    expect(rows[1]?.textContent).toContain('2');
    expect(rows[1]?.textContent).toContain('d8c7');
    expect(rows[1]?.textContent).toContain('-0.4');
    expect(panel?.textContent).not.toContain('b6b2');

    controller.dispose();
  });

  it('removes the top moves panel when the eval overlay is removed', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }
    ]);

    expect(document.querySelector('[data-chesscom-top-moves-panel="true"]')).not.toBeNull();

    removeEvalBarOverlay();

    expect(document.querySelector('[data-chesscom-eval-bar="true"]')).toBeNull();
    expect(document.querySelector('[data-chesscom-top-moves-panel="true"]')).toBeNull();

    controller.dispose();
  });

  it('removes top-move arrows and the reveal button when the eval overlay is removed', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 1000,
      bottom: 900,
      width: 800,
      height: 800,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      showTopMoves: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 100 }, move: 'e2e4' }
    ]);
    document.querySelector<HTMLButtonElement>('[data-chesscom-top-move-reveal=true]')?.click();

    expect(document.querySelector('[data-chesscom-top-move-arrow=true]')).not.toBeNull();

    removeEvalBarOverlay();

    expect(document.querySelector('[data-chesscom-top-move-arrow=true]')).toBeNull();
    expect(document.querySelector('[data-chesscom-top-move-reveal=true]')).toBeNull();

    controller.dispose();
  });

  it('keeps the existing top moves panel visible while a new position is pending', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/P7/4K2k' }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]);
    const panel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/2P5/4K2k' }));

    expect(document.querySelector('[data-chesscom-top-moves-panel="true"]')).toBe(panel);
    expect(panel?.textContent).toContain('e2e4');

    controller.dispose();
  });

  it('repositions eval overlays when the board size changes without a new position', async () => {
    setViewportSize(1200, 900);
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    let boardRect = {
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect;
    board!.getBoundingClientRect = () => boardRect;
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]);
    expect(document.querySelector<HTMLElement>('[data-chesscom-eval-bar="true"]')?.style.left).toBe('213px');
    expect(document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]')?.style.left).toBe('1040px');

    setViewportSize(500, 700);
    boardRect = {
      x: 87,
      y: 107,
      left: 87,
      top: 107,
      right: 487,
      bottom: 507,
      width: 400,
      height: 400,
      toJSON: () => ({})
    } as DOMRect;

    await controller.update(evalResult());

    expect(document.querySelector<HTMLElement>('[data-chesscom-eval-bar="true"]')?.style.left).toBe('52px');
    expect(document.querySelector<HTMLElement>('[data-chesscom-eval-bar="true"]')?.style.top).toBe('107px');
    expect(document.querySelector<HTMLElement>('[data-chesscom-eval-bar="true"]')?.style.height).toBe('400px');
    expect(document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]')?.style.left).toBe('8px');
    expect(document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]')?.style.top).toBe('107px');

    controller.dispose();
  });

  it('updates top moves in place and preserves a dragged panel position', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]);
    const panel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');
    panel?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 1050, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 1090, clientY: 230 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(panel?.style.left).toBe('1080px');
    expect(panel?.style.top).toBe('217px');

    emitEngineUpdate(onUpdate, [{ depth: 9, multipv: 1, score: { type: 'cp', value: -40 }, move: 'c2c4' }]);

    expect(document.querySelector('[data-chesscom-top-moves-panel="true"]')).toBe(panel);
    expect(panel?.style.left).toBe('1080px');
    expect(panel?.style.top).toBe('217px');
    expect(panel?.textContent).toContain('c2c4');
    expect(panel?.textContent).not.toContain('e2e4');

    controller.dispose();
  });

  it('drags the top moves panel with pointer input', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]);
    const panel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');
    panel?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 1050, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 1090, clientY: 230 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));

    expect(panel?.style.left).toBe('1080px');
    expect(panel?.style.top).toBe('217px');

    controller.dispose();
  });

  it('keeps a dragged top moves panel position when the selected position changes', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/P7/4K2k' }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]);
    const panel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');
    panel?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 1050, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 1090, clientY: 230 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(panel?.style.left).toBe('1080px');
    expect(panel?.style.top).toBe('217px');

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/2P5/4K2k' }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: -40 }, move: 'c2c4' }]);

    expect(document.querySelector('[data-chesscom-top-moves-panel="true"]')).toBe(panel);
    expect(panel?.style.left).toBe('1080px');
    expect(panel?.style.top).toBe('217px');
    expect(panel?.textContent).toContain('c2c4');

    controller.dispose();
  });

  it('hides alternative move names while keeping their evals visible', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 3,
      showTopMoves: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' },
      { depth: 8, multipv: 2, score: { type: 'cp', value: 40 }, move: 'd2d4' }
    ]);

    const panel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');
    const rows = [...document.querySelectorAll<HTMLElement>('[data-chesscom-top-move-row="true"]')];

    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.9');
    expect(panel).not.toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('1');
    expect(rows[0]?.textContent).toContain('0.9');
    expect(rows[1]?.textContent).toContain('2');
    expect(rows[1]?.textContent).toContain('0.4');
    expect(panel?.textContent).not.toContain('e2e4');
    expect(panel?.textContent).not.toContain('d2d4');

    controller.dispose();
  });

  it('draws scaled top-move arrows automatically when move names are shown', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 1000,
      bottom: 900,
      width: 800,
      height: 800,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 3,
      showTopMoves: true,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({ fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1' }));
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 100 }, move: 'e2e4' },
      { depth: 8, multipv: 2, score: { type: 'cp', value: 20 }, move: 'g1f3' },
      { depth: 8, multipv: 3, score: { type: 'cp', value: -150 }, move: 'b1c3' }
    ]);

    const arrows = [...document.querySelectorAll<SVGLineElement>('[data-chesscom-top-move-arrow=true]')];

    expect(arrows).toHaveLength(2);
    expect(arrows[0]?.dataset.rank).toBe('1');
    expect(arrows[0]?.getAttribute('stroke')).toBe('#81b64c');
    expect(arrows[0]?.getAttribute('stroke-width')).toBe('18');
    expect(arrows[0]?.getAttribute('x1')).toBe('450');
    expect(arrows[0]?.getAttribute('y1')).toBe('620');
    expect(arrows[0]?.getAttribute('x2')).toBe('450');
    expect(arrows[0]?.getAttribute('y2')).toBe('482');
    expect(arrows[0]?.getAttribute('stroke-linecap')).toBe('butt');
    expect(document.querySelector('marker#chesscom-top-move-arrow-1')?.getAttribute('markerUnits')).toBe('userSpaceOnUse');
    expect(document.querySelector('marker#chesscom-top-move-arrow-1')?.getAttribute('refX')).toBe('0');
    expect(Number(arrows[1]?.getAttribute('stroke-width'))).toBeLessThan(18);
    expect(arrows[1]?.getAttribute('x1')).toBe('635');
    expect(arrows[1]?.getAttribute('y1')).toBe('720');
    expect(arrows.some((arrow) => arrow.getAttribute('data-chesscom-top-move-arrow-rank') === '3')).toBe(false);

    controller.dispose();
  });

  it('reveals top-move arrows for only the current position when move names are hidden', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 1000,
      bottom: 900,
      width: 800,
      height: 800,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      showTopMoves: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/P7/4K2k' }));
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 100 }, move: 'e2e4' },
      { depth: 8, multipv: 2, score: { type: 'cp', value: 20 }, move: 'g1f3' }
    ]);

    const button = document.querySelector<HTMLButtonElement>('[data-chesscom-top-move-reveal=true]');
    expect(button?.textContent).toBe('Show moves');
    expect(button?.style.zIndex).toBe('2147483647');
    expect(document.querySelector('[data-chesscom-top-move-arrow=true]')).toBeNull();

    button?.click();

    expect(document.querySelectorAll('[data-chesscom-top-move-arrow=true]')).toHaveLength(2);
    expect(document.querySelector('[data-chesscom-top-move-reveal=true]')).toBeNull();

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/2P5/4K2k' }));
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 40 }, move: 'c2c4' },
      { depth: 8, multipv: 2, score: { type: 'cp', value: 0 }, move: 'g1f3' }
    ]);

    expect(document.querySelector('[data-chesscom-top-move-arrow=true]')).toBeNull();
    expect(document.querySelector('[data-chesscom-top-move-reveal=true]')).not.toBeNull();

    controller.dispose();
  });

  it('places the show moves button beside the visible board when a narrow viewport has no room on the right', async () => {
    setViewportSize(640, 700);
    setWindowScroll(8, 260);
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 160,
      y: 60,
      left: 160,
      top: 60,
      right: 560,
      bottom: 460,
      width: 400,
      height: 400,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      showTopMoves: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 100 }, move: 'e2e4' }
    ]);

    const button = document.querySelector<HTMLButtonElement>('[data-chesscom-top-move-reveal=true]');

    expect(button?.style.position).toBe('absolute');
    expect(button?.style.left).toBe('56px');
    expect(button?.style.top).toBe('686px');

    controller.dispose();
  });

  it('places hidden-move overlays in the usable gap beside the board on wide Chess.com layouts', async () => {
    setViewportSize(1920, 900);
    document.body.innerHTML = '<nav id="sidebar-main-menu"></nav><wc-chess-board></wc-chess-board><aside id="board-layout-sidebar"></aside>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      showTopMoves: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 100 }, move: 'e2e4' },
      { depth: 8, multipv: 2, score: { type: 'cp', value: 20 }, move: 'g1f3' }
    ]);

    const button = document.querySelector<HTMLButtonElement>('[data-chesscom-top-move-reveal=true]');

    expect(button?.style.left).toBe('136px');
    expect(button?.style.top).toBe('937px');
    expect(button?.style.zIndex).toBe('2147483647');

    button?.click();

    const panel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');
    expect(panel?.style.left).toBe('112px');
    expect(panel?.style.top).toBe('187px');
    expect(panel?.style.zIndex).toBe('2147483647');

    controller.dispose();
  });

  it('does not render the show moves button when manual reveal is disabled', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 1000,
      bottom: 900,
      width: 800,
      height: 800,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      showTopMoves: false,
      showMovesButton: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 100 }, move: 'e2e4' }
    ]);

    expect(document.querySelector('[data-chesscom-top-move-reveal=true]')).toBeNull();
    expect(document.querySelector('[data-chesscom-top-move-arrow=true]')).toBeNull();

    controller.dispose();
  });

  it('preserves a dragged show moves button position across hidden-move updates', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 1000,
      bottom: 900,
      width: 800,
      height: 800,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      showTopMoves: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/P7/4K2k' }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 100 }, move: 'e2e4' }]);
    const firstButton = document.querySelector<HTMLButtonElement>('[data-chesscom-top-move-reveal=true]');
    firstButton?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 1010, clientY: 870 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 950, clientY: 820 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(firstButton?.style.left).toBe('948px');
    expect(firstButton?.style.top).toBe('816px');

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/2P5/4K2k' }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 40 }, move: 'c2c4' }]);

    const secondButton = document.querySelector<HTMLButtonElement>('[data-chesscom-top-move-reveal=true]');
    expect(secondButton).not.toBe(firstButton);
    expect(secondButton?.style.left).toBe('948px');
    expect(secondButton?.style.top).toBe('816px');

    controller.dispose();
  });

  it('drags the show moves button with pointer input without revealing moves', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 1000,
      bottom: 900,
      width: 800,
      height: 800,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      showTopMoves: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/P7/4K2k' }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 100 }, move: 'e2e4' }]);
    const button = document.querySelector<HTMLButtonElement>('[data-chesscom-top-move-reveal=true]');
    button?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 1010, clientY: 870 }));
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 950, clientY: 820 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    button?.click();

    expect(button?.style.left).toBe('948px');
    expect(button?.style.top).toBe('816px');
    expect(document.querySelector('[data-chesscom-top-move-arrow=true]')).toBeNull();
    expect(document.querySelector('[data-chesscom-top-move-reveal=true]')).toBe(button);

    controller.dispose();
  });

  it('restores a dragged show moves button position after the page body is replaced', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 1000,
      bottom: 900,
      width: 800,
      height: 800,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const firstController = createEvalBarController({
      topMoves: 2,
      showTopMoves: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await firstController.update(evalResult({ fenPlacement: '8/8/8/8/8/8/P7/4K2k' }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 100 }, move: 'e2e4' }]);
    const firstButton = document.querySelector<HTMLButtonElement>('[data-chesscom-top-move-reveal=true]');
    firstButton?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 1010, clientY: 870 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 950, clientY: 820 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(firstButton?.style.left).toBe('948px');
    expect(firstButton?.style.top).toBe('816px');

    firstController.dispose();
    const replacementBody = document.createElement('body');
    replacementBody.innerHTML = '<wc-chess-board></wc-chess-board>';
    document.body.replaceWith(replacementBody);
    const replacementBoard = document.querySelector<HTMLElement>('wc-chess-board');
    replacementBoard!.getBoundingClientRect = board!.getBoundingClientRect;
    onUpdate = null;
    const secondController = createEvalBarController({
      topMoves: 2,
      showTopMoves: false,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await secondController.update(evalResult({ gameId: 'new-daily-game', fenPlacement: '8/8/8/8/8/8/2P5/4K2k' }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 40 }, move: 'c2c4' }]);

    const secondButton = document.querySelector<HTMLButtonElement>('[data-chesscom-top-move-reveal=true]');
    expect(secondButton?.style.left).toBe('948px');
    expect(secondButton?.style.top).toBe('816px');

    secondController.dispose();
  });

  it('scales the alternative move popup from the configured percentage', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      topMoves: 2,
      topMovesScale: 150,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult());
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }
    ]);

    const panel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');

    expect(panel?.style.minWidth).toBe('144px');
    expect(panel?.style.maxWidth).toBe('192px');
    expect(panel?.style.padding).toBe('11px 12px');
    expect(panel?.style.font).toContain('15px');

    controller.dispose();
  });

  it('keeps a dragged alternative move popup position when the popup size setting changes', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const firstController = createEvalBarController({
      topMoves: 2,
      topMovesScale: 100,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await firstController.update(evalResult());
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]);
    const firstPanel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');
    firstPanel?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 1050, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 1090, clientY: 230 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(firstPanel?.style.left).toBe('1080px');
    expect(firstPanel?.style.top).toBe('217px');

    firstController.dispose();

    const secondController = createEvalBarController({
      topMoves: 2,
      topMovesScale: 150,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await secondController.update(evalResult());
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: -40 }, move: 'c2c4' }]);

    const secondPanel = document.querySelector<HTMLElement>('[data-chesscom-top-moves-panel="true"]');
    expect(secondPanel).not.toBe(firstPanel);
    expect(secondPanel?.style.left).toBe('1080px');
    expect(secondPanel?.style.top).toBe('217px');
    expect(secondPanel?.style.minWidth).toBe('144px');
    expect(secondPanel?.textContent).toContain('c2c4');

    secondController.dispose();
  });

  it('analyzes the selected replay ply with the correct side to move and white-perspective score', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let capturedFen = '';
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (fen, update) => {
          capturedFen = fen;
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({
      fenPlacement: '4kb1r/rp2ppp/pqn2n2/2pp4/3P1Bb1/P1P1PN1P/1PQNBBP1/R3K2R',
      moveIndex: 19
    }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: -170 }, move: 'g4f3' }]);

    expect(capturedFen).toBe('4kb1r/rp2ppp/pqn2n2/2pp4/3P1Bb1/P1P1PN1P/1PQNBBP1/R3K2R b - - 0 10');
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('1.7');
    expect(controller.getDebugState()).toMatchObject({
      status: 'ready',
      formattedScore: '1.7',
      score: { type: 'cp', value: 170 }
    });

    controller.dispose();
  });

  it('shows a neutral score while a new continuous analysis is pending', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/P7/4K2k' }));
    emitEngineUpdate(onUpdate, [{ depth: 6, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]);

    await controller.update(evalResult({ fenPlacement: '8/8/8/8/8/8/2P5/4K2k' }));

    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.0');

    emitEngineUpdate(onUpdate, [{ depth: 6, multipv: 1, score: { type: 'cp', value: -40 }, move: 'c2c4' }]);
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('-0.4');

    controller.dispose();
  });

  it('exposes debug state for continuous Stockfish eval-bar analysis', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    const result: DetectorResult = {
      status: 'ok',
      gameId: 'eval-debug',
      mode: 'analysis',
      modeConfidence: 1,
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      fenPlacement: '8/8/8/8/8/8/P7/4K2k',
      orientation: 'white',
      reconciledFromMoveList: false,
      sharing: { allowed: true, reason: 'analysis-page' },
      evidence: []
    };
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(result);
    expect(controller.getDebugState()).toMatchObject({
      status: 'analyzing',
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      analysisMode: 'continuous'
    });

    emitEngineUpdate(onUpdate, [{ depth: 6, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]);

    expect(controller.getDebugState()).toEqual({
      status: 'ready',
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      analysisMode: 'continuous',
      score: { type: 'cp', value: 85 },
      formattedScore: '0.9',
      depth: 6,
      bestMove: 'e2e4'
    });
  });

  it('updates the eval bar at progressively deeper bounded searches', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    const result: DetectorResult = {
      status: 'ok',
      gameId: 'eval-progressive',
      mode: 'analysis',
      modeConfidence: 1,
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      fenPlacement: '8/8/8/8/8/8/P7/4K2k',
      orientation: 'white',
      reconciledFromMoveList: false,
      sharing: { allowed: true, reason: 'analysis-page' },
      evidence: []
    };
    const calls: Array<number | undefined> = [];
    const responses = [
      deferred([{ depth: 4, multipv: 1, score: { type: 'cp', value: 30 }, move: 'e2e4' }]),
      deferred([{ depth: 8, multipv: 1, score: { type: 'cp', value: 85 }, move: 'e2e4' }]),
      deferred([{ depth: 12, multipv: 1, score: { type: 'cp', value: 110 }, move: 'e2e4' }])
    ];
    const controller = createEvalBarController({
      engineFactory: () => ({
        analyze: (_fen, depth) => {
          calls.push(depth);
          return responses[calls.length - 1]!.promise;
        },
        dispose: () => undefined
      })
    });

    void controller.update(result);
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.0');

    responses[0]!.resolve();
    await Promise.resolve();
    expect(calls).toEqual([4, 8]);
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.3');

    responses[1]!.resolve();
    await Promise.resolve();
    expect(calls).toEqual([4, 8, 12]);
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.9');

    responses[2]!.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('1.1');
    controller.dispose();
  });

  it('analyzes the current live side for the eval bar from Chess.com active clock classes', async () => {
    document.body.innerHTML = `
      <wc-chess-board class="flipped"></wc-chess-board>
      <div class="board-layout-player board-layout-top player-component player-top">
        <div class="clock-component clock-top clock-white clock-player-turn">
          <span class="clock-time-monospace" data-cy="clock-time" role="timer">10:00</span>
        </div>
      </div>
      <div class="board-layout-player board-layout-bottom player-component player-bottom">
        <div class="clock-component clock-bottom clock-black">
          <span class="clock-time-monospace" data-cy="clock-time" role="timer">10:00</span>
        </div>
      </div>
    `;
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let capturedFen = '';
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (fen, update) => {
          capturedFen = fen;
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(liveEvalResult({ orientation: 'black' }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 75 }, move: 'e2e4' }]);

    expect(capturedFen).toBe('8/8/8/8/8/8/P7/4K2k w - - 0 1');
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.8');
    expect(controller.getDebugState()).toMatchObject({
      status: 'ready',
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      formattedScore: '0.8'
    });

    controller.dispose();
  });

  it('shows top moves in live opponent-only mode when it is the opponent turn', async () => {
    document.body.innerHTML = `
      <wc-chess-board></wc-chess-board>
      <div class="board-player-component board-player-bottom">
        <a class="user-username">NotAosSpeed</a>
      </div>
      <div class="board-player-component board-player-top active">
        <a class="user-username">Opponent</a>
      </div>
    `;
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      cache: new GameCache(),
      showOpponentMovesOnly: true,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(liveEvalResult({
      players: {
        white: { name: 'NotAosSpeed' },
        black: { name: 'Opponent' }
      }
    }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: -90 }, move: 'e7e5' }]);

    expect(document.querySelector('[data-chesscom-top-moves-panel="true"]')).not.toBeNull();
    expect(controller.getDebugState()).toMatchObject({
      status: 'ready',
      fen: '8/8/8/8/8/8/P7/4K2k b - - 0 1',
      opponentMoves: {
        enabled: true,
        liveGame: true,
        playerColor: 'white',
        opponentColor: 'black',
        positionSideToMove: 'b',
        analyzedSideToMove: 'b',
        overlaysVisible: true,
        forceShowArrows: true,
        showTopMoves: true,
        showMovesButton: true,
        topMoves: 3,
        topMovesScale: 100,
        reason: 'opponent to move'
      },
      topMoveLines: [
        {
          rank: 1,
          move: 'e7e5',
          score: { type: 'cp', value: 90 },
          formattedScore: '0.9',
          depth: 8
        }
      ]
    });

    controller.dispose();
  });

  it('draws arrows automatically in live opponent-only mode when move names are hidden and it is the opponent turn', async () => {
    document.body.innerHTML = `
      <wc-chess-board></wc-chess-board>
      <div class="board-player-component board-player-bottom">
        <a class="user-username">NotAosSpeed</a>
      </div>
      <div class="board-player-component board-player-top active">
        <a class="user-username">Opponent</a>
      </div>
    `;
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    const controller = createEvalBarController({
      cache: new GameCache(),
      showTopMoves: false,
      showOpponentMovesOnly: true,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (_fen, update) => {
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(liveEvalResult({
      players: {
        white: { name: 'NotAosSpeed' },
        black: { name: 'Opponent' }
      }
    }));
    emitEngineUpdate(onUpdate, [
      { depth: 8, multipv: 1, score: { type: 'cp', value: -90 }, move: 'e7e5' },
      { depth: 8, multipv: 2, score: { type: 'cp', value: -30 }, move: 'd7d5' }
    ]);

    expect(document.querySelectorAll('[data-chesscom-top-move-arrow=true]')).toHaveLength(2);
    expect(document.querySelector('[data-chesscom-top-move-reveal=true]')).toBeNull();

    controller.dispose();
  });

  it('hides live opponent-only candidate moves on your turn instead of flipping the position', async () => {
    document.body.innerHTML = `
      <wc-chess-board></wc-chess-board>
      <div class="board-player-component board-player-bottom active">
        <a class="user-username">NotAosSpeed</a>
      </div>
      <div class="board-player-component board-player-top">
        <a class="user-username">Opponent</a>
      </div>
    `;
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    let capturedFen = '';
    const controller = createEvalBarController({
      cache: new GameCache(),
      showOpponentMovesOnly: true,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (fen, update) => {
          capturedFen = fen;
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(liveEvalResult({
      players: {
        white: { name: 'NotAosSpeed' },
        black: { name: 'Opponent' }
      }
    }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 90 }, move: 'e2e4' }]);
    await controller.update(liveEvalResult({
      players: {
        white: { name: 'NotAosSpeed' },
        black: { name: 'Opponent' }
      }
    }));

    expect(capturedFen).toBe('8/8/8/8/8/8/P7/4K2k w - - 0 1');
    expect(document.querySelector('[data-chesscom-eval-bar="true"]')).not.toBeNull();
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('0.9');
    expect(document.querySelector('[data-chesscom-top-moves-panel="true"]')).toBeNull();
    expect(document.querySelectorAll('[data-chesscom-top-move-arrow=true]')).toHaveLength(0);
    expect(controller.getDebugState()).toMatchObject({
      status: 'ready',
      fen: '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      score: { type: 'cp', value: 90 },
      formattedScore: '0.9',
      opponentMoves: {
        enabled: true,
        liveGame: true,
        playerColor: 'white',
        opponentColor: 'black',
        positionSideToMove: 'w',
        analyzedSideToMove: 'w',
        overlaysVisible: false,
        forceShowArrows: true,
        reason: 'user to move, opponent moves hidden'
      },
      topMoveLines: [
        expect.objectContaining({
          rank: 1,
          move: 'e2e4',
          formattedScore: '0.9',
          depth: 8
        })
      ]
    });

    controller.dispose();
  });

  it('supports opponent-only mode on replay positions for testing', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    let onUpdate: ((lines: EngineLine[]) => void) | null = null;
    let capturedFen = '';
    const controller = createEvalBarController({
      showOpponentMovesOnly: true,
      engineFactory: () => ({
        analyze: async () => [],
        analyzeContinuously: (fen, update) => {
          capturedFen = fen;
          onUpdate = update;
          return { stop: vi.fn() };
        },
        dispose: () => undefined
      })
    });

    await controller.update(evalResult({
      mode: 'replay',
      moveIndex: 3,
      fenPlacement: '8/8/8/8/8/8/P7/4K2k'
    }));
    emitEngineUpdate(onUpdate, [{ depth: 8, multipv: 1, score: { type: 'cp', value: 90 }, move: 'h1h2' }]);

    expect(capturedFen).toBe('8/8/8/8/8/8/P7/4K2k b - - 0 2');
    expect(document.querySelector('[data-chesscom-eval-label="true"]')?.textContent).toBe('-0.9');
    expect(document.querySelector('[data-chesscom-top-moves-panel="true"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-chesscom-top-move-arrow=true]')).toHaveLength(1);
    expect(controller.getDebugState()).toMatchObject({
      status: 'ready',
      fen: '8/8/8/8/8/8/P7/4K2k b - - 0 2',
      score: { type: 'cp', value: -90 },
      formattedScore: '-0.9',
      opponentMoves: {
        enabled: true,
        liveGame: false,
        positionSideToMove: 'b',
        analyzedSideToMove: 'b',
        overlaysVisible: true,
        forceShowArrows: true,
        reason: 'showing legal moves'
      },
      topMoveLines: [
        expect.objectContaining({
          rank: 1,
          move: 'h1h2',
          formattedScore: '-0.9',
          depth: 8
        })
      ]
    });

    controller.dispose();
  });

  it('prompts for side selection in live opponent-only mode when player names are unknown', async () => {
    document.body.innerHTML = `
      <wc-chess-board></wc-chess-board>
      <div class="board-player-component board-player-bottom active">
        <a class="user-username">MysteryOne</a>
      </div>
      <div class="board-player-component board-player-top">
        <a class="user-username">MysteryTwo</a>
      </div>
    `;
    const board = document.querySelector<HTMLElement>('wc-chess-board');
    board!.getBoundingClientRect = () => ({
      x: 248,
      y: 187,
      left: 248,
      top: 187,
      right: 1032,
      bottom: 971,
      width: 784,
      height: 784,
      toJSON: () => ({})
    } as DOMRect);
    const controller = createEvalBarController({
      cache: new GameCache(),
      showOpponentMovesOnly: true,
      engineFactory: () => ({
        analyze: async () => [],
        dispose: () => undefined
      })
    });

    await controller.update(liveEvalResult({
      players: {
        white: { name: 'MysteryOne' },
        black: { name: 'MysteryTwo' }
      }
    }));

    expect(document.querySelector('[data-chesscom-live-color-prompt]')?.textContent).toContain('You are');
    expect(controller.getDebugState()).toEqual({
      status: 'waiting-for-player-color',
      opponentMoves: {
        enabled: true,
        liveGame: true,
        overlaysVisible: false,
        forceShowArrows: true,
        showTopMoves: true,
        showMovesButton: true,
        topMoves: 3,
        topMovesScale: 100,
        reason: 'waiting for player color'
      }
    });

    controller.dispose();
  });
});

function deferred(lines: EngineLine[]): { promise: Promise<EngineLine[]>; resolve: () => void } {
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<EngineLine[]>((resolve) => {
    resolvePromise = () => resolve(lines);
  });
  return { promise, resolve: resolvePromise };
}

function evalResult(overrides: Partial<DetectorResult> = {}): DetectorResult {
  const result: DetectorResult = {
    status: 'ok',
    gameId: 'eval-result',
    mode: 'analysis',
    modeConfidence: 1,
    fenPlacement: '8/8/8/8/8/8/P7/4K2k',
    orientation: 'white',
    reconciledFromMoveList: false,
    sharing: { allowed: true, reason: 'analysis-page' },
    evidence: [],
    ...overrides
  };

  if (!Object.prototype.hasOwnProperty.call(overrides, 'fen') && !Object.prototype.hasOwnProperty.call(overrides, 'fenPlacement')) {
    result.fen = '8/8/8/8/8/8/P7/4K2k w - - 0 1';
  }

  return result;
}

function liveEvalResult(overrides: Partial<DetectorResult> = {}): DetectorResult {
  return {
    status: 'ok',
    gameId: 'live-eval-result',
    mode: 'live',
    modeConfidence: 1,
    fenPlacement: '8/8/8/8/8/8/P7/4K2k',
    orientation: 'white',
    reconciledFromMoveList: false,
    sharing: { allowed: false, reason: 'live-game' },
    evidence: [],
    ...overrides
  };
}

function emitEngineUpdate(onUpdate: ((lines: EngineLine[]) => void) | null, lines: EngineLine[]): void {
  if (!onUpdate) {
    throw new Error('No continuous analysis update callback was captured');
  }

  onUpdate(lines);
}

function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height
  });
}

function setWindowScroll(x: number, y: number): void {
  Object.defineProperty(window, 'scrollX', {
    configurable: true,
    value: x
  });
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: y
  });
  Object.defineProperty(window, 'pageXOffset', {
    configurable: true,
    value: x
  });
  Object.defineProperty(window, 'pageYOffset', {
    configurable: true,
    value: y
  });
}
