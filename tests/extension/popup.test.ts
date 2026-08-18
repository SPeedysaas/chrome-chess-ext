import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('popup settings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  it('preserves a disabled attack balance overlay when saving another setting', async () => {
    document.documentElement.innerHTML = readFileSync('popup/index.html', 'utf8');
    const set = vi.fn((_settings: unknown, callback?: () => void) => callback?.());
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn((_defaults: unknown, callback: (settings: unknown) => void) => callback({
            attackBalanceOverlay: false
          })),
          set
        },
        onChanged: { addListener: vi.fn() }
      }
    });

    await import('../../src/popup/index');
    await Promise.resolve();
    const debugInput = document.querySelector<HTMLInputElement>('#debug');
    const form = document.querySelector<HTMLFormElement>('#settings-form');
    expect(document.querySelector<HTMLInputElement>('#attackBalanceOverlay')?.checked).toBe(false);

    if (debugInput) {
      debugInput.checked = true;
    }
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      attackBalanceOverlay: false,
      debug: true
    }), expect.any(Function));
  });
});
