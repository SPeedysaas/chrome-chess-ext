import { selectors } from '../detector/selectors';

export interface PageWatcherOptions {
  debounceMs: number;
  fallbackMs: number;
  onChange: () => void;
}

export class PageWatcher {
  private observer: MutationObserver | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private fallbackTimer: ReturnType<typeof setInterval> | undefined;
  private root: ParentNode | undefined;
  private observingFallbackRoot = false;

  constructor(private readonly options: PageWatcherOptions) {}

  start(root: ParentNode = document): void {
    this.stop();
    this.root = root;

    this.observer = new MutationObserver((records) => {
      this.handleMutations(records);
    });
    this.observeWatchedRoots(root);

    this.fallbackTimer = setInterval(() => this.options.onChange(), this.options.fallbackMs);
    this.options.onChange();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = undefined;
    }

    this.root = undefined;
    this.observingFallbackRoot = false;
  }

  private handleMutations(records: MutationRecord[]): void {
    if (records.length > 0 && records.every(isExtensionOnlyMutation)) {
      return;
    }

    if (this.observingFallbackRoot) {
      if (!records.some(hasWatchedRootCandidate)) {
        return;
      }

      if (this.root) {
        this.observeWatchedRoots(this.root);
      }
    }

    this.scheduleChange();
  }

  private scheduleChange(): void {
    if (this.debounceTimer) {
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.options.onChange();
    }, this.options.debounceMs);
  }

  private observeWatchedRoots(root: ParentNode): void {
    const { roots, fallback } = this.findWatchedRoots(root);
    this.observingFallbackRoot = fallback;
    this.observer?.disconnect();

    for (const watchedRoot of roots) {
      this.observer?.observe(watchedRoot, fallback
        ? {
          childList: true,
          subtree: true
        }
        : {
          childList: true,
          attributes: true,
          characterData: true,
          subtree: true
        });
    }
  }

  private findWatchedRoots(root: ParentNode): { roots: Node[]; fallback: boolean } {
    const selected = [
      ...selectors.board,
      ...selectors.liveControls,
      ...selectors.replayControls,
      ...selectors.analysisControls,
      ...selectors.moveList
    ].flatMap((selector) => Array.from(root.querySelectorAll(selector)));

    return selected.length > 0
      ? { roots: selected, fallback: false }
      : { roots: [root as Node], fallback: true };
  }
}

const watchedRootSelector = [
  ...selectors.board,
  ...selectors.liveControls,
  ...selectors.replayControls,
  ...selectors.analysisControls,
  ...selectors.moveList
].join(',');

const extensionUiSelector = [
  '#chesscom-board-detector-debug',
  '#chesscom-board-detector-debug-button',
  '#chesscom-board-detector-debug-window',
  '#chesscom-lichess-import-button',
  '[data-chesscom-pin-badge="true"]',
  '[data-chesscom-fork-square="true"]',
  '[data-chesscom-fork-source="true"]',
  '[data-chesscom-attack-balance-badge="true"]',
  '[data-chesscom-eval-bar="true"]',
  '[data-chesscom-eval-label="true"]',
  '[data-chesscom-eval-light="true"]',
  '[data-chesscom-top-moves-panel="true"]',
  '[data-chesscom-top-move-row="true"]',
  '[data-chesscom-live-move-alert="true"]',
  '[data-chesscom-live-color-prompt="true"]'
].join(',');

function isExtensionOnlyMutation(record: MutationRecord): boolean {
  if (record.type === 'childList') {
    const changedNodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
    return changedNodes.length > 0 && changedNodes.every(isExtensionOwnedNode);
  }

  if (record.type === 'attributes') {
    return isExtensionOwnedNode(record.target)
      || isExtensionAttribute(record.attributeName);
  }

  if (record.type === 'characterData') {
    return isExtensionOwnedNode(record.target);
  }

  return false;
}

function isExtensionOwnedNode(node: Node): boolean {
  const element = node.nodeType === 1
    ? node as Element
    : (node as ChildNode).parentElement;

  return Boolean(element?.matches(extensionUiSelector) || element?.closest(extensionUiSelector));
}

function isExtensionAttribute(attributeName: string | null): boolean {
  return Boolean(attributeName?.startsWith('data-chesscom-'));
}

function hasWatchedRootCandidate(record: MutationRecord): boolean {
  return [
    ...Array.from(record.addedNodes),
    ...Array.from(record.removedNodes)
  ].some(nodeHasWatchedRoot);
}

function nodeHasWatchedRoot(node: Node): boolean {
  if (node.nodeType !== 1) {
    return false;
  }

  const element = node as Element;
  return element.matches(watchedRootSelector) || Boolean(element.querySelector(watchedRootSelector));
}
