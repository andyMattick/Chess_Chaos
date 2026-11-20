/**
 * Exact forced-mate search for standard chess puzzles (no heuristics, no time
 * limit): "can the side to move force checkmate within n of its own moves,
 * whatever the other side does?" Used offline to build and check the placement
 * puzzles (scripts/gen-placement.ts), and in tests. Pure, deterministic.
 */
import { inCheck, makeMove } from '../core/movegen';
import { positionKey } from '../core/position';
import { legalActions } from '../core/rules';
import type { GameState, MoveAction } from '../core/types';

const mated = (s: GameState) => legalActions(s).length === 0 && inCheck(s, s.turn);

export class MateSolver {
  private tt = new Map<string, boolean>();
  nodes = 0;
  /** Stop with an error past this many nodes, so a generator can skip slow positions. */
  constructor(private maxNodes = Infinity) {}

  /** Does `s.turn` force mate within n of its own moves? */
  forces(s: GameState, n: number): boolean {
    if (n < 1) return false;
    const key = `${positionKey(s)}|${s.turn}|${n}`;
    const hit = this.tt.get(key);
    if (hit !== undefined) return hit;
    if (++this.nodes > this.maxNodes) throw new Error('mate search too big');
    let ok = false;
    for (const [, a] of this.ordered(s, n)) {
      if (this.afterForces(a, n)) { ok = true; break; }
    }
    this.tt.set(key, ok);
    return ok;
  }

  /** Does playing `m` force mate within n moves (counting `m`)? */
  moveForces(s: GameState, m: MoveAction, n: number): boolean {
    return this.afterForces(makeMove(s, m), n);
  }

  /** The attacker has just moved, reaching `a`: is it mate now, or forced mate within n - 1 more? */
  private afterForces(a: GameState, n: number): boolean {
    const replies = legalActions(a);
    if (!replies.length) return inCheck(a, a.turn); // mate now; stalemate is not a win
    if (n === 1) return false;
    for (const r of replies) if (!this.forces(makeMove(a, r), n - 1)) return false;
    return true;
  }

  /** A first move that forces mate within n (checks tried first), or null. */
  find(s: GameState, n: number): MoveAction | null {
    for (const [m, a] of this.ordered(s, n)) if (this.afterForces(a, n)) return m;
    return null;
  }

  /** Every first move that forces mate within n. */
  solutions(s: GameState, n: number): MoveAction[] {
    return legalActions(s).filter((m) => this.moveForces(s, m, n));
  }

  /** On the last move only a check can mate; before that, checks and captures first. */
  private ordered(s: GameState, n: number): [MoveAction, GameState][] {
    const checks: [MoveAction, GameState][] = [], caps: [MoveAction, GameState][] = [], rest: [MoveAction, GameState][] = [];
    for (const m of legalActions(s)) {
      const a = makeMove(s, m);
      if (inCheck(a, a.turn)) checks.push([m, a]);
      else if (n > 1) (s.sq[m.to] >= 0 ? caps : rest).push([m, a]);
    }
    return [...checks, ...caps, ...rest];
  }
}

export { mated as isCheckmated };
