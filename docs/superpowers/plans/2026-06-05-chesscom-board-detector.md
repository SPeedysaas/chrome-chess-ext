# Chess.com Board Detector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser extension content-script detector that reads the visible Chess.com board, classifies live/replay/analysis mode, and manually detects real-time live-game positions locally while blocking live-game sharing/export.

**Architecture:** The content script owns all page observation and detection. `ModeDetector` runs first, `ManualLiveDetector` handles active real-time games by reading the visible board directly, replay/analysis pages use the normal board and move-list pipeline, and `ShareController` gates every outbound result. Live and unknown modes may update local state but cannot export position, move list, or full game data.

**Tech Stack:** Browser extension Manifest V3, TypeScript, Vitest, jsdom fixtures, `chess.js` for move-list reconstruction.

---

## File Structure

- Create: `package.json` - npm scripts and dependencies.
- Create: `tsconfig.json` - strict TypeScript build settings.
- Create: `vitest.config.ts` - Vitest configuration with jsdom.
- Create: `manifest.json` - Manifest V3 extension entry points for Chess.com.
- Create: `src/content/index.ts` - content-script bootstrap and detection-cycle wiring.
- Create: `src/content/pageWatcher.ts` - `MutationObserver` and debounce scheduling.
- Create: `src/detector/types.ts` - shared detector result, mode, evidence, board, and sharing types.
- Create: `src/detector/selectors.ts` - isolated Chess.com DOM selector candidates.
- Create: `src/detector/modeDetector.ts` - live/replay/analysis/unknown classification.
- Create: `src/detector/shareController.ts` - outbound sharing gate.
- Create: `src/detector/positionFingerprint.ts` - cheap change detection.
- Create: `src/detector/boardReader.ts` - board orientation, piece coordinate parsing, board map, FEN placement.
- Create: `src/detector/manualLiveDetector.ts` - real-time live-game manual board detection path.
- Create: `src/detector/gameCache.ts` - per-game in-memory cache.
- Create: `src/detector/moveListReconciler.ts` - move-list parsing and `chess.js` reconstruction.
- Create: `src/detector/pipeline.ts` - one full detection cycle that coordinates all modules.
- Create: `tests/fixtures/live-game.html` - saved live-game DOM fixture.
- Create: `tests/fixtures/replay-game.html` - saved replay DOM fixture.
- Create: `tests/fixtures/analysis-game.html` - saved analysis DOM fixture.
- Create: `tests/detector/*.test.ts` - focused unit and fixture tests.

## Required Behavior

1. Active real-time games must be detected manually from the visible board in the content script.
2. Manual live-game detection must return local board state and confidence for local extension use.
3. Manual live-game detection must not call Chess.com game export/replay APIs or rely on completed-game retrieval.
4. Live and unknown modes must always block external sharing/export, even when manual detection succeeds.
5. Replay and clearly non-live analysis pages may share only through `ShareController`.
6. Detection must be event-driven with a low-frequency fallback only when mutation observation stops producing changes.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `manifest.json`

- [ ] **Step 1: Create the package and test setup**

Create `package.json`:

```json
{
  "name": "chesscom-board-detector",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "dependencies": {
    "chess.js": "^1.0.0-beta.8"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "types": ["chrome", "vitest/globals"],
    "outDir": "dist"
  },
  "include": ["src", "tests", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
});
```

- [ ] **Step 4: Create extension manifest**

Create `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Chess.com Board Detector",
  "version": "0.1.0",
  "permissions": ["storage"],
  "host_permissions": ["https://www.chess.com/*"],
  "content_scripts": [
    {
      "matches": ["https://www.chess.com/*"],
      "js": ["dist/content/index.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 5: Install dependencies and verify tooling**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

Run: `npm test`

Expected: Vitest starts and reports no tests found or no matching tests before test files exist.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts manifest.json
git commit -m "chore: scaffold chess detector extension"
```

---

### Task 2: Shared Types and Sharing Gate

**Files:**
- Create: `src/detector/types.ts`
- Create: `src/detector/shareController.ts`
- Test: `tests/detector/shareController.test.ts`

