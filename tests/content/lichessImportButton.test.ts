import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateLichessImportButton } from '../../src/content/lichessImportButton';
import type { DetectorResult } from '../../src/detector/types';

const baseResult: DetectorResult = {
  status: 'ok',
  gameId: '169747037990',
  mode: 'replay',
  modeConfidence: 0.95,
  pgn: '[Event "Live Chess"]\n\n1. e4 e5 1-0',
  reconciledFromMoveList: false,
  sharing: { allowed: true, reason: 'replay-page' },
  evidence: []
};

function installChromeMock() {
  const set = vi.fn((_items: Record<string, unknown>, callback?: () => void) => callback?.());
  const create = vi.fn();
  vi.stubGlobal('chrome', {
    runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
    storage: { local: { set } },
    tabs: { create }
  });

  return { set, create };
}

describe('updateLichessImportButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders a Lichess import button next to the replay search control when PGN is available', () => {
    document.body.innerHTML = '<div class="toolbar"><button aria-label="Search">Search</button></div>';

    updateLichessImportButton(baseResult);

    const button = document.querySelector<HTMLButtonElement>('#chesscom-lichess-import-button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('title')).toBe('Import PGN to Lichess analysis');
    expect(button?.previousElementSibling?.getAttribute('aria-label')).toBe('Search');
    expect(button?.querySelector('img')?.getAttribute('src')).toContain('lichess-svgrepo-com.svg');
  });

  it('stores PGN and opens the Lichess paste page when clicked', () => {
    const chromeMock = installChromeMock();
    document.body.innerHTML = '<div class="toolbar"><button aria-label="Search">Search</button></div>';

    updateLichessImportButton(baseResult);
    document.querySelector<HTMLButtonElement>('#chesscom-lichess-import-button')?.click();

    expect(chromeMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'lichessImport:169747037990': expect.objectContaining({
          pgn: baseResult.pgn
        })
      }),
      expect.any(Function)
    );
    expect(chromeMock.create).toHaveBeenCalledWith({
      url: 'https://lichess.org/paste#chesscom-import=169747037990'
    });
  });

  it('falls back to the replay controls row when the search button is icon-only', () => {
    document.body.innerHTML = '<section class="move-list-controls"></section>';

    updateLichessImportButton(baseResult);

    expect(document.querySelector('.move-list-controls > #chesscom-lichess-import-button')).not.toBeNull();
  });

  it('builds PGN from the replay move list when the detection result has no PGN field', () => {
    const chromeMock = installChromeMock();
    document.body.innerHTML = `
      <div class="toolbar"><button aria-label="Search">Search</button></div>
      <div class="move-list">
        <span>1.</span><button>e4</button><button>e5</button>
        <span>2.</span><button>Nf3</button><button>Nc6</button>
      </div>
    `;

    const { pgn: _pgn, ...resultWithoutPgn } = baseResult;

    updateLichessImportButton(resultWithoutPgn);
    document.querySelector<HTMLButtonElement>('#chesscom-lichess-import-button')?.click();

    expect(chromeMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'lichessImport:169747037990': expect.objectContaining({
          pgn: expect.stringContaining('1. e4 e5 2. Nf3 Nc6')
        })
      }),
      expect.any(Function)
    );
  });

  it('removes the button when sharing is not allowed', () => {
    document.body.innerHTML = '<div class="toolbar"><button aria-label="Search">Search</button></div>';

    updateLichessImportButton(baseResult);
    updateLichessImportButton({
      ...baseResult,
      sharing: { allowed: false, reason: 'live-game' }
    });

    expect(document.querySelector('#chesscom-lichess-import-button')).toBeNull();
  });

  it('does not read the move list when sharing is not allowed', () => {
    document.body.innerHTML = '<div class="move-list"><span>e4</span></div>';
    const moveText = document.querySelector('span');
    Object.defineProperty(moveText, 'textContent', {
      configurable: true,
      get: () => {
        throw new Error('move list should not be read');
      }
    });
    const { pgn: _pgn, ...resultWithoutPgn } = baseResult;

    expect(() => updateLichessImportButton({
      ...resultWithoutPgn,
      sharing: { allowed: false, reason: 'live-game' }
    })).not.toThrow();
  });
});
