export type EngineScore =
  | { type: 'cp'; value: number }
  | { type: 'mate'; value: number };

export interface EngineLine {
  depth: number;
  multipv: number;
  score: EngineScore;
  move: string;
}

export function parseInfoLine(line: string): EngineLine | null {
  if (!line.startsWith('info ')) {
    return null;
  }

  const tokens = line.split(/\s+/);
  const depth = numberAfter(tokens, 'depth');
  const multipv = numberAfter(tokens, 'multipv') ?? 1;
  const scoreIndex = tokens.indexOf('score');
  const pvIndex = tokens.indexOf('pv');

  if (depth === undefined || scoreIndex === -1 || pvIndex === -1 || !tokens[pvIndex + 1]) {
    return null;
  }

  const scoreType = tokens[scoreIndex + 1];
  const scoreValue = Number(tokens[scoreIndex + 2]);
  if ((scoreType !== 'cp' && scoreType !== 'mate') || !Number.isFinite(scoreValue)) {
    return null;
  }

  return {
    depth,
    multipv,
    score: { type: scoreType, value: scoreValue },
    move: tokens[pvIndex + 1]!
  };
}

export function parseBestMove(line: string): string | null {
  const match = /^bestmove\s+(\S+)/.exec(line);
  return match?.[1] && match[1] !== '(none)' ? match[1] : null;
}

function numberAfter(tokens: string[], token: string): number | undefined {
  const index = tokens.indexOf(token);
  if (index === -1) {
    return undefined;
  }

  const value = Number(tokens[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}
