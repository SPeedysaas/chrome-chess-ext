# Top Moves Eval Panel Design

## Goal

Add a configurable board-side panel that shows the evals for the top Stockfish moves in the current Chess.com position.

## Behavior

- Add an `evalTopMoves` setting, default `3`.
- Clamp `evalTopMoves` to an integer from `1` to `10`.
- Add a popup number input labeled `Top moves` with `min="1"`, `max="10"`, and `step="1"`.
- When `Eval bar` is enabled, analyze the current position with Stockfish `MultiPV` set to `evalTopMoves`.
- Keep the existing eval bar driven by the first engine line.
- Render a compact fixed panel near the board showing up to `evalTopMoves` ranked engine lines.
- Remove the panel when eval is disabled, the detector has no usable board/FEN, the game changes, or the controller is disposed.

## Panel Content

Each row shows:

- The line rank.
- The move in UCI notation, such as `e2e4`.
- The score from White's perspective using the existing eval formatting, such as `0.8`, `-1.4`, `M3`, or `-M2`.

The current implementation will not convert UCI moves to SAN. SAN can be added later if the UI needs friendlier move names, but UCI avoids adding move-legality dependencies to this feature.

## Architecture

- Extend `ExtensionSettings` and `DEFAULT_EXTENSION_SETTINGS` with `evalTopMoves`.
- Normalize and clamp the setting in `normalizeExtensionSettings`.
- Wire the popup input through `src/popup/index.ts`.
- Extend `createEvalBarController` options with `topMoves`.
- Construct `LocalStockfishEngine` with `multipv: topMoves`.
- Reuse existing continuous and bounded analysis flows. For each update, filter/sort available `EngineLine` values by `multipv`, limit to `topMoves`, convert scores to White's perspective, update the bar from line 1, and render the panel from all visible lines.
- Add a separate `removeTopMovesOverlay` helper so stale panels are cleaned up alongside the eval bar.

## Data Flow

1. Popup saves `evalTopMoves` to `chrome.storage.sync`.
2. The content script restarts on relevant storage changes.
3. `startChessComBoardDetector` creates the eval controller with the normalized `evalTopMoves` setting.
4. The controller starts Stockfish analysis for the detected FEN.
5. Each engine update refreshes the eval bar and top moves panel if the result is still current.

## Error Handling

- Missing board or invalid FEN removes the panel and leaves no stale DOM.
- Empty engine lines keep the neutral eval bar visible while analysis is pending and do not show a misleading top-moves list.
- Out-of-range or invalid stored values fall back through settings normalization before the controller is created.
- Old asynchronous engine updates are ignored using the existing active analysis id and FEN checks.

## Testing

- Settings tests cover the default value, clamping below `1`, clamping above `10`, rounding, and preserving stored customization.
- Popup markup tests cover the `Top moves` number input.
- Popup script behavior is covered through existing load/save wiring and the new input.
- Eval bar tests cover rendering top move rows, limiting rows to the configured count, removing stale panels, and keeping line scores in White's perspective.
- Content startup tests cover passing `evalTopMoves` into the eval controller.
- Engine tests cover `LocalStockfishEngine` sending the requested `MultiPV` value, using the existing constructor behavior.
