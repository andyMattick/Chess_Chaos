import { describe, expect, it } from 'vitest';
import { addPiece, emptyState } from '../src/core/setup';
import { legalActions, play } from '../src/core';
import { leapTargets, stepDir } from '../src/core/board';
import { triStart } from '../src/core/variants';
import { pseudoMovesFor } from '../src/core/movegen';
import type { GameState, Seat } from '../src/core/types';

/** Square of seat s's half-board, file f (0 = their a-file), rank r (0 = their back row). */
const T = (s: number, f: number, r: number) => (s * 4 + r) * 8 + f;
function empty(): GameState {
  const seats: Seat[] = (['p1', 'p2', 'p3'] as const).map((id, i) => ({ id, name: id, forward: [0, 1], promo: { axis: 'r', value: i }, status: 'active' }));
  const s = emptyState(8, 12, seats);
  s.board.topology = 'tri';
  return s;
}
const targets = (s: GameState, at: number) => pseudoMovesFor(s, s.pieces[s.sq[at]]).map((m) => m.to).sort((a, b) => a - b);

describe('three-player hexagon', () => {
  it('starts with 48 pieces and 20 moves for White, like normal chess', () => {
    const s = triStart();
    expect(s.pieces.length).toBe(48);
    expect(legalActions(s).length).toBe(20);
  });
  it('files run straight on into the next half-board (file f meets file 7-f)', () => {
    const b = triStart().board;
    expect(stepDir(b, T(0, 1, 3), 0, 1)).toEqual([T(2, 6, 3), 0, -1]); // b4 of White into Gold's g4
    expect(stepDir(b, T(0, 6, 3), 0, 1)).toEqual([T(1, 1, 3), 0, -1]); // g4 into Black's b4
    expect(stepDir(b, T(0, 0, 3), -1, 1)[0]).toBe(-1); // off the edge
  });
  it('a rook goes all the way through to the far back row', () => {
    const s = empty();
    addPiece(s, 'rook', 'p1', T(0, 1, 0));
    addPiece(s, 'king', 'p1', T(0, 7, 0));
    const t = targets(s, T(0, 1, 0));
    for (const r of [1, 2, 3]) expect(t).toContain(T(0, 1, r));
    for (const r of [3, 2, 1, 0]) expect(t).toContain(T(2, 6, r));
  });
  it('a diagonal through the middle point comes out of the square opposite', () => {
    const s = empty();
    addPiece(s, 'bishop', 'p1', T(0, 2, 2));
    const t = targets(s, T(0, 2, 2));
    // c3 -> d4 -> (middle) -> Black's e4 -> f3 -> g2 -> h1
    for (const sq of [T(0, 3, 3), T(1, 4, 3), T(1, 5, 2), T(1, 6, 1), T(1, 7, 0)]) expect(t).toContain(sq);
  });
  it('knights jump across the line', () => {
    const b = triStart().board;
    // From White's b3 (1,2): two forward lands in Gold's half.
    const t = leapTargets(b, T(0, 1, 2), 1, 2);
    expect(t).toEqual(expect.arrayContaining([T(2, 5, 3)]));
  });
  it('a pawn in someone else\'s half walks to their back row and promotes there', () => {
    const s = empty();
    addPiece(s, 'pawn', 'p1', T(0, 2, 3));
    addPiece(s, 'king', 'p1', T(0, 4, 0));
    addPiece(s, 'king', 'p2', T(1, 4, 0));
    addPiece(s, 'king', 'p3', T(2, 0, 0));
    let x = { ...s, positionCounts: {} };
    const step1 = legalActions(x).find((m) => m.t === 'move' && m.to === T(2, 5, 3));
    expect(step1).toBeDefined();
    // Put it one step from Gold's back row instead.
    const y = empty();
    addPiece(y, 'pawn', 'p1', T(2, 5, 1));
    addPiece(y, 'king', 'p1', T(0, 4, 0));
    addPiece(y, 'king', 'p2', T(1, 4, 0));
    addPiece(y, 'king', 'p3', T(2, 0, 0));
    const promos = legalActions(y).filter((m) => m.t === 'move' && m.to === T(2, 5, 0));
    expect(promos.some((m) => m.t === 'move' && m.promo === 'queen')).toBe(true);
    void x;
  });
  it('castling still works on your own back row', () => {
    const s = empty();
    addPiece(s, 'king', 'p1', T(0, 4, 0));
    addPiece(s, 'rook', 'p1', T(0, 7, 0));
    addPiece(s, 'king', 'p2', T(1, 4, 0));
    addPiece(s, 'king', 'p3', T(2, 4, 0));
    expect(legalActions(s).some((m) => m.t === 'move' && m.castle === 'k')).toBe(true);
  });
  it('200 random moves never break (every move lands on the board)', () => {
    let s = triStart('battle', 3);
    let x = 7;
    for (let i = 0; i < 200 && !s.result; i++) {
      const moves = legalActions(s);
      if (!moves.length) break;
      x = (x * 1103515245 + 12345) % 2147483648;
      s = play(s, moves[x % moves.length]);
      for (const p of s.pieces) if (p.at >= 0) expect(s.sq[p.at]).toBe(p.id);
    }
  });
});
