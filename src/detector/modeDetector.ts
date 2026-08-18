import { selectors } from './selectors';
import type { ModeResult, PageMode } from './types';

interface Score {
  mode: PageMode;
  score: number;
  evidence: string[];
}

export function detectMode(root: ParentNode = document): ModeResult {
  const live = scoreLive(root);
  const replay = scoreReplay(root);
  const analysis = scoreAnalysis(root, live.evidence.some((item) => item !== 'playable-board'));
  const best = [live, replay, analysis].sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 0.45) {
    return { mode: 'unknown', confidence: Math.max(best?.score ?? 0, 0), evidence: best?.evidence ?? [] };
  }

  return {
    mode: best.mode,
    confidence: Math.min(best.score, 1),
    evidence: best.evidence
  };
}

function scoreLive(root: ParentNode): Score {
  let score = 0;
  const evidence: string[] = [];

  if (hasButtonLabelOrText(root, ['new game', 'neue partie', 'games', 'partien'])) {
    score += 0.35;
    evidence.push('game-sidebar');
  }

  if (hasButtonLabel(root, ['resign', 'aufgeben'])) {
    score += 0.35;
    evidence.push('resign-button');
  }

  if (hasButtonLabel(root, ['draw', 'remis'])) {
    score += 0.25;
    evidence.push('draw-button');
  }

  const clock = root.querySelector('.clock-player-turn, .clock, [class*="clock" i]');
  if (clock?.textContent && /\d{1,2}:\d{2}/.test(clock.textContent)) {
    score += 0.3;
    evidence.push('running-clock');
  }

  if (root.querySelector(selectors.board.join(','))) {
    score += 0.1;
    evidence.push('playable-board');
  }

  if (textIncludes(root, ['game over', 'rematch', 'new game'])) {
    score -= 0.25;
  }

  return { mode: 'live', score, evidence };
}

function scoreReplay(root: ParentNode): Score {
  let score = 0;
  const evidence: string[] = [];

  if (hasSelectedButtonLabelOrText(root, ['games', 'partien'])) {
    score += 0.45;
    evidence.push('games-sidebar');
  }

  if (root.querySelector(selectors.replayControls.join(','))) {
    score += 0.65;
    evidence.push('replay-controls');
  }

  if (root.querySelector('button[aria-label*="Previous" i]') && root.querySelector('button[aria-label*="Next" i]')) {
    score += 0.15;
    evidence.push('previous-next-controls');
  }

  if (textIncludes(root, ['rematch', 'new game', 'game over'])) {
    score += 0.25;
    evidence.push('completed-game-controls');
  }

  if (root.querySelector(selectors.board.join(','))) {
    score += 0.1;
    evidence.push('board-visible');
  }

  return { mode: 'replay', score, evidence };
}

function scoreAnalysis(root: ParentNode, hasLiveSignals: boolean): Score {
  let score = 0;
  const evidence: string[] = [];

  if (hasSelectedButtonLabelOrText(root, ['analysis', 'analyse'])) {
    score += 0.55;
    evidence.push('analysis-sidebar');
  }

  if (root.querySelector(selectors.analysisControls.join(','))) {
    score += 0.75;
    evidence.push('analysis-layout');
  }

  if (!hasLiveSignals) {
    score += 0.15;
    evidence.push('no-live-controls');
  }

  return { mode: 'analysis', score, evidence };
}

function textIncludes(root: ParentNode, values: string[]): boolean {
  const text = root instanceof Document
    ? root.body?.textContent ?? ''
    : root.textContent ?? '';
  const normalized = text.toLowerCase();

  return values.some((value) => normalized.includes(value));
}

function hasButtonLabel(root: ParentNode, values: string[]): boolean {
  return Array.from(root.querySelectorAll('button')).some((button) => {
    const label = button.getAttribute('aria-label')?.toLowerCase() ?? '';
    return values.some((value) => label.includes(value));
  });
}

function hasButtonLabelOrText(root: ParentNode, values: string[]): boolean {
  return sidebarControls(root).some((control) => {
    const label = elementLabelOrText(control);
    return values.some((value) => label === value);
  });
}

function hasSelectedButtonLabelOrText(root: ParentNode, values: string[]): boolean {
  return sidebarControls(root).some((control) => {
    if (!isSelectedControl(control)) {
      return false;
    }

    const label = elementLabelOrText(control);
    return values.some((value) => label === value);
  });
}

function sidebarControls(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll('button, a, [role="tab"], [role="button"], [aria-selected], [aria-current]'));
}

function elementLabelOrText(element: Element): string {
  return (element.getAttribute('aria-label') ?? element.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isSelectedControl(element: Element): boolean {
  const state = [
    element.getAttribute('aria-selected'),
    element.getAttribute('aria-current'),
    element.getAttribute('data-active'),
    element.getAttribute('data-selected')
  ].some((value) => value === 'true' || value === 'page');

  if (state) {
    return true;
  }

  return /\b(?:active|selected|current)\b/i.test(element.className);
}
