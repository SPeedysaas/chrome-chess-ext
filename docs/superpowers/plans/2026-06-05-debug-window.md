# Debug Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tiny debug preview with an accessible on-page debug window that opens by hotkey or floating button and can display player names.

**Architecture:** Keep the feature in the content script. Extend `DetectorResult` with optional player metadata populated from Chess.com share-dialog PGN headers, and render the debug UI from `src/content/debugPreview.ts` so the existing `startChessComBoardDetector` debug path remains unchanged.

**Tech Stack:** TypeScript, Chrome MV3 content script, DOM APIs, Vitest with jsdom.

---

### Task 1: Player Metadata Extraction

**Files:**
- Modify: `src/detector/types.ts`
- Modify: `src/detector/chessComShareExtractor.ts`
- Modify: `src/detector/pipeline.ts`
- Test: `tests/detector/chessComShareExtractor.test.ts`
- Test: `tests/detector/pipeline.test.ts`

- [ ] **Step 1: Write failing tests**

Add expectations that `[White "..."]` and `[Black "..."]` PGN headers become `players.white.name` and `players.black.name`.

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/detector/chessComShareExtractor.test.ts tests/detector/pipeline.test.ts`
Expected: FAIL because `players` is not present.

- [ ] **Step 3: Implement metadata flow**

Add `PlayerInfo`, `GamePlayers`, and optional `players` to `DetectorResult`. Parse PGN headers in `extractChessComShareGame`, then copy `shareGame.players` into the share-result branch in `pipeline.ts`.

- [ ] **Step 4: Verify green**

Run: `npm test -- tests/detector/chessComShareExtractor.test.ts tests/detector/pipeline.test.ts`
Expected: PASS.

### Task 2: Debug Window UI

**Files:**
- Modify: `src/content/debugPreview.ts`
- Test: `tests/content/debugPreview.test.ts`
- Test: `tests/content/index.test.ts`

- [ ] **Step 1: Write failing tests**

Assert that rendering debug creates `role="dialog"`, includes player names, includes a floating toggle button, closes and opens by button, and toggles on `Alt+Shift+D`.

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/content/debugPreview.test.ts tests/content/index.test.ts`
Expected: FAIL because the current preview is a static `<pre>` and has no toggle behavior.

- [ ] **Step 3: Implement UI**

Render a fixed debug button plus a fixed dialog with overview metrics, current result fields, player names, actions, evidence, and raw JSON. Store the latest result so reopening restores current debug data. Register the hotkey once.

- [ ] **Step 4: Verify green**

Run: `npm test -- tests/content/debugPreview.test.ts tests/content/index.test.ts`
Expected: PASS.

### Task 3: Full Verification

**Files:**
- Existing project files only.

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS and `dist/` updates successfully.