- [ ] **Step 1: Write failing sharing-gate tests**

Create `tests/detector/shareController.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decideSharing } from '../../src/detector/shareController';

describe('decideSharing', () => {
  it('blocks active live games even when local manual detection succeeds', () => {
    expect(decideSharing({ mode: 'live', confidence: 0.95, evidence: ['running-clock'] })).toEqual({
      allowed: false,
      reason: 'live-game'
    });
  });

  it('blocks unknown mode by default', () => {
    expect(decideSharing({ mode: 'unknown', confidence: 0.2, evidence: [] })).toEqual({
      allowed: false,
      reason: 'unknown-mode'
    });
  });

  it('allows confident replay pages', () => {
    expect(decideSharing({ mode: 'replay', confidence: 0.9, evidence: ['replay-controls'] })).toEqual({
      allowed: true,
      reason: 'replay-page'
    });
  });

  it('allows confident non-live analysis pages', () => {
    expect(decideSharing({ mode: 'analysis', confidence: 0.86, evidence: ['analysis-tab', 'no-live-controls'] })).toEqual({
      allowed: true,
      reason: 'analysis-page'
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/detector/shareController.test.ts`

Expected: FAIL because `shareController.ts` does not exist.

- [ ] **Step 3: Implement shared types**

Create `src/detector/types.ts`:

```ts
export type PageMode = 'live' | 'replay' | 'analysis' | 'unknown';

export type Orientation = 'white' | 'black';

export type Square =
  | 'a1' | 'b1' | 'c1' | 'd1' | 'e1' | 'f1' | 'g1' | 'h1'
  | 'a2' | 'b2' | 'c2' | 'd2' | 'e2' | 'f2' | 'g2' | 'h2'
  | 'a3' | 'b3' | 'c3' | 'd3' | 'e3' | 'f3' | 'g3' | 'h3'
  | 'a4' | 'b4' | 'c4' | 'd4' | 'e4' | 'f4' | 'g4' | 'h4'
  | 'a5' | 'b5' | 'c5' | 'd5' | 'e5' | 'f5' | 'g5' | 'h5'
  | 'a6' | 'b6' | 'c6' | 'd6' | 'e6' | 'f6' | 'g6' | 'h6'
  | 'a7' | 'b7' | 'c7' | 'd7' | 'e7' | 'f7' | 'g7' | 'h7'
  | 'a8' | 'b8' | 'c8' | 'd8' | 'e8' | 'f8' | 'g8' | 'h8';

export type PieceCode =
  | 'wP' | 'wN' | 'wB' | 'wR' | 'wQ' | 'wK'
  | 'bP' | 'bN' | 'bB' | 'bR' | 'bQ' | 'bK';

export type BoardMap = Partial<Record<Square, PieceCode>>;

export interface ModeResult {
  mode: PageMode;
  confidence: number;
  evidence: string[];
}

export interface SharingDecision {
  allowed: boolean;
  reason: 'live-game' | 'unknown-mode' | 'low-confidence' | 'replay-page' | 'analysis-page';
}

export interface BoardReadResult {
  board: BoardMap;
  fenPlacement: string;
  orientation: Orientation;
  confidence: number;
  source: 'board-dom' | 'manual-live-board-dom' | 'move-list';
  evidence: string[];
}

export interface DetectorResult {
  status: 'ok' | 'no-board' | 'low-confidence';
  gameId: string;
  mode: PageMode;
  modeConfidence: number;
  board?: BoardMap;
  fenPlacement?: string;
  boardConfidence?: number;
  moveIndex?: number;
  orientation?: Orientation;
  source?: BoardReadResult['source'];
  reconciledFromMoveList: boolean;
  sharing: SharingDecision;
  evidence: string[];
}
```

- [ ] **Step 4: Implement sharing gate**

Create `src/detector/shareController.ts`:

