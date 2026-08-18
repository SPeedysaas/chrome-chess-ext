import { describe, expect, it } from 'vitest';
import { decideSharing } from '../../src/detector/shareController';

describe('decideSharing', () => {
  it('blocks active live games even when local manual detection succeeds', () => {
    expect(decideSharing({ mode: 'live', confidence: 0.95, evidence: ['running-clock'] })).toEqual({
      allowed: false,
      reason: 'live-game'
    });
  });

  it('blocks unknown mode by default', () => {
    expect(decideSharing({ mode: 'unknown', confidence: 0.2, evidence: [] })).toEqual({
      allowed: false,
      reason: 'unknown-mode'
    });
  });

  it('allows confident replay pages', () => {
    expect(decideSharing({ mode: 'replay', confidence: 0.9, evidence: ['replay-controls'] })).toEqual({
      allowed: true,
      reason: 'replay-page'
    });
  });

  it('allows confident non-live analysis pages', () => {
    expect(decideSharing({ mode: 'analysis', confidence: 0.86, evidence: ['analysis-tab', 'no-live-controls'] })).toEqual({
      allowed: true,
      reason: 'analysis-page'
    });
  });

  it('blocks low-confidence replay pages', () => {
    expect(decideSharing({ mode: 'replay', confidence: 0.5, evidence: ['replay-controls'] })).toEqual({
      allowed: false,
      reason: 'low-confidence'
    });
  });

  it('allows low-confidence analysis pages when a Chess.com share button is present', () => {
    expect(decideSharing(
      { mode: 'analysis', confidence: 0.75, evidence: ['analysis-layout'] },
      { shareButtonPresent: true, hasActiveLiveControls: false }
    )).toEqual({
      allowed: true,
      reason: 'share-button'
    });
  });

  it('does not let a share button override live mode', () => {
    expect(decideSharing(
      { mode: 'live', confidence: 0.95, evidence: ['running-clock'] },
      { shareButtonPresent: true, hasActiveLiveControls: true }
    )).toEqual({
      allowed: false,
      reason: 'live-game'
    });
  });

  it('does not let a share button override unknown mode', () => {
    expect(decideSharing(
      { mode: 'unknown', confidence: 0.2, evidence: [] },
      { shareButtonPresent: true, hasActiveLiveControls: false }
    )).toEqual({
      allowed: false,
      reason: 'unknown-mode'
    });
  });
});
