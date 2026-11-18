import { inCheck, makeMove, pseudoMoves } from '../core/movegen';
import { pieceType } from '../core/pieces';
import { positionKey } from '../core/position';
import { advance, hasMoveFilters, isCheckEnforced, legalActions, needsFullRules, sameMove } from '../core/rules';
import type { GameState, MoveAction, PlayerId } from '../core/types';
import { evaluate } from './evaluate';

/**
 * Alpha-beta search with iterative deepening, quiescence, a transposition table
 * and move ordering. Scores are from the root player's point of view, and every
 * other seat is treated as an opponent ("paranoid" search), so the same code
 * plays two-player and three/four-player games. Uses only legalActions and
 * makeMove, so it plays any mode without special code (docs/04 section 6).
 */

export const MATE = 100000;

export interface SearchOptions {
  depth: number;
  timeMs?: number;
  quiescence?: boolean;
}

export interface SearchResult {
  best: MoveAction | null;
  score: number;
  depth: number;
  nodes: number;
}

export interface RankedMove {
  move: MoveAction;
  score: number;
}

interface TTEntry { depth: number; score: number; flag: 0 | 1 | 2; best?: MoveAction }
const EXACT = 0, LOWER = 1, UPPER = 2;

class Timeout extends Error {}

class Searcher {
  nodes = 0;
  tt = new Map<string, TTEntry>();
  killers: MoveAction[][] = [];
  deadline: number;
  constructor(public root: PlayerId, public quiescence: boolean, timeMs?: number, public history: Record<string, number> = {}) {
    this.deadline = timeMs ? Date.now() + timeMs : Infinity;
  }

  tick() {
    if (++this.nodes % 1024 === 0 && Date.now() > this.deadline) throw new Timeout();
  }

  /** Modes with their own after-move rules are searched with them, so the bot understands explosions, double moves and drops. */
  full = false;
  step(s: GameState, m: MoveAction): GameState {
    return this.full ? advance(s, m) : makeMove(s, m);
  }

  /** A position the mode has already decided. */
  decided(s: GameState, ply: number): number | null {
    if (!s.result) return null;
    if (!s.result.winners.length) return 0;
    return s.result.winners.includes(this.root) ? MATE - ply : -MATE + ply;
  }

  order(s: GameState, moves: MoveAction[], ttBest: MoveAction | undefined, ply: number): MoveAction[] {
    const killers = this.killers[ply] ?? [];
    const scored = moves.map((m) => {
      let k = 0;
      if (ttBest && sameMove(m, ttBest)) k = 1e7;
      else {
        const victim = s.sq[m.to];
        if (victim >= 0) k = 1e5 + pieceType(s.pieces[victim].type).value * 100 - pieceType(s.pieces[m.piece].type).value;
        else if (m.promo) k = 9e4 + pieceType(m.promo).value;
        else if (killers.some((x) => sameMove(x, m))) k = 5e4;
      }
      return { m, k };
    });
    scored.sort((a, b) => b.k - a.k);
    return scored.map((x) => x.m);
  }

  terminal(s: GameState, ply: number): number {
    if (isCheckEnforced(s) && inCheck(s, s.turn)) return s.turn === this.root ? -MATE + ply : MATE - ply;
    return 0;
  }

  search(s: GameState, depth: number, alpha: number, beta: number, ply: number, path: Set<string>): number {
    this.tick();
    const done = this.decided(s, ply);
    if (done !== null) return done;
    const key = positionKey(s);
    if (ply > 0 && (path.has(key) || (this.history[key] ?? 0) >= 2)) return 0;
    if (s.halfmoveClock >= 100) return 0;

    const entry = this.tt.get(key);
    if (entry && entry.depth >= depth && ply > 0) {
      if (entry.flag === EXACT) return entry.score;
      if (entry.flag === LOWER && entry.score >= beta) return entry.score;
      if (entry.flag === UPPER && entry.score <= alpha) return entry.score;
    }

    const lazy = !hasMoveFilters(s);
    const checks = isCheckEnforced(s);
    const moves = lazy ? pseudoMoves(s) : legalActions(s);
    if (depth <= 0) {
      if (!lazy && moves.length === 0) return this.terminal(s, ply);
      return this.quiescence ? this.quiesce(s, alpha, beta, ply, 0) : this.leaf(s, ply, lazy, moves);
    }

    const maximizing = s.turn === this.root;
    const a0 = alpha, b0 = beta;
    let best = maximizing ? -Infinity : Infinity;
    let bestMove: MoveAction | undefined;
    let legalCount = 0;
    path.add(key);
    for (const m of this.order(s, moves, entry?.best, ply)) {
      const next = this.step(s, m);
      if (lazy && checks && !next.result && inCheck(next, s.turn)) continue;
      legalCount++;
      const score = this.search(next, depth - 1, alpha, beta, ply + 1, path);
      if (maximizing ? score > best : score < best) { best = score; bestMove = m; }
      if (maximizing) alpha = Math.max(alpha, score); else beta = Math.min(beta, score);
      if (alpha >= beta) {
        if (s.sq[m.to] < 0) {
          const k = (this.killers[ply] ??= []);
          if (!k.some((x) => sameMove(x, m))) { k.unshift(m); k.length = Math.min(k.length, 2); }
        }
        break;
      }
    }
    if (legalCount === 0) { path.delete(key); return this.terminal(s, ply); }
    path.delete(key);
    const flag: 0 | 1 | 2 = best <= a0 ? UPPER : best >= b0 ? LOWER : EXACT;
    this.tt.set(key, { depth, score: best, flag, best: bestMove });
    return best;
  }

