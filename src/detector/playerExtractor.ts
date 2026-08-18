import type { GamePlayers, Orientation, PlayerInfo } from './types';

interface PlayerCandidate {
  placement: 'top' | 'bottom';
  player: PlayerInfo;
}

export function extractPlayersFromDom(root: ParentNode, orientation: Orientation = 'white'): GamePlayers | undefined {
  const candidates = collectPlayerCandidates(root);
  if (candidates.length === 0) {
    return undefined;
  }

  const players: GamePlayers = {};
  for (const candidate of candidates) {
    const color = colorForPlacement(candidate.placement, orientation);
    players[color] ??= candidate.player;
  }

  return players.white || players.black ? players : undefined;
}

function collectPlayerCandidates(root: ParentNode): PlayerCandidate[] {
  return Array.from(root.querySelectorAll('.board-player-component, [class*="board-player" i], [class*="player-component" i]'))
    .map((element) => {
      const placement = placementFromElement(element);
      const player = playerFromElement(element);
      return placement && player ? { placement, player } : null;
    })
    .filter((candidate): candidate is PlayerCandidate => candidate !== null);
}

function placementFromElement(element: Element): PlayerCandidate['placement'] | null {
  const classText = String(element.className);
  if (/\b(?:top|above)\b/i.test(classText)) {
    return 'top';
  }

  if (/\b(?:bottom|below)\b/i.test(classText)) {
    return 'bottom';
  }

  return null;
}

function playerFromElement(element: Element): PlayerInfo | null {
  const name = textFromSelectors(element, [
    '.user-username',
    '[class*="username" i]',
    'a[href*="/member/"]',
    'a[href*="/members/"]'
  ]);
  if (!name) {
    return null;
  }

  const ratingText = textFromSelectors(element, [
    '.user-tagline-rating',
    '[class*="rating" i]'
  ]);
  const rating = ratingFromText(ratingText);
  return rating === undefined ? { name } : { name, rating };
}

function textFromSelectors(root: ParentNode, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const text = Array.from(root.querySelectorAll(selector))
      .map((element) => element.textContent ?? '')
      .map(cleanName)
      .find(Boolean);
    if (text) {
      return text;
    }
  }

  return undefined;
}

function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/^\(|\)$/g, '').trim();
}

function ratingFromText(value: string | undefined): number | undefined {
  const match = value?.match(/\b(\d{3,4})\b/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function colorForPlacement(placement: PlayerCandidate['placement'], orientation: Orientation): keyof GamePlayers {
  if (orientation === 'black') {
    return placement === 'bottom' ? 'black' : 'white';
  }

  return placement === 'bottom' ? 'white' : 'black';
}
