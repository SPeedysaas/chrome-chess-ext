import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPendingLichessPasteImport } from '../../src/content/lichessPasteImport';

function installChromeMock(pgn = '[Event "Live Chess"]\n\n1. e4 e5 1-0') {
  const get = vi.fn((_key: string, callback: (items: Record<string, unknown>) => void) => {
    callback({
      'lichessImport:abc123': {
        pgn,
        createdAt: Date.now()
      }
    });
  });
  const remove = vi.fn();
  vi.stubGlobal('chrome', {
    storage: { local: { get, remove } }
  });

  return { get, remove };
}

describe('runPendingLichessPasteImport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
    history.replaceState(null, '', '/');
  });

  it('fills the Lichess PGN textbox, requests computer analysis, and submits the form', () => {
    const chromeMock = installChromeMock();
    const submit = vi.fn((event: Event) => event.preventDefault());
    history.replaceState(null, '', '/paste#chesscom-import=abc123');
    document.body.innerHTML = `
      <form>
        <textarea name="pgn"></textarea>
        <label><input type="checkbox" name="analyse"> Computer analysis</label>
        <button type="submit">Import game</button>
      </form>
    `;
    document.querySelector('form')?.addEventListener('submit', submit);

    runPendingLichessPasteImport();

    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toContain('1. e4 e5');
    expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(chromeMock.remove).toHaveBeenCalledWith('lichessImport:abc123');
  });

  it('waits for the paste form when Lichess renders it after the content script starts', () => {
    vi.useFakeTimers();
    installChromeMock();
    history.replaceState(null, '', '/paste#chesscom-import=abc123');

    runPendingLichessPasteImport({ retryMs: 25, maxAttempts: 3 });
    document.body.innerHTML = `
      <form>
        <textarea></textarea>
        <input type="checkbox" id="analyse">
        <button type="submit">Import</button>
      </form>
    `;
    document.querySelector('form')?.addEventListener('submit', (event) => event.preventDefault());

    vi.advanceTimersByTime(25);

    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toContain('1. e4 e5');
    expect(document.querySelector<HTMLInputElement>('#analyse')?.checked).toBe(true);
  });

  it('does nothing without a chesscom import id in the URL hash', () => {
    const chromeMock = installChromeMock();
    history.replaceState(null, '', '/paste');

    runPendingLichessPasteImport();

    expect(chromeMock.get).not.toHaveBeenCalled();
  });
});