  /** Depth-0 evaluation without quiescence; detects mate and stalemate. */
  leaf(s: GameState, ply: number, lazy: boolean, moves: MoveAction[]): number {
    if (lazy) {
      const checks = isCheckEnforced(s);
      if (!moves.some((m) => !checks || !inCheck(makeMove(s, m), s.turn))) return this.terminal(s, ply);
    }
    return evaluate(s, this.root);
  }

  quiesce(s: GameState, alpha: number, beta: number, ply: number, qd: number): number {
    this.tick();
    const done = this.decided(s, ply);
    if (done !== null) return done;
    const maximizing = s.turn === this.root;
    const stand = evaluate(s, this.root);
    const inChk = isCheckEnforced(s) && inCheck(s, s.turn);
    if (!inChk) {
      if (maximizing) { if (stand >= beta) return stand; alpha = Math.max(alpha, stand); }
      else { if (stand <= alpha) return stand; beta = Math.min(beta, stand); }
      if (qd >= 6) return stand;
    }
    const checks = isCheckEnforced(s);
    const all = inChk || hasMoveFilters(s) ? legalActions(s) : pseudoMoves(s);
    if (inChk && all.length === 0) return this.terminal(s, ply);
    const tactical = inChk && qd < 2 ? all : all.filter((m) => s.sq[m.to] >= 0 || m.promo === 'queen' || (s.enPassant?.square === m.to && s.pieces[m.piece].type === 'pawn'));
    let best = inChk ? (maximizing ? -Infinity : Infinity) : stand;
    for (const m of this.order(s, tactical, undefined, ply)) {
      const next = this.step(s, m);
      if (!inChk && checks && !next.result && inCheck(next, s.turn)) continue;
      const score = this.quiesce(next, alpha, beta, ply + 1, qd + 1);
      if (maximizing) { if (score > best) best = score; alpha = Math.max(alpha, score); }
      else { if (score < best) best = score; beta = Math.min(beta, score); }
      if (alpha >= beta) break;
    }
    if (best === -Infinity || best === Infinity) return stand;
    return best;
  }
}

/** Best move by iterative deepening. Returns the deepest completed iteration. */
export function bestMove(s: GameState, opts: SearchOptions): SearchResult {
  const root = s.turn;
  const searcher = new Searcher(root, opts.quiescence ?? true, opts.timeMs, s.positionCounts);
  searcher.full = needsFullRules(s);
  const moves = legalActions(s);
  if (moves.length === 0) return { best: null, score: 0, depth: 0, nodes: 0 };
  if (moves.length === 1) return { best: moves[0], score: 0, depth: 0, nodes: 0 };
  let result: SearchResult = { best: moves[0], score: 0, depth: 0, nodes: 0 };
  for (let d = 1; d <= opts.depth; d++) {
    try {
      const score = searcher.search(s, d, -Infinity, Infinity, 0, new Set());
      const best = searcher.tt.get(positionKey(s))?.best ?? result.best;
      result = { best, score, depth: d, nodes: searcher.nodes };
      if (Math.abs(score) > MATE - 100) break;
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
  }
  result.nodes = searcher.nodes;
  // The table is keyed by piece layout only, so in modes that change the board (Shrinking, Lava) a stored
  // best move could be from a different board. Only ever return a move that is legal here.
  if (result.best && !moves.some((m) => sameMove(m, result.best!))) result.best = moves[0];
  return result;
}

/**
 * Score every root move with a full window at a shallow depth. Used for
 * deliberate weaker moves, "pick from three" hints and post-game review.
 */
export function rankMoves(s: GameState, depth: number, quiescence = true, timeMs?: number): RankedMove[] {
  const root = s.turn;
  const searcher = new Searcher(root, quiescence, timeMs, s.positionCounts);
  searcher.full = needsFullRules(s);
  const ranked: RankedMove[] = [];
  for (const m of legalActions(s)) {
    let score: number;
    try {
      score = searcher.search(searcher.step(s, m), depth - 1, -Infinity, Infinity, 1, new Set([positionKey(s)]));
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      score = evaluate(searcher.step(s, m), root);
    }
    ranked.push({ move: m, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/** Does the opponent have a mate in one after this move? */
export function allowsMateInOne(s: GameState, m: MoveAction): boolean {
  const after = makeMove(s, m);
  for (const reply of legalActions(after)) {
    const n = makeMove(after, reply);
    if (legalActions(n).length === 0 && isCheckEnforced(n) && inCheck(n, n.turn) && n.turn === s.turn) return true;
  }
  return false;
}
