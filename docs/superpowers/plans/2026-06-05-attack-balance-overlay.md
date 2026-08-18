# Attack Balance Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact `=` / `!` overlay that marks pieces with equal attacker/defender counts or more attackers than defenders.

**Architecture:** Add a focused detector analyzer for attack balance, then render its results through a dedicated content overlay modeled after `pinOverlay.ts`. Wire the feature through an independent `attackBalanceOverlay` setting in the main content publishing path.

**Tech Stack:** TypeScript, Vitest, jsdom, existing `BoardMap`/`DetectorResult` types.

---

## File Structure

- Create `src/detector/attackBalanceAnalyzer.ts`: pure board analyzer that counts legal-style piece attacks on occupied squares and emits balanced/overloaded tactics.
- Create `tests/detector/attackBalanceAnalyzer.test.ts`: analyzer behavior tests.
- Create `src/content/attackBalanceOverlay.ts`: DOM badge renderer and cleanup function.
- Create `tests/content/attackBalanceOverlay.test.ts`: overlay rendering and cleanup tests.
- Modify `src/extension/settings.ts`: add `attackBalanceOverlay` default and normalization.
- Modify `tests/extension/settings.test.ts`: prove default and stored false behavior.
- Modify `src/content/index.ts`: call update/remove attack balance overlay in `publishResult` and startup cleanup.
- Modify `tests/content/index.test.ts`: include the new setting in partial settings used by tests and prove disabled cleanup behavior through DOM.

---

### Task 1: Analyzer

**Files:**
- Create: `tests/detector/attackBalanceAnalyzer.test.ts`
- Create: `src/detector/attackBalanceAnalyzer.ts`

- [ ] **Step 1: Write failing analyzer tests**

```ts
import { describe, expect, it } from 'vitest';
import { findAttackBalanceTactics } from '../../src/detector/attackBalanceAnalyzer';

describe('attack balance analyzer', () => {
  it('marks a piece as balanced when nonzero attackers equal defenders', () => {
    expect(findAttackBalanceTactics({
      d4: 'wN',
      f5: 'bP',
      e2: 'wB'
    })).toEqual([{
      square: 'd4',
      piece: 'wN',
      attackers: 1,
      defenders: 1,
      state: 'balanced'
    }]);
  });

  it('marks a piece as overloaded when attackers exceed defenders', () => {
    expect(findAttackBalanceTactics({
      d4: 'wN',
      f5: 'bP',
      c6: 'bB',
      e2: 'wB'
    })).toEqual([{
      square: 'd4',
      piece: 'wN',
      attackers: 2,
      defenders: 1,
      state: 'overloaded'
    }]);
  });

  it('marks one attacker and zero defenders as overloaded', () => {
    expect(findAttackBalanceTactics({
      d4: 'wN',
      f5: 'bP'
    })).toEqual([{
      square: 'd4',
      piece: 'wN',
      attackers: 1,
      defenders: 0,
      state: 'overloaded'
    }]);
  });

  it('does not mark pieces with zero attackers and zero defenders', () => {
    expect(findAttackBalanceTactics({
      a1: 'wR',
      h8: 'bK'
    })).toEqual([]);
  });

  it('does not mark pieces with more defenders than attackers', () => {
    expect(findAttackBalanceTactics({
      d4: 'wN',
      f5: 'bP',
      e2: 'wB',
      b3: 'wQ'
    })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run analyzer tests and verify RED**

Run: `npx vitest run tests/detector/attackBalanceAnalyzer.test.ts`

Expected: FAIL because `../../src/detector/attackBalanceAnalyzer` does not exist.

- [ ] **Step 3: Implement analyzer**

```ts
import type { BoardMap, PieceCode, Square } from './types';

export type AttackBalanceState = 'balanced' | 'overloaded';

export interface AttackBalanceTactic {
  square: Square;
  piece: PieceCode;
  attackers: number;
  defenders: number;
  state: AttackBalanceState;
}

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export function findAttackBalanceTactics(board: BoardMap): AttackBalanceTactic[] {
  const tactics: AttackBalanceTactic[] = [];

  for (const [square, piece] of Object.entries(board) as [Square, PieceCode][]) {
    if (!piece) {
      continue;
    }

    const attackers = countAttackers(board, square, piece);
    const defenders = countDefenders(board, square, piece);

    if (attackers === 0 && defenders === 0) {
      continue;
    }

    if (attackers === defenders) {
      tactics.push({ square, piece, attackers, defenders, state: 'balanced' });
      continue;
    }

    if (attackers > defenders) {
      tactics.push({ square, piece, attackers, defenders, state: 'overloaded' });
    }
  }

  return tactics.sort((a, b) => a.square.localeCompare(b.square));
}