```ts
import type { ModeResult, SharingDecision } from './types';

const MIN_SHARE_CONFIDENCE = 0.8;

export function decideSharing(mode: ModeResult): SharingDecision {
  if (mode.mode === 'live') {
    return { allowed: false, reason: 'live-game' };
  }

  if (mode.mode === 'unknown') {
    return { allowed: false, reason: 'unknown-mode' };
  }

  if (mode.confidence < MIN_SHARE_CONFIDENCE) {
    return { allowed: false, reason: 'low-confidence' };
  }

  if (mode.mode === 'replay') {
    return { allowed: true, reason: 'replay-page' };
  }

  return { allowed: true, reason: 'analysis-page' };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/detector/shareController.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/detector/types.ts src/detector/shareController.ts tests/detector/shareController.test.ts
git commit -m "feat: add mode-based sharing gate"
```

---

### Task 3: Board Reader

**Files:**
- Create: `src/detector/selectors.ts`
- Create: `src/detector/boardReader.ts`
- Test: `tests/detector/boardReader.test.ts`

- [ ] **Step 1: Write failing board-reader tests**

Create `tests/detector/boardReader.test.ts` with fixture HTML that includes a `chess-board` element and piece nodes using Chess.com-style classes such as `wp square-12` and `bk square-85`.

Expected assertions:

```ts
expect(result?.orientation).toBe('white');
expect(result?.board.a2).toBe('wP');
expect(result?.board.e8).toBe('bK');
expect(result?.source).toBe('board-dom');
expect(result?.confidence).toBeGreaterThan(0.8);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/detector/boardReader.test.ts`

Expected: FAIL because `boardReader.ts` does not exist.

- [ ] **Step 3: Implement selectors**

Create `src/detector/selectors.ts`:

```ts
export const selectors = {
  board: ['chess-board', 'wc-chess-board', '.board', '[data-board-id]'],
  pieces: ['.piece', '[class*="square-"]'],
  liveControls: ['button[aria-label*="Resign" i]', 'button[aria-label*="Draw" i]', '.clock-player-turn'],
  replayControls: ['button[aria-label*="Previous" i]', 'button[aria-label*="Next" i]', '.move-list-controls'],
  analysisControls: ['[data-cy*="analysis" i]', '.analysis-layout', '.review']
} as const;
```

- [ ] **Step 4: Implement board reading**

Create `src/detector/boardReader.ts` with functions:

```ts
export function readBoard(root: ParentNode = document, source: BoardReadResult['source'] = 'board-dom'): BoardReadResult | null
export function squareFromChessComClass(squareClass: string, orientation: Orientation): Square | null
export function fenPlacementFromBoard(board: BoardMap): string
```

Implementation rules:

- Find the first board element from `selectors.board`.
- Treat a board with class `flipped` or `orientation-black` as black orientation; otherwise white.
- Parse piece color/type from two-letter classes like `wp`, `bk`, or expanded classes like `white pawn`.
- Parse square classes matching `/square-(\d)(\d)/`.
- For white orientation, file `1` maps to `a` and rank `1` maps to `1`.
- For black orientation, reverse both file and rank.
- Build FEN placement from rank 8 down to rank 1.
- Confidence is `0.95` for 2-32 valid pieces, `0.55` for 1 valid piece, and `0` for no board or no pieces.

- [ ] **Step 5: Run board-reader tests**

Run: `npm test -- tests/detector/boardReader.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/detector/selectors.ts src/detector/boardReader.ts tests/detector/boardReader.test.ts
git commit -m "feat: read visible chesscom board"
```

---

### Task 4: Manual Real-Time Live Detection

**Files:**
- Create: `src/detector/manualLiveDetector.ts`
- Test: `tests/detector/manualLiveDetector.test.ts`

- [ ] **Step 1: Write failing manual-live tests**

