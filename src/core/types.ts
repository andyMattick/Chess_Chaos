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
  | 'draw-agreed';

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
  | { t: 'draw-agreed' };
