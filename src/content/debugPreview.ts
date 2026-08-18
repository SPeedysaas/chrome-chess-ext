import type { DetectorResult, GamePlayers, PlayerInfo, Square } from '../detector/types';
import { findForkMoves } from '../detector/forkAnalyzer';
import { findPinTactics } from '../detector/pinAnalyzer';
import type { EngineScore } from '../engine/stockfishUci';
import type { EvalBarDebugState, EvalBarOpponentMovesDebug, EvalBarTopMoveDebugLine } from './evalBar';
import type { LiveMoveAlertDebugState } from './liveMoveAlert';
import { palette, shadow } from './styleTokens';

const DEBUG_ROOT_ID = 'chesscom-board-detector-debug';
const DEBUG_BUTTON_ID = 'chesscom-board-detector-debug-button';
const DEBUG_WINDOW_ID = 'chesscom-board-detector-debug-window';

let latestResult: DetectorResult | null = null;
let hotkeyRegistered = false;
let debugWindowOpen = true;
let activeTab: DebugTab = 'overview';
let dragPosition: { left: number; top: number } | null = null;

type DebugTab = 'overview' | 'position' | 'evidence' | 'stockfish' | 'settings' | 'raw';
type PreviewPiece = { glyph: string; color: 'white' | 'black' };

const DEBUG_TABS: Array<{ id: DebugTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'position', label: 'Position' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'stockfish', label: 'Stockfish' },
  { id: 'settings', label: 'Settings' },
  { id: 'raw', label: 'Raw' }
];

export function renderDebugPreview(
  result: DetectorResult,
  liveMoveAlert: LiveMoveAlertDebugState = { status: 'inactive' },
  evalBar: EvalBarDebugState = { status: 'inactive' }
): void {
  latestResult = result;
  const root = getOrCreateRoot();
  const dialog = root.querySelector<HTMLElement>(`#${DEBUG_WINDOW_ID}`);
  if (!dialog) {
    return;
  }

  if (hasActiveSelectionInside(dialog)) {
    return;
  }

  renderDialog(dialog, result, liveMoveAlert, evalBar);
}

export function removeDebugPreview(): void {
  document.getElementById(DEBUG_ROOT_ID)?.remove();
  latestResult = null;
  debugWindowOpen = true;
  activeTab = 'overview';
  dragPosition = null;
}

function getOrCreateRoot(): HTMLElement {
  const existing = document.getElementById(DEBUG_ROOT_ID);
  if (existing) {
    return existing;
  }

  const root = document.createElement('section');
  root.id = DEBUG_ROOT_ID;
  root.setAttribute('aria-label', 'Chess.com board detector debug controls');
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    overflow: 'clip',
    pointerEvents: 'none',
    contain: 'layout style paint',
    font: '13px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: palette.textPrimary
  });

  const button = document.createElement('button');
  button.id = DEBUG_BUTTON_ID;
  button.type = 'button';
  button.textContent = 'D';
  button.title = 'Open detector debug window (Alt+Shift+D)';
  button.setAttribute('aria-label', 'Open detector debug window');
  Object.assign(button.style, {
    position: 'absolute',
    right: '20px',
    bottom: '20px',
    width: '46px',
    height: '46px',
    border: `1px solid ${palette.borderStrong}`,
    borderRadius: '8px',
    background: palette.surfaceControl,
    color: palette.textPrimary,
    boxShadow: shadow.panel,
    cursor: 'pointer',
    pointerEvents: 'auto',
    font: '700 18px/1 ui-monospace, SFMono-Regular, Consolas, monospace'
  });
  button.addEventListener('click', toggleDebugWindow);

  const hint = document.createElement('span');
  hint.textContent = 'Alt+Shift+D';
  Object.assign(hint.style, {
    position: 'absolute',
    right: '76px',
    bottom: '28px',
    padding: '5px 8px',
    border: `1px solid ${palette.borderSubtle}`,
    borderRadius: '6px',
    background: 'rgba(38, 36, 33, 0.92)',
    color: palette.textSecondary,
    fontSize: '12px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap'
  });

  const dialog = document.createElement('section');
  dialog.id = DEBUG_WINDOW_ID;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'Chess.com board detector debug window');
  Object.assign(dialog.style, {
    position: 'absolute',
    right: '20px',
    bottom: '78px',
    width: 'min(720px, calc(100vw - 40px))',
    maxHeight: 'min(680px, calc(100vh - 110px))',
    display: 'grid',
    gridTemplateRows: 'auto auto minmax(0, 1fr)',
    border: `1px solid ${palette.borderStrong}`,
    borderRadius: '8px',
    background: 'rgba(38, 36, 33, 0.98)',
    boxShadow: shadow.panel,
    pointerEvents: 'auto',
    overflow: 'hidden',
    userSelect: 'none'
  });
  applyDialogVisibility(dialog);
  applyDialogPosition(dialog);

  root.append(dialog, hint, button);
  document.documentElement.append(root);
  registerHotkey();
  return root;
}

