import { DEFAULT_EXTENSION_SETTINGS, normalizeExtensionSettings, type ExtensionSettings } from '../extension/settings.js';

const form = document.querySelector<HTMLFormElement>('#settings-form');
const enabledInput = document.querySelector<HTMLInputElement>('#enabled');
const debugInput = document.querySelector<HTMLInputElement>('#debug');
const pinOverlayInput = document.querySelector<HTMLInputElement>('#pinOverlay');
const forkOverlayInput = document.querySelector<HTMLInputElement>('#forkOverlay');
const attackBalanceOverlayInput = document.querySelector<HTMLInputElement>('#attackBalanceOverlay');
const evalBarInput = document.querySelector<HTMLInputElement>('#evalBar');
const evalTopMovesInput = document.querySelector<HTMLInputElement>('#evalTopMoves');
const showTopMovesInput = document.querySelector<HTMLInputElement>('#showTopMoves');
const showMovesButtonInput = document.querySelector<HTMLInputElement>('#showMovesButton');
const showOpponentMovesOnlyInput = document.querySelector<HTMLInputElement>('#showOpponentMovesOnly');
const topMovesScaleInput = document.querySelector<HTMLInputElement>('#topMovesScale');
const liveMoveAlertInput = document.querySelector<HTMLInputElement>('#liveMoveAlert');
const debounceInput = document.querySelector<HTMLInputElement>('#debounceMs');
const fallbackInput = document.querySelector<HTMLInputElement>('#fallbackMs');
const resetButton = document.querySelector<HTMLButtonElement>('#reset');
const statusText = document.querySelector<HTMLElement>('#status');
const sectionNavLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.section-nav a'));
const settingSections = Array.from(document.querySelectorAll<HTMLElement>('.settings-section'));

void loadSettings();
observeSettingSections();

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const settings = readFormSettings();
  saveSettings(settings);
});

resetButton?.addEventListener('click', () => {
  applySettings(DEFAULT_EXTENSION_SETTINGS);
  saveSettings(DEFAULT_EXTENSION_SETTINGS);
});

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== 'sync') {
    return;
  }

  const changedSettings = Object.fromEntries(
    Object.entries(changes)
      .filter(([key]) => key in DEFAULT_EXTENSION_SETTINGS)
      .map(([key, change]) => [key, change.newValue])
  );

  if (Object.keys(changedSettings).length > 0) {
    void loadSettings();
  }
});

async function loadSettings(): Promise<void> {
  const storedSettings = await getStoredSettings();
  applySettings(storedSettings);
  setStatus('Settings loaded');
}

function applySettings(settings: ExtensionSettings): void {
  if (enabledInput) {
    enabledInput.checked = settings.enabled;
  }

  if (debugInput) {
    debugInput.checked = settings.debug;
  }

  if (pinOverlayInput) {
    pinOverlayInput.checked = settings.pinOverlay;
  }

  if (forkOverlayInput) {
    forkOverlayInput.checked = settings.forkOverlay ?? DEFAULT_EXTENSION_SETTINGS.forkOverlay ?? true;
  }

  if (attackBalanceOverlayInput) {
    attackBalanceOverlayInput.checked = settings.attackBalanceOverlay;
  }

  if (evalBarInput) {
    evalBarInput.checked = settings.evalBar;
  }

  if (evalTopMovesInput) {
    evalTopMovesInput.value = String(settings.evalTopMoves);
  }

  if (showTopMovesInput) {
    showTopMovesInput.checked = settings.showTopMoves;
  }

  if (showMovesButtonInput) {
    showMovesButtonInput.checked = settings.showMovesButton;
  }

  if (showOpponentMovesOnlyInput) {
    showOpponentMovesOnlyInput.checked = settings.showOpponentMovesOnly;
  }

  if (topMovesScaleInput) {
    topMovesScaleInput.value = String(settings.topMovesScale);
  }

  if (liveMoveAlertInput) {
    liveMoveAlertInput.checked = settings.liveMoveAlert;
  }

  if (debounceInput) {
    debounceInput.value = String(settings.debounceMs);
  }

  if (fallbackInput) {
    fallbackInput.value = String(settings.fallbackMs);
  }
}

function readFormSettings(): ExtensionSettings {
  const settings: Partial<ExtensionSettings> = {
    evalTopMoves: Number(evalTopMovesInput?.value),
    topMovesScale: Number(topMovesScaleInput?.value),
    debounceMs: Number(debounceInput?.value),
    fallbackMs: Number(fallbackInput?.value)
  };

  if (enabledInput) {
    settings.enabled = enabledInput.checked;
  }

  if (debugInput) {
    settings.debug = debugInput.checked;
  }

  if (pinOverlayInput) {
    settings.pinOverlay = pinOverlayInput.checked;
  }

  if (forkOverlayInput) {
    settings.forkOverlay = forkOverlayInput.checked;
  }

  if (attackBalanceOverlayInput) {
    settings.attackBalanceOverlay = attackBalanceOverlayInput.checked;
  }

  if (evalBarInput) {
    settings.evalBar = evalBarInput.checked;
  }

  if (showTopMovesInput) {
    settings.showTopMoves = showTopMovesInput.checked;
  }

  if (showMovesButtonInput) {
    settings.showMovesButton = showMovesButtonInput.checked;
  }

  if (showOpponentMovesOnlyInput) {
    settings.showOpponentMovesOnly = showOpponentMovesOnlyInput.checked;
  }

  if (liveMoveAlertInput) {
    settings.liveMoveAlert = liveMoveAlertInput.checked;
  }

  return normalizeExtensionSettings(settings);
}

function getStoredSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_EXTENSION_SETTINGS, (storedSettings) => {
      resolve(normalizeExtensionSettings(storedSettings));
    });
  });
}

function saveSettings(settings: ExtensionSettings): void {
  chrome.storage.sync.set(settings, () => {
    applySettings(settings);
    setStatus('Saved. Open Chess.com tabs update automatically.');
  });
}

function setStatus(message: string): void {
  if (statusText) {
    statusText.textContent = message;
  }
}

function observeSettingSections(): void {
  if (sectionNavLinks.length === 0 || settingSections.length === 0 || typeof IntersectionObserver === 'undefined') {
    return;
  }

  const setCurrentSection = (sectionId: string): void => {
    sectionNavLinks.forEach((link) => {
      const isCurrent = link.getAttribute('href') === `#${sectionId}`;
      if (isCurrent) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const observer = new IntersectionObserver((entries) => {
    const visibleEntry = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visibleEntry) {
      setCurrentSection((visibleEntry.target as HTMLElement).id);
    }
  }, { threshold: [0.15, 0.4, 0.75], rootMargin: '-58px 0px 0px 0px' });

  settingSections.forEach((section) => observer.observe(section));
  const firstSection = settingSections[0];
  if (firstSection) {
    setCurrentSection(firstSection.id);
  }
}
