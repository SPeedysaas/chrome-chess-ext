import { afterEach, describe, expect, it, vi } from 'vitest';
import { findShareButton, readShareModalPgn } from '../../src/content/chessComSharePgnAutomation';

describe('Chess.com share PGN automation', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('finds the primary Chess.com sidebar share button', () => {
    document.body.innerHTML = '<button type="button" data-cy="sidebar-share-icon" aria-label="Teilen"></button>';

    expect(findShareButton(document)?.getAttribute('data-cy')).toBe('sidebar-share-icon');
  });

  it('finds the share button by graph-nodes-share glyph fallback', () => {
    document.body.innerHTML = `
      <button type="button" aria-label="Icon only">
        <svg data-glyph="graph-nodes-share"></svg>
      </button>
    `;

    expect(findShareButton(document)?.getAttribute('aria-label')).toBe('Icon only');
  });

  it('does not match unrelated share containers', () => {
    document.body.innerHTML = '<div class="share-menu">Share text without an actionable button</div>';

    expect(findShareButton(document)).toBeNull();
  });

  it('opens the share modal, selects PGN, reads values, and closes the modal it opened', async () => {
    document.body.innerHTML = '<button type="button" data-cy="sidebar-share-icon" aria-label="Teilen"></button>';
    document.querySelector<HTMLButtonElement>('[data-cy="sidebar-share-icon"]')!.addEventListener('click', () => {
      document.body.insertAdjacentHTML('beforeend', `
        <dialog data-cy="share-menu-modal" open>
          <button data-cy="modal-close-button" type="button">Close</button>
          <button data-cy="pgn-tab-button" aria-selected="false" type="button">PGN</button>
          <input id="share-fen" value="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1">
          <textarea name="pgn" aria-label="PGN"></textarea>
        </dialog>
      `);
      document.querySelector<HTMLTextAreaElement>('textarea[name="pgn"]')!.value = `[Event "Live Chess"]
[Site "Chess.com"]
[White "WhitePlayer"]
[Black "BlackPlayer"]
[Result "1-0"]

1. e4 e5 1-0`;
      document.querySelector<HTMLButtonElement>('[data-cy="modal-close-button"]')!.addEventListener('click', () => {
        document.querySelector('[data-cy="share-menu-modal"]')?.remove();
      });
    });

    const result = await readShareModalPgn({ root: document, attempts: 1, waitMs: 0 });

    expect(result?.pgn).toContain('[Event "Live Chess"]');
    expect(result?.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(result?.players).toEqual({
      white: { name: 'WhitePlayer' },
      black: { name: 'BlackPlayer' }
    });
    expect(document.querySelector('[data-cy="share-menu-modal"]')).toBeNull();
  });

  it('reads an already-open modal without closing it', async () => {
    document.body.innerHTML = `
      <button type="button" data-cy="sidebar-share-icon" aria-label="Teilen"></button>
      <dialog data-cy="share-menu-modal" open>
        <button data-cy="modal-close-button" type="button">Close</button>
        <button data-cy="pgn-tab-button" aria-selected="true" type="button">PGN</button>
        <textarea name="pgn" aria-label="PGN"></textarea>
      </dialog>
    `;
    document.querySelector<HTMLTextAreaElement>('textarea[name="pgn"]')!.value = `[Event "Live Chess"]
[White "WhitePlayer"]
[Black "BlackPlayer"]

1. e4 e5`;

    const result = await readShareModalPgn({ root: document, attempts: 1, waitMs: 0 });

    expect(result?.pgn).toContain('[White "WhitePlayer"]');
    expect(document.querySelector('[data-cy="share-menu-modal"]')).not.toBeNull();
  });

  it('returns null when no share button exists', async () => {
    document.body.innerHTML = '<main>No export control</main>';

    await expect(readShareModalPgn({ root: document, attempts: 1, waitMs: 0 })).resolves.toBeNull();
  });

  it('returns null when the modal never appears', async () => {
    document.body.innerHTML = '<button type="button" data-cy="sidebar-share-icon" aria-label="Teilen"></button>';

    await expect(readShareModalPgn({ root: document, attempts: 1, waitMs: 0 })).resolves.toBeNull();
  });

  it('returns null when the PGN textarea stays empty', async () => {
    document.body.innerHTML = `
      <button type="button" data-cy="sidebar-share-icon" aria-label="Teilen"></button>
      <dialog data-cy="share-menu-modal" open>
        <button data-cy="pgn-tab-button" aria-selected="true" type="button">PGN</button>
        <textarea name="pgn" aria-label="PGN"></textarea>
      </dialog>
    `;

    await expect(readShareModalPgn({ root: document, attempts: 1, waitMs: 0 })).resolves.toBeNull();
  });
});
