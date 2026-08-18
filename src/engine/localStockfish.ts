import { Chess } from 'chess.js';
import { parseInfoLine, type EngineLine } from './stockfishUci';

interface WorkerLike {
  onmessage: ((event: MessageEvent<string>) => void) | null;
  postMessage: (message: string) => void;
  terminate: () => void;
}

export interface LocalStockfishEngineOptions {
  createWorker?: () => WorkerLike;
  multipv?: number;
  depth?: number;
  minimumUpdateDepth?: number;
}

export interface ContinuousAnalysisSession {
  stop: () => void;
}

export interface StockfishSearchOptions {
  noCaptures?: boolean;
}

type PendingAnalysis =
  | {
    mode: 'single';
    lines: Map<number, EngineLine>;
    resolve: (lines: EngineLine[]) => void;
    canceled: boolean;
    settled: boolean;
  }
  | {
    mode: 'continuous';
    lines: Map<number, EngineLine>;
    onUpdate: (lines: EngineLine[]) => void;
    canceled: boolean;
  };

interface QueuedSearch {
  request: PendingAnalysis;
  start: () => void;
}

export class LocalStockfishEngine {
  private readonly worker: WorkerLike;
  private readonly multipv: number;
  private readonly depth: number;
  private readonly minimumUpdateDepth: number;
  private initialized = false;
  private pending: PendingAnalysis | null = null;
  private stopping = false;
  private queuedSearch: QueuedSearch | null = null;

  constructor(options: LocalStockfishEngineOptions = {}) {
    this.worker = options.createWorker?.() ?? createDefaultWorker();
    this.multipv = options.multipv ?? 8;
    this.depth = options.depth ?? 12;
    this.minimumUpdateDepth = options.minimumUpdateDepth ?? 4;
    this.worker.onmessage = (event) => this.handleMessage(String(event.data));
  }

  analyze(fen: string, depth = this.depth, searchOptions: StockfishSearchOptions = {}): Promise<EngineLine[]> {
    const searchMoves = allowedSearchMoves(fen, searchOptions);
    if (searchMoves?.length === 0) {
      return Promise.resolve([]);
    }

    this.initialize();

    let request!: PendingAnalysis;
    const promise = new Promise<EngineLine[]>((resolve) => {
      request = {
        mode: 'single',
        lines: new Map(),
        resolve,
        canceled: false,
        settled: false
      };
    });

    this.startSearchWhenReady(request, () => {
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(goCommand(depth, searchMoves));
    });
    return promise;
  }

  analyzeContinuously(
    fen: string,
    onUpdate: (lines: EngineLine[]) => void,
    searchOptions: StockfishSearchOptions = {}
  ): ContinuousAnalysisSession {
    const searchMoves = allowedSearchMoves(fen, searchOptions);
    if (searchMoves?.length === 0) {
      onUpdate([]);
      return { stop: () => undefined };
    }

    this.initialize();

    const pending: PendingAnalysis = {
      mode: 'continuous',
      lines: new Map(),
      onUpdate,
      canceled: false
    };

    this.startSearchWhenReady(pending, () => {
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(goCommand(this.depth, searchMoves));
    });

    return {
      stop: () => {
        if (this.pending === pending) {
          this.stopPendingSearch();
          return;
        }

        this.cancelQueuedSearch(pending);
      }
    };
  }

  dispose(): void {
    this.cancelQueuedSearch();
    if (this.pending) {
      this.cancelAnalysis(this.pending);
    }
    this.worker.terminate();
    this.pending = null;
    this.stopping = false;
  }

  private handleMessage(message: string): void {
    const line = parseInfoLine(message);
    if (line && this.pending) {
      if (this.pending.canceled) {
        return;
      }

      this.pending.lines.set(line.multipv, line);
      if (this.pending.mode === 'continuous' && line.depth >= this.minimumUpdateDepth) {
        this.pending.onUpdate(sortedLines(this.pending.lines));
      }
      return;
    }

    if (isBestMoveLine(message)) {
      if (this.pending?.mode === 'single' && !this.pending.canceled) {
        this.resolveSingleAnalysis(this.pending, sortedLines(this.pending.lines));
      }

      this.pending = null;
      if (this.stopping) {
        this.stopping = false;
        this.startQueuedSearch();
      }
    }
  }

