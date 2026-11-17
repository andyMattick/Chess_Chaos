import type { PieceTypeId, Vec } from './types';

/**
 * Piece types are data. Card pieces, the Boss and other fairy pieces are added
 * to this table in later phases (docs/04 section 2).
 */
export type MovePattern =
  | { kind: 'leap'; offsets: Vec[] }
  | { kind: 'ride'; dirs: Vec[]; max?: number }
  | { kind: 'pawn'; double: 'first' | 'always' | 'never' };

export interface PieceType {
  id: PieceTypeId;
  name: string;
  /** Letter used in SAN and FEN (upper case). Empty for pawns in SAN. */
  letter: string;
  /** Material value in pawns, used by the AI and capture-race scoring. */
  value: number;
  royal: boolean;
  moves: MovePattern[];
  promotesTo?: PieceTypeId[];
}

const ORTH: Vec[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: Vec[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT: Vec[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

export const PIECE_TYPES: Record<PieceTypeId, PieceType> = {
  pawn: {
    id: 'pawn', name: 'Pawn', letter: 'P', value: 1, royal: false,
    moves: [{ kind: 'pawn', double: 'first' }],
    promotesTo: ['queen', 'rook', 'bishop', 'knight'],
  },
  knight: { id: 'knight', name: 'Knight', letter: 'N', value: 3, royal: false, moves: [{ kind: 'leap', offsets: KNIGHT }] },
  bishop: { id: 'bishop', name: 'Bishop', letter: 'B', value: 3.25, royal: false, moves: [{ kind: 'ride', dirs: DIAG }] },
  rook: { id: 'rook', name: 'Rook', letter: 'R', value: 5, royal: false, moves: [{ kind: 'ride', dirs: ORTH }] },
  queen: { id: 'queen', name: 'Queen', letter: 'Q', value: 9, royal: false, moves: [{ kind: 'ride', dirs: [...ORTH, ...DIAG] }] },
  king: { id: 'king', name: 'King', letter: 'K', value: 0, royal: true, moves: [{ kind: 'leap', offsets: [...ORTH, ...DIAG] }] },
};

export function pieceType(id: PieceTypeId): PieceType {
  const t = PIECE_TYPES[id];
  if (!t) throw new Error(`Unknown piece type: ${id}`);
  return t;
}

export function typeFromLetter(letter: string): PieceTypeId | undefined {
  const up = letter.toUpperCase();
  for (const t of Object.values(PIECE_TYPES)) if (t.letter === up) return t.id;
  return undefined;
}
