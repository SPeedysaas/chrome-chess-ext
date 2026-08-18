# Eval Bar Design

## Goal

Add an optional Chess.com-style evaluation bar beside the detected board, backed by the extension's local Stockfish engine.

## Behavior

- Add an `evalBar` setting, default enabled.
- Show a popup checkbox labeled `Eval bar`.
- When enabled and a detector result has a valid FEN, render a narrow vertical bar immediately left of the Chess.com board.
- Match the Chess.com visual shape: thin bordered vertical strip, light top, dark bottom, and centered numeric label.
- Update continuously from local Stockfish when possible.
- Remove the bar when disabled, when no usable board/FEN exists, or when the detector stops.

## Scoring

- Centipawn scores display from White's perspective as one decimal place, for example `0.8` or `-1.4`.
- Mate scores display as `M#` or `-M#`.
- Bar fill is clamped so extreme evaluations remain readable.

## Testing

- Settings normalization covers the new default and stored customization.
- Popup tests cover loading/saving the new checkbox.
- Overlay tests cover render, centered number styling, score formatting, clamped fill, and removal.
- Content startup tests cover update/dispose behavior when the option changes.
