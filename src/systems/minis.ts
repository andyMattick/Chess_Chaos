import { fromFEN } from '../core/setup';
import { legalActions, play } from '../core/rules';
import { makeMove } from '../core/movegen';
import { parseSAN, toSAN } from '../core/san';
import type { GameState, MoveAction } from '../core/types';
import { hanging } from '../tactics/attacks';
import type { PathLevel } from '../content/minis';

/** Rules for the solo mini-games (content/minis.ts). Pure: no DOM. */

export function sqOf(name: string): number {
  return (Number(name[1]) - 1) * 8 + (name.charCodeAt(0) - 97);
}

const LETTER = { rook: 'R', bishop: 'B', knight: 'N', king: 'K', queen: 'Q' } as const;

/** The board for a maze or candy level: one White piece, walls as blocked squares. */
export function pathState(level: PathLevel, at = sqOf(level.start)): GameState {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      if (r * 8 + f === at) { if (empty) { row += empty; empty = 0; } row += LETTER[level.piece]; } else empty++;
    }
    rows.push(row + (empty ? String(empty) : ''));
  }
  const s = fromFEN(`${rows.join('/')} w - - 0 1`);
  const blocked = s.board.blocked.slice();
  for (const w of level.walls) blocked[sqOf(w)] = true;
  return { ...s, board: { ...s.board, blocked } };
}

/** Where the piece can go from here (real chess moves; walls block). */
export function pathMoves(s: GameState): MoveAction[] {
  return legalActions({ ...s, turn: 'p1' });
}

/** Move the piece; it stays White's turn. */
export function pathStep(s: GameState, m: MoveAction): GameState {
  return { ...makeMove({ ...s, turn: 'p1' }, m), turn: 'p1' };
}

/** Fewest moves to visit every goal (any order), by breadth-first search. -1 if impossible. */
export function pathPar(level: PathLevel): number {
  const goals = level.goals.map(sqOf);
  const full = (1 << goals.length) - 1;
  const start = sqOf(level.start);
  const key = (sq: number, mask: number) => sq * 64 + mask;
  const seen = new Set<number>([key(start, 0)]);
  let frontier: [number, number][] = [[start, 0]];
  for (let d = 0; frontier.length && d < 64; d++) {
    const next: [number, number][] = [];
    for (const [sq, mask] of frontier) {
      if (mask === full) return d;
      for (const m of pathMoves(pathState(level, sq))) {
        const gi = goals.indexOf(m.to);
        const nm = gi >= 0 ? mask | (1 << gi) : mask;
        const k = key(m.to, nm);
        if (!seen.has(k)) { seen.add(k); next.push([m.to, nm]); }
      }
    }
    frontier = next;
  }
  return -1;
}

/** 3 stars at par, 2 within two extra moves, else 1. */
export function pathStars(moves: number, par: number): number {
  return moves <= par ? 3 : moves <= par + 2 ? 2 : 1;
}

/** MINI-05: any mate counts, not only the one we found. */
export function isMate(fen: string, m: MoveAction): boolean {
  try { return play(fromFEN(fen), m).result?.reason === 'checkmate'; } catch { return false; }
}

/** MINI-06: after the move, nothing of White's is hanging. */
export function guardsAll(fen: string, m: MoveAction): boolean {
  try {
    const n = play(fromFEN(fen), m);
    return !n.result && hanging(n, 'p1').length === 0;
  } catch { return false; }
}

/** The capture to judge in MINI-07, as from and to squares for an arrow. */
export function tradeMove(fen: string, san: string): MoveAction | undefined {
  return parseSAN(fromFEN(fen), san);
}

/** MINI-08: one of the best moves for the lit piece. */
export function isSpotlightBest(fen: string, best: string[], m: MoveAction): boolean {
  const s = fromFEN(fen);
  try { return best.includes(toSAN(s, m)); } catch { return false; }
}

/** A fresh order for a round (seeded shuffle). */
export function shuffled<T>(list: T[], rand: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