Create `tests/detector/manualLiveDetector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectManualLivePosition } from '../../src/detector/manualLiveDetector';

describe('detectManualLivePosition', () => {
  it('manually reads the visible board during a real-time live game', () => {
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

    const result = detectManualLivePosition(document, {
      mode: 'live',
      confidence: 0.92,
      evidence: ['running-clock', 'resign-button']
    });

    expect(result?.source).toBe('manual-live-board-dom');
    expect(result?.board.a2).toBe('wP');
    expect(result?.confidence).toBeGreaterThan(0.8);
    expect(result?.evidence).toContain('manual-live-detection');
  });

  it('does not run manual live detection on replay pages', () => {
    const result = detectManualLivePosition(document, {
      mode: 'replay',
      confidence: 0.91,
      evidence: ['replay-controls']
    });

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/detector/manualLiveDetector.test.ts`

Expected: FAIL because `manualLiveDetector.ts` does not exist.

- [ ] **Step 3: Implement manual live detector**

Create `src/detector/manualLiveDetector.ts`:

```ts
import { readBoard } from './boardReader';
import type { BoardReadResult, ModeResult } from './types';

export function detectManualLivePosition(root: ParentNode, mode: ModeResult): BoardReadResult | null {
  if (mode.mode !== 'live') {
    return null;
  }

  const board = readBoard(root, 'manual-live-board-dom');
  if (!board) {
    return null;
  }

  return {
    ...board,
    evidence: [...board.evidence, 'manual-live-detection']
  };
}
```

- [ ] **Step 4: Run manual-live tests**

Run: `npm test -- tests/detector/manualLiveDetector.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/detector/manualLiveDetector.ts tests/detector/manualLiveDetector.test.ts
git commit -m "feat: manually detect live game positions"
```

---

### Task 5: Mode Detector

**Files:**
- Create: `src/detector/modeDetector.ts`
- Test: `tests/detector/modeDetector.test.ts`

- [ ] **Step 1: Write failing mode tests**

Create tests that prove:

- running clocks plus resign/draw controls classify as `live`;
- replay navigation controls classify as `replay`;
- analysis/review container without live controls classifies as `analysis`;
- no strong signals classifies as `unknown`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/detector/modeDetector.test.ts`

Expected: FAIL because `modeDetector.ts` does not exist.

- [ ] **Step 3: Implement mode detection**

Create `src/detector/modeDetector.ts` with:

```ts
export function detectMode(root: ParentNode = document): ModeResult
```

Implementation rules:

- Score live evidence from visible resign/draw controls, active clock text, playable board state, and absence of game-over controls.
- Score replay evidence from previous/next move controls, game-over/rematch/new-game controls, and completed-game panels.
- Score analysis evidence from analysis/review tab or layout signals and absence of live controls.
- Return the highest scoring mode with confidence between `0` and `1`.
- If the best score is below `0.45`, return `unknown`.
- Include concrete evidence strings such as `resign-button`, `draw-button`, `running-clock`, `replay-controls`, `analysis-layout`.

- [ ] **Step 4: Run mode tests**

Run: `npm test -- tests/detector/modeDetector.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/detector/modeDetector.ts tests/detector/modeDetector.test.ts
git commit -m "feat: classify chesscom page mode"
```

---

### Task 6: Detection Pipeline With Live Manual Path

**Files:**
- Create: `src/detector/positionFingerprint.ts`
- Create: `src/detector/gameCache.ts`
- Create: `src/detector/pipeline.ts`
- Test: `tests/detector/pipeline.test.ts`

- [ ] **Step 1: Write failing pipeline tests**

Create tests that prove:

- `live` mode calls `detectManualLivePosition`, returns `source: "manual-live-board-dom"`, updates local cache, and returns `sharing.allowed: false`.
- `replay` mode reads the board through normal `readBoard`, returns `source: "board-dom"`, and allows sharing when confidence is high.
- unchanged fingerprints skip full parsing and return cached state.
- `unknown` mode blocks sharing and does not export data.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/detector/pipeline.test.ts`

Expected: FAIL because `pipeline.ts` does not exist.

- [ ] **Step 3: Implement fingerprint and cache**

Create `positionFingerprint.ts`:

```ts
export interface PositionFingerprint {
  gameId: string;
  orientationText: string;
  pieceText: string;
  moveListText: string;
  controlText: string;
  clockText: string;
}

export function buildFingerprint(root: ParentNode, gameId: string): PositionFingerprint
export function sameFingerprint(a: PositionFingerprint | undefined, b: PositionFingerprint): boolean
```

