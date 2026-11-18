import { describe, expect, it } from 'vitest';
import { analyzeGame } from '../src/systems/analysis';
import { newRecord, replay } from '../src/core/record';
import { parseSAN } from '../src/core/san';
import { play } from '../src/core/rules';

function game(sans: string[]) {
  const rec = newRecord(3, { p1: 'A', p2: 'B' });
  let s = replay(rec)[0];
  for (const t of sans) { const m = parseSAN(s, t)!; rec.actions.push(m); s = play(s, m); }
  return rec;
}

describe('game analysis', () => {
  it('grades scholar\'s mate: the mate is best, Nf6 is a blunder with a reason', () => {
    const a = analyzeGame(game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']));
    expect(a.notes.length).toBe(7);
    expect(a.evals.length).toBe(8);
    const nf6 = a.notes[5];
    expect(nf6.san).toBe('Nf6');
    expect(nf6.grade).toBe('blunder');
    expect(nf6.text).toMatch(/checkmate/i);
    expect(nf6.bestSan).toBeTruthy();
    const mate = a.notes[6];
    expect(['best', 'good']).toContain(mate.grade);
    expect(a.evals[7]).toBeGreaterThan(5);
    expect(a.summary.p1.score).toBeGreaterThan(a.summary.p2.score);
  });

  it('spots a hung queen', () => {
    const a = analyzeGame(game(['e4', 'e5', 'Qh5', 'Nc6', 'Qxf7+', 'Kxf7']));
    const q = a.notes[4];
    expect(['mistake', 'blunder']).toContain(q.grade);
  });
});
