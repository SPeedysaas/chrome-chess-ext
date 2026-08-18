import type { GameCache } from '../detector/gameCache';
import type { DetectorResult, Orientation } from '../detector/types';

export type LiveUserColorResolution =
  | { status: 'inactive' }
  | { status: 'needs-choice' }
  | { status: 'known'; color: Orientation };

export function resolveLiveUserColor(
  result: DetectorResult,
  cache: GameCache,
  username: string
): LiveUserColorResolution {
  if (result.mode !== 'live') {
    return { status: 'inactive' };
  }

  const cached = cache.getLiveUserColor(result.gameId);
  if (cached) {
    return { status: 'known', color: cached };
  }

  const expectedName = normalizeName(username);
  if (expectedName && normalizeName(result.players?.white?.name) === expectedName) {
    cache.setLiveUserColor(result.gameId, 'white');
    return { status: 'known', color: 'white' };
  }

  if (expectedName && normalizeName(result.players?.black?.name) === expectedName) {
    cache.setLiveUserColor(result.gameId, 'black');
    return { status: 'known', color: 'black' };
  }

  return { status: 'needs-choice' };
}

export function storeManualLiveUserColor(cache: GameCache, gameId: string, color: Orientation): void {
  cache.setLiveUserColor(gameId, color);
}

function normalizeName(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}
