import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('popup markup', () => {
  it('includes an attack balance overlay checkbox option', () => {
    const html = readFileSync('popup/index.html', 'utf8');

    expect(html).toContain('id="attackBalanceOverlay"');
    expect(html).toContain('name="attackBalanceOverlay"');
    expect(html).toContain('Attack balance badges');
  });

  it('includes an eval bar checkbox option', () => {
    const html = readFileSync('popup/index.html', 'utf8');

    expect(html).toContain('id="evalBar"');
    expect(html).toContain('name="evalBar"');
    expect(html).toContain('Eval bar');
  });

  it('includes a top moves number option', () => {
    const html = readFileSync('popup/index.html', 'utf8');

    expect(html).toContain('id="evalTopMoves"');
    expect(html).toContain('name="evalTopMoves"');
    expect(html).toContain('Top moves');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="10"');
  });

  it('includes a show top moves toggle', () => {
    const html = readFileSync('popup/index.html', 'utf8');

    expect(html).toContain('id="showTopMoves"');
    expect(html).toContain('name="showTopMoves"');
    expect(html).toContain('Show move names');
  });

  it('includes a show moves button toggle', () => {
    const html = readFileSync('popup/index.html', 'utf8');

    expect(html).toContain('id="showMovesButton"');
    expect(html).toContain('name="showMovesButton"');
    expect(html).toContain('Show moves button');
  });

  it('includes an opponent-only live move toggle', () => {
    const html = readFileSync('popup/index.html', 'utf8');

    expect(html).toContain('id="showOpponentMovesOnly"');
    expect(html).toContain('name="showOpponentMovesOnly"');
    expect(html).toContain('Show opponent moves only');
  });

  it('includes an alternative move popup size option', () => {
    const html = readFileSync('popup/index.html', 'utf8');

    expect(html).toContain('id="topMovesScale"');
    expect(html).toContain('name="topMovesScale"');
    expect(html).toContain('Alternative popup size');
    expect(html).toContain('min="50"');
    expect(html).toContain('max="300"');
  });
});
