import { describe, expect, it } from 'vitest';
import { ALL_BUILT_IN, builtInPuzzles, checkMove, currentStreak, EMPTY_PROGRESS, isMate, puzzleFrom, recordSolve } from '../src/systems/puzzle';
import { play, legalActions } from '../src/core/rules';
import { parseSAN } from '../src/core/san';

describe('puzzles', () => {
  it('every built-in puzzle reads fully, and mate puzzles end in mate', () => {
    const ps = builtInPuzzles();
    expect(ps.length).toBe(ALL_BUILT_IN.length);
    expect(new Set(ALL_BUILT_IN.map((x) => x.id)).size).toBe(ALL_BUILT_IN.length);
    for (const [i, p] of ps.entries()) {
      expect(p.line.length, p.id).toBe(ALL_BUILT_IN[i].san.length);
      // The solver has the last word.
      expect(p.line.length % 2, p.id).toBe(1);
      let s = p.start;
      for (const m of p.line) s = play(s, m);
      if (ALL_BUILT_IN[i].san.at(-1)!.endsWith('#')) expect(isMate(s), p.id).toBe(true);
    }
  });
  it('built-ins run easy to hard, and simple one-move mates are a small part', () => {
    const levels = ALL_BUILT_IN.map((x) => x.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    const mateInOne = ALL_BUILT_IN.filter((x) => x.san.length === 1 && x.san[0].endsWith('#')).length;
    expect(ALL_BUILT_IN.length).toBeGreaterThanOrEqual(40);
    expect(mateInOne / ALL_BUILT_IN.length).toBeLessThan(0.2);
  });

  it('reads a Chess.com style PGN with black to move', () => {
    const p = puzzleFrom({
      id: 'x', title: 't', source: 'daily',
      fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1',
      pgn: '[Event "x"]\n[SetUp "1"]\n[FEN "r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1"]\n\n1... Ra1# 0-1',
    })!;
    expect(p.solver).toBe('p2');
    expect(p.line.length).toBe(1);
  });

  it('accepts the scripted move and any other mate, rejects the rest', () => {
    // Two rooks: both Ra8# and Rb8# mate.
    const p = puzzleFrom({ id: 'y', title: 't', source: 'built-in', fen: '6k1/5ppp/8/8/8/8/5PPP/RR4K1 w - - 0 1', san: ['Ra8#'] })!;
    expect(checkMove(p, p.start, 0, parseSAN(p.start, 'Ra8')!)).toBe('right');
    expect(checkMove(p, p.start, 0, parseSAN(p.start, 'Rb8')!)).toBe('right');
    expect(checkMove(p, p.start, 0, parseSAN(p.start, 'Ra7')!)).toBe('wrong');
    expect(legalActions(p.start).length).toBeGreaterThan(5);
  });

  it('streak grows on consecutive days, resets after a gap, pays once per puzzle', () => {
    let pr = EMPTY_PROGRESS;
    let r = recordSolve(pr, { id: 'd1', source: 'daily' }, false, '2026-11-15');
    expect(r.progress.streak).toBe(1); expect(r.coins).toBe(8);
    r = recordSolve(r.progress, { id: 'd2', source: 'daily' }, true, '2026-11-16');
    expect(r.progress.streak).toBe(2); expect(r.coins).toBe(4 + 2);
    // Same puzzle again: no coins, no streak change.
    const again = recordSolve(r.progress, { id: 'd2', source: 'daily' }, false, '2026-11-16');
    expect(again.coins).toBe(0); expect(again.progress.streak).toBe(2);
    expect(currentStreak(r.progress, '2026-11-17')).toBe(2);
    expect(currentStreak(r.progress, '2026-11-18')).toBe(0);
    r = recordSolve(r.progress, { id: 'd4', source: 'daily' }, false, '2026-11-18');
    expect(r.progress.streak).toBe(1); expect(r.progress.best).toBe(2);
    pr = r.progress;
    const rnd = recordSolve(pr, { id: 'r1', source: 'random' }, false, '2026-11-18');
    expect(rnd.coins).toBe(3); expect(rnd.progress.streak).toBe(1); expect(rnd.progress.solved).toBe(4);
  });
});
