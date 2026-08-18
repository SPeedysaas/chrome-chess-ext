import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectMode } from '../../src/detector/modeDetector';

describe('detectMode', () => {
  it('classifies running clocks plus resign and draw controls as live', () => {
    document.body.innerHTML = `
      <chess-board></chess-board>
      <button aria-label="Resign"></button>
      <button aria-label="Offer Draw"></button>
      <div class="clock-player-turn">04:31</div>
    `;

    const result = detectMode(document);

    expect(result.mode).toBe('live');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.evidence).toContain('resign-button');
    expect(result.evidence).toContain('draw-button');
    expect(result.evidence).toContain('running-clock');
  });

  it('classifies localized active game controls as live even with move navigation present', () => {
    document.body.innerHTML = `
      <chess-board></chess-board>
      <button aria-label="Aufgeben"></button>
      <button aria-label="Remis"></button>
      <div class="clock-component clock-player-turn">
        <span class="clock-time-monospace" data-cy="clock-time" role="timer">9:40</span>
      </div>
      <button data-cy="move-list-button-backward" aria-label="Vorheriger Zug"></button>
      <button data-cy="move-list-button-forward" aria-label="Nächster Zug"></button>
    `;

    const result = detectMode(document);

    expect(result.mode).toBe('live');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.evidence).toContain('resign-button');
    expect(result.evidence).toContain('draw-button');
    expect(result.evidence).toContain('running-clock');
  });

  it('keeps German Chess.com game sidebar pages classified as live when clocks remain visible', () => {
    document.body.innerHTML = `
      <chess-board></chess-board>
      <nav>
        <button>Analyse</button>
        <button aria-selected="true">Neue Partie</button>
        <button>Partien</button>
        <button>Spieler</button>
      </nav>
      <section>
        <button>Partie starten</button>
        <div>10 Minuten (Schnellschach)</div>
      </section>
      <div class="clock">10:00</div>
      <div class="clock">10:00</div>
    `;

    const result = detectMode(document);

    expect(result.mode).toBe('live');
    expect(result.confidence).toBeGreaterThanOrEqual(0.45);
    expect(result.evidence).toContain('game-sidebar');
    expect(result.evidence).toContain('running-clock');
  });

  it('keeps German Chess.com game sidebar pages classified as live when tabs are not buttons', () => {
    document.body.innerHTML = `
      <chess-board></chess-board>
      <nav role="tablist">
        <div role="tab"><span>Analyse</span></div>
        <div role="tab" aria-selected="true"><span>Neue Partie</span></div>
        <div role="tab"><span>Partien</span></div>
        <div role="tab"><span>Spieler</span></div>
      </nav>
      <section>
        <div role="button">Partie starten</div>
        <div>10 Minuten (Schnellschach)</div>
      </section>
      <div class="clock">10:00</div>
      <div class="clock">10:00</div>
    `;

    const result = detectMode(document);

    expect(result.mode).toBe('live');
    expect(result.confidence).toBeGreaterThanOrEqual(0.45);
    expect(result.evidence).toContain('game-sidebar');
    expect(result.evidence).toContain('running-clock');
  });

  it('classifies replay navigation controls as replay', () => {
    document.body.innerHTML = `
      <button aria-label="Previous move"></button>
      <button aria-label="Next move"></button>
      <section class="move-list-controls"></section>
      <button>Rematch</button>
    `;

    const result = detectMode(document);

    expect(result.mode).toBe('replay');
    expect(result.evidence).toContain('replay-controls');
  });

  it('uses German Chess.com analysis tab labels as analysis evidence', () => {
    document.body.innerHTML = `
      <chess-board></chess-board>
      <nav>
        <button aria-selected="true">Analyse</button>
        <button>Neue Partie</button>
        <button>Partien</button>
      </nav>
    `;

    const result = detectMode(document);

    expect(result.mode).toBe('analysis');
    expect(result.evidence).toContain('analysis-sidebar');
  });

  it('classifies analysis layout without live controls as analysis', () => {
    document.body.innerHTML = `
      <main class="analysis-layout">
        <div data-cy="analysis-board"></div>
      </main>
    `;

    const result = detectMode(document);

    expect(result.mode).toBe('analysis');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.evidence).toContain('analysis-layout');
    expect(result.evidence).toContain('no-live-controls');
  });

  it('classifies weak pages as unknown', () => {
    document.body.innerHTML = '<main><p>No board here.</p></main>';

    const result = detectMode(document);

    expect(result.mode).toBe('unknown');
    expect(result.confidence).toBeLessThan(0.45);
  });

  it('classifies saved live, replay, and analysis fixtures', () => {
    document.body.innerHTML = fixture('live-game.html');
    expect(detectMode(document).mode).toBe('live');

    document.body.innerHTML = fixture('replay-game.html');
    expect(detectMode(document).mode).toBe('replay');

    document.body.innerHTML = fixture('analysis-game.html');
    expect(detectMode(document).mode).toBe('analysis');
  });
});

function fixture(name: string): string {
  return readFileSync(resolve('tests/fixtures', name), 'utf8');
}