function countAttackers(board: BoardMap, square: Square, piece: PieceCode): number {
  return countPiecesAttacking(board, square, (candidateSquare, candidatePiece) =>
    candidateSquare !== square && candidatePiece[0] !== piece[0]);
}

function countDefenders(board: BoardMap, square: Square, piece: PieceCode): number {
  return countPiecesAttacking(board, square, (candidateSquare, candidatePiece) =>
    candidateSquare !== square && candidatePiece[0] === piece[0]);
}

function countPiecesAttacking(
  board: BoardMap,
  target: Square,
  include: (candidateSquare: Square, candidatePiece: PieceCode) => boolean
): number {
  return (Object.entries(board) as [Square, PieceCode][])
    .filter(([candidateSquare, candidatePiece]) => candidatePiece && include(candidateSquare, candidatePiece))
    .filter(([candidateSquare, candidatePiece]) => attacksSquare(board, candidateSquare, candidatePiece, target))
    .length;
}

function attacksSquare(board: BoardMap, from: Square, piece: PieceCode, target: Square): boolean {
  const fromCoord = coord(from);
  const targetCoord = coord(target);
  const fileDelta = targetCoord.file - fromCoord.file;
  const rankDelta = targetCoord.rank - fromCoord.rank;
  const absFile = Math.abs(fileDelta);
  const absRank = Math.abs(rankDelta);

  switch (piece[1]) {
    case 'P': {
      const forward = piece[0] === 'w' ? 1 : -1;
      return absFile === 1 && rankDelta === forward;
    }
    case 'N':
      return (absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1);
    case 'B':
      return absFile === absRank && pathIsClear(board, fromCoord, targetCoord);
    case 'R':
      return (fileDelta === 0 || rankDelta === 0) && pathIsClear(board, fromCoord, targetCoord);
    case 'Q':
      return (fileDelta === 0 || rankDelta === 0 || absFile === absRank) && pathIsClear(board, fromCoord, targetCoord);
    case 'K':
      return Math.max(absFile, absRank) === 1;
    default:
      return false;
  }
}

function pathIsClear(board: BoardMap, from: Coord, target: Coord): boolean {
  const fileStep = Math.sign(target.file - from.file);
  const rankStep = Math.sign(target.rank - from.rank);

  for (
    let file = from.file + fileStep, rank = from.rank + rankStep;
    file !== target.file || rank !== target.rank;
    file += fileStep, rank += rankStep
  ) {
    if (board[squareFromCoord({ file, rank })]) {
      return false;
    }
  }

  return true;
}

interface Coord {
  file: number;
  rank: number;
}

function coord(square: Square): Coord {
  return {
    file: files.indexOf(square[0] as typeof files[number]),
    rank: ranks.indexOf(square[1] as typeof ranks[number])
  };
}