Create `gameCache.ts`:

```ts
export interface GameCacheEntry {
  fingerprint?: PositionFingerprint;
  result?: DetectorResult;
  updatedAt: number;
}

export class GameCache {
  get(gameId: string): GameCacheEntry | undefined
  set(gameId: string, entry: GameCacheEntry): void
}
```

- [ ] **Step 4: Implement pipeline**

Create `pipeline.ts`:

```ts
export interface DetectionPipelineOptions {
  root?: ParentNode;
  url?: string;
  now?: () => number;
}

export function runDetectionCycle(cache: GameCache, options?: DetectionPipelineOptions): DetectorResult
```

Pipeline order:

1. Derive `gameId` from URL path or use `unknown-game`.
2. Run `detectMode`.
3. Run `decideSharing`.
4. Build `PositionFingerprint`.
5. If fingerprint unchanged and cache exists, return cached result with the new sharing decision.
6. If mode is `live`, call `detectManualLivePosition`.
7. If mode is not `live`, call `readBoard`.
8. If no board is found, return `status: "no-board"` with sharing decision.
9. Store the result in `GameCache`.
10. Return `DetectorResult`.

Important live-game rule:

```ts
if (mode.mode === 'live') {
  boardResult = detectManualLivePosition(root, mode);
  // This local read is allowed, but sharing remains blocked by ShareController.
}
```

- [ ] **Step 5: Run pipeline tests**

Run: `npm test -- tests/detector/pipeline.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/detector/positionFingerprint.ts src/detector/gameCache.ts src/detector/pipeline.ts tests/detector/pipeline.test.ts
git commit -m "feat: wire detection pipeline with live manual path"
```

---

### Task 7: Page Watcher and Content Bootstrap

**Files:**
- Create: `src/content/pageWatcher.ts`
- Create: `src/content/index.ts`
- Test: `tests/content/pageWatcher.test.ts`

- [ ] **Step 1: Write failing watcher tests**

Create tests that prove:

- multiple mutations within 150 ms trigger one detection cycle;
- mutations outside the board/control/move-list roots do not trigger unnecessary scans when watched roots are present;
- a fallback timer can trigger detection after several seconds when no mutations arrive.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/content/pageWatcher.test.ts`

Expected: FAIL because `pageWatcher.ts` does not exist.

- [ ] **Step 3: Implement watcher**

Create `src/content/pageWatcher.ts`:

```ts
export interface PageWatcherOptions {
  debounceMs: number;
  fallbackMs: number;
  onChange: () => void;
}

export class PageWatcher {
  constructor(options: PageWatcherOptions)
  start(root?: ParentNode): void
  stop(): void
}
```

Implementation rules:

- Use `MutationObserver`.
- Observe the best available board/control/move-list containers.
- Debounce with default `150` ms.
- Use fallback interval default `5000` ms.
- Never make chess-specific mode or sharing decisions inside `PageWatcher`.

- [ ] **Step 4: Implement bootstrap**

Create `src/content/index.ts`:

```ts
import { PageWatcher } from './pageWatcher';
import { GameCache } from '../detector/gameCache';
import { runDetectionCycle } from '../detector/pipeline';

const cache = new GameCache();

const watcher = new PageWatcher({
  debounceMs: 150,
  fallbackMs: 5000,
  onChange: () => {
    const result = runDetectionCycle(cache);
    window.dispatchEvent(new CustomEvent('chesscom-board-detector:result', { detail: result }));
  }
});

watcher.start();
```

- [ ] **Step 5: Run watcher tests and typecheck**

Run: `npm test -- tests/content/pageWatcher.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/content/pageWatcher.ts src/content/index.ts tests/content/pageWatcher.test.ts
git commit -m "feat: observe chesscom page changes"
```

---

### Task 8: Move-List Reconciliation for Non-Live Pages

**Files:**
- Create: `src/detector/moveListReconciler.ts`
- Test: `tests/detector/moveListReconciler.test.ts`

- [ ] **Step 1: Write failing reconciler tests**

Create tests that prove:

- replay move text can reconstruct a final FEN with `chess.js`;
- incomplete or ambiguous move text returns a failed reconciliation result;
- reconciliation is not used to export active live-game state.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/detector/moveListReconciler.test.ts`

