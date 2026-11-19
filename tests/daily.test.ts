import { describe, expect, it } from 'vitest';
import { DAILY_ALL_BONUS, DAILY_MISSIONS, claim, dailyById, dailyFor, isDone, noteKind, pickDaily } from '../src/systems/daily';

describe('daily missions', () => {
  it('picks three from different groups, always one Level-Up, same for a date', () => {
    for (let d = 1; d <= 60; d++) {
      const day = `2026-12-${String((d % 28) + 1).padStart(2, '0')}-${d}`;
      const ids = pickDaily(day);
      expect(ids).toHaveLength(3);
      const groups = ids.map((id) => dailyById(id)!.group);
      expect(new Set(groups).size).toBe(3);
      expect(groups).toContain('levelup');
      expect(pickDaily(day)).toEqual(ids);
    }
  });
  it('uses every mission over a few months', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 120; d++) pickDaily(`day-${d}`).forEach((id) => seen.add(id));
    expect(seen.size).toBe(DAILY_MISSIONS.length);
  });
  it('resets on a new day and counts progress up to the goal', () => {
    let s = dailyFor(undefined, '2026-11-19');
    s = { ...s, ids: ['D-puzzle', 'D-party', 'D-lu-win'] };
    for (let i = 0; i < 5; i++) s = noteKind(s, 'puzzle');
    expect(s.progress['D-puzzle']).toBe(3);
    expect(isDone(s, 'D-puzzle')).toBe(true);
    expect(noteKind(s, 'bot-win')).toBe(s);
    expect(dailyFor(s, '2026-11-20').progress).toEqual({});
    expect(dailyFor(s, '2026-11-19')).toBe(s);
  });
  it('pays once per mission, plus a bonus for all three', () => {
    let s = { ...dailyFor(undefined, 'x'), ids: ['D-puzzle', 'D-party', 'D-lu-win'] };
    expect(claim(s, 'D-party').coins).toBe(0);
    s = noteKind(noteKind(noteKind(noteKind(noteKind(s, 'puzzle'), 'puzzle'), 'puzzle'), 'party'), 'lu-win');
    let r = claim(s, 'D-puzzle'); expect(r.coins).toBe(10); s = r.state;
    expect(claim(s, 'D-puzzle').coins).toBe(0);
    r = claim(s, 'D-party'); expect(r.coins).toBe(15); s = r.state;
    r = claim(s, 'D-lu-win'); expect(r.coins).toBe(20 + DAILY_ALL_BONUS);
  });
});
