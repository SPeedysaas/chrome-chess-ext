import type { DetectorResult } from './types';
import type { Orientation } from './types';
import type { PositionFingerprint } from './positionFingerprint';

export interface GameCacheEntry {
  fingerprint?: PositionFingerprint;
  result?: DetectorResult;
  updatedAt: number;
}

export interface FenPositionCacheEntry {
  movesKey: string;
  positions: string[];
}

export class GameCache {
  private entries = new Map<string, GameCacheEntry>();
  private fenPositionEntries = new Map<string, FenPositionCacheEntry>();
  private liveUserColors = new Map<string, Orientation>();

  get(gameId: string): GameCacheEntry | undefined {
    return this.entries.get(gameId);
  }

  set(gameId: string, entry: GameCacheEntry): void {
    this.entries.set(gameId, entry);
  }

  getFenPositionCache(gameId: string, moves: readonly string[]): FenPositionCacheEntry | undefined {
    const entry = this.fenPositionEntries.get(gameId);
    if (!entry || entry.movesKey !== movesKey(moves)) {
      return undefined;
    }

    return entry;
  }

  setFenPositionCache(gameId: string, moves: readonly string[], positions: string[]): void {
    this.fenPositionEntries.set(gameId, {
      movesKey: movesKey(moves),
      positions
    });
  }

  getLiveUserColor(gameId: string): Orientation | undefined {
    return this.liveUserColors.get(gameId);
  }

  setLiveUserColor(gameId: string, color: Orientation): void {
    this.liveUserColors.set(gameId, color);
  }

  clearLiveUserColor(gameId: string): void {
    this.liveUserColors.delete(gameId);
  }
}

function movesKey(moves: readonly string[]): string {
  return moves.join('\u001f');
}
