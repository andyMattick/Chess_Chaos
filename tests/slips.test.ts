import { describe, expect, it } from 'vitest';
import { newRecord, parseSAN, play, standardStart, fromFEN } from '../src/core';
import { findSlips, slipReady } from '../src/systems/slips';
import { checkMove, puzzleFrom } from '../src/systems/puzzle';

function game(sans: string) {
  const rec = newRecord(7, { p1: 'Ava', p2: 'Bot' });
  let s = standardStart();
  for (const san of sans.split(' ')) {
    const m = parseSAN(s, san)!;
    expect(m, san).toBeTruthy();
    rec.actions.push(m);
    s = play(s, m);
  }
  return rec;
}

describe('blunder replay', () => {
  // Nine quiet moves each, then White hangs the queen with Qd5?? (the e6 pawn takes it).
  const quiet = 'Nf3 Nf6 Nc3 Nc6 e3 e6 Be2 Be7 O-O O-O d3 d6 a3 a6 h3 h6 Rb1 Rb8';
  it('finds a hung queen after move 8 and makes a puzzle where the best move (or one as good) is right', () => {
    const rec2 = game(`${quiet} Ne4 Nxe4 dxe4 Bd7 Qd5 exd5`);
    const slips = findSlips(rec2, 'p1', 'here');
    const big = slips.find((x) => x.played === 'Qd5');
    expect(big).toBeDefined();
    expect(big!.drop).toBeGreaterThanOrEqual(2);
    const pz = puzzleFrom({ id: big!.id, title: big!.text, source: 'slip', fen: big!.fen, san: [big!.best] })!;
    pz.ok = big!.ok.map((san) => parseSAN(pz.start, san)!);
    expect(checkMove(pz, pz.start, 0, parseSAN(pz.start, big!.best)!)).toBe('right');
    expect(checkMove(pz, pz.start, 0, parseSAN(pz.start, 'Qd5')!)).toBe('wrong');
    // Black played well enough: nothing for Black.
    expect(findSlips(rec2, 'p2', 'here').some((x) => x.played === 'exd5')).toBe(false);
  });
  it('ignores the opening and non-standard games', () => {
    const early = game('e4 e5 Qh5 Nc6 Qxe5+ Nxe5');
    expect(findSlips(early, 'p1', 'here')).toEqual([]);
    const koth = { ...game('e4'), setup: { kind: 'fen' as const, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', mode: 'koth' } };
    expect(slipReady(koth)).toBe(false);
    void fromFEN;
  });
});