function registerHotkey(): void {
  if (hotkeyRegistered) {
    return;
  }

  window.addEventListener('keydown', (event) => {
    if (!event.altKey || !event.shiftKey || event.key.toLowerCase() !== 'd') {
      return;
    }

    event.preventDefault();
    if (latestResult) {
      getOrCreateRoot();
      toggleDebugWindow();
    }
  });
  hotkeyRegistered = true;
}

function toggleDebugWindow(): void {
  const dialog = document.getElementById(DEBUG_WINDOW_ID);
  if (dialog instanceof HTMLElement) {
    debugWindowOpen = !debugWindowOpen;
    applyDialogVisibility(dialog);
  }
}

function renderDialog(
  dialog: HTMLElement,
  result: DetectorResult,
  liveMoveAlert: LiveMoveAlertDebugState,
  evalBar: EvalBarDebugState
): void {
  const previousPanel = dialog.querySelector<HTMLElement>(`[data-debug-panel="${activeTab}"]`);
  const previousScrollTop = previousPanel?.scrollTop ?? 0;
  dialog.replaceChildren(
    renderTextSummary(result),
    renderTitleBar(dialog),
    renderTabs(result, liveMoveAlert, evalBar),
    renderBody(result, liveMoveAlert, evalBar)
  );
  applyDialogVisibility(dialog);
  applyDialogPosition(dialog);
  const nextPanel = dialog.querySelector<HTMLElement>(`[data-debug-panel="${activeTab}"]`);
  if (nextPanel) {
    nextPanel.scrollTop = previousScrollTop;
  }
}

function hasActiveSelectionInside(element: HTMLElement): boolean {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }

  return (
    nodeIsInside(element, selection.anchorNode)
    || nodeIsInside(element, selection.focusNode)
  );
}

function nodeIsInside(element: HTMLElement, node: Node | null): boolean {
  return node !== null && (node === element || element.contains(node));
}

function applyDialogVisibility(dialog: HTMLElement): void {
  dialog.hidden = !debugWindowOpen;
  dialog.style.display = debugWindowOpen ? 'grid' : 'none';
}

function applyDialogPosition(dialog: HTMLElement): void {
  if (!dragPosition) {
    return;
  }

  Object.assign(dialog.style, {
    left: `${dragPosition.left}px`,
    top: `${dragPosition.top}px`,
    right: 'auto',
    bottom: 'auto'
  });
}

function renderTextSummary(result: DetectorResult): HTMLElement {
  const summary = document.createElement('pre');
  summary.textContent = [
    `Game: ${result.mode}`,
    `Mode: ${result.mode} (${result.modeConfidence.toFixed(2)})`,
    `Status: ${result.status}`,
    `White: ${formatPlayer(result.players?.white)}`,
    `Black: ${formatPlayer(result.players?.black)}`,
    `Source: ${result.source ?? 'none'}`,
    `FEN: ${result.fen ?? result.fenPlacement ?? 'none'}`,
    `PGN: ${result.pgn ? 'detected' : 'none'}`,
    `Sharing: ${result.sharing.allowed ? 'allowed' : `blocked (${result.sharing.reason})`}`
  ].join('\n');
  Object.assign(summary.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'pre'
  });
  return summary;
}

