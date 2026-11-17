import { fromFEN, parseSAN, play, standardStart, legalActions, toSAN } from '../src/core';
import { bestMove } from '../src/ai/search';
import { chooseMove } from '../src/ai/strength';
import { compileBook } from '../src/ai/book';
import { BOTS } from '../src/content/bots';

describe('search', () => {
  it('finds mate in one', () => {
    const s = fromFEN('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    const r = bestMove(s, { depth: 2 });
    expect(toSAN(s, r.best!)).toBe('Rd8#');
  });

  it('finds mate in two', () => {
    // 1.Kb6 Kb8 2.Rh8#
    const s = fromFEN('k7/8/2K5/8/8/8/8/7R w - - 0 1');
    const r = bestMove(s, { depth: 4 });
    expect(r.score).toBeGreaterThan(90000);
    let after = play(s, r.best!);
    expect(after.result).toBeNull();
    const reply = bestMove(after, { depth: 3 });
    after = play(after, reply.best!);
    const finish = bestMove(after, { depth: 2 });
    expect(play(after, finish.best!).result?.reason).toBe('checkmate');
  });

  it('wins a hanging queen', () => {
    const s = fromFEN('rnb1kbnr/pppp1ppp/8/3qp3/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 1');
    const r = bestMove(s, { depth: 2 });
    expect(s.pieces[s.sq[r.best!.to]]?.type).toBe('queen');
  });

  it('never returns an illegal move over a random game', { timeout: 60000 }, () => {
    let s = standardStart();
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 40 && !s.result; i++) {
      const c = chooseMove(s, { rating: 600 + (i % 4) * 200, random: rand })!;
      expect(legalActions(s).some((m) => m.piece === c.move.piece && m.to === c.move.to)).toBe(true);
      s = play(s, c.move);
    }
  });
});

describe('bots', () => {
  it('has 18 bots with unique ids', () => {
    expect(BOTS.length).toBe(18);
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(18);
  });

  for (const bot of BOTS) {
    it(`${bot.name}: every book line is legal`, () => {
      expect(() => compileBook(bot.asWhite)).not.toThrow();
      expect(() => compileBook(bot.asBlack)).not.toThrow();
    });
  }

  it('London bot plays its signature opening as White', () => {
    const lola = BOTS.find((b) => b.id === 'BOT-03')!;
    let s = standardStart();
    const c1 = chooseMove(s, { bot: lola, rating: lola.rating, random: () => 0 })!;
    expect(c1.source).toBe('book');
    expect(toSAN(s, c1.move)).toBe('d4');
    s = play(s, c1.move);
    s = play(s, parseSAN(s, 'd5')!);
    const c2 = chooseMove(s, { bot: lola, rating: lola.rating, random: () => 0 })!;
    expect(toSAN(s, c2.move)).toBe('Bf4');
  });

  it('Sicilian bot answers e4 with c5', () => {
    const sal = BOTS.find((b) => b.id === 'BOT-15')!;
    const s = play(standardStart(), parseSAN(standardStart(), 'e4')!);
    expect(toSAN(s, chooseMove(s, { bot: sal, rating: sal.rating, random: () => 0 })!.move)).toBe('c5');
  });
});
