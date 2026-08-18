import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GameCache } from '../../src/detector/gameCache';
import { findStrictPins } from '../../src/detector/pinAnalyzer';
import { runDetectionCycle } from '../../src/detector/pipeline';

describe('runDetectionCycle', () => {
  it('uses manual visible-board detection for live games and blocks sharing', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Resign"></button>
      <button aria-label="Offer Draw"></button>
      <div class="clock-player-turn">04:31</div>
    `;

    const cache = new GameCache();
    const result = runDetectionCycle(cache, { root: document, url: 'https://www.chess.com/game/live/169747037990', now: () => 1 });

    expect(result.status).toBe('ok');
    expect(result.mode).toBe('live');
    expect(result.source).toBe('manual-live-board-dom');
    expect(result.board?.a2).toBe('wP');
    expect(result.sharing.allowed).toBe(false);
    expect(cache.get('169747037990')?.result?.source).toBe('manual-live-board-dom');
  });

  it('extracts game ids from daily game URLs', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Previous move"></button>
      <button aria-label="Next move"></button>
      <section class="move-list-controls"></section>
    `;

    const cache = new GameCache();
    const result = runDetectionCycle(cache, { root: document, url: 'https://www.chess.com/game/daily/984205126' });

    expect(result.gameId).toBe('984205126');
    expect(cache.get('984205126')?.result?.gameId).toBe('984205126');
    expect(cache.get('unknown-game')).toBeUndefined();
  });

  it('keeps the local move sequence for live games without building exportable PGN', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <div class="board-player-component board-player-top">
        <a class="user-username">BlackPlayer</a>
        <span class="user-tagline-rating">1602</span>
      </div>
      <div class="board-player-component board-player-bottom">
        <a class="user-username">WhitePlayer</a>
        <span class="user-tagline-rating">(1511)</span>
      </div>
      <button aria-label="Resign"></button>
      <button aria-label="Offer Draw"></button>
      <div class="clock-player-turn">04:31</div>
      <div class="move-list">
        <span class="node">1.</span>
        <span class="node">e4</span>
        <span class="node">e5</span>
      </div>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/live/169747037990' });

    expect(result.mode).toBe('live');
    expect(result.moveSequence).toEqual(['e4', 'e5']);
    expect(result.players).toEqual({
      white: { name: 'WhitePlayer', rating: 1511 },
      black: { name: 'BlackPlayer', rating: 1602 }
    });
    expect(result.pgn).toBeUndefined();
    expect(result.sharing.allowed).toBe(false);
  });

  it('keeps the selected ply index on live board results', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Aufgeben"></button>
      <button aria-label="Remis"></button>
      <div class="clock-component clock-player-turn">
        <span class="clock-time-monospace" data-cy="clock-time" role="timer">9:40</span>
      </div>
      <div class="move-list">
        <button data-node="0-0" class="node">e4</button>
        <button data-node="0-1" class="node">e5</button>
        <button data-node="0-2" class="node selected">Nf3</button>
        <button data-node="0-3" class="node">Nc6</button>
      </div>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/169755326994' });

    expect(result.mode).toBe('live');
    expect(result.moveIndex).toBe(3);
    expect(result.moveSequence).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('treats localized active Chess.com games on /game URLs as live', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Aufgeben"></button>
      <button aria-label="Remis"></button>
      <div class="clock-component clock-player-turn">
        <span class="clock-time-monospace" data-cy="clock-time" role="timer">9:40</span>
      </div>
      <button data-cy="move-list-button-backward" aria-label="Vorheriger Zug"></button>
      <button data-cy="move-list-button-forward" aria-label="Nächster Zug"></button>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/169755326994' });

    expect(result.mode).toBe('live');
    expect(result.source).toBe('manual-live-board-dom');
    expect(result.sharing).toEqual({ allowed: false, reason: 'live-game' });
  });

  it('keeps the cached live result when only clock text changes', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Resign"></button>
      <button aria-label="Offer Draw"></button>
      <div class="clock-player-turn">04:31</div>
    `;
    const cache = new GameCache();
    const first = runDetectionCycle(cache, { root: document, url: 'https://www.chess.com/game/live/169747037990', now: () => 1 });
    document.querySelector('.clock-player-turn')!.textContent = '04:30';

    const second = runDetectionCycle(cache, { root: document, url: 'https://www.chess.com/game/live/169747037990', now: () => 2 });

    expect(second).toEqual(first);
    expect(cache.get('169747037990')?.updatedAt).toBe(2);
  });

  it('reads the visible replay board and allows confident sharing while keeping PGN metadata', () => {
    document.body.innerHTML = `
      <div class="board-player-component board-player-top">
        <a class="user-username">BlackPlayer</a>
        <span class="user-tagline-rating">1602</span>
      </div>
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <div class="board-player-component board-player-bottom">
        <a class="user-username">WhitePlayer</a>
        <span class="user-tagline-rating">(1511)</span>
      </div>
      <button aria-label="Previous move"></button>
      <button aria-label="Next move"></button>
      <section class="move-list-controls"></section>
      <div class="move-list">
        <span class="node">1.</span>
        <span class="node">e4</span>
        <span class="node">e5</span>
      </div>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/169747037990' });

    expect(result.status).toBe('ok');
    expect(result.mode).toBe('replay');
    expect(result.source).toBe('board-dom');
    expect(result.reconciledFromMoveList).toBe(false);
    expect(result.fenPlacement).toBe('8/8/8/K6k/8/8/P7/8');
    expect(result.players).toEqual({
      white: { name: 'WhitePlayer', rating: 1511 },
      black: { name: 'BlackPlayer', rating: 1602 }
    });
    expect(result.moveSequence).toEqual(['e4', 'e5']);
    expect(result.pgn).toContain('1. e4 e5');
    expect(result.sharing.allowed).toBe(true);
  });

  it('extracts replay position and PGN from the Chess.com share dialog before board DOM fallback', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-label="Share">
        <label>FEN</label>
        <div>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</div>
        <label>PGN</label>
        <textarea>[Event "Live Chess"]
[White "WhitePlayer"]
[Black "BlackPlayer"]

1. e4 e5</textarea>
      </div>
      <button aria-label="Previous move"></button>
      <button aria-label="Next move"></button>
      <section class="move-list-controls"></section>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/169747037990' });

    expect(result.status).toBe('ok');
    expect(result.mode).toBe('replay');
    expect(result.source).toBe('chesscom-share-dialog');
    expect(result.pgn).toContain('[Event "Live Chess"]');
    expect(result.players).toEqual({
      white: { name: 'WhitePlayer' },
      black: { name: 'BlackPlayer' }
    });
    expect(result.fenPlacement).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    expect(result.sharing.allowed).toBe(true);
  });

  it('extracts PGN from an open analysis share dialog even when mode confidence is below the sharing threshold', () => {
    document.body.innerHTML = `
      <main class="analysis-layout">
        <button aria-label="Offer Draw"></button>
        <div role="dialog" aria-label="Teilen">
          <button>PGN</button>
          <button>Image</button>
          <label>FEN</label>
          <div>3r1rk1/5pp1/p5qp/1b2R3/1P1B4/P6P/3Q2P1/1KR5 b - - 1 30</div>
          <label>PGN</label>
          <textarea>[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.06.05"]
[White "uecevshge"]
[Black "NotAosSpeed"]
[Result "0-1"]

1. e4 e5 0-1</textarea>
        </div>
      </main>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/169747037990' });

    expect(result.mode).toBe('analysis');
    expect(result.modeConfidence).toBe(0.75);
    expect(result.status).toBe('ok');
    expect(result.source).toBe('chesscom-share-dialog');
    expect(result.pgn).toContain('[White "uecevshge"]');
    expect(result.sharing).toEqual({ allowed: true, reason: 'analysis-page' });
  });

  it('keeps the debug position aligned to the visible board when the replay move list is at a different ply', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wp square-22"></div>
        <div class="piece wp square-32"></div>
        <div class="piece wp square-42"></div>
        <div class="piece wp square-52"></div>
        <div class="piece wp square-62"></div>
        <div class="piece wp square-72"></div>
        <div class="piece wp square-82"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Previous move"></button>
      <button aria-label="Next move"></button>
      <section class="move-list-controls"></section>
      <div class="move-list">
        <span class="node">1.</span>
        <button class="node">e4</button>
        <button class="node">e5</button>
        <span class="node">2.</span>
        <button class="node">Nf3</button>
        <button class="node">Nc6</button>
      </div>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/169747037990' });

    expect(result.status).toBe('ok');
    expect(result.mode).toBe('replay');
    expect(result.source).toBe('board-dom');
    expect(result.reconciledFromMoveList).toBe(false);
    expect(result.fenPlacement).toBe('8/8/8/K6k/8/8/PPPPPPPP/8');
    expect(result.pgn).toContain('1. e4 e5 2. Nf3 Nc6');
  });

  it('keeps the selected ply index on visible replay board results', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Previous move"></button>
      <button aria-label="Next move"></button>
      <section class="move-list-controls"></section>
      <div class="move-list">
        <button data-node="0-0" class="node">e4</button>
        <button data-node="0-1" class="node">e5</button>
        <button data-node="0-2" class="node selected">Nf3</button>
        <button data-node="0-3" class="node">Nc6</button>
      </div>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/169747037990?move=1' });

    expect(result.status).toBe('ok');
    expect(result.source).toBe('board-dom');
    expect(result.moveIndex).toBe(3);
  });

  it('infers the replay ply from the visible board when stepping back without a selected move marker', () => {
    const cache = new GameCache();
    const moveList = `
      <div class="move-list">
        <button class="node">e4</button>
        <button class="node">e5</button>
        <button class="node">Nf3</button>
      </div>
    `;

    document.body.innerHTML = replayBoardMarkup(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R',
      moveList
    );
    const finalPosition = runDetectionCycle(cache, { root: document, url: 'https://www.chess.com/game/169747037990' });

    document.body.innerHTML = replayBoardMarkup(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR',
      moveList
    );
    const previousPosition = runDetectionCycle(cache, { root: document, url: 'https://www.chess.com/game/169747037990' });

    expect(finalPosition.moveIndex).toBe(3);
    expect(previousPosition.source).toBe('board-dom');
    expect(previousPosition.moveIndex).toBe(2);
  });

  it('uses a black-oriented visible replay board instead of the final move-list position', () => {
    document.body.innerHTML = `
      <chess-board class="flipped">
        <div class="piece wp square-11"></div>
        <div class="piece wp square-21"></div>
        <div class="piece wp square-31"></div>
        <div class="piece wp square-41"></div>
        <div class="piece wk square-51"></div>
        <div class="piece bk square-58"></div>
      </chess-board>
      <button aria-label="Previous move"></button>
      <button aria-label="Next move"></button>
      <section class="move-list-controls"></section>
      <div class="move-list">
        <button class="node">e4</button>
        <button class="node">e5</button>
        <button class="node">Qh5</button>
        <button class="node">Nc6</button>
      </div>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/169747037990' });

    expect(result.mode).toBe('replay');
    expect(result.source).toBe('board-dom');
    expect(result.orientation).toBe('black');
    expect(result.fenPlacement).toBe('4k3/8/8/8/8/8/8/PPPPK3');
    expect(result.moveSequence).toEqual(['e4', 'e5', 'Qh5', 'Nc6']);
  });

  it('returns cached state when the fingerprint is unchanged', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Previous move"></button>
      <button aria-label="Next move"></button>
      <section class="move-list-controls"></section>
    `;
    const cache = new GameCache();
    const first = runDetectionCycle(cache, { root: document, url: 'https://www.chess.com/game/169747037990', now: () => 1 });
    const second = runDetectionCycle(cache, { root: document, url: 'https://www.chess.com/game/169747037990', now: () => 2 });

    expect(second).toEqual(first);
    expect(cache.get('169747037990')?.updatedAt).toBe(2);
  });

  it('builds a board for pinned-piece analysis from cached saved-move positions', () => {
    document.body.innerHTML = `
      <button aria-label="Previous move"></button>
      <button aria-label="Next move"></button>
      <section class="move-list-controls"></section>
      <div class="move-list">
        <button class="node">e4</button>
      </div>
    `;
    const cache = new GameCache();
    cache.setFenPositionCache('169747037990', ['e4'], [
      '8/8/8/8/8/8/8/4K3 w - - 0 1',
      '4r3/8/8/8/8/8/4R3/4K3 w - - 0 1'
    ]);

    const result = runDetectionCycle(cache, { root: document, url: 'https://www.chess.com/game/169747037990' });

    expect(result.status).toBe('ok');
    expect(result.source).toBe('move-list');
    expect(result.board).toEqual({
      e1: 'wK',
      e2: 'wR',
      e8: 'bR'
    });
    expect(findStrictPins(result.board!)).toEqual([
      {
        square: 'e2',
        piece: 'wR',
        targetSquare: 'e1',
        targetPiece: 'wK',
        attackerSquare: 'e8',
        attackerPiece: 'bR',
        severity: 'king'
      }
    ]);
  });

  it('blocks unknown mode and does not include exportable board data', () => {
    document.body.innerHTML = '<main>No chess board</main>';

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/home' });

    expect(result.status).toBe('no-board');
    expect(result.mode).toBe('unknown');
    expect(result.board).toBeUndefined();
    expect(result.sharing.allowed).toBe(false);
  });

  it('applies live fixture safety rules', () => {
    document.body.innerHTML = fixture('live-game.html');

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/live/169747037990' });

    expect(result.mode).toBe('live');
    expect(result.source).toBe('manual-live-board-dom');
    expect(result.sharing.allowed).toBe(false);
  });

  it('allows replay fixture sharing through the gate', () => {
    document.body.innerHTML = fixture('replay-game.html');

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/169747037990' });

    expect(result.mode).toBe('replay');
    expect(result.sharing.allowed).toBe(true);
  });

  it('allows analysis fixture sharing only without live controls', () => {
    document.body.innerHTML = fixture('analysis-game.html');
    const analysis = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/analysis/game/169747037990' });

    document.body.innerHTML = `${fixture('analysis-game.html')}<button aria-label="Resign"></button><button aria-label="Offer Draw"></button>`;
    const liveLikeAnalysis = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/analysis/game/169747037990' });

    expect(analysis.mode).toBe('analysis');
    expect(analysis.sharing.allowed).toBe(true);
    expect(liveLikeAnalysis.sharing.allowed).toBe(false);
  });

  it('allows low-confidence analysis sharing when the Chess.com share button is present', () => {
    document.body.innerHTML = `
      <main class="analysis-layout">
        <div class="clock">10:00</div>
        <button type="button" data-cy="sidebar-share-icon" aria-label="Teilen">
          <svg data-glyph="graph-nodes-share"></svg>
        </button>
      </main>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/live/169747037990?move=0' });

    expect(result.mode).toBe('analysis');
    expect(result.modeConfidence).toBe(0.75);
    expect(result.sharing).toEqual({ allowed: true, reason: 'share-button' });
  });

  it('keeps live games blocked even if a fake share button is present', () => {
    document.body.innerHTML = `
      <chess-board>
        <div class="piece wp square-12"></div>
        <div class="piece wk square-15"></div>
        <div class="piece bk square-85"></div>
      </chess-board>
      <button aria-label="Resign"></button>
      <button type="button" data-cy="sidebar-share-icon" aria-label="Teilen"></button>
      <div class="clock-player-turn">04:31</div>
    `;

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/game/live/169747037990' });

    expect(result.mode).toBe('live');
    expect(result.sharing).toEqual({ allowed: false, reason: 'live-game' });
  });

  it('keeps unknown pages blocked even if a fake share button is present', () => {
    document.body.innerHTML = '<button type="button" data-cy="sidebar-share-icon" aria-label="Teilen"></button>';

    const result = runDetectionCycle(new GameCache(), { root: document, url: 'https://www.chess.com/home' });

    expect(result.mode).toBe('unknown');
    expect(result.sharing).toEqual({ allowed: false, reason: 'unknown-mode' });
  });
});

