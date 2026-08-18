export const selectors = {
  board: ['chess-board', 'wc-chess-board', '.board', '[data-board-id]'],
  pieces: ['.piece', '[class*="square-"]'],
  liveControls: ['button[aria-label*="Resign" i]', 'button[aria-label*="Draw" i]', '.clock-player-turn'],
  replayControls: ['button[aria-label*="Previous" i]', 'button[aria-label*="Next" i]', '.move-list-controls'],
  analysisControls: ['[data-cy*="analysis" i]', '.analysis-layout', '.review'],
  moveList: ['.move-list', '.vertical-move-list', '[data-cy*="move-list" i]', '.move-list-component']
} as const;
