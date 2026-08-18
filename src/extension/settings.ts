export interface ExtensionSettings {
  enabled: boolean;
  debug: boolean;
  pinOverlay: boolean;
  forkOverlay: boolean;
  attackBalanceOverlay: boolean;
  evalBar: boolean;
  evalTopMoves: number;
  showTopMoves: boolean;
  showMovesButton: boolean;
  showOpponentMovesOnly: boolean;
  topMovesScale: number;
  liveMoveAlert: boolean;
  debounceMs: number;
  fallbackMs: number;
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  enabled: true,
  debug: false,
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
  debounceMs: 150,
  fallbackMs: 5000
};

const MIN_EVAL_TOP_MOVES = 1;
const MAX_EVAL_TOP_MOVES = 10;
const MIN_TOP_MOVES_SCALE = 50;
const MAX_TOP_MOVES_SCALE = 300;
const MIN_DEBOUNCE_MS = 0;
const MAX_DEBOUNCE_MS = 1000;
const MIN_FALLBACK_MS = 1000;
const MAX_FALLBACK_MS = 60000;

export function normalizeExtensionSettings(value: Partial<ExtensionSettings> = {}): ExtensionSettings {
  return {
    enabled: value.enabled ?? DEFAULT_EXTENSION_SETTINGS.enabled,
    debug: value.debug ?? DEFAULT_EXTENSION_SETTINGS.debug,
    pinOverlay: value.pinOverlay ?? DEFAULT_EXTENSION_SETTINGS.pinOverlay,
    forkOverlay: value.forkOverlay ?? DEFAULT_EXTENSION_SETTINGS.forkOverlay,
    attackBalanceOverlay: value.attackBalanceOverlay ?? DEFAULT_EXTENSION_SETTINGS.attackBalanceOverlay,
    evalBar: value.evalBar ?? DEFAULT_EXTENSION_SETTINGS.evalBar,
    evalTopMoves: clampNumber(value.evalTopMoves, DEFAULT_EXTENSION_SETTINGS.evalTopMoves, MIN_EVAL_TOP_MOVES, MAX_EVAL_TOP_MOVES),
    showTopMoves: value.showTopMoves ?? DEFAULT_EXTENSION_SETTINGS.showTopMoves,
    showMovesButton: value.showMovesButton ?? DEFAULT_EXTENSION_SETTINGS.showMovesButton,
    showOpponentMovesOnly: value.showOpponentMovesOnly ?? DEFAULT_EXTENSION_SETTINGS.showOpponentMovesOnly,
    topMovesScale: clampNumber(value.topMovesScale, DEFAULT_EXTENSION_SETTINGS.topMovesScale, MIN_TOP_MOVES_SCALE, MAX_TOP_MOVES_SCALE),
    liveMoveAlert: value.liveMoveAlert ?? DEFAULT_EXTENSION_SETTINGS.liveMoveAlert,
    debounceMs: clampNumber(value.debounceMs, DEFAULT_EXTENSION_SETTINGS.debounceMs, MIN_DEBOUNCE_MS, MAX_DEBOUNCE_MS),
    fallbackMs: clampNumber(value.fallbackMs, DEFAULT_EXTENSION_SETTINGS.fallbackMs, MIN_FALLBACK_MS, MAX_FALLBACK_MS)
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}
