import { describe, expect, it } from 'vitest';
import { LocalStockfishEngine } from '../../src/engine/localStockfish';

describe('LocalStockfishEngine', () => {
  it('sends UCI setup and analyzes a FEN with MultiPV', async () => {
    const worker = new FakeWorker();
    const engine = new LocalStockfishEngine({
      createWorker: () => worker,
      multipv: 8,
      depth: 12
    });

    const analysis = engine.analyze('8/8/8/8/8/8/P7/4K2k w - - 0 1');
    worker.emit('uciok');
    worker.emit('readyok');
    worker.emit('info depth 12 multipv 1 score cp 30 pv e2e4 e7e5');
    worker.emit('info depth 12 multipv 2 score cp -250 pv a2a3 e7e5');
    worker.emit('bestmove e2e4');

    await expect(analysis).resolves.toEqual([
      { depth: 12, multipv: 1, score: { type: 'cp', value: 30 }, move: 'e2e4' },
      { depth: 12, multipv: 2, score: { type: 'cp', value: -250 }, move: 'a2a3' }
    ]);
    expect(worker.messages).toEqual([
      'uci',
      'setoption name MultiPV value 8',
      'isready',
      'position fen 8/8/8/8/8/8/P7/4K2k w - - 0 1',
      'go depth 12'
    ]);
  });

  it('allows a bounded analysis call to override the default depth', () => {
    const worker = new FakeWorker();
    const engine = new LocalStockfishEngine({
      createWorker: () => worker,
      depth: 12
    });

    void engine.analyze('8/8/8/8/8/8/P7/4K2k w - - 0 1', 4);

    expect(worker.messages.at(-1)).toBe('go depth 4');
  });

  it('keeps a newer bounded search alive when a stopped search emits a late bestmove', async () => {
    const worker = new FakeWorker();
    const engine = new LocalStockfishEngine({
      createWorker: () => worker,
      depth: 12
    });

    void engine.analyze('8/8/8/8/8/8/P7/4K2k w - - 0 1');
    let secondResolved = false;
    const secondAnalysis = engine
      .analyze('8/8/8/8/8/8/2P5/4K2k w - - 0 1')
      .then((lines) => {
        secondResolved = true;
        return lines;
      });

    worker.emit('bestmove a2a3');
    await Promise.resolve();

    expect(secondResolved).toBe(false);

    worker.emit('info depth 12 multipv 1 score cp 85 pv c2c4');
    worker.emit('bestmove c2c4');

    await expect(secondAnalysis).resolves.toEqual([
      { depth: 12, multipv: 1, score: { type: 'cp', value: 85 }, move: 'c2c4' }
    ]);
  });

  it('streams improving analysis with a bounded search and can stop it', () => {
    const worker = new FakeWorker();
    const updates: unknown[] = [];
    const engine = new LocalStockfishEngine({
      createWorker: () => worker,
      multipv: 8,
      depth: 12,
      minimumUpdateDepth: 4
    });

    const session = engine.analyzeContinuously(
      '8/8/8/8/8/8/P7/4K2k w - - 0 1',
      (lines) => updates.push(lines)
    );
    worker.emit('info depth 3 multipv 1 score cp 10 pv e2e4');
    worker.emit('info depth 4 multipv 1 score cp 30 pv e2e4 e7e5');
    worker.emit('info depth 4 multipv 2 score cp -250 pv a2a3 e7e5');

    expect(updates).toEqual([
      [{ depth: 4, multipv: 1, score: { type: 'cp', value: 30 }, move: 'e2e4' }],
      [
        { depth: 4, multipv: 1, score: { type: 'cp', value: 30 }, move: 'e2e4' },
        { depth: 4, multipv: 2, score: { type: 'cp', value: -250 }, move: 'a2a3' }
      ]
    ]);
    expect(worker.messages).toEqual([
      'uci',
      'setoption name MultiPV value 8',
      'isready',
      'position fen 8/8/8/8/8/8/P7/4K2k w - - 0 1',
      'go depth 12'
    ]);

    session.stop();

    expect(worker.messages.at(-1)).toBe('stop');
  });

  it('terminates the worker on dispose', () => {
    const worker = new FakeWorker();
    const engine = new LocalStockfishEngine({ createWorker: () => worker });

    engine.dispose();

    expect(worker.terminated).toBe(true);
  });

  it('creates the default Stockfish worker through a same-origin blob bootstrap', async () => {
    const originalChrome = globalThis.chrome;
    const originalWorker = globalThis.Worker;
    const originalUrl = globalThis.URL;
    const originalBlob = globalThis.Blob;
    const createdUrls: string[] = [];
    const objectUrls: string[] = [];
    const blobParts: BlobPart[][] = [];
    const blobTypes: (string | undefined)[] = [];

    globalThis.chrome = {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-id/${path}`
      }
    } as typeof chrome;
    globalThis.Blob = class {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        blobParts.push(parts);
        blobTypes.push(options?.type);
      }
    } as typeof Blob;
    globalThis.URL = {
      ...originalUrl,
      createObjectURL: (blob: Blob) => {
        const objectUrl = `blob:https://www.chess.com/stockfish-${objectUrls.length + 1}`;
        objectUrls.push(objectUrl);
        return objectUrl;
      },
      revokeObjectURL: () => undefined
    } as unknown as typeof URL;
    globalThis.Worker = class {
      onmessage: ((event: MessageEvent<string>) => void) | null = null;

      constructor(url: string | URL) {
        createdUrls.push(String(url));
      }

      postMessage(): void {}

      terminate(): void {}
    } as unknown as typeof Worker;

    try {
      const engine = new LocalStockfishEngine();
      engine.dispose();
    } finally {
      globalThis.chrome = originalChrome;
      globalThis.Worker = originalWorker;
      globalThis.URL = originalUrl;
      globalThis.Blob = originalBlob;
    }

    expect(blobParts).toEqual([['importScripts("chrome-extension://test-id/vendor/stockfish/stockfish.js");']]);
    expect(blobTypes).toEqual(['text/javascript']);
    expect(createdUrls).toEqual([
      'blob:https://www.chess.com/stockfish-1#chrome-extension%3A%2F%2Ftest-id%2Fvendor%2Fstockfish%2Fstockfish.wasm'
    ]);
    expect(createdUrls[0]).not.toMatch(/,worker$/);
    expect(objectUrls).toEqual(['blob:https://www.chess.com/stockfish-1']);
  });
});

class FakeWorker {
  messages: string[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  postMessage(message: string): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(message: string): void {
    this.onmessage?.({ data: message } as MessageEvent<string>);
  }
}
