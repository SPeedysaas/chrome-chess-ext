import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageWatcher } from '../../src/content/pageWatcher';

describe('PageWatcher', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a detection cycle immediately when watching starts', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    document.body.innerHTML = '<chess-board></chess-board>';
    const watcher = new PageWatcher({ debounceMs: 150, fallbackMs: 5000, onChange });

    watcher.start(document);

    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('debounces multiple relevant mutations into one detection cycle', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    document.body.innerHTML = '<chess-board></chess-board>';
    const board = document.querySelector('chess-board');
    const watcher = new PageWatcher({ debounceMs: 150, fallbackMs: 5000, onChange });

    watcher.start(document);
    onChange.mockClear();
    board?.append(document.createElement('div'));
    board?.append(document.createElement('span'));
    await Promise.resolve();
    vi.advanceTimersByTime(149);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('does not postpone a pending detection when additional mutations arrive', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    document.body.innerHTML = '<chess-board></chess-board>';
    const board = document.querySelector('chess-board');
    const watcher = new PageWatcher({ debounceMs: 50, fallbackMs: 5000, onChange });

    watcher.start(document);
    onChange.mockClear();
    board?.append(document.createElement('div'));
    await Promise.resolve();
    vi.advanceTimersByTime(40);
    board?.append(document.createElement('span'));
    await Promise.resolve();
    vi.advanceTimersByTime(10);

    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('ignores mutations outside watched roots when relevant roots are present', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    document.body.innerHTML = '<chess-board></chess-board><aside id="chat"></aside>';
    const watcher = new PageWatcher({ debounceMs: 150, fallbackMs: 5000, onChange });

    watcher.start(document);
    onChange.mockClear();
    document.querySelector('#chat')?.append(document.createElement('p'));
    vi.advanceTimersByTime(200);

    expect(onChange).not.toHaveBeenCalled();
    watcher.stop();
  });

  it('ignores unrelated document mutations while waiting for a relevant root', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    document.body.innerHTML = '<main id="home"></main>';
    const watcher = new PageWatcher({ debounceMs: 150, fallbackMs: 5000, onChange });

    watcher.start(document);
    onChange.mockClear();
    document.querySelector('#home')?.append(document.createElement('p'));
    await Promise.resolve();
    vi.advanceTimersByTime(200);

    expect(onChange).not.toHaveBeenCalled();
    watcher.stop();
  });

  it('starts watching the board after a relevant root appears', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    document.body.innerHTML = '<main id="home"></main><aside id="chat"></aside>';
    const watcher = new PageWatcher({ debounceMs: 150, fallbackMs: 5000, onChange });

    watcher.start(document);
    onChange.mockClear();
    const board = document.createElement('chess-board');
    document.querySelector('#home')?.append(board);
    await Promise.resolve();
    vi.advanceTimersByTime(150);
    expect(onChange).toHaveBeenCalledTimes(1);

    onChange.mockClear();
    document.querySelector('#chat')?.append(document.createElement('p'));
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    expect(onChange).not.toHaveBeenCalled();
    watcher.stop();
  });

  it('ignores extension-only overlay mutations inside watched roots', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    document.body.innerHTML = '<chess-board></chess-board>';
    const board = document.querySelector('chess-board');
    const watcher = new PageWatcher({ debounceMs: 150, fallbackMs: 5000, onChange });

    watcher.start(document);
    onChange.mockClear();
    const badge = document.createElement('span');
    badge.setAttribute('data-chesscom-pin-badge', 'true');
    board?.append(badge);
    await Promise.resolve();
    vi.advanceTimersByTime(200);

    expect(onChange).not.toHaveBeenCalled();
    watcher.stop();
  });

  it('runs a low-frequency fallback when no mutations arrive', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    document.body.innerHTML = '<chess-board></chess-board>';
    const watcher = new PageWatcher({ debounceMs: 150, fallbackMs: 5000, onChange });

    watcher.start(document);
    onChange.mockClear();
    vi.advanceTimersByTime(5000);

    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.stop();
  });
});
