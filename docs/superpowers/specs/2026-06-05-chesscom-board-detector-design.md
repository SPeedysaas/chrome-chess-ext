# Chess.com Board Detector Extension Design

## Goal

Build a browser extension that detects the current Chess.com board position and classifies whether the page is showing a live game, replay, or analysis/review state.

The first implementation should use a hybrid design:

- DOM-based detection for board pieces, controls, clocks, and move list.
- Lightweight visual or layout fallback only where DOM signals are unreliable.
- Mode detection as an early gate before any position or game data can be shared outside the content script.
- Event-driven updates so the extension does not scan constantly.
- Temporary per-game cache so the extension remembers what it has already seen.
- Move-list reconciliation so missed page updates can be recovered.

Live games must be treated differently from replay/review pages. If the page is replay/review, the extension can share the current replay position for downstream features such as retrieving or reconstructing the completed game moves trough the official chess.com feature. If a game is currently going on the position has to be detected manually.

## Target Pages

The extension should target Chess.com game pages such as:

- Live game pages.
- Finished game replay pages.
- Analysis/review pages that show the board and move list.

The extension should ignore pages where no Chess.com board is visible.

## Core Concepts

### Debouncing

Debouncing means waiting briefly before reacting to page changes. Chess.com may update many DOM nodes for a single move: piece animation, clock text, highlighted squares, captured pieces, and move list rows. The extension should wait about 100-200 ms after the last relevant mutation, then run one detection cycle.

### Position Fingerprint

A position fingerprint is a cheap summary of the page state. It is used to decide whether full board parsing is needed.

The fingerprint should include:

- Game id or URL-derived id.
- Board orientation.
- Piece element count.
- Piece class/style snapshot.
- Move number or visible move-list length.
- Active replay/control state.
- Clock visibility or clock text summary.

If the fingerprint is unchanged, the extension skips full board extraction.

### Game Cache

The game cache is short-term memory for the current tab/game. It should store:

- Game id.
- Last detected FEN or board map.
- Last move index.
- Parsed move list.
- Board orientation.
- Detected page mode: live, replay, analysis, or unknown.
- Confidence score and last update time.

The cache can start in memory. If needed, mirror it to `chrome.storage.session` so it survives extension service-worker restarts during the same browser session.

### Sharing Gate

The sharing gate decides whether position or game data is allowed to leave the page context.

Rules:

- `live`: do not share/export position, move list, or full game.
- `replay`: sharing the current replay position is allowed.
- `analysis`: sharing is allowed only when the page is clearly not an active live game.
- `unknown`: default to blocked.

This gate should use `ModeDetector` output and require enough confidence before allowing any export.

## Modules

### PageWatcher

Watches the Chess.com page for relevant changes using `MutationObserver`.

Responsibilities:

- Find stable root elements for the board, clocks, move list, and game controls.
- Watch only relevant page areas where possible.
- Schedule detection after mutations using debouncing.
- Avoid chess-specific decisions.

### ModeDetector

Classifies the page mode as early as possible.

Responsibilities:

- Detect live-game controls such as active clocks, draw/resign buttons, and currently playable state.
- Detect replay/review controls such as back/forward move buttons, rematch/new game buttons, game-over panels, and analysis tabs.
- Combine signals into `live`, `replay`, `analysis`, or `unknown`.
- Return confidence and evidence, not just a boolean.
- Run before any external sharing/export decision.

### PositionFingerprint

Quickly decides whether the page changed enough to justify full parsing.

Responsibilities:

- Build a small state summary from board/control/move-list signals.
- Compare the new fingerprint with the cached one.
- Return "unchanged", "changed", or "unknown".

### BoardReader

Extracts the visible board position.

Responsibilities:

- Detect board orientation.
- Locate piece elements.
- Convert piece coordinates into chess squares.
- Produce a board map and FEN placement.
- Return confidence based on whether the board and piece count look valid.

### GameCache

Stores the current game state seen by the extension.

Responsibilities:

- Keep the latest accepted board state.
- Track the last move index and parsed move list.
- Detect when a page jump probably happened.
- Separate cache entries by tab and game id.

### MoveListReconciler

Repairs missed updates by reading the move list.

Responsibilities:

- Parse the visible Chess.com move list.
- Compare parsed move count with cached move count.
- If moves were missed, replay the move list through a chess rules library such as `chess.js`.
- Replace the cached board state when the reconstructed state is valid.
- Mark reconciliation as failed if move text is incomplete or ambiguous.

### ShareController

Prevents accidental sharing during live games.

Responsibilities:

- Receive mode and confidence from `ModeDetector`.
- Block all position/game sharing when mode is `live` or `unknown`.
- Allow replay-position sharing only when mode is confidently `replay`.
- Allow analysis sharing only when mode is confidently non-live.
- Attach the sharing decision to every published result.

## Data Flow

1. `PageWatcher` observes a relevant DOM mutation.
2. It waits 100-200 ms using debouncing.
3. `ModeDetector` classifies live/replay/analysis state as early as possible.
4. `ShareController` computes whether any position/game sharing is allowed.
5. `PositionFingerprint` builds a cheap snapshot.
6. If unchanged, stop.
7. If changed, `BoardReader` extracts the board position for local state.
8. `GameCache` compares the new result with cached state.
9. If the move index or position jumped unexpectedly, `MoveListReconciler` parses the move list and rebuilds state.
10. The extension publishes the local result with board position, mode, confidence, evidence, and sharing permission.
11. Any external sharing/export path must check `ShareController` first. Live and unknown games stay blocked.

## Result Shape

The detector should return structured data like:

```json
{
  "gameId": "169747037990",
  "mode": "live",
  "modeConfidence": 0.88,
  "fen": "rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2",
  "boardConfidence": 0.94,
  "moveIndex": 1,
  "orientation": "black",
  "source": "board-dom",
  "reconciledFromMoveList": false,
  "sharing": {
    "allowed": false,
    "reason": "live-game"
  },
  "evidence": ["running clocks", "draw button visible", "move list current"]
}
```

## Error Handling

The detector should degrade gracefully:

- If no board is found, report `status: "no-board"`.
- If board extraction is uncertain, keep the last known cache entry but mark the new result as low confidence.
- If mode detection is uncertain, report `unknown` with evidence.
- If mode detection is `live` or `unknown`, block all sharing/export of position and game data.
- If move-list reconciliation fails, keep the direct board read and report the failure reason.
- If Chess.com changes DOM structure, expose enough diagnostic evidence to adjust selectors later.

## Testing Strategy

Use focused tests around the detector modules:

- Unit tests for square coordinate conversion and board orientation.
- Unit tests for fingerprint comparison.
- Unit tests for move-list parsing and reconstruction with `chess.js`.
- Fixture tests using saved HTML snippets for live, replay, and analysis layouts.
- Tests proving live and unknown modes block sharing/export.
- Tests proving replay mode allows only the approved replay-position sharing path.
- Manual browser tests on Chess.com pages to verify board/mode detection and missed-move recovery.

## Implementation Notes

The first version should avoid constant polling. Polling can be used only as a low-frequency fallback, for example every few seconds, if mutation observation fails or the page root changes.

The implementation should be structured so DOM selectors are isolated in one place. Chess.com may change class names or layout, and selector maintenance should not require rewriting the detector logic.

The extension should not make moves or automate gameplay. It only reads visible page state and reports it.

External sharing is explicitly mode-gated. The implementation must default to blocked unless it is confident the page is a replay/review page rather than an active live game.
