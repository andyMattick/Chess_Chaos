import { describe, expect, it } from 'vitest';
import { cardsEarned, handOptions, updateCollection } from '../src/systems/cards';
import { newRecord, replay, type GameRecord } from '../src/core/record';
import { parseSAN } from '../src/core/san';
import { play } from '../src/core/rules';

function game(sans: string[], fen?: string, mode?: string): GameRecord {
  const rec = newRecord(5, { p1: 'A', p2: 'B' }, fen, mode);
  let s = replay(rec)[0];
  for (const t of sans) {
    const m = parseSAN(s, t);
    if (!m) throw new Error(`bad ${t}`);
    rec.actions.push(m);
    s = play(s, m);
  }
  return rec;
}
const earn = (rec: GameRecord, extra: Partial<Parameters<typeof cardsEarned>[0]> = {}, progress = {}) =>
  cardsEarned({ record: rec, states: replay(rec), me: 'p1', rated: true, missionsCompleted: 0, rating: 1000, gamesPlayed: 1, ...extra }, progress);

describe('earning cards', () => {
  it('scholar\'s mate earns nothing special, but a fool\'s-mate loss earns nothing at all', () => {
    const r = earn(game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']));
    expect(r.cards).not.toContain('CARD-15');
    expect(r.progress.winStreak).toBe(1);
    const l = earn(game(['f3', 'e5', 'g4', 'Qh4#']));
    expect(l.cards).toEqual([]);
    expect(l.progress.winStreak).toBe(0);
  });

  it('three rated wins in a row earn the Amazon', () => {
    const r = earn(game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']), {}, { winStreak: 2 });
    expect(r.cards).toContain('CARD-03');
  });

  it('back-rank mate with a rook earns the Dragon rook; promotion earns the Super pawn', () => {
    const r = earn(game(['Ra8#'], '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'));
    expect(r.cards).toContain('CARD-15');
    const p = earn(game(['c8=Q#'], 'k7/2P5/1K6/8/8/8/8/8 w - - 0 1'));
    expect(p.cards).toContain('CARD-04');
  });

  it('a knight fork earns the Nightrider; winning Dice chess earns the Camel', () => {
    const rec = game(['Nc7+', 'Kd7', 'Nxa8'], 'q3k3/8/8/1N6/8/8/P7/4K3 w - - 0 1');
    rec.actions.push({ t: 'resign', by: 'p2' });
    const r = earn(rec);
    expect(r.cards).toContain('CARD-07');
  });

  it('beginner gift every third game under 800', () => {
    const rec = game(['f3', 'e5', 'g4', 'Qh4#']);
    expect(earn(rec, { rating: 500, gamesPlayed: 3 }).cards.length).toBe(1);
    expect(earn(rec, { rating: 500, gamesPlayed: 4 }).cards.length).toBe(0);
    expect(earn(rec, { rating: 900, gamesPlayed: 3 }).cards.length).toBe(0);
  });

  it('collection: earn adds, playing burns', () => {
    let c = updateCollection({}, ['CARD-04', 'CARD-07'], []);
    expect(handOptions(c)).toEqual(['CARD-04', 'CARD-07']);
    c = updateCollection(c, [], ['CARD-04']);
    expect(c).toEqual({ 'CARD-07': 1 });
  });
});
