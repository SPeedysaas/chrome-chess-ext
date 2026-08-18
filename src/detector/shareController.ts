import type { ModeResult, SharingDecision } from './types';

const MIN_SHARE_CONFIDENCE = 0.8;

export interface SharingContext {
  shareButtonPresent?: boolean;
  hasActiveLiveControls?: boolean;
}

export function decideSharing(mode: ModeResult, context: SharingContext = {}): SharingDecision {
  if (mode.mode === 'live') {
    return { allowed: false, reason: 'live-game' };
  }

  if (mode.mode === 'unknown') {
    return { allowed: false, reason: 'unknown-mode' };
  }

  if (context.shareButtonPresent && !context.hasActiveLiveControls) {
    return { allowed: true, reason: 'share-button' };
  }

  if (mode.confidence < MIN_SHARE_CONFIDENCE) {
    return { allowed: false, reason: 'low-confidence' };
  }

  if (mode.mode === 'replay') {
    return { allowed: true, reason: 'replay-page' };
  }

  return { allowed: true, reason: 'analysis-page' };
}
