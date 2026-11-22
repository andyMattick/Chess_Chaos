import { describe, expect, it } from 'vitest';
import { PLACEMENT_DEEP } from '../src/content/placement';
import { makeMove } from '../src/core/movegen';
import { legalActions } from '../src/core/rules';
import { parseSAN } from '../src/core/san';
import { fromFEN } from '../src/core/setup';
import { PATH, unlockedCount } from '../src/systems/coins';
import { judgeMove, needsPlacement, nextIndex, pickTest, placementPool, placementRating, PLACE_MAX, PLACE_MIN, type PlacementPuzzle } from '../src/systems/placement';
import { puzzleFrom } from '../src/systems/puzzle';
import { MateSolver, isCheckmated } from '../src/tactics/mateSolver';

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('placement test', () => {
  it('every deep puzzle is an exact forced mate in 3 or 4, not faster, and its line ends in mate', () => {
    expect(PLACEMENT_DEEP.filter((p) => p.mateIn === 3).length).toBeGreaterThanOrEqual(4);
    expect(PLACEMENT_DEEP.filter((p) => p.mateIn === 4).length).toBeGreaterThanOrEqual(4);
    for (const p of PLACEMENT_DEEP) {
      const start = fromFEN(p.fen);
      expect(p.san.length).toBe(2 * p.mateIn - 1);
      let s = start;
      for (const t of p.san) {
        const m = parseSAN(s, t);
        expect(m, `${p.id} ${t}`).toBeTruthy();
        s = makeMove(s, m!);
      }
      expect(isCheckmated(s), p.id).toBe(true);
      const solver = new MateSolver();
      expect(solver.forces(start, p.mateIn), p.id).toBe(true);
      expect(solver.forces(start, p.mateIn - 1), p.id).toBe(false);
    }
  }, 120_000);

  it('deals two puzzles per step, steps 1 to 4 in order, two different themes where it can', () => {
    for (let seed = 1; seed < 30; seed++) {
      const t = pickTest(seeded(seed));
      expect(t.map((p) => p.tier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
      for (let i = 0; i < t.length; i += 2) expect(t[i].id).not.toBe(t[i + 1].id);
      expect(t[0].line.length).toBe(1);
      expect(t[2].line.length).toBe(3);
      expect(t[4].line.length).toBe(5);
      expect(t[6].line.length).toBe(7);
    }
    const pool = placementPool();
    expect(pool[1].length).toBeGreaterThanOrEqual(4);
    expect(pool[2].length).toBeGreaterThanOrEqual(4);
  });

  it('stops after a step where both puzzles were missed, and not before', () => {
    const t = pickTest(seeded(7));
    expect(nextIndex(t, [])).toBe(0);
    expect(nextIndex(t, [false])).toBe(1); // one miss: still the second puzzle of the step
    expect(nextIndex(t, [false, false])).toBeNull(); // both missed: done
    expect(nextIndex(t, [false, true])).toBe(2);
    expect(nextIndex(t, [true, true, false, false])).toBeNull();
    expect(nextIndex(t, [true, true, true, false, false, true, false])).toBe(7);
    expect(nextIndex(t, [true, true, true, true, true, true, true, true])).toBeNull();
  });

  it('maps solves to ★400 + 100 each, ★400 to ★1200', () => {
    expect(placementRating([])).toBe(PLACE_MIN);
    expect(placementRating([false, false])).toBe(400);
    expect(placementRating([true, false, true, true])).toBe(700);
    expect(placementRating(Array(8).fill(true))).toBe(PLACE_MAX);
    expect(PLACE_MAX).toBe(1200);
  });

  it('opens the Bot Path up to the placed rating, never fewer than the usual three', () => {
    expect(unlockedCount({})).toBe(3);
    expect(unlockedCount({}, 400)).toBe(3);
    expect(unlockedCount({}, 600)).toBe(3);
    const at900 = unlockedCount({}, 900);
    expect(PATH.slice(0, at900).every((b) => b.rating <= 900)).toBe(true);
    expect(PATH[at900]?.rating ?? Infinity).toBeGreaterThan(900);
    expect(unlockedCount({}, 1200)).toBe(PATH.filter((b) => b.rating <= 1200).length);
  });

  it('is offered once, only before the first game', () => {
    expect(needsPlacement({ gamesPlayed: 0 })).toBe(true);
    expect(needsPlacement({ gamesPlayed: 0, placement: { at: 1, skipped: true } })).toBe(false);
    expect(needsPlacement({ gamesPlayed: 3 })).toBe(false);
    expect(needsPlacement(null)).toBe(false);
  });

  it('accepts a different move that still forces mate in time, and rejects one that does not', () => {
    // Every move is judged the same way the exact solver sees it: any move that still forces mate in 2 counts.
    const pz0 = PLACEMENT_DEEP.find((p) => p.mateIn === 3)!;
    const base = puzzleFrom({ id: pz0.id, title: pz0.title, source: 'built-in', fen: pz0.fen, san: pz0.san })!;
    const pz: PlacementPuzzle = { ...base, tier: 3, mateIn: 3 };
    // Step 2 of the line: two moves left to mate.
    const s2 = makeMove(makeMove(base.start, base.line[0]), base.line[1]);
    const solver = new MateSolver();
    let accepted = 0;
    for (const m of legalActions(s2)) {
      const v = judgeMove(pz, s2, 2, m, 1e9);
      expect(v !== 'wrong', `${m.piece}->${m.to}`).toBe(solver.moveForces(s2, m, 2));
      if (v !== 'wrong') accepted++;
    }
    expect(accepted).toBeGreaterThanOrEqual(1);
    expect(judgeMove(pz, s2, 2, base.line[2])).toBe('right');
  });
});