function renderTitleBar(dialog: HTMLElement): HTMLElement {
  const titleBar = document.createElement('header');
  titleBar.dataset.debugDragHandle = 'true';
  Object.assign(titleBar.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    borderBottom: `1px solid ${palette.borderSubtle}`,
    background: palette.surfaceRaised,
    cursor: 'move',
    userSelect: 'none'
  });
  attachDragHandlers(titleBar, dialog);

  const title = document.createElement('div');
  title.textContent = 'Detector Debug';
  Object.assign(title.style, {
    fontWeight: '700'
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'x';
  close.setAttribute('aria-label', 'Close debug window');
  Object.assign(close.style, iconButtonStyles());
  close.addEventListener('click', toggleDebugWindow);

  titleBar.append(title, close);
  return titleBar;
}

function attachDragHandlers(handle: HTMLElement, dialog: HTMLElement): void {
  handle.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || event.target instanceof HTMLButtonElement) {
      return;
    }

    event.preventDefault();
    const rect = dialog.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const onMove = (moveEvent: MouseEvent) => {
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);
      dragPosition = {
        left: clamp(moveEvent.clientX - offsetX, 0, maxLeft),
        top: clamp(moveEvent.clientY - offsetY, 0, maxTop)
      };
      applyDialogPosition(dialog);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function renderTabs(result: DetectorResult, liveMoveAlert: LiveMoveAlertDebugState, evalBar: EvalBarDebugState): HTMLElement {
  const tabs = document.createElement('nav');
  tabs.setAttribute('aria-label', 'Debug sections');
  tabs.setAttribute('role', 'tablist');
  Object.assign(tabs.style, {
    display: 'flex',
    gap: '4px',
    padding: '8px 10px 0',
    borderBottom: `1px solid ${palette.borderSubtle}`,
    background: palette.surface
  });

  for (const tabDefinition of DEBUG_TABS) {
    const selected = tabDefinition.id === activeTab;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = tabDefinition.label;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(selected));
    Object.assign(tab.style, {
      height: '34px',
      padding: '0 12px',
      border: '0',
      borderRadius: '6px 6px 0 0',
      background: selected ? palette.surfaceControl : 'transparent',
      color: selected ? palette.green : palette.textSecondary,
      cursor: 'pointer',
      font: 'inherit',
      fontSize: '13px'
    });
    tab.addEventListener('click', () => {
      activeTab = tabDefinition.id;
      renderDialog(document.getElementById(DEBUG_WINDOW_ID) as HTMLElement, result, liveMoveAlert, evalBar);
    });
    tabs.append(tab);
  }

  return tabs;
}

function renderBody(result: DetectorResult, liveMoveAlert: LiveMoveAlertDebugState, evalBar: EvalBarDebugState): HTMLElement {
  const body = document.createElement('div');
  body.dataset.debugPanel = activeTab;
  Object.assign(body.style, {
    minHeight: '0',
    overflow: 'auto',
    padding: '14px',
    background: palette.surface,
    userSelect: 'none'
  });

  if (activeTab === 'position') {
    body.append(renderPosition(result));
    return body;
  }

  if (activeTab === 'evidence') {
    body.append(renderEvidence(result));
    return body;
  }

  if (activeTab === 'stockfish') {
    body.append(renderStockfishAnalysis(liveMoveAlert, evalBar));
    return body;
  }

  if (activeTab === 'settings') {
    body.append(renderSettings());
    return body;
  }

  if (activeTab === 'raw') {
    body.append(renderRaw(result));
    return body;
  }

  const metrics = document.createElement('div');
  Object.assign(metrics.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(112px, 1fr))',
    gap: '10px',
    marginBottom: '14px'
  });
  metrics.append(
    renderMetric('Status', result.status),
    renderMetric('Game', result.mode),
    renderMetric('Mode', result.modeConfidence.toFixed(2)),
    renderMetric('Sharing', result.sharing.allowed ? 'allowed' : 'blocked')
  );

  const layout = document.createElement('div');
  Object.assign(layout.style, {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(220px, 0.8fr)',
    gap: '12px'
  });

  layout.append(renderCurrentResult(result, liveMoveAlert), renderActions(result));
  body.append(metrics, layout);
  return body;
}

function renderMetric(label: string, value: string): HTMLElement {
  const metric = document.createElement('div');
  Object.assign(metric.style, {
    minHeight: '76px',
    border: `1px solid ${palette.borderSubtle}`,
    borderRadius: '8px',
    padding: '10px',
    background: palette.surfaceRaised
  });

  const metricLabel = document.createElement('div');
  metricLabel.textContent = label;
  Object.assign(metricLabel.style, {
    color: palette.textSecondary,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0',
    marginBottom: '8px'
  });

  const metricValue = document.createElement('div');
  metricValue.textContent = value;
  Object.assign(metricValue.style, {
    fontSize: '18px',
    fontWeight: '750',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  });

  metric.append(metricLabel, metricValue);
  return metric;
}