function fixture(name: string): string {
  return readFileSync(resolve('tests/fixtures', name), 'utf8');
}

function replayBoardMarkup(fenPlacement: string, moveList: string): string {
  return `
    <chess-board>
      ${piecesFromFenPlacement(fenPlacement)}
    </chess-board>
    <button aria-label="Previous move"></button>
    <button aria-label="Next move"></button>
    <section class="move-list-controls"></section>
    ${moveList}
  `;
}

function piecesFromFenPlacement(fenPlacement: string): string {
  const pieces: string[] = [];
  const ranks = fenPlacement.split('/');
  const compactPieceClass: Record<string, string> = {
    P: 'wp',
    N: 'wn',
    B: 'wb',
    R: 'wr',
    Q: 'wq',
    K: 'wk',
    p: 'bp',
    n: 'bn',
    b: 'bb',
    r: 'br',
    q: 'bq',
    k: 'bk'
  };

  ranks.forEach((rankText, rankIndex) => {
    let file = 1;
    const rank = 8 - rankIndex;
    for (const token of rankText) {
      if (/\d/.test(token)) {
        file += Number.parseInt(token, 10);
        continue;
      }

      pieces.push(`<div class="piece ${compactPieceClass[token]} square-${file}${rank}"></div>`);
      file += 1;
    }
  });

  return pieces.join('\n');
}