Expected: FAIL because `moveListReconciler.ts` does not exist.

- [ ] **Step 3: Implement reconciler**

Create `src/detector/moveListReconciler.ts`:

```ts
export interface ReconciliationResult {
  ok: boolean;
  fen?: string;
  moveIndex?: number;
  reason?: 'empty-move-list' | 'invalid-san' | 'live-mode-blocked';
}

export function reconcileMoveList(root: ParentNode, mode: PageMode): ReconciliationResult
```

Implementation rules:

- If `mode` is `live` or `unknown`, return `{ ok: false, reason: 'live-mode-blocked' }`.
- Parse visible SAN move text from move-list rows.
- Replay moves through `new Chess()`.
- Return final FEN and move index when every move applies cleanly.
- Return `invalid-san` when any move fails.

- [ ] **Step 4: Run reconciler tests**

Run: `npm test -- tests/detector/moveListReconciler.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/detector/moveListReconciler.ts tests/detector/moveListReconciler.test.ts
git commit -m "feat: reconcile replay move lists"
```

---

### Task 9: Fixture and Manual Browser Verification

**Files:**
- Create: `tests/fixtures/live-game.html`
- Create: `tests/fixtures/replay-game.html`
- Create: `tests/fixtures/analysis-game.html`
- Modify: `tests/detector/modeDetector.test.ts`
- Modify: `tests/detector/pipeline.test.ts`

- [ ] **Step 1: Add fixtures**

Create fixture files with representative DOM snippets for live, replay, and analysis/review pages. The live fixture must include:

```html
<chess-board>
  <div class="piece wp square-12"></div>
  <div class="piece wk square-15"></div>
  <div class="piece bk square-85"></div>
</chess-board>
<button aria-label="Resign"></button>
<button aria-label="Offer Draw"></button>
<div class="clock-player-turn">04:31</div>
```

- [ ] **Step 2: Add fixture-based tests**

Update mode and pipeline tests to load each fixture and assert:

- live fixture returns `mode: "live"`;
- live fixture returns `source: "manual-live-board-dom"`;
- live fixture returns `sharing.allowed: false`;
- replay fixture returns `sharing.allowed: true`;
- analysis fixture returns `sharing.allowed: true` only when no live controls are present.

- [ ] **Step 3: Run full automated verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Perform manual Chrome verification**

Build:

```bash
npm run build
```

Load the unpacked extension from the repository root in Chrome.

Manual checks:

- On a real-time Chess.com game, open DevTools and listen for `chesscom-board-detector:result`.
- Confirm the result has `mode: "live"`.
- Confirm the result has `source: "manual-live-board-dom"`.
- Confirm the visible pieces match the emitted board map.
- Confirm `sharing.allowed` is `false`.
- On a finished replay page, confirm replay detection and allowed replay sharing.
- On an analysis/review page, confirm sharing is allowed only when live controls are absent.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures tests/detector/modeDetector.test.ts tests/detector/pipeline.test.ts
git commit -m "test: cover live manual detection fixtures"
```

---

## Self-Review

- Spec coverage: The plan covers mode detection, event-driven watching, fingerprinting, board reading, game cache, move-list reconciliation, sharing gate, and diagnostics through evidence strings.
- Manual real-time detection coverage: Task 4 and Task 6 explicitly require live games to use manual visible-board detection through `ManualLiveDetector`, with `source: "manual-live-board-dom"`, while `ShareController` keeps live sharing/export blocked.
- Placeholder scan: No steps rely on `TBD`, unspecified edge handling, or unnamed future work.
- Type consistency: `PageMode`, `ModeResult`, `BoardReadResult`, `DetectorResult`, and `SharingDecision` are defined before modules use them.