function renderCurrentResult(result: DetectorResult, liveMoveAlert: LiveMoveAlertDebugState): HTMLElement {
  const section = renderSection('Current Result');
  section.append(
    renderRow('Game ID', result.gameId),
    renderRow('Game', result.mode),
    renderRow('White', formatPlayer(result.players?.white)),
    renderRow('Black', formatPlayer(result.players?.black)),
    renderRow('Status', result.status),
    renderRow('Source', result.source ?? 'none'),
    renderRow('FEN', result.fen ?? result.fenPlacement ?? 'none'),
    renderRow('PGN', result.pgn ? 'detected' : 'none'),
    renderRow('Sharing', result.sharing.allowed ? 'allowed' : `blocked (${result.sharing.reason})`),
    renderRow('Live Move Alert', formatLiveMoveAlertSummary(liveMoveAlert)),
    renderRow('Pinned Pieces', formatPinnedPiecesSummary(result)),
    renderRow('Fork Highlights', formatForkHighlightsSummary(result)),
    renderRow('Reconciled', String(result.reconciledFromMoveList))
  );
  return section;
}

function formatLiveMoveAlertSummary(state: LiveMoveAlertDebugState): string {
  switch (state.status) {
    case 'disabled':
      return 'disabled';
    case 'inactive':
      return 'inactive';
    case 'waiting-for-player-color':
      return 'waiting for player color';
    case 'analyzing':
      return 'analyzing locally';
    case 'no-cliff':
      return 'no cliff detected';
    case 'warning':
      return `Only ${state.safeMoveCount} safe ${state.safeMoveCount === 1 ? 'move' : 'moves'} here`;
  }
}

function renderActions(result: DetectorResult): HTMLElement {
  const section = renderSection('Actions');
  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '12px'
  });

  actions.append(
    renderAction('Copy FEN', result.fen ?? result.fenPlacement ?? ''),
    renderAction('Copy PGN', result.pgn ?? ''),
    renderAction('Copy JSON', JSON.stringify(result, null, 2))
  );
  section.append(actions);
  return section;
}

function renderAction(label: string, value: string): HTMLButtonElement {
  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = label;
  Object.assign(action.style, {
    height: '32px',
    padding: '0 10px',
    border: `1px solid ${palette.borderStrong}`,
    borderRadius: '6px',
    background: palette.surfaceControl,
    color: palette.textPrimary,
    cursor: 'pointer',
    font: 'inherit',
    fontSize: '12px'
  });
  action.addEventListener('click', () => {
    void copyText(value);
  });
  return action;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', 'true');
  Object.assign(field.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0'
  });
  document.body.append(field);
  field.select();
  document.execCommand('copy');
  field.remove();
}

function renderPosition(result: DetectorResult): HTMLElement {
  const section = renderSection('Position');
  section.append(
    renderBoardPreview(result),
    renderRow('FEN', result.fen ?? result.fenPlacement ?? 'none'),
    renderRow('Orientation', result.orientation ?? 'unknown'),
    renderRow('Board confidence', result.boardConfidence?.toFixed(2) ?? 'unknown'),
    renderRow('Move index', result.moveIndex === undefined ? 'unknown' : String(result.moveIndex)),
    renderRow('Board squares', result.board ? String(Object.keys(result.board).length) : 'unknown'),
    renderRow('Saved sequence', result.moveSequence?.join(' ') || 'none'),
    renderRow('Saved PGN', result.pgn ?? 'none')
  );
  section.append(renderPinTactics(result));
  return section;
}

function renderPinTactics(result: DetectorResult): HTMLElement {
  const section = renderSection('Pinned Pieces');
  if (!result.board) {
    section.append(renderRow('Pins', 'unavailable'));
    return section;
  }

  const pins = findPinTactics(result.board);
  if (pins.length === 0) {
    section.append(renderRow('Pins', 'none'));
    return section;
  }

  for (const pin of pins) {
    const attacker = pin.attackerSquare && pin.attackerPiece
      ? `${pin.attackerSquare} ${pin.attackerPiece}`
      : 'none';
    section.append(renderRow(
      `${pin.square} ${pin.piece}`,
      `${formatPinLabel(pin)} | target ${pin.targetSquare} ${pin.targetPiece} | attacker ${attacker}`
    ));
  }

  return section;
}

