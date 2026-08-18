# Lichess PGN Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chess.com replay button that opens Lichess paste import, fills the PGN textbox, requests computer analysis, and submits the form.

**Architecture:** Keep the Chess.com button injector and Lichess paste autofill as separate focused content helpers. The Chess.com page stores one pending PGN import in `chrome.storage.local`, opens `https://lichess.org/paste#chesscom-import=<id>`, and the Lichess content script consumes that id to fill and submit the import form.

**Tech Stack:** Chrome extension Manifest V3, TypeScript, Vitest, jsdom.

---

### Task 1: Chess.com Lichess Button

**Files:**
- Create: `src/content/lichessImportButton.ts`
- Test: `tests/content/lichessImportButton.test.ts`

- [ ] Write a failing test that injects a Lichess button when a replay detection result includes PGN.
- [ ] Write a failing test that clicking the button stores the PGN in `chrome.storage.local` and opens a Lichess paste tab.
- [ ] Implement the button module with idempotent rendering.
- [ ] Run `npm test -- tests/content/lichessImportButton.test.ts`.

### Task 2: Lichess Paste Autofill

**Files:**
- Create: `src/content/lichessPasteImport.ts`
- Test: `tests/content/lichessPasteImport.test.ts`

- [ ] Write a failing test that reads the import id from the URL hash.
- [ ] Write a failing test that fills the PGN textarea, ticks computer analysis, clicks the import button, and removes the consumed storage item.
- [ ] Implement the paste import helper with conservative selectors and retry scheduling for delayed Lichess forms.
- [ ] Run `npm test -- tests/content/lichessPasteImport.test.ts`.

### Task 3: Extension Wiring

**Files:**
- Modify: `src/content/index.ts`
- Modify: `manifest.json`

- [ ] Write or update tests for detector integration and manifest host/content script coverage.
- [ ] Call the button updater after each Chess.com detection cycle.
- [ ] Add the Lichess paste content script and storage permission/host access to the manifest.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
