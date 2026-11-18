import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/content/bots';
import { cardKey, DAY, grade, isLineMove, lineMoves, sessionLines, trainerLines, trainerStats } from '../src/systems/openings';

describe('opening trainer', () => {
  it('every bot has legal lines to learn as White and as Black', () => {
    for (const b of BOTS) {
      expect(trainerLines(b, 'w').length, `${b.name} white`).toBeGreaterThan(0);
      expect(trainerLines(b, 'b').length, `${b.name} black`).toBeGreaterThan(0);
    }
  });
  it('checks your move against the line', () => {
    const l = lineMoves('e4 e5 Nf3')!;
    expect(isLineMove(l, 0, l.moves[0])).toBe(true);
    expect(isLineMove(l, 2, l.moves[0])).toBe(false);
    expect(lineMoves('e4 e4')).toBeNull();
  });
  it('spaced repetition: clean lines come back later and later, a slip starts over', () => {
    let c = grade(undefined, 0, 0);
    expect(c.box).toBe(1);
    expect(c.due).toBe(DAY);
    c = grade(c, 0, DAY);
    expect(c.box).toBe(2);
    expect(c.due).toBe(DAY + 3 * DAY);
    c = grade(c, 2, 5 * DAY);
    expect(c.box).toBe(0);
    expect(c.due).toBe(5 * DAY); // straight back
    expect(c.seen).toBe(3);
    expect(c.clean).toBe(2);
  });
  it('a session takes due lines first, then new ones', () => {
    const lines = ['a', 'b', 'c', 'd'];
    const key = (l: string) => cardKey('BOT-01', 'w', l);
    const cards = { [key('b')]: { box: 1, due: 50, seen: 1, clean: 1 }, [key('c')]: { box: 3, due: 500, seen: 3, clean: 3 }, [key('a')]: { box: 0, due: 10, seen: 1, clean: 0 } };
    expect(sessionLines(lines, cards, key, 100, 3)).toEqual(['a', 'b', 'd']);
    expect(trainerStats(lines, cards, key, 100)).toEqual({ total: 4, learned: 1, due: 2, fresh: 1 });
  });
});
