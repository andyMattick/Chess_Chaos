import type { PieceTypeId, Vec } from './types';

/**
 * Piece types are data. Card pieces, the Boss and other fairy pieces are added
 * to this table in later phases (docs/04 section 2).
 */
export type MovePattern =
  | { kind: 'leap'; offsets: Vec[]; noCapture?: boolean }
  | { kind: 'ride'; dirs: Vec[]; max?: number; noCapture?: boolean }
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
  /** For variants made by modifiers: the normal piece it looks like. */
  base?: PieceTypeId;
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

  // Variants used by party modifiers (docs/03 Buffs and Handicaps).
  'pawn-sprint': { id: 'pawn-sprint', base: 'pawn', name: 'Sprint pawn', letter: 'P', value: 1.2, royal: false, moves: [{ kind: 'pawn', double: 'always' }], promotesTo: ['queen', 'rook', 'bishop', 'knight'] },
  'pawn-slow': { id: 'pawn-slow', base: 'pawn', name: 'Slow pawn', letter: 'P', value: 0.9, royal: false, moves: [{ kind: 'pawn', double: 'never' }], promotesTo: ['queen', 'rook', 'bishop', 'knight'] },
  'pawn-rusty': { id: 'pawn-rusty', base: 'pawn', name: 'Pawn', letter: 'P', value: 0.8, royal: false, moves: [{ kind: 'pawn', double: 'first' }], promotesTo: ['knight'] },
  'knight-long': { id: 'knight-long', base: 'knight', name: 'Long-jump knight', letter: 'N', value: 4, royal: false, moves: [{ kind: 'leap', offsets: [...KNIGHT, [1, 3], [3, 1], [3, -1], [1, -3], [-1, -3], [-3, -1], [-3, 1], [-1, 3]] }] },
  'queen-tired': { id: 'queen-tired', base: 'queen', name: 'Tired queen', letter: 'Q', value: 6.5, royal: false, moves: [{ kind: 'ride', dirs: [...ORTH, ...DIAG], max: 3 }] },
  'rook-file': { id: 'rook-file', base: 'rook', name: 'One-way rook', letter: 'R', value: 3.5, royal: false, moves: [{ kind: 'ride', dirs: [[0, 1], [0, -1]] }] },
  'bishop-peace': { id: 'bishop-peace', base: 'bishop', name: 'Peaceful bishop', letter: 'B', value: 1.5, royal: false, moves: [{ kind: 'ride', dirs: DIAG, noCapture: true }] },
};

/** The normal piece a type looks like (for art and SAN). */
export function baseType(id: PieceTypeId): PieceTypeId {
  return PIECE_TYPES[id]?.base ?? id;
}

export function pieceType(id: PieceTypeId): PieceType {
  const t = PIECE_TYPES[id];
  if (!t) throw new Error(`Unknown piece type: ${id}`);
  return t;
}

export function typeFromLetter(letter: string): PieceTypeId | undefined {
  const up = letter.toUpperCase();
  for (const t of Object.values(PIECE_TYPES)) if (t.letter === up && !t.base) return t.id;
  return undefined;
}
