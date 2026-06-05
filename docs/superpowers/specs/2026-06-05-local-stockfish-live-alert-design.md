# Local Stockfish Live Alert Design

## Goal

Add a live-game safety alert for Chess.com that runs Stockfish locally, identifies the user's side, and warns when the current position has only a narrow band of acceptable moves before the remaining candidate moves become much worse.

The cached user name is `NotAosSpeed`. Elo text shown near player names is only rating metadata and must not affect player matching.

## Current Context

The extension already detects Chess.com live games, reads the visible board, extracts player names and ratings separately, keeps a per-game cache, and renders board overlays. Live games deliberately block sharing and rely on manual board DOM detection. There is no existing Stockfish or move-evaluation layer.

## Player And Color Detection

For live games, the extension should first try to infer the user's color from the detected players:

- Match `players.white.name` or `players.black.name` against `NotAosSpeed`.
- Compare names case-insensitively after trimming whitespace.
- Ignore `rating` values completely.
- If a match is found, cache the resolved color for the active game.

If the live game is detected but neither player can be matched, show a compact board-adjacent prompt asking whether the user is White or Black. Store the answer in the game cache so the prompt does not repeat for the same game unless the game identity changes.

## Local Stockfish

Stockfish should run inside the extension, not through an external server or native executable. The implementation should use a browser-compatible Stockfish JavaScript/WASM worker asset bundled with the extension and listed as a web-accessible resource if Chrome requires that for worker loading.

The engine lifecycle should be conservative:

- Start only when the page is a live game.
- Start only after the user's color is known.
- Analyze only when it is the user's turn, once that can be inferred from the full FEN.
- Reuse one engine instance per active game where practical.
- Stop or idle the engine when the page leaves a live game, the detector is disabled, or the game identity changes.

The implementation needs a small engine adapter that hides worker messages behind a typed API. The rest of the content code should not parse raw UCI output directly.

## Position Input

The current detector exposes `fenPlacement`, but Stockfish needs a full FEN with side to move, castling, en passant, and counters. For live games, the first implementation should build the best available full FEN from:

- The visible board placement.
- The side to move inferred from Chess.com turn UI when available.
- Conservative defaults for unknown castling, en passant, halfmove, and fullmove fields.

If the side to move cannot be inferred confidently, the engine should not analyze and the alert should stay hidden.

## Move Cliff Detection

Stockfish should produce a ranked candidate list for the current position. The alert should be dynamic across the top 5-10 moves, not hardcoded to only compare the first and second move.

The cliff detector should:

- Normalize evaluations from the user's perspective.
- Treat mate scores as stronger than centipawn scores.
- Define an acceptable move band near the best move.
- Find how many top moves remain inside that acceptable band.
- Warn only when at least one acceptable move exists and the next move group drops sharply.

Initial thresholds should be configurable constants, with tests documenting their behavior:

- Analyze up to 8 principal variations.
- Treat moves within 80 centipawns of the best move as acceptable.
- Warn when the first unacceptable move is at least 200 centipawns worse than the last acceptable move.
- Include mate-score handling so a move that allows forced mate is treated as a severe cliff.

The alert text should avoid telling the user the engine move. It should warn about danger, such as "Only 2 safe moves here", without exposing Stockfish's best move list.

## UI

Render a compact alert on or next to the board, using the same board lookup and positioning conventions as the existing overlays. It should be visible enough to notice during a live game but should not cover pieces or clocks.

States:

- Hidden when not in a live game.
- Hidden when the user color is unknown and the color prompt is shown.
- Hidden while waiting for a stable engine result.
- Warning state when a cliff is detected.
- Quiet state when no cliff is detected; no persistent UI is needed.

The player color prompt should be separate from the warning alert so choosing a color does not look like an engine warning.

## Error Handling

If Stockfish fails to load or returns malformed output, disable the alert for the current page session and surface the failure only in debug output. The extension should continue to run board detection and existing overlays.

If board confidence is low, game mode is not live, or side-to-move is unknown, do not analyze.

## Tests

Add focused unit tests for:

- Player matching ignores Elo and resolves `NotAosSpeed` to the correct color.
- Cached color is reused for a live game.
- Unknown live players require a manual color choice before engine analysis.
- UCI parsing extracts multipv evaluations and moves.
- Cliff detection handles broad safe bands, narrow safe bands, no cliff positions, and mate-score cliffs.
- The alert renderer hides outside live games and renders a warning without leaking best moves.

Integration tests should verify that live-game detection can trigger the engine controller only after player color is known.
