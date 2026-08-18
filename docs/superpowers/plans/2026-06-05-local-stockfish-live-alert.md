# Local Stockfish Live Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Stockfish-backed Chess.com live-game alert that warns when only a small dynamic band of candidate moves avoids a severe evaluation drop.

**Architecture:** Add focused detector modules for player-color resolution, full-FEN construction, UCI parsing, and move-cliff detection. Add a content-level controller that starts a local Stockfish worker only for live games where the user color and side to move are known, then renders a compact board-adjacent prompt or warning.

**Tech Stack:** TypeScript, Vitest, Chrome MV3 content scripts, Web Workers, UCI Stockfish protocol, `chess.js` for legal move validation and FEN construction.

---

## File Structure

- Create `src/engine/livePlayerColor.ts`: resolve and cache the user color for a live game.
- Create `src/engine/liveFen.ts`: build full FEN from detector board state and inferred side to move.
- Create `src/engine/stockfishUci.ts`: parse UCI `info` and `bestmove` lines.
- Create `src/engine/moveCliff.ts`: detect dynamic top-5-to-10 move cliffs.
- Create `src/engine/localStockfish.ts`: wrap a browser Worker with a typed analyze API.
- Create `src/content/liveMoveAlert.ts`: orchestrate player prompt, engine analysis, and warning UI.
- Modify `src/content/index.ts`: create and update the live alert controller.
- Modify `src/detector/gameCache.ts`: store live user color per game.
- Modify `src/extension/settings.ts`, `popup/index.html`, and `src/popup/index.ts`: add an on/off setting.
- Modify `manifest.json`: expose bundled Stockfish worker asset.
- Add tests under `tests/engine/` and `tests/content/liveMoveAlert.test.ts`.

## Tasks

### Task 1: Player Color Cache

**Files:**
- Modify: `src/detector/gameCache.ts`
- Create: `src/engine/livePlayerColor.ts`
- Test: `tests/engine/livePlayerColor.test.ts`

- [ ] Write tests that `NotAosSpeed` resolves to white or black by name, ignores rating values, compares case-insensitively, returns cached color for the same game, and requires a manual choice when no player matches.
- [ ] Run `node .\node_modules\vitest\vitest.mjs run tests/engine/livePlayerColor.test.ts`; expect failures for missing module.
- [ ] Add `GameCache.getLiveUserColor`, `setLiveUserColor`, and `clearLiveUserColor`.
- [ ] Implement `resolveLiveUserColor(result, cache, username)` and `storeManualLiveUserColor(cache, gameId, color)`.
- [ ] Re-run the test; expect pass.

### Task 2: Full FEN For Live Analysis

**Files:**
- Create: `src/engine/liveFen.ts`
- Test: `tests/engine/liveFen.test.ts`

- [ ] Write tests for building full FEN from `fenPlacement`, user color, and turn UI; include unknown-turn returning null.
- [ ] Run the test; expect failures for missing module.
- [ ] Implement turn inference from active clock/player DOM classes and fallback to move count parity when move sequence exists.
- [ ] Use conservative FEN defaults: `- - 0 1` for castling, en passant, halfmove, fullmove when unknown.
- [ ] Re-run the test; expect pass.

### Task 3: UCI Parsing And Local Engine Adapter

**Files:**
- Create: `src/engine/stockfishUci.ts`
- Create: `src/engine/localStockfish.ts`
- Test: `tests/engine/stockfishUci.test.ts`
- Test: `tests/engine/localStockfish.test.ts`

- [ ] Write UCI parser tests for MultiPV centipawn scores, mate scores, depth, and bestmove.
- [ ] Write adapter tests with a fake worker constructor that receives `uci`, `isready`, `setoption name MultiPV value 8`, `position fen ...`, and `go depth 12`.
- [ ] Run both tests; expect failures for missing modules.
- [ ] Implement UCI parsing with typed `EngineLine` values.
- [ ] Implement `LocalStockfishEngine` with dependency-injected worker creation and a default URL provider using `chrome.runtime.getURL('vendor/stockfish/stockfish.js')`.
- [ ] Re-run both tests; expect pass.

### Task 4: Move Cliff Detection

**Files:**
- Create: `src/engine/moveCliff.ts`
- Test: `tests/engine/moveCliff.test.ts`

- [ ] Write tests for no cliff, two safe moves then a severe drop, dynamic safe band up to 8 moves, and mate-score cliffs.
- [ ] Run the test; expect failures for missing module.
- [ ] Implement `detectMoveCliff(lines, color, thresholds)` with default thresholds: 8 lines, 80cp safe band, 200cp cliff gap.
- [ ] Re-run the test; expect pass.

### Task 5: Alert UI And Controller

**Files:**
- Create: `src/content/liveMoveAlert.ts`
- Test: `tests/content/liveMoveAlert.test.ts`

- [ ] Write tests showing the alert hides outside live games, prompts for color when unknown, starts analysis when color and turn are known, renders "Only N safe moves here", and does not display best moves.
- [ ] Run the test; expect failures for missing module.
- [ ] Implement a controller factory with injectable engine, cache, username, and root.
- [ ] Render the color prompt and warning as board-adjacent absolute elements.
- [ ] Ensure `dispose()` removes UI and stops the engine.
- [ ] Re-run the test; expect pass.

### Task 6: Wire Into Extension

**Files:**
- Modify: `src/content/index.ts`
- Modify: `src/extension/settings.ts`
- Modify: `popup/index.html`
- Modify: `src/popup/index.ts`
- Modify: `manifest.json`
- Test: `tests/content/index.test.ts`
- Test: `tests/extension/settings.test.ts`
- Test: `tests/extension/manifest.test.ts`

- [ ] Write tests that the live alert controller is updated from `publishResult`, can be disabled by settings, and the manifest exposes the Stockfish worker.
- [ ] Run the tests; expect failures.
- [ ] Add `liveMoveAlert` setting defaulting to true and popup checkbox wiring.
- [ ] Create one alert controller per detector start and update it after each detection result.
- [ ] Add `vendor/stockfish/stockfish.js` to `web_accessible_resources`.
- [ ] Re-run the tests; expect pass.

### Task 7: Bundle Asset And Verify

**Files:**
- Add: `vendor/stockfish/stockfish.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `manifest.json`

- [ ] Add a bundled Stockfish worker asset from Stockfish.js or document the expected vendored worker path if the asset is too large for source control.
- [ ] Bump the extension version to `0.6.0`.
- [ ] Run `node .\node_modules\vitest\vitest.mjs run`.
- [ ] Run `node .\node_modules\typescript\bin\tsc -p tsconfig.build.json`.
- [ ] Run `node .\node_modules\esbuild\bin\esbuild src/content/index.ts src/content/lichessPasteImport.ts --bundle --format=iife --target=es2022 --outdir=dist/content`.
