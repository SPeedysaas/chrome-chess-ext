import { describe, expect, it } from 'vitest';
import { DEFAULT_EXTENSION_SETTINGS, normalizeExtensionSettings } from '../../src/extension/settings';

describe('extension settings', () => {
  it('uses safe defaults when storage has no customization', () => {
    expect(normalizeExtensionSettings()).toEqual(DEFAULT_EXTENSION_SETTINGS);
  });

  it('normalizes stored customization and clamps timer values', () => {
    expect(normalizeExtensionSettings({
      enabled: false,
      debug: true,
      pinOverlay: true,
      debounceMs: -1,
      fallbackMs: 120000
    })).toEqual({
      enabled: false,
      debug: true,
      pinOverlay: true,
      forkOverlay: true,
      attackBalanceOverlay: true,
      evalBar: true,
      evalTopMoves: 3,
      showTopMoves: true,
      showMovesButton: true,
      showOpponentMovesOnly: false,
      topMovesScale: 100,
      liveMoveAlert: true,
      debounceMs: 0,
      fallbackMs: 60000
    });
  });

  it('allows immediate debounce scheduling', () => {
    expect(normalizeExtensionSettings({ debounceMs: 0 }).debounceMs).toBe(0);
  });

  it('enables pin badges by default', () => {
    expect(normalizeExtensionSettings().pinOverlay).toBe(true);
  });

  it('enables fork highlights by default', () => {
    expect(normalizeExtensionSettings().forkOverlay).toBe(true);
  });

  it('enables attack balance badges by default', () => {
    expect(normalizeExtensionSettings().attackBalanceOverlay).toBe(true);
  });

  it('preserves stored attack balance overlay customization', () => {
    expect(normalizeExtensionSettings({ attackBalanceOverlay: false }).attackBalanceOverlay).toBe(false);
  });

  it('enables live move alerts by default and preserves customization', () => {
    expect(normalizeExtensionSettings().liveMoveAlert).toBe(true);
    expect(normalizeExtensionSettings({ liveMoveAlert: false }).liveMoveAlert).toBe(false);
  });

  it('enables the eval bar by default and preserves customization', () => {
    expect(normalizeExtensionSettings().evalBar).toBe(true);
    expect(normalizeExtensionSettings({ evalBar: false }).evalBar).toBe(false);
  });

  it('defaults top moves to 3 and clamps customization from 1 to 10', () => {
    expect(normalizeExtensionSettings().evalTopMoves).toBe(3);
    expect(normalizeExtensionSettings({ evalTopMoves: 1 }).evalTopMoves).toBe(1);
    expect(normalizeExtensionSettings({ evalTopMoves: 10 }).evalTopMoves).toBe(10);
    expect(normalizeExtensionSettings({ evalTopMoves: 0 }).evalTopMoves).toBe(1);
    expect(normalizeExtensionSettings({ evalTopMoves: 99 }).evalTopMoves).toBe(10);
    expect(normalizeExtensionSettings({ evalTopMoves: 4.6 }).evalTopMoves).toBe(5);
  });

  it('shows alternative top moves by default and preserves customization', () => {
    expect(normalizeExtensionSettings().showTopMoves).toBe(true);
    expect(normalizeExtensionSettings({ showTopMoves: false }).showTopMoves).toBe(false);
  });

  it('shows the manual move reveal button by default and preserves customization', () => {
    expect(normalizeExtensionSettings().showMovesButton).toBe(true);
    expect(normalizeExtensionSettings({ showMovesButton: false }).showMovesButton).toBe(false);
  });

  it('keeps opponent-only live move visibility disabled by default and preserves customization', () => {
    expect(normalizeExtensionSettings().showOpponentMovesOnly).toBe(false);
    expect(normalizeExtensionSettings({ showOpponentMovesOnly: true }).showOpponentMovesOnly).toBe(true);
  });

  it('defaults alternative move popup size to 100 and clamps customization from 50 to 300', () => {
    expect(normalizeExtensionSettings().topMovesScale).toBe(100);
    expect(normalizeExtensionSettings({ topMovesScale: 50 }).topMovesScale).toBe(50);
    expect(normalizeExtensionSettings({ topMovesScale: 300 }).topMovesScale).toBe(300);
    expect(normalizeExtensionSettings({ topMovesScale: 1 }).topMovesScale).toBe(50);
    expect(normalizeExtensionSettings({ topMovesScale: 400 }).topMovesScale).toBe(300);
    expect(normalizeExtensionSettings({ topMovesScale: 124.6 }).topMovesScale).toBe(125);
  });
});