function squareFromCoord(value: Coord): Square {
  return `${files[value.file]}${ranks[value.rank]}` as Square;
}
```

- [ ] **Step 4: Run analyzer tests and verify GREEN**

Run: `npx vitest run tests/detector/attackBalanceAnalyzer.test.ts`

Expected: PASS.

---

### Task 2: Overlay

**Files:**
- Create: `tests/content/attackBalanceOverlay.test.ts`
- Create: `src/content/attackBalanceOverlay.ts`

- [ ] **Step 1: Write failing overlay tests**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { removeAttackBalanceOverlay, updateAttackBalanceOverlay } from '../../src/content/attackBalanceOverlay';
import type { DetectorResult } from '../../src/detector/types';

const result: DetectorResult = {
  status: 'ok',
  gameId: 'attack-balance-test',
  mode: 'analysis',
  modeConfidence: 1,
  boardConfidence: 1,
  board: {
    d4: 'wN',
    f5: 'bP',
    e2: 'wB',
    a1: 'wR'
  },
  orientation: 'white',
  reconciledFromMoveList: false,
  sharing: { allowed: true, reason: 'analysis-page' },
  evidence: []
};

describe('attack balance overlay', () => {
  afterEach(() => {
    removeAttackBalanceOverlay();
    document.body.innerHTML = '';
  });

  it('adds a compact balanced badge with exact counts in the aria label', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44"></div>
        <div class="piece bp square-65"></div>
        <div class="piece wb square-52"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay(result);

    const badge = document.querySelector<HTMLElement>('.piece.wn.square-44 [data-chesscom-attack-balance-badge="true"]');
    expect(badge?.textContent).toBe('=');
    expect(badge?.getAttribute('aria-label')).toBe('Balanced piece: 1 attacker and 1 defender');
    expect(badge?.style.position).toBe('absolute');
  });

  it('adds a compact overloaded badge for more attackers than defenders', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44"></div>
        <div class="piece bp square-65"></div>
        <div class="piece bb square-36"></div>
        <div class="piece wb square-52"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay({
      ...result,
      board: {
        d4: 'wN',
        f5: 'bP',
        c6: 'bB',
        e2: 'wB'
      }
    });

    const badge = document.querySelector<HTMLElement>('.piece.wn.square-44 [data-chesscom-attack-balance-badge="true"]');
    expect(badge?.textContent).toBe('!');
    expect(badge?.getAttribute('aria-label')).toBe('Overloaded piece: 2 attackers and 1 defender');
  });

  it('removes stale badges when refreshed', () => {
    document.body.innerHTML = `
      <wc-chess-board>
        <div class="piece wn square-44"></div>
        <div class="piece bp square-65"></div>
        <div class="piece wb square-52"></div>
      </wc-chess-board>
    `;

    updateAttackBalanceOverlay(result);
    updateAttackBalanceOverlay({
      ...result,
      board: {
        d4: 'wN'
      }
    });

    expect(document.querySelector('[data-chesscom-attack-balance-badge="true"]')).toBeNull();
  });

  it('does not render when the detector result is incomplete', () => {
    document.body.innerHTML = '<wc-chess-board><div class="piece wn square-44"></div></wc-chess-board>';

    updateAttackBalanceOverlay({
      ...result,
      status: 'low-confidence',
      board: undefined
    });

    expect(document.querySelector('[data-chesscom-attack-balance-badge="true"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run overlay tests and verify RED**

Run: `npx vitest run tests/content/attackBalanceOverlay.test.ts`

Expected: FAIL because `../../src/content/attackBalanceOverlay` does not exist.

- [ ] **Step 3: Implement overlay**

```ts
import { findAttackBalanceTactics, type AttackBalanceTactic } from '../detector/attackBalanceAnalyzer';
import { selectors } from '../detector/selectors';
import type { DetectorResult, Orientation, Square } from '../detector/types';

const badgeAttribute = 'data-chesscom-attack-balance-badge';
const badgeSelector = `[${badgeAttribute}="true"]`;

export function updateAttackBalanceOverlay(result: DetectorResult, root: ParentNode = document): void {
  removeAttackBalanceOverlay(root);

  if (result.status !== 'ok' || !result.board || !result.orientation) {
    return;
  }

  const boardElement = queryFirst(root, selectors.board);
  if (!boardElement) {
    return;
  }

  for (const tactic of findAttackBalanceTactics(result.board)) {
    const pieceElement = findPieceElement(boardElement, tactic.square, result.orientation);
    if (!pieceElement) {
      continue;
    }

    pieceElement.appendChild(createBadge(tactic));
  }
}

export function removeAttackBalanceOverlay(root: ParentNode = document): void {
  for (const badge of root.querySelectorAll(badgeSelector)) {
    badge.remove();
  }
}

function createBadge(tactic: AttackBalanceTactic): HTMLElement {
  const badge = document.createElement('span');
  badge.setAttribute(badgeAttribute, 'true');
  badge.setAttribute('aria-label', `${capitalize(tactic.state)} piece: ${tactic.attackers} ${pluralize('attacker', tactic.attackers)} and ${tactic.defenders} ${pluralize('defender', tactic.defenders)}`);
  badge.textContent = tactic.state === 'balanced' ? '=' : '!';

  Object.assign(badge.style, {
    position: 'absolute',
    top: '3%',
    right: '1%',
    width: '28%',
    minWidth: '18px',
    aspectRatio: '1 / 1',
    display: 'grid',
    placeItems: 'center',
    border: '2px solid #f5f5f5',
    borderRadius: '999px',
    background: tactic.state === 'balanced' ? '#2f7ed6' : '#d6462f',
    color: '#fff',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.35)',
    font: '900 18px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    pointerEvents: 'none',
    zIndex: '4'
  } satisfies Partial<CSSStyleDeclaration>);

  return badge;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

