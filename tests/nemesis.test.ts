import { describe, expect, it } from 'vitest';
import { buildNemesis, nemesisBot, nemesisStrength, openingName, type NemesisGame } from '../src/systems/nemesis';
import { chooseMove } from '../src/ai/strength';
import { compileBook } from '../src/ai/book';
import { standardStart } from '../src/core/setup';
import { parseSAN } from '../src/core/san';
import { play } from '../src/core/rules';

const g = (white: string, black: string, moves: string, eco = '', wr = 'win', br = 'resigned'): NemesisGame => ({
  rules: 'chess',
  white: { username: white, result: wr },
  black: { username: black, result: br },
  pgn: `[Event "Live Chess"]\n[White "${white}"]\n[Black "${black}"]\n${eco ? `[ECOUrl "https://www.chess.com/openings/${eco}"]\n` : ''}\n${moves} 1-0`,
});

const GAMES = [
  g('Kid', 'a', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3', 'Italian-Game-3...Bc5'),
  g('Kid', 'b', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3', 'Italian-Game-Two-Knights-Defense'),
  g('Kid', 'c', '1. e4 c5 2. Nf3 d6 3. d4', 'Sicilian-Defense-2.Nf3'),
  g('Kid', 'd', '1. d4 d5 2. c4', "Queen's-Gambit"),
  g('e', 'kid', '1. e4 e5 2. Nf3 Nc6', 'Kings-Pawn-Opening', 'resigned', 'win'),
  g('f', 'KID', '1. e4 e5 2. Bc4 Nf6', 'Bishops-Opening', 'agreed', 'agreed'),
  { rules: 'chess960', white: { username: 'kid', result: 'win' }, black: { username: 'x', result: 'lose' }, pgn: '1. e4' },
];

describe('nemesis bot', () => {
  const n = buildNemesis('Kid', GAMES, 1720);

  it('reads only their standard games and their record', () => {
    expect(n.games).toBe(6);
    expect(n.record).toEqual({ w: 5, l: 0, d: 1 });
    expect(n.rating).toBe(1400); // capped at the strongest bot setting
    expect(n.ccRating).toBe(1720);
  });

  it('keeps only moves they played at least twice', () => {
    // 1.e4 three times; 2.Nf3 after 1...e5 twice, 3.Bc4 twice; 2.Nf3 after 1...c5 and 1.d4 once each (dropped).
    expect(n.asWhite.map((l) => l.line).sort()).toEqual(['e4', 'e4 e5 Nf3 Nc6 Bc4', 'e4 e5 Nf3 Nc6 Bc4']);
    // As Black: 1...e5 twice, then 2...Nc6 and 2...Nf6 once each.
    expect(n.asBlack.map((l) => l.line)).toEqual(['e4 e5', 'e4 e5']);
    expect(n.firstMove).toBe('e4');
    expect(n.topWhite[0]).toBe('Italian Game');
  });

  it('the bot plays from the book', () => {
    const bot = nemesisBot(n);
    expect(bot.id).toBe('NEM:kid');
    const c = chooseMove(standardStart(), { bot, rating: bot.rating, random: () => 0.5 });
    expect(c?.source).toBe('book');
    let s = standardStart();
    s = play(s, c!.move);
    expect(s.sq[28]).toBeGreaterThanOrEqual(0); // e4
    // Every line compiles.
    expect(() => compileBook([...n.asWhite, ...n.asBlack])).not.toThrow();
    // As Black after 1.e4 it answers e5.
    let b = play(standardStart(), parseSAN(standardStart(), 'e4')!);
    const reply = chooseMove(b, { bot, rating: bot.rating, random: () => 0.1 });
    expect(reply?.source).toBe('book');
    b = play(b, reply!.move);
    expect(b.sq[36]).toBeGreaterThanOrEqual(0); // e5
  });

  it('opening names and strength', () => {
    expect(openingName({ ECOUrl: 'https://www.chess.com/openings/Sicilian-Defense-Alapin-Variation-2...c5' })).toBe('Sicilian Defense Alapin Variation');
    expect(openingName({ Opening: 'French Defense' })).toBe('French Defense');
    expect(nemesisStrength(null)).toBe(800);
    expect(nemesisStrength(150)).toBe(400);
  });
});
