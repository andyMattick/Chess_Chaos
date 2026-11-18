import type { GameState, MoveAction } from '../core/types';
import { legalActions } from '../core/rules';
import { pieceType } from '../core/pieces';
import { allowsMateInOne, bestMove, rankMoves } from './search';
import { bookMove, compileBook } from './book';
import type { Bot } from '../content/bots';

/**
 * Strength control (docs/05-bots.md). Starting values; calibrate by self-play.
 */
export interface Strength {
  depth: number;
  weakChance: number;
  quiescence: boolean;
  timeMs: number;
}

const TABLE: [number, Strength][] = [
  [400, { depth: 1, weakChance: 0.35, quiescence: false, timeMs: 400 }],
  [600, { depth: 2, weakChance: 0.25, quiescence: false, timeMs: 600 }],
  [800, { depth: 2, weakChance: 0.15, quiescence: true, timeMs: 700 }],
  [1000, { depth: 3, weakChance: 0.12, quiescence: true, timeMs: 900 }],
  // ★1100 and ★1300 used to share the tier below, so the Bot Path did not get harder there (weekly check, 2026-11-18).
  [1100, { depth: 3, weakChance: 0.07, quiescence: true, timeMs: 1050 }],
  [1200, { depth: 3, weakChance: 0.04, quiescence: true, timeMs: 1200 }],
  [1300, { depth: 4, weakChance: 0.06, quiescence: true, timeMs: 1400 }],
  [1400, { depth: 4, weakChance: 0.02, quiescence: true, timeMs: 1600 }],
];

export function strengthFor(rating: number): Strength {
  let s = TABLE[0][1];
  for (const [r, v] of TABLE) if (rating >= r) s = v;
  return s;
}

/** Modes whose opening phase is standard, so books apply (docs/05). */
const BOOK_MODES = new Set(['standard', 'koth', 'three-check', 'capture-race', 'capture-the-flag', 'truce', 'lava']);

export interface ChooseOptions {
  bot?: Pick<Bot, 'asWhite' | 'asBlack'>;
  rating: number;
  /** Random numbers in [0, 1); injectable for tests. */
  random?: () => number;
  /** Only pick from these moves (a bot undoing a shown secret mission). */
  only?: MoveAction[];
}

export interface Choice {
  move: MoveAction;
  source: 'book' | 'search' | 'weak' | 'forced' | 'undo-mission';
}

export function chooseMove(s: GameState, opts: ChooseOptions): Choice | null {
  const rand = opts.random ?? Math.random;
  const legal = legalActions(s);
  if (legal.length === 0) return null;
  if (legal.length === 1) return { move: legal[0], source: 'forced' };

  if (opts.only?.length) {
    // Best of the allowed moves by a short search.
    const st = strengthFor(opts.rating);
    const same = (a: MoveAction, b: MoveAction) => a.piece === b.piece && a.to === b.to && a.promo === b.promo && a.castle === b.castle;
    const ranked = rankMoves(s, Math.min(2, st.depth), false, st.timeMs);
    const hit = ranked.find((r) => opts.only!.some((o) => same(o, r.move)));
    return { move: hit?.move ?? opts.only[0], source: 'undo-mission' };
  }

  if (opts.bot && BOOK_MODES.has(s.mode) && s.seats.length === 2) {
    const lines = s.turn === 'p1' ? opts.bot.asWhite : opts.bot.asBlack;
    const m = bookMove(compileBook(lines), s, rand());
    if (m) return { move: m, source: 'book' };
  }

  const st = strengthFor(opts.rating);

  // Beginner bots never refuse a free queen.
  const freeQueen = legal.find((m) => {
    const v = s.sq[m.to];
    return v >= 0 && s.pieces[v].type === 'queen';
  });

  if (rand() < st.weakChance) {
    const ranked = rankMoves(s, Math.min(2, st.depth), false, st.timeMs);
    const pool = ranked.slice(2, 6).filter((r) => !allowsMateInOne(s, r.move));
    if (pool.length && !(freeQueen && opts.rating <= 500)) {
      return { move: pool[Math.floor(rand() * pool.length)].move, source: 'weak' };
    }
  }

  // Modes where one side moves twice in a row need one more ply to see the other side's reply.
  const extra = s.mode === 'monster' && s.turn === s.seats[0].id ? 1 : 0;
  const res = bestMove(s, { depth: st.depth + extra, quiescence: st.quiescence, timeMs: st.timeMs * (extra ? 2 : 1) });
  let move = res.best ?? legal[0];
  if (freeQueen && opts.rating <= 500 && s.sq[move.to] < 0) {
    const qv = pieceType('queen').value;
    if (qv > 0) move = freeQueen;
  }
  return { move, source: 'search' };
}
