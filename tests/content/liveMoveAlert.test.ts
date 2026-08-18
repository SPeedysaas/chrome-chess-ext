import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameCache } from '../../src/detector/gameCache';
import { createLiveMoveAlertController } from '../../src/content/liveMoveAlert';
import type { DetectorResult } from '../../src/detector/types';
import type { EngineLine } from '../../src/engine/stockfishUci';

describe('live move alert controller', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('hides outside live games', async () => {
    const engine = fakeEngine([]);
    const controller = createLiveMoveAlertController({ cache: new GameCache(), engineFactory: () => engine });

    await controller.update({ ...liveResult(), mode: 'analysis' });

    expect(document.querySelector('[data-chesscom-live-move-alert]')).toBeNull();
    expect(engine.analyze).not.toHaveBeenCalled();
  });

  it('prompts for color when live players are unknown', async () => {
    const controller = createLiveMoveAlertController({ cache: new GameCache(), engineFactory: () => fakeEngine([]) });

    await controller.update(liveResult());

    expect(document.querySelector('[data-chesscom-live-color-prompt]')?.textContent).toContain('You are');
  });

  it('stores a manual color choice and analyzes after selection', async () => {
    const engine = fakeEngine([cp(1, 50), cp(2, -300)]);
    const cache = new GameCache();
    const controller = createLiveMoveAlertController({ cache, engineFactory: () => engine });
    await controller.update(liveResult());

    document.querySelector<HTMLButtonElement>('[data-live-color="white"]')?.click();
    await Promise.resolve();

    expect(cache.getLiveUserColor('169747037990')).toBe('white');
    expect(engine.analyzeContinuously).toHaveBeenCalledWith(
      '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      expect.any(Function)
    );
  });

  it('renders a warning without showing best engine moves', async () => {
    const engine = fakeEngine();
    const controller = createLiveMoveAlertController({ cache: new GameCache(), engineFactory: () => engine });

    await controller.update(liveResult({
      white: { name: 'NotAosSpeed', rating: 1511 },
      black: { name: 'Opponent', rating: 1702 }
    }));
    engine.emit([cp(1, 60, 'e2e4'), cp(2, 10, 'd2d4'), cp(3, -240, 'a2a3')]);

    const alert = document.querySelector('[data-chesscom-live-move-alert]');
    expect(alert?.textContent).toContain('Only 2 safe moves here');
    expect(alert?.textContent).not.toContain('e2e4');
    expect(alert?.textContent).not.toContain('d2d4');
    expect(controller.getDebugState()).toMatchObject({
      status: 'warning',
      targetPlayer: 'NotAosSpeed',
      targetColor: 'white',
      targetScoreCentipawns: 200,
      currentScoreCentipawns: 250
    });
  });

  it('ignores stale continuous analysis updates after the position changes', async () => {
    const engine = fakeEngine();
    const controller = createLiveMoveAlertController({ cache: new GameCache(), engineFactory: () => engine });

    await controller.update(liveResult({
      white: { name: 'NotAosSpeed' },
      black: { name: 'Opponent' }
    }));
    const firstSession = engine.lastSession();

    await controller.update(liveResult({
      white: { name: 'NotAosSpeed' },
      black: { name: 'Opponent' }
    }, { fenPlacement: '8/8/8/8/8/8/2P5/4K2k' }));
    const secondSession = engine.lastSession();

    firstSession.emit([cp(1, 60), cp(2, -300)]);
    expect(document.querySelector('[data-chesscom-live-move-alert]')).toBeNull();
    expect(firstSession.stop).toHaveBeenCalled();

    secondSession.emit([cp(1, 60), cp(2, -300)]);
    expect(document.querySelector('[data-chesscom-live-move-alert]')?.textContent).toContain('Only 1 safe move here');
  });

  it('removes UI and disposes the engine', async () => {
    const engine = fakeEngine([cp(1, 0)]);
    const controller = createLiveMoveAlertController({ cache: new GameCache(), engineFactory: () => engine });
    await controller.update(liveResult({
      white: { name: 'NotAosSpeed' },
      black: { name: 'Opponent' }
    }));

    controller.dispose();

    expect(document.querySelector('[data-chesscom-live-color-prompt]')).toBeNull();
    expect(engine.dispose).toHaveBeenCalled();
  });
});

function liveResult(players?: DetectorResult['players'], overrides: Partial<DetectorResult> = {}): DetectorResult {
  document.body.innerHTML = `
    <chess-board></chess-board>
    <div class="board-player-component board-player-bottom active">
      <a class="user-username">NotAosSpeed</a>
    </div>
  `;

  const result: DetectorResult = {
    status: 'ok',
    gameId: '169747037990',
    mode: 'live',
    modeConfidence: 1,
    fenPlacement: '8/8/8/8/8/8/P7/4K2k',
    orientation: 'white',
    reconciledFromMoveList: false,
    sharing: { allowed: false, reason: 'live-game' },
    evidence: [],
    ...overrides
  };
  if (players) {
    result.players = players;
  }

  return result;
}

function fakeEngine(lines: EngineLine[] = []) {
  const sessions: Array<{
    fen: string;
    emit: (lines: EngineLine[]) => void;
    stop: ReturnType<typeof vi.fn>;
  }> = [];

  return {
    analyze: vi.fn().mockResolvedValue(lines),
    analyzeContinuously: vi.fn((fen: string, onUpdate: (lines: EngineLine[]) => void) => {
      const session = {
        fen,
        emit: onUpdate,
        stop: vi.fn()
      };
      sessions.push(session);
      if (lines.length > 0) {
        onUpdate(lines);
      }
      return session;
    }),
    emit: (updateLines: EngineLine[]) => sessions.at(-1)?.emit(updateLines),
    lastSession: () => {
      const session = sessions.at(-1);
      if (!session) {
        throw new Error('No analysis session was started');
      }
      return session;
    },
    dispose: vi.fn()
  };
}

function cp(multipv: number, value: number, move = `m${multipv}`): EngineLine {
  return { depth: 12, multipv, score: { type: 'cp', value }, move };
}
