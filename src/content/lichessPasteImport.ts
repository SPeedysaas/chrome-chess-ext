const STORAGE_PREFIX = 'lichessImport:';

interface PendingLichessImport {
  pgn: string;
  createdAt: number;
  sourceUrl?: string;
}

export interface LichessPasteImportOptions {
  retryMs?: number;
  maxAttempts?: number;
}

export function runPendingLichessPasteImport(options: LichessPasteImportOptions = {}): void {
  const importId = importIdFromHash(window.location.hash);
  if (!importId) {
    return;
  }

  const storageKey = `${STORAGE_PREFIX}${importId}`;
  chrome.storage.local.get(storageKey, (items) => {
    const pending = items[storageKey] as PendingLichessImport | undefined;
    if (!pending?.pgn?.trim()) {
      return;
    }

    tryFillPasteForm(storageKey, pending.pgn, {
      retryMs: options.retryMs ?? 250,
      maxAttempts: options.maxAttempts ?? 20
    });
  });
}

function importIdFromHash(hash: string): string | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('chesscom-import') || undefined;
}

function tryFillPasteForm(storageKey: string, pgn: string, options: Required<LichessPasteImportOptions>, attempt = 1): void {
  const textarea = findPgnTextarea();
  const analysisCheckbox = findAnalysisCheckbox();
  const submitButton = findSubmitButton();

  if (textarea && analysisCheckbox && submitButton) {
    textarea.value = pgn;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    if (!analysisCheckbox.checked) {
      analysisCheckbox.click();
    }

    chrome.storage.local.remove(storageKey);
    submitButton.click();
    return;
  }

  if (attempt < options.maxAttempts) {
    window.setTimeout(() => tryFillPasteForm(storageKey, pgn, options, attempt + 1), options.retryMs);
  }
}

function findPgnTextarea(): HTMLTextAreaElement | null {
  return document.querySelector('textarea[name*="pgn" i], textarea');
}

function findAnalysisCheckbox(): HTMLInputElement | null {
  const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  return checkboxes.find((checkbox) => {
    const label = checkbox.closest('label')?.textContent ?? '';
    const idLabel = checkbox.id
      ? document.querySelector(`label[for="${cssEscape(checkbox.id)}"]`)?.textContent ?? ''
      : '';
    const name = `${checkbox.name} ${checkbox.id} ${label} ${idLabel}`;

    return /\b(?:analyse|analysis|computer)\b/i.test(name);
  }) ?? checkboxes[0] ?? null;
}

function findSubmitButton(): HTMLElement | null {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, input[type="submit"]'));
  return buttons.find((button) => {
    const text = [
      button.textContent,
      button.getAttribute('value'),
      button.getAttribute('aria-label'),
      button.getAttribute('title')
    ].join(' ');

    return button.getAttribute('type') === 'submit' || /\b(?:import|importieren)\b/i.test(text);
  }) ?? null;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  runPendingLichessPasteImport();
}
