# Attack Balance Overlay Design

## Goal

Add a Chess.com board overlay that marks pieces based on the number of attackers relative to their defenders. The visual style should match the existing fork and pin feature family: compact circular badges attached to piece elements.

## Behavior

For every occupied board square:

- Count attackers as opposing pieces that currently attack the piece's square.
- Count defenders as friendly pieces, excluding the piece itself, that currently attack or defend that same square.
- Do not render a badge when both counts are zero.
- Render a balanced badge when attackers equal defenders and the counts are not both zero.
- Render an overloaded badge when attackers are greater than defenders, including `1 attacker / 0 defenders`.
- Do not render a badge when defenders are greater than attackers.

The feature reports exact counts internally and in accessible labels, but the visible badge uses compact symbols:

- `=` for balanced pieces.
- `!` for overloaded pieces.

## Architecture

Add `src/detector/attackBalanceAnalyzer.ts` with a public `findAttackBalanceTactics(board)` function. The analyzer returns sorted tactics with:

- `square`
- `piece`
- `attackers`
- `defenders`
- `state: 'balanced' | 'overloaded'`

The analyzer should use the same board model as existing tactical analyzers: `BoardMap`, `PieceCode`, and `Square`. It should keep attack detection in the analyzer so the behavior is testable without DOM setup.

Add `src/content/attackBalanceOverlay.ts` modeled after `pinOverlay.ts`. It should:

- Remove stale attack-balance badges before rendering.
- Skip rendering unless the detector result is `ok` and includes `board` and `orientation`.
- Locate existing Chess.com piece elements using the same square class convention as current overlays.
- Append one compact badge to each triggered piece element.
- Use a distinct badge attribute so cleanup does not interfere with pin or fork overlays.

## Visual Design

The badge should use the established circular overlay language:

- Absolute positioned in the top-right corner of the piece element.
- White border, circular shape, strong font weight, no pointer events.
- Blue background for balanced `=`.
- Red background for overloaded `!`.

Accessible labels should include the state and counts, for example:

- `Balanced piece: 1 attacker and 1 defender`
- `Overloaded piece: 2 attackers and 1 defender`

## Settings Integration

Add `attackBalanceOverlay: boolean` to `ExtensionSettings`.

Defaults:

- `attackBalanceOverlay: true`

Normalization:

- Preserve stored boolean values.
- Default to `true` when absent.

Publishing:

- `publishResult` should call `updateAttackBalanceOverlay(result)` when the setting is enabled.
- It should call `removeAttackBalanceOverlay()` when disabled.
- Existing pin, fork, debug, and import behavior should remain unchanged.

## Tests

Add analyzer tests covering:

- Balanced state when attackers equal defenders and the count is nonzero.
- Overloaded state when attackers exceed defenders.
- Overloaded state for `1 attacker / 0 defenders`.
- No tactic for `0 attackers / 0 defenders`.
- No tactic when defenders exceed attackers.

Add overlay tests covering:

- Compact `=` and `!` badge text.
- Accessible labels include exact counts.
- Stale badges are removed on refresh.
- No badges render for non-`ok` or incomplete detector results.

Add settings and content integration tests covering:

- `attackBalanceOverlay` defaults to `true`.
- Stored `false` remains false.
- The main detector update path invokes the overlay independently from pin and fork settings.

## Scope

This feature does not add arrows, destination-square markers, move recommendations, or material evaluation. It only marks current pieces whose attacker/defender balance meets the trigger rules.
