/**
 * Core types. Pure data, JSON-serialisable. See docs/04-engine-architecture.md
 * and docs/09-multiplayer-and-roles.md section 3 (2 to 4 seats from day one).
 */

export type PlayerId = 'p1' | 'p2' | 'p3' | 'p4';
export type PieceTypeId = string;
export type Vec = [number, number];

export interface Seat {
  id: PlayerId;
  /** Display name: "White", "Black", "Red", ... */
  name: string;
  /** Pawn direction as a [file, rank] vector. */
  forward: Vec;
  /** A pawn promotes when this coordinate of its square equals value. */
  promo: { axis: 'f' | 'r'; value: number };
  team?: 'A' | 'B';
  status: 'active' | 'eliminated';
}

export interface BoardShape {
  width: number;
  height: number;
  /** Wrap-around mode: the first and last file are joined. */
  wrapFiles: boolean;
  /** One entry per square, true when the square does not exist or cannot be entered. */
  blocked: boolean[];
}

export interface Piece {
  /** Stable for the whole game; equals the index in GameState.pieces. */
  id: number;
  type: PieceTypeId;
  owner: PlayerId;
  /** Square the piece started the game on. */
  home: number;
  /** Current square, or -1 once captured. */
  at: number;
  moved: boolean;
  marks?: string[];
}

export interface EnPassant {
  /** Square a capturing pawn moves to. */
  square: number;
  /** Square of the pawn that would be removed. */
  victim: number;
  by: PlayerId;
}

export type EndReason =
  | 'checkmate'
  | 'mode-win'
  | 'mission'
  | 'resign'
  | 'time'
  | 'stalemate'
  | 'draw-repetition'
  | 'draw-50'
  | 'draw-material'
  | 'draw-agreed'
  /** Three or four player games: the last king (or team) standing. */
  | 'last-standing'
  /** Party match: a secret mission was completed. */
  | 'mission';

export interface GameResult {
  reason: EndReason;
  /** Empty for a draw. */
  winners: PlayerId[];
}

export interface GameState {
  board: BoardShape;
  seats: Seat[];
  pieces: Piece[];
  /** Occupancy: piece id per square, -1 when empty. */
  sq: number[];
  turn: PlayerId;
  ply: number;
  halfmoveClock: number;
  enPassant: EnPassant | null;
  positionCounts: Record<string, number>;
  mode: string;
  /** Seeded generator state; see rng.ts. */
  rng: number;
  /** Per-mode counters (hill scores, checks given…). JSON only. */
  modeData?: Record<string, unknown>;
  /** Extra rule modules on top of the mode, e.g. "HCAP-09@p1" (party modifiers). */
  rules?: string[];
  /** The last move played (for mirror, effects, missions). */
  last?: { piece: number; type: string; by: PlayerId; from: number; to: number; captured?: string };
  result: GameResult | null;
}

export interface MoveAction {
  t: 'move';
  piece: number;
  to: number;
  promo?: PieceTypeId;
  castle?: 'k' | 'q';
}

export type Action =
  | MoveAction
  | { t: 'resign'; by: PlayerId }
  /** A player's clock ran out (online games). */
  | { t: 'timeout'; by: PlayerId }
  /** A one-shot buff (party match). Fields used depend on the buff. */
  | { t: 'buff'; by: PlayerId; id: string; piece?: number; target?: number; to?: number; to2?: number }
  /** A secret mission was completed (checked by the referee: server or this device). */
  | { t: 'mission'; by: PlayerId; id: string }
  | { t: 'draw-agreed' };
