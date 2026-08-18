export type PageMode = 'live' | 'replay' | 'analysis' | 'unknown';

export type Orientation = 'white' | 'black';

export type Square =
  | 'a1' | 'b1' | 'c1' | 'd1' | 'e1' | 'f1' | 'g1' | 'h1'
  | 'a2' | 'b2' | 'c2' | 'd2' | 'e2' | 'f2' | 'g2' | 'h2'
  | 'a3' | 'b3' | 'c3' | 'd3' | 'e3' | 'f3' | 'g3' | 'h3'
  | 'a4' | 'b4' | 'c4' | 'd4' | 'e4' | 'f4' | 'g4' | 'h4'
  | 'a5' | 'b5' | 'c5' | 'd5' | 'e5' | 'f5' | 'g5' | 'h5'
  | 'a6' | 'b6' | 'c6' | 'd6' | 'e6' | 'f6' | 'g6' | 'h6'
  | 'a7' | 'b7' | 'c7' | 'd7' | 'e7' | 'f7' | 'g7' | 'h7'
  | 'a8' | 'b8' | 'c8' | 'd8' | 'e8' | 'f8' | 'g8' | 'h8';

export type PieceCode =
  | 'wP' | 'wN' | 'wB' | 'wR' | 'wQ' | 'wK'
  | 'bP' | 'bN' | 'bB' | 'bR' | 'bQ' | 'bK';

export type BoardMap = Partial<Record<Square, PieceCode>>;

export interface ModeResult {
  mode: PageMode;
  confidence: number;
  evidence: string[];
}

export interface SharingDecision {
  allowed: boolean;
  reason: 'live-game' | 'unknown-mode' | 'low-confidence' | 'share-button' | 'replay-page' | 'analysis-page';
}

export interface PlayerInfo {
  name: string;
  rating?: number;
}

export interface GamePlayers {
  white?: PlayerInfo;
  black?: PlayerInfo;
}

export interface BoardReadResult {
  board: BoardMap;
  fenPlacement: string;
  orientation: Orientation;
  confidence: number;
  source: 'board-dom' | 'manual-live-board-dom' | 'move-list' | 'chesscom-share-dialog';
  evidence: string[];
}

export interface DetectorResult {
  status: 'ok' | 'no-board' | 'low-confidence';
  gameId: string;
  mode: PageMode;
  modeConfidence: number;
  board?: BoardMap;
  fenPlacement?: string;
  boardConfidence?: number;
  fen?: string;
  pgn?: string;
  players?: GamePlayers;
  moveSequence?: string[];
  moveIndex?: number;
  orientation?: Orientation;
  source?: BoardReadResult['source'];
  reconciledFromMoveList: boolean;
  sharing: SharingDecision;
  evidence: string[];
}