function formatPinnedPiecesSummary(result: DetectorResult): string {
  if (!result.board) {
    return 'unavailable';
  }

  const pins = findPinTactics(result.board);
  if (pins.length === 0) {
    return 'none';
  }

  const summary = pins
    .map((pin) => {
      const attacker = pin.attackerSquare && pin.attackerPiece
        ? `${pin.attackerSquare} ${pin.attackerPiece}`
        : 'none';
      return `${pin.square} ${pin.piece} -> ${pin.targetSquare} ${pin.targetPiece} by ${attacker} (${formatPinLabel(pin)})`;
    })
    .join('; ');
  return `${pins.length}: ${summary}`;
}

function formatForkHighlightsSummary(result: DetectorResult): string {
  const forkFen = result.fen ?? result.fenPlacement;
  if (!forkFen) {
    return 'unavailable';
  }

  const forks = findForkMoves(forkFen);
  if (forks.length === 0) {
    return 'none';
  }

  const summary = forks
    .map((fork) => `${fork.piece} ${fork.from} -> ${fork.to} targets ${fork.targetSquares.join(', ')} (${fork.kind})`)
    .join('; ');
  return `${forks.length}: ${summary}`;
}

function formatPinLabel(pin: { state: 'active'; kind: 'check' | 'piece' }): string {
  return `${pin.state} ${pin.kind} pin`;
}

function renderBoardPreview(result: DetectorResult): HTMLElement {
  const preview = document.createElement('div');
  preview.dataset.debugBoardPreview = 'true';
  Object.assign(preview.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
    gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
    width: 'min(320px, 100%)',
    aspectRatio: '1 / 1',
    margin: '12px',
    border: `1px solid ${palette.borderStrong}`,
    borderRadius: '6px',
    overflow: 'hidden',
    background: palette.surface
  });

  const squares = boardPreviewSquares(result);
  for (let index = 0; index < 64; index += 1) {
    const square = document.createElement('div');
    const file = index % 8;
    const rank = Math.floor(index / 8);
    const piece = squares[index];
    square.textContent = piece?.glyph ?? '';
    Object.assign(square.style, {
      display: 'grid',
      placeItems: 'center',
      background: (file + rank) % 2 === 0 ? palette.cream : palette.boardGreen,
      color: piece?.color === 'black' ? '#171717' : '#f8fafc',
      textShadow: piece?.color === 'white'
        ? '0 1px 2px rgba(0, 0, 0, 0.75)'
        : '0 1px 1px rgba(255, 255, 255, 0.5)',
      font: '400 30px/1 "Segoe UI Symbol", "Noto Sans Symbols 2", "Arial Unicode MS", serif',
      minWidth: '0',
      minHeight: '0'
    });
    preview.append(square);
  }

  return preview;
}

function boardPreviewSquares(result: DetectorResult): Array<PreviewPiece | null> {
  if (result.fenPlacement) {
    return squaresFromFenPlacement(result.fenPlacement);
  }

  if (!result.board) {
    return Array(64).fill(null);
  }

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const squares: Array<PreviewPiece | null> = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    for (const file of files) {
      const piece = result.board[`${file}${rank}` as Square];
      if (!piece) {
        squares.push(null);
        continue;
      }

      const letter = piece.charAt(1);
      squares.push(piecePreviewFromFenChar(piece.startsWith('w') ? letter : letter.toLowerCase()));
    }
  }

  return squares;
}

function squaresFromFenPlacement(fenPlacement: string): Array<PreviewPiece | null> {
  const squares: Array<PreviewPiece | null> = [];
  for (const row of fenPlacement.split('/')) {
    for (const char of row) {
      if (/\d/.test(char)) {
        squares.push(...Array(Number(char)).fill(null));
      } else {
        squares.push(piecePreviewFromFenChar(char));
      }
    }
  }

  return squares.length === 64 ? squares : Array(64).fill(null);
}

