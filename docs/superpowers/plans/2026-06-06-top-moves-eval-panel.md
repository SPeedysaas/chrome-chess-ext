# Top Moves Eval Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a configurable `1` to `10` move Stockfish eval list beside the Chess.com board.

**Architecture:** Extend existing extension settings with `evalTopMoves`, wire the popup number input, and pass the normalized count into the existing eval bar controller. The controller will keep using line 1 for the eval bar and render all available MultiPV lines in a separate top-moves panel.

**Tech Stack:** TypeScript, Chrome extension storage, existing `LocalStockfishEngine`, Vitest with jsdom.

---

### Task 1: Add `evalTopMoves` Setting

**Files:**
- Modify: `src/extension/settings.ts`
- Test: `tests/extension/settings.test.ts`

- [ ] Add a failing settings test:

```ts
it('defaults top moves to 3 and clamps customization from 1 to 10', () => {
  expect(normalizeExtensionSettings().evalTopMoves).toBe(3);
  expect(normalizeExtensionSettings({ evalTopMoves: 1 }).evalTopMoves).toBe(1);
  expect(normalizeExtensionSettings({ evalTopMoves: 10 }).evalTopMoves).toBe(10);
  expect(normalizeExtensionSettings({ evalTopMoves: 0 }).evalTopMoves).toBe(1);
  expect(normalizeExtensionSettings({ evalTopMoves: 99 }).evalTopMoves).toBe(10);
  expect(normalizeExtensionSettings({ evalTopMoves: 4.6 }).evalTopMoves).toBe(5);
});
```

- [ ] Run `npx vitest run tests/extension/settings.test.ts` and confirm it fails because `evalTopMoves` is missing.
- [ ] Add `evalTopMoves: number` to `ExtensionSettings`.
- [ ] Add `evalTopMoves: 3` to `DEFAULT_EXTENSION_SETTINGS`.
- [ ] Add min/max constants `1` and `10`.
- [ ] Normalize with `clampNumber(value.evalTopMoves, DEFAULT_EXTENSION_SETTINGS.evalTopMoves, 1, 10)`.
- [ ] Run `npx vitest run tests/extension/settings.test.ts` and confirm it passes.

### Task 2: Wire Popup Input

**Files:**
- Modify: `popup/index.html`
- Modify: `src/popup/index.ts`
- Test: `tests/extension/popupMarkup.test.ts`

- [ ] Add a failing popup markup test:

```ts
it('includes a top moves number option', () => {
  const html = readFileSync('popup/index.html', 'utf8');

  expect(html).toContain('id="evalTopMoves"');
  expect(html).toContain('name="evalTopMoves"');
  expect(html).toContain('Top moves');
  expect(html).toContain('min="1"');
  expect(html).toContain('max="10"');
});
```

- [ ] Run `npx vitest run tests/extension/popupMarkup.test.ts` and confirm it fails because the input is missing.
- [ ] Add a `field-row` below `Eval bar` in `popup/index.html`:

```html
<label class="field-row">
  <span>
    <strong>Top moves</strong>
    <small>How many Stockfish candidate moves to show beside the board</small>
  </span>
  <input id="evalTopMoves" name="evalTopMoves" type="number" min="1" max="10" step="1">
</label>
```

- [ ] In `src/popup/index.ts`, query `#evalTopMoves`, set its value in `applySettings`, and include `evalTopMoves: Number(evalTopMovesInput?.value)` in `readFormSettings`.
- [ ] Run `npx vitest run tests/extension/popupMarkup.test.ts tests/extension/settings.test.ts` and confirm both pass.

### Task 3: Render Top Moves Panel

**Files:**
- Modify: `src/content/evalBar.ts`
- Test: `tests/content/evalBar.test.ts`

- [ ] Add failing tests that create a controller with `{ topMoves: 2 }`, emit three MultiPV lines, and expect only two rows with rank, move, and formatted White-perspective score.
- [ ] Add a failing test that `removeEvalBarOverlay()` removes both the bar and top moves panel.
- [ ] Add `topMoves?: number` to `EvalBarControllerOptions`.
- [ ] Add top-moves DOM attributes and selectors.
- [ ] Construct `LocalStockfishEngine` with `multipv: topMoves`.
- [ ] Add `updateTopMovesOverlay(lines, root, orientation, topMoves)` that positions a compact fixed panel to the right of the board, renders sorted MultiPV rows, and skips rendering when no lines exist.
- [ ] Update `applyLines` to convert each line score through `scoreFromWhitePerspective`, update the existing bar from line 1, and render the top-moves panel from up to `topMoves` lines.
- [ ] Update cleanup paths so invalid positions and dispose remove both overlays.
- [ ] Run `npx vitest run tests/content/evalBar.test.ts` and confirm it passes.

### Task 4: Pass Setting Into Content Controller

**Files:**
- Modify: `src/content/index.ts`
- Test: `tests/content/index.test.ts`

- [ ] Add a failing content startup test using an `evalBarFactory` that captures options and expects `{ topMoves: 7 }`.
- [ ] Change `evalBarFactory` to accept `{ topMoves: number }`.
- [ ] Pass `settings.evalTopMoves` when creating the eval controller.
- [ ] Keep disabled eval behavior disposing the controller.
- [ ] Run `npx vitest run tests/content/index.test.ts` and confirm it passes.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check `git diff --stat` and inspect touched files before the final response.