  private initialize(): void {
    if (this.initialized) {
      return;
    }

    this.worker.postMessage('uci');
    this.worker.postMessage(`setoption name MultiPV value ${this.multipv}`);
    this.worker.postMessage('isready');
    this.initialized = true;
  }

  private startSearchWhenReady(request: PendingAnalysis, postSearchCommands: () => void): void {
    const start = (): void => {
      if (request.canceled) {
        return;
      }

      this.pending = request;
      postSearchCommands();
    };

    if (this.pending || this.stopping) {
      this.queueSearch(request, start);
      this.stopPendingSearch();
      return;
    }

    start();
  }

  private queueSearch(request: PendingAnalysis, start: () => void): void {
    this.cancelQueuedSearch();
    this.queuedSearch = { request, start };
  }

  private startQueuedSearch(): void {
    const queued = this.queuedSearch;
    this.queuedSearch = null;
    queued?.start();
  }

  private cancelQueuedSearch(request?: PendingAnalysis): void {
    if (!this.queuedSearch) {
      return;
    }

    if (request && this.queuedSearch.request !== request) {
      return;
    }

    this.cancelAnalysis(this.queuedSearch.request);
    this.queuedSearch = null;
  }

  private stopPendingSearch(): void {
    if (!this.pending || this.pending.canceled) {
      return;
    }

    this.cancelAnalysis(this.pending);
    this.worker.postMessage('stop');
    this.stopping = true;
  }

  private cancelAnalysis(request: PendingAnalysis): void {
    request.canceled = true;
    if (request.mode === 'single') {
      this.resolveSingleAnalysis(request, []);
    }
  }

  private resolveSingleAnalysis(request: Extract<PendingAnalysis, { mode: 'single' }>, lines: EngineLine[]): void {
    if (request.settled) {
      return;
    }

    request.settled = true;
    request.resolve(lines);
  }
}

function allowedSearchMoves(fen: string, options: StockfishSearchOptions): string[] | undefined {
  if (!options.noCaptures) {
    return undefined;
  }

  const chess = new Chess(fen);
  return chess.moves({ verbose: true })
    .filter((move) => !move.isCapture())
    .map((move) => `${move.from}${move.to}${move.promotion ?? ''}`);
}

function goCommand(depth: number, searchMoves?: string[]): string {
  return searchMoves
    ? `go depth ${depth} searchmoves ${searchMoves.join(' ')}`
    : `go depth ${depth}`;
}

function sortedLines(lines: Map<number, EngineLine>): EngineLine[] {
  return Array.from(lines.values()).sort((a, b) => a.multipv - b.multipv);
}

function isBestMoveLine(message: string): boolean {
  return message.startsWith('bestmove ');
}

function createDefaultWorker(): WorkerLike {
  const runtime = typeof chrome !== 'undefined' ? chrome.runtime : undefined;
  const scriptUrl = runtime?.getURL ? runtime.getURL('vendor/stockfish/stockfish.js') : 'vendor/stockfish/stockfish.js';
  const wasmUrl = runtime?.getURL ? runtime.getURL('vendor/stockfish/stockfish.wasm') : 'vendor/stockfish/stockfish.wasm';
  const bootstrapUrl = URL.createObjectURL(
    new Blob([`importScripts(${JSON.stringify(scriptUrl)});`], { type: 'text/javascript' })
  );
  const workerUrl = `${bootstrapUrl}#${encodeURIComponent(wasmUrl)}`;
  const worker = new Worker(workerUrl) as WorkerLike;
  const terminate = worker.terminate.bind(worker);

  worker.terminate = () => {
    terminate();
    URL.revokeObjectURL(bootstrapUrl);
  };

  return worker;
}
