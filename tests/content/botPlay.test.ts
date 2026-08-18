import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBotPlayController, playUciMoveOnBoard } from '../../src/content/botPlay';
import type { DetectorResult } from '../../src/detector/types';

describe('Stockfish bot play', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('plays the best move once when it is the user turn on a bot route', async () => {
    document.body.innerHTML = '<div class="board-player-bottom active"></div><wc-chess-board></wc-chess-board>';
    const analyze = vi.fn().mockResolvedValue([
      { depth: 12, multipv: 1, score: { type: 'cp' as const, value: 40 }, move: 'e2e4' }
    ]);
    const playMove = vi.fn().mockReturnValue(true);
    const controller = createBotPlayController({
      enabled: true,
      noCaptures: true,
      url: () => 'https://www.chess.com/play/computer',
      engineFactory: () => ({ analyze, dispose: vi.fn() }),
      playMove
    });
    const result = liveResult();

    await controller.update(result);
    await controller.update(result);

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(analyze).toHaveBeenCalledWith(expect.stringContaining(' w '), 12, { noCaptures: true });
    expect(playMove).toHaveBeenCalledWith('e2e4', 'white', document);
  });

  it('recognizes White to move from the exact opening position without turn UI', async () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const analyze = vi.fn().mockResolvedValue([
      { depth: 12, multipv: 1, score: { type: 'cp' as const, value: 40 }, move: 'd2d4' }
    ]);
    const playMove = vi.fn().mockReturnValue(true);

    await createBotPlayController({
      enabled: true,
      url: () => 'https://www.chess.com/play/bots/coach-danny',
      engineFactory: () => ({ analyze, dispose: vi.fn() }),
      playMove
    }).update(liveResult());

    expect(playMove).toHaveBeenCalledWith('d2d4', 'white', document);
  });

  it('does not analyze opponent turns or human game routes', async () => {
    document.body.innerHTML = '<div class="board-player-top active"></div><wc-chess-board></wc-chess-board>';
    const analyze = vi.fn();
    const engineFactory = () => ({ analyze, dispose: vi.fn() });

    await createBotPlayController({
      enabled: true,
      url: () => 'https://www.chess.com/play/computer',
      engineFactory
    }).update(liveResult());
    await createBotPlayController({
      enabled: true,
      url: () => 'https://www.chess.com/play/online',
      engineFactory
    }).update(liveResult());

    expect(analyze).not.toHaveBeenCalled();
  });

  it('maps UCI squares to board click coordinates for either orientation', () => {
    document.body.innerHTML = '<wc-chess-board></wc-chess-board>';
    const board = document.querySelector<HTMLElement>('wc-chess-board')!;
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, width: 800, height: 800, right: 900, bottom: 850, x: 100, y: 50, toJSON: () => ({})
    });
    const clicks: Array<[number, number]> = [];
    board.addEventListener('click', (event) => clicks.push([(event as MouseEvent).clientX, (event as MouseEvent).clientY]));

    expect(playUciMoveOnBoard('e2e4', 'white')).toBe(true);
    expect(playUciMoveOnBoard('e7e5', 'black')).toBe(true);

    expect(clicks).toEqual([[550, 700], [550, 500], [450, 700], [450, 500]]);
  });
});

function liveResult(): DetectorResult {
  return {
    status: 'ok',
    gameId: 'bot-game',
    mode: 'live',
    modeConfidence: 1,
    fenPlacement: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    orientation: 'white',
    reconciledFromMoveList: false,
    sharing: { allowed: false, reason: 'live-game' },
    evidence: []
  };
}