function findPieceElement(boardElement: Element, square: Square, orientation: Orientation): HTMLElement | null {
  const squareClass = squareClassFromSquare(square, orientation);
  return boardElement.querySelector<HTMLElement>(`.piece.${squareClass}, [class~="${squareClass}"]`);
}

function squareClassFromSquare(square: Square, orientation: Orientation): string {
  const fileIndex = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankIndex = Number(square[1]) - 1;

  return `square-${fileIndex + 1}${rankIndex + 1}`;
}

function queryFirst(root: ParentNode, selectorList: readonly string[]): Element | null {
  for (const selector of selectorList) {
    const element = root.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return null;
}
```

- [ ] **Step 4: Run overlay tests and verify GREEN**

Run: `npx vitest run tests/content/attackBalanceOverlay.test.ts`

Expected: PASS.

---

### Task 3: Settings and Main Integration

**Files:**
- Modify: `src/extension/settings.ts`
- Modify: `tests/extension/settings.test.ts`
- Modify: `src/content/index.ts`
- Modify: `tests/content/index.test.ts`

- [ ] **Step 1: Write failing settings and integration tests**

Add to `tests/extension/settings.test.ts`:

```ts
  it('enables attack balance badges by default', () => {
    expect(normalizeExtensionSettings().attackBalanceOverlay).toBe(true);
  });

  it('preserves stored attack balance overlay customization', () => {
    expect(normalizeExtensionSettings({ attackBalanceOverlay: false }).attackBalanceOverlay).toBe(false);
  });
```

Add to `tests/content/index.test.ts`:

```ts
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
      settings: { enabled: true, debug: false, pinOverlay: false, forkOverlay: false, attackBalanceOverlay: false, debounceMs: 150, fallbackMs: 5000 },
      runDetection: () => ({
        status: 'ok',
        gameId: 'attack-balance-disabled',
        mode: 'analysis',
        modeConfidence: 1,
        board: {
          d4: 'wN',
          f5: 'bP'
        },
        orientation: 'white',
        reconciledFromMoveList: false,
        sharing: { allowed: true, reason: 'analysis-page' },
        evidence: []
      })
    });

    expect(document.querySelector('[data-chesscom-attack-balance-badge="true"]')).toBeNull();
  });
```

Update existing inline `settings` objects in `tests/content/index.test.ts` only if TypeScript requires the new property.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/extension/settings.test.ts tests/content/index.test.ts`

Expected: FAIL because `attackBalanceOverlay` does not exist or cleanup is not wired.

- [ ] **Step 3: Implement settings and publishing integration**

In `src/extension/settings.ts`, add the field to the interface, default, and normalizer:

```ts
export interface ExtensionSettings {
  enabled: boolean;
  debug: boolean;
  pinOverlay: boolean;
  forkOverlay: boolean;
  attackBalanceOverlay: boolean;
  debounceMs: number;
  fallbackMs: number;
}
```

```ts
export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  enabled: true,
  debug: false,
  pinOverlay: true,
  forkOverlay: true,
  attackBalanceOverlay: true,
  debounceMs: 150,
  fallbackMs: 5000
};
```

```ts
attackBalanceOverlay: value.attackBalanceOverlay ?? DEFAULT_EXTENSION_SETTINGS.attackBalanceOverlay,
```

In `src/content/index.ts`, import and wire the overlay:

```ts
import { removeAttackBalanceOverlay, updateAttackBalanceOverlay } from './attackBalanceOverlay';
```

```ts
  if (settings.attackBalanceOverlay) {
    updateAttackBalanceOverlay(result);
  } else {
    removeAttackBalanceOverlay();
  }
```

Also call `removeAttackBalanceOverlay()` inside `startWithSettings` cleanup next to existing overlay removals.

- [ ] **Step 4: Run settings and integration tests and verify GREEN**

Run: `npx vitest run tests/extension/settings.test.ts tests/content/index.test.ts`

Expected: PASS.

---

### Task 4: Full Verification

**Files:**
- No new source files.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: build succeeds and all Vitest tests pass.

- [ ] **Step 2: Inspect git diff**

Run: `git diff -- src tests docs/superpowers/plans/2026-06-05-attack-balance-overlay.md`

Expected: diff only contains analyzer, overlay, settings, integration tests, and this plan.

- [ ] **Step 3: Commit implementation**

```bash
git add src tests docs/superpowers/plans/2026-06-05-attack-balance-overlay.md
git commit -m "Add attack balance overlay"
```

Expected: commit succeeds without staging unrelated untracked files.