function piecePreviewFromFenChar(char: string): PreviewPiece {
  const glyphs: Record<string, string> = {
    K: '♔',
    Q: '♕',
    R: '♖',
    B: '♗',
    N: '♘',
    P: '♙',
    k: '♚',
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞',
    p: '♟'
  };

  return {
    glyph: glyphs[char] ?? char,
    color: char === char.toUpperCase() ? 'white' : 'black'
  };
}

function renderEvidence(result: DetectorResult): HTMLElement {
  const section = renderSection('Recent Events');
  for (const evidence of result.evidence.length > 0 ? result.evidence : ['no evidence']) {
    section.append(renderEvent(evidence));
  }
  return section;
}

function renderStockfishAnalysis(liveMoveAlert: LiveMoveAlertDebugState, evalBar: EvalBarDebugState): HTMLElement {
  const container = document.createElement('div');
  const section = renderSection('Stockfish Analysis');
  section.append(
    renderRow('Status', liveMoveAlert.status),
    renderRow('Summary', formatLiveMoveAlertSummary(liveMoveAlert))
  );

  if ('targetPlayer' in liveMoveAlert) {
    section.append(
      renderRow('Target player', `${liveMoveAlert.targetPlayer} (${liveMoveAlert.targetColor})`),
      renderRow('Target score', `${liveMoveAlert.targetScoreCentipawns} cp`),
      renderRow('Current score', liveMoveAlert.currentScoreCentipawns === undefined ? 'pending' : `${liveMoveAlert.currentScoreCentipawns} cp`)
    );
  }

  if (liveMoveAlert.status === 'warning') {
    section.append(renderRow('Safe moves', String(liveMoveAlert.safeMoveCount)));
  }

  container.append(section, renderEvalBarAnalysis(evalBar));
  return container;
}

function renderEvalBarAnalysis(state: EvalBarDebugState): HTMLElement {
  const section = renderSection('Eval Bar Analysis');
  section.append(
    renderRow('Status', state.status),
    renderRow('Summary', formatEvalBarSummary(state))
  );

  if ('fen' in state) {
    section.append(
      renderRow('Engine mode', state.analysisMode),
      renderRow('FEN', state.fen),
      renderRow('Current score', state.score ? formatEngineScore(state.score) : 'pending'),
      renderRow('Label', state.formattedScore ?? 'pending'),
      renderRow('Depth', state.depth === undefined ? 'pending' : String(state.depth)),
      renderRow('Best move', state.bestMove ?? 'pending')
    );
  }

  const container = document.createElement('div');
  container.append(section);

  if ('opponentMoves' in state && state.opponentMoves) {
    container.append(renderOpponentMovesDebug(state.opponentMoves));
  }

  if ('topMoveLines' in state && state.topMoveLines && state.topMoveLines.length > 0) {
    container.append(renderTopMoveLines(state.topMoveLines));
  }

  return container;
}

function renderOpponentMovesDebug(debug: EvalBarOpponentMovesDebug): HTMLElement {
  const section = renderSection('Opponent Moves Debug');
  section.append(
    renderRow('Enabled', String(debug.enabled)),
    renderRow('Live game', String(debug.liveGame)),
    renderRow('Reason', debug.reason),
    renderRow('Player color', debug.playerColor ?? 'unknown'),
    renderRow('Opponent color', debug.opponentColor ?? 'unknown'),
    renderRow('Position turn', debug.positionSideToMove ?? 'unknown'),
    renderRow('Analyzed turn', debug.analyzedSideToMove ?? 'unknown'),
    renderRow('Overlays visible', String(debug.overlaysVisible)),
    renderRow('Force arrows', String(debug.forceShowArrows)),
    renderRow('Show names', String(debug.showTopMoves)),
    renderRow('Show button', String(debug.showMovesButton)),
    renderRow('Top moves', String(debug.topMoves)),
    renderRow('Popup scale', `${debug.topMovesScale}%`),
    renderRow('Visible FEN', debug.visibleFen ?? 'unknown'),
    renderRow('Analysis FEN', debug.analysisFen ?? 'unknown')
  );
  return section;
}

function renderTopMoveLines(lines: EvalBarTopMoveDebugLine[]): HTMLElement {
  const section = renderSection('Top Move Lines');
  for (const line of lines) {
    section.append(renderRow(
      `#${line.rank}`,
      `${line.move} | ${formatEngineScore(line.score)} | label ${line.formattedScore} | depth ${line.depth}`
    ));
  }
  return section;
}

