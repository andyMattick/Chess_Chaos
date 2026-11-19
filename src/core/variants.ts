import { addPiece, emptyState } from './setup';
import { positionKey } from './position';
import type { GameState, PlayerId, Seat } from './types';

/**
 * Three and four player chess (docs/09 s4): a 14x14 board with a 3x3 block
 * removed from each corner. Each army sits on the middle 8 squares of one side.
 * Turn order is clockwise: bottom, left, top, right.
 * Pawns promote after travelling 7 squares (the eighth row from their side).
 */
export type BattleKind = 'three' | 'four' | 'teams' | 'tri';

const N = 14;
const BACK = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

export const SEAT_COLOURS: Record<PlayerId, string> = { p1: '#f4efe2', p2: '#3a3550', p3: '#ffcf3a', p4: '#45c7a8' };

function battleSeats(kind: BattleKind): Seat[] {
  const all: Seat[] = [
    { id: 'p1', name: 'White', forward: [0, 1], promo: { axis: 'r', value: 8 }, status: 'active' },
    { id: 'p2', name: 'Black', forward: [1, 0], promo: { axis: 'f', value: 8 }, status: 'active' },
    { id: 'p3', name: 'Gold', forward: [0, -1], promo: { axis: 'r', value: 5 }, status: 'active' },
    { id: 'p4', name: 'Mint', forward: [-1, 0], promo: { axis: 'f', value: 5 }, status: 'active' },
  ];
  if (kind === 'three') return all.slice(0, 3);
  if (kind === 'teams') {
    // Partners sit opposite each other.
    all[0].team = 'A'; all[2].team = 'A';
    all[1].team = 'B'; all[3].team = 'B';
  }
  return all;
}

/**
 * Three players on the hexagon (owner, 2026-11-18; board.ts). Each seat's
 * half-board is stored with its own back row at local rank 0, so every seat's
 * pawns start by walking "up" (forward [0, 1]); promo.value is the seat's half.
 */
/** The six middle squares (every player's d4 and e4), left out of the board since 2026-11-19 (owner). */
export const TRI_HOLE = [0, 1, 2].flatMap((s) => [(s * 4 + 3) * 8 + 3, (s * 4 + 3) * 8 + 4]);

export function triStart(mode = 'battle', seed = 1, hole = false): GameState {
  const seats: Seat[] = (['p1', 'p2', 'p3'] as PlayerId[]).map((id, i) => ({ id, name: ['White', 'Black', 'Gold'][i], forward: [0, 1], promo: { axis: 'r', value: i }, status: 'active' }));
  const s = emptyState(8, 12, seats, seed);
  s.board.topology = 'tri';
  if (hole) for (const sq of TRI_HOLE) s.board.blocked[sq] = true;
  seats.forEach((seat, i) => {
    for (let f = 0; f < 8; f++) {
      addPiece(s, BACK[f], seat.id, (i * 4) * 8 + f);
      addPiece(s, 'pawn', seat.id, (i * 4 + 1) * 8 + f);
    }
  });
  s.mode = mode;
  s.positionCounts = { [positionKey(s)]: 1 };
  return s;
}

export function battleStart(kind: BattleKind, mode = 'battle', seed = 1, hole = false): GameState {
  if (kind === 'tri') return triStart(mode, seed, hole);
  const seats = battleSeats(kind);
  const s = emptyState(N, N, seats, seed);
  for (let f = 0; f < N; f++) for (let r = 0; r < N; r++) {
    const corner = (f < 3 || f > 10) && (r < 3 || r > 10);
    if (corner) s.board.blocked[r * N + f] = true;
  }
  const at = (f: number, r: number) => r * N + f;
  for (let i = 0; i < 8; i++) {
    const x = 3 + i;
    // Bottom (p1), facing up: left to right is files 3..10.
    addPiece(s, BACK[i], 'p1', at(x, 0)); addPiece(s, 'pawn', 'p1', at(x, 1));
    // Left (p2), facing right: their left is the top, so ranks 10..3.
    addPiece(s, BACK[i], 'p2', at(0, 10 - i)); addPiece(s, 'pawn', 'p2', at(1, 10 - i));
    // Top (p3), facing down: their left is file 10.
    addPiece(s, BACK[i], 'p3', at(10 - i, 13)); addPiece(s, 'pawn', 'p3', at(10 - i, 12));
    if (kind !== 'three') {
      // Right (p4), facing left: their left is the bottom, ranks 3..10.
      addPiece(s, BACK[i], 'p4', at(13, 3 + i)); addPiece(s, 'pawn', 'p4', at(12, 3 + i));
    }
  }
  s.mode = mode;
  s.positionCounts = { [positionKey(s)]: 1 };
  return s;
}
