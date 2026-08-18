import { afterEach, describe, expect, it } from 'vitest';
import { removeDebugPreview, renderDebugPreview } from '../../src/content/debugPreview';
import { extractChessComShareGame } from '../../src/detector/chessComShareExtractor';
import type { DetectorResult } from '../../src/detector/types';

describe('extractChessComShareGame', () => {
  afterEach(() => {
    removeDebugPreview();
    document.body.innerHTML = '';
  });

  it('extracts FEN and PGN from the Chess.com share dialog', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-label="Teilen">
        <button>PGN</button>
        <button>Image</button>
        <label>FEN</label>
        <div class="share-field">rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</div>
        <label>PGN</label>
        <textarea>
[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.06.05"]
[White "uecevshge"]
[Black "NotAosSpeed"]
[Result "0-1"]

1. e4 e5 0-1
        </textarea>
      </div>
    `;

    const result = extractChessComShareGame(document);

    expect(result).toEqual({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: expect.stringContaining('[Event "Live Chess"]'),
      players: {
        white: { name: 'uecevshge' },
        black: { name: 'NotAosSpeed' }
      },
      source: 'chesscom-share-dialog',
      evidence: ['chesscom-share-dialog', 'share-dialog-fen', 'share-dialog-pgn']
    });
  });

  it('returns null when no share dialog data is present', () => {
    document.body.innerHTML = '<main>No dialog</main>';

    expect(extractChessComShareGame(document)).toBeNull();
  });

  it('extracts PGN from the Chess.com share menu textarea when earlier share controls also mention PGN', () => {
    document.body.innerHTML = `
      <div class="share-menu-tabs">
        <button>PGN</button>
      </div>
      <div class="share-menu-tab-pgn-section">
        <div class="share-menu-tab-pgn-pgn">
          <div id="pgn-heading" class="share-menu-tab-pgn-heading cc-text-medium-bold">PGN</div>
        </div>
        <div class="share-menu-tab-pgn-pgn-wrapper">
          <textarea class="cc-textarea-component cc-textarea-x-large share-menu-tab-pgn-textarea" aria-label="PGN" name="pgn" readonly=""></textarea>
        </div>
      </div>
    `;
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="pgn"]');
    textarea!.value = `[Event "Live Chess"]
[Site "Chess.com"]
[White "uecevshge"]
[Black "NotAosSpeed"]
[Result "1-0"]

1. e4 e5 1-0`;

    const result = extractChessComShareGame(document);

    expect(result?.pgn).toContain('[Event "Live Chess"]');
    expect(result?.evidence).toEqual(['chesscom-share-dialog', 'share-dialog-pgn']);
  });

  it('ignores the extension debug dialog when looking for Chess.com share PGN', () => {
    const resultWithPgn: DetectorResult = {
      status: 'ok',
      gameId: '169747037990',
      mode: 'analysis',
      modeConfidence: 0.75,
      fenPlacement: '8/8/8/8/8/8/8/8',
      pgn: '[Event "Live Chess"]\n[Site "Chess.com"]\n\n1. e4 e5 1-0',
      reconciledFromMoveList: false,
      sharing: { allowed: true, reason: 'share-button' },
      evidence: ['analysis-layout']
    };

    renderDebugPreview(resultWithPgn);
    [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => tab.textContent === 'Position')
      ?.click();

    expect(extractChessComShareGame(document)).toBeNull();
  });
});
