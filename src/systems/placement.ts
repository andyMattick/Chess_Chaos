/**
 * Placement test for new players (owner, 2026-11-20: "Starting at 600 is
 * frustrating... 1, 2, 3, 4 move-ahead puzzles"). Offered once after a player
 * is made, and skippable ("New to chess?" keeps today's start of ★600).
 *
 * Four steps, two puzzles each: find 1 good move, then 2, then 3 (mate in 3),
 * then 4 (mate in 4). One try per puzzle, no hints. The test stops after a step
 * where both puzzles were missed, so nobody sits through puzzles far too hard.
 * Each solved puzzle is worth 100: the start is ★400 + 100 per solve, so
 * ★400 (none) to ★1200 (all eight). Bots up to that rating open on the Bot Path.
 *
 * Pure: the screen passes in its own random numbers.
 */
import { PLACEMENT_DEEP } from '../content/placement';
import { MateSolver } from '../tactics/mateSolver';
import type { GameState, MoveAction } from '../core/types';
import { ALL_BUILT_IN, checkMove, puzzleFrom, type Puzzle } from './puzzle';

export const PLACE_MIN = 400;
export const PLACE_MAX = 1200;
export const PER_TIER = 2;
export const TIERS = [1, 2, 3, 4] as const;
export type Tier = (typeof TIERS)[number];

export interface PlacementPuzzle extends Puzzle {
  tier: Tier;
  /** Deep steps are forced mates: another move that still forces mate in time counts too. */
  mateIn?: number;
}

interface Entry { id: string; title: string; fen: string; san: string[]; theme: string; mateIn?: number }

/** The puzzles each step draws from. Steps 1 and 2 reuse the engine-checked built-ins. */
export function placementPool(): Record<Tier, Entry[]> {
  const oneMove = ALL_BUILT_IN.filter((p) => p.san.length === 1 && p.level <= 2);
  const twoMoves = ALL_BUILT_IN.filter((p) => p.san.length === 3);
  return {
    1: oneMove,
    2: twoMoves.map((p) => (p.theme === 'mate2' ? { ...p, mateIn: 2 } : p)),
    3: PLACEMENT_DEEP.filter((p) => p.mateIn === 3).map((p) => ({ ...p, theme: 'mate3' })),
    4: PLACEMENT_DEEP.filter((p) => p.mateIn === 4).map((p) => ({ ...p, theme: 'mate4' })),
  };
}

/** Two puzzles per step, easiest step first; inside a step, two different themes when there are. */
export function pickTest(rand: () => number): PlacementPuzzle[] {
  const pool = placementPool();
  const out: PlacementPuzzle[] = [];
  for (const tier of TIERS) {
    const list = [...pool[tier]];
    const chosen: Entry[] = [];
    while (chosen.length < PER_TIER && list.length) {
      const fresh = list.filter((e) => !chosen.some((c) => c.theme === e.theme));
      const from = fresh.length ? fresh : list;
      const e = from[Math.floor(rand() * from.length) % from.length];
      chosen.push(e);
      list.splice(list.indexOf(e), 1);
    }
    for (const e of chosen) {
      const pz = puzzleFrom({ id: e.id, title: e.title, source: 'built-in', fen: e.fen, san: e.san });
      if (pz) out.push({ ...pz, tier, mateIn: e.mateIn });
    }
  }
  return out;
}

/**
 * Which puzzle comes next, given the results so far (true = solved), or null
 * when the test is over: after the last puzzle, or after a step where both were missed.
 */
export function nextIndex(test: Pick<PlacementPuzzle, 'tier'>[], results: boolean[]): number | null {
  const i = results.length;
  if (i > 0) {
    const tier = test[i - 1].tier;
    const done = test.map((t, k) => ({ t, k })).filter((x) => x.t.tier === tier && x.k < i);
    const stepOver = i >= test.length || test[i].tier !== tier;
    if (stepOver && done.length && done.every((x) => !results[x.k])) return null;
  }
  return i < test.length ? i : null;
}

/** ★400 plus 100 for every solved puzzle, never above ★1200. */
export function placementRating(results: boolean[]): number {
  return Math.min(PLACE_MAX, PLACE_MIN + 100 * results.filter(Boolean).length);
}

/**
 * Judge one move. 'right' follows the line (or mates on the spot, like any puzzle);
 * 'solved' is a different move in a forced-mate step that is proved to still force
 * mate in time (a search with a size limit, so a phone never hangs; if the proof
 * is too big the move counts as not found); otherwise 'wrong'.
 */
export function judgeMove(pz: PlacementPuzzle, state: GameState, ply: number, m: MoveAction, maxNodes = 20_000): 'right' | 'solved' | 'wrong' {
  if (checkMove(pz, state, ply, m) === 'right') return 'right';
  if (!pz.mateIn) return 'wrong';
  const left = pz.mateIn - Math.floor(ply / 2);
  try {
    return new MateSolver(maxNodes).moveForces(state, m, left) ? 'solved' : 'wrong';
  } catch {
    return 'wrong';
  }
}

/** Offer the test once: to a player who has not played yet and has not taken or skipped it. */
export function needsPlacement(p: { gamesPlayed: number; placement?: unknown } | null | undefined): boolean {
  return !!p && p.gamesPlayed === 0 && !p.placement;
}