function formatEvalBarSummary(state: EvalBarDebugState): string {
  switch (state.status) {
    case 'disabled':
      return 'disabled';
    case 'inactive':
      return 'inactive';
    case 'waiting-for-player-color':
      return 'waiting for player color';
    case 'analyzing':
      return `analyzing eval bar (${state.analysisMode})`;
    case 'ready':
      return state.formattedScore === undefined
        ? `eval bar ready (${state.analysisMode})`
        : `eval bar ${state.formattedScore} (${state.analysisMode})`;
  }
}

function formatEngineScore(score: EngineScore): string {
  if (score.type === 'mate') {
    return `${score.value < 0 ? '-' : ''}M${Math.abs(score.value)}`;
  }

  return `${score.value} cp`;
}

function renderRaw(result: DetectorResult): HTMLElement {
  const section = renderSection('Raw Result');
  const raw = document.createElement('pre');
  raw.textContent = JSON.stringify(result, null, 2);
  Object.assign(raw.style, {
    margin: '0',
    padding: '12px',
    overflow: 'auto',
    color: palette.textPrimary,
    font: '12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace',
    whiteSpace: 'pre-wrap',
    userSelect: 'text'
  });
  section.append(raw);
  return section;
}

function renderSettings(): HTMLElement {
  const section = renderSection('Debug Settings');
  section.append(
    renderRow('Hotkey', 'Alt+Shift+D'),
    renderRow('Window', debugWindowOpen ? 'open' : 'closed'),
    renderRow('Selected tab', activeTab),
    renderRow('Position', dragPosition ? `${dragPosition.left}, ${dragPosition.top}` : 'default')
  );
  return section;
}

function renderSection(title: string): HTMLElement {
  const section = document.createElement('section');
  Object.assign(section.style, {
    border: `1px solid ${palette.borderSubtle}`,
    borderRadius: '8px',
    background: palette.surfaceRaised,
    overflow: 'hidden',
    marginTop: '12px'
  });

  const heading = document.createElement('h3');
  heading.textContent = title;
  Object.assign(heading.style, {
    margin: '0',
    padding: '10px 12px',
    borderBottom: `1px solid ${palette.borderSubtle}`,
    fontSize: '13px',
    background: palette.surfaceControl
  });

  section.append(heading);
  return section;
}

function renderRow(key: string, value: string): HTMLElement {
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'grid',
    gridTemplateColumns: '130px minmax(0, 1fr)',
    gap: '8px',
    padding: '10px 12px',
    borderBottom: `1px solid ${palette.borderSubtle}`,
    fontSize: '13px',
    userSelect: 'none'
  });

  const keyElement = document.createElement('div');
  keyElement.textContent = key;
  Object.assign(keyElement.style, {
    color: palette.textSecondary,
    userSelect: 'none'
  });

  const valueElement = document.createElement('div');
  valueElement.textContent = value;
  Object.assign(valueElement.style, {
    overflowWrap: 'anywhere',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    userSelect: 'text'
  });

  row.append(keyElement, valueElement);
  return row;
}

function renderEvent(text: string): HTMLElement {
  const event = document.createElement('div');
  Object.assign(event.style, {
    display: 'grid',
    gridTemplateColumns: '74px minmax(0, 1fr)',
    gap: '10px',
    padding: '9px 12px',
    borderBottom: `1px solid ${palette.borderSubtle}`,
    fontSize: '12px'
  });

  const time = document.createElement('span');
  time.textContent = new Date().toLocaleTimeString();
  Object.assign(time.style, {
    color: palette.textSecondary,
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace'
  });

  const message = document.createElement('span');
  message.textContent = text;
  event.append(time, message);
  return event;
}

function formatPlayer(player: PlayerInfo | undefined): string {
  if (!player) {
    return 'unknown';
  }

  return player.rating === undefined ? player.name : `${player.name} (${player.rating})`;
}

function iconButtonStyles(): Partial<CSSStyleDeclaration> {
  return {
    width: '32px',
    height: '32px',
    border: `1px solid ${palette.borderStrong}`,
    borderRadius: '6px',
    background: palette.surfaceControl,
    color: palette.textPrimary,
    cursor: 'pointer',
    fontSize: '16px'
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
