import { describe, expect, it } from 'vitest';
import { addMyLine, buildMirror, buildNemesis, learnFromGame, linesFromRecords, myLineFrom, nemesisBot, nemesisStrength, openingName, MIN_WEIGHT, MIRROR_KEY, type NemesisGame } from '../src/systems/nemesis';
import { newRecord, type GameRecord } from '../src/core/record';
import { STANDARD_FEN } from '../src/core/setup';
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

describe('learning on the phone (Mirror and learning nemeses)', () => {
  const mine = [
    { c: 'w' as const, san: 'e4 e5 Nf3 Nc6 Bc4 Bc5', r: 1 },
    { c: 'w' as const, san: 'e4 c5 Nf3 d6 d4 cxd4', r: 0 },
    { c: 'w' as const, san: 'e4 e5 Nf3 d6 d4', r: 0.5 },
    { c: 'b' as const, san: 'd4 d5 c4 e6 Nc3', r: 1 },
    { c: 'b' as const, san: 'e4 c6 d4 d5', r: 0 },
    { c: 'b' as const, san: 'd4 d5 Nf3 e6', r: 0 },
  ];

  it('builds a Mirror from your own moves', () => {
    const m = buildMirror(mine, 'Kid', 900);
    expect(m.mirror).toBe(true);
    expect(m.key).toBe(MIRROR_KEY);
    expect(m.firstMove).toBe('e4');
    expect(m.record).toEqual({ w: 2, l: 3, d: 1 });
    // You played e4 three times and Nf3 after it three times, so those go in.
    expect(m.asWhite.every((l) => l.line.startsWith('e4'))).toBe(true);
    expect(m.asWhite.some((l) => l.line.startsWith('e4 e5 Nf3'))).toBe(true);
    // As Black you answered d4 with d5 twice.
    expect(m.asBlack.some((l) => l.line === 'd4 d5')).toBe(true);
    expect(nemesisBot(m).name).toBe('Mirror Kid');
    // The book compiles and the bot plays from it.
    expect(() => compileBook(m.asWhite)).not.toThrow();
  });

  it('picks openings that beat you more and ones you beat less', () => {
    const m = buildMirror(mine, 'Kid', 900);
    const line = m.asWhite[0].line.split(' ');
    const won = learnFromGame(m, [...line, 'a6'], 'w', 1);
    expect(won.asWhite[0].weight).toBeGreaterThan(1);
    expect(won.vsYou).toEqual({ w: 1, l: 0, d: 0 });
    expect(won.learned).toBe(1);
    const lost = learnFromGame(m, [...line, 'a6'], 'w', 0);
    expect(lost.asWhite[0].weight).toBeLessThan(1);
    // Never removed for good.
    let n = m;
    for (let i = 0; i < 20; i++) n = learnFromGame(n, line, 'w', 0);
    expect(n.asWhite[0].weight).toBe(MIN_WEIGHT);
    // A draw only counts the game.
    expect(learnFromGame(m, line, 'w', 0.5).asWhite).toBe(m.asWhite);
    // A game that left the book at once teaches nothing.
    expect(learnFromGame(m, ['d4', 'd5'], 'w', 1).learned).toBeUndefined();
  });

  it('keeps what it learned when the Mirror is rebuilt', () => {
    const m = buildMirror(mine, 'Kid', 900);
    const taught = learnFromGame(m, m.asWhite[0].line.split(' '), 'w', 1);
    const again = buildMirror(addMyLine(mine, myLineFrom(['e4', 'e5', 'Nf3', 'Nc6'], 'w', 1)), 'Kid', 900, taught);
    const same = again.asWhite.find((l) => l.line === taught.asWhite[0].line);
    expect(same?.weight).toBe(taught.asWhite[0].weight);
    expect(again.vsYou).toEqual(taught.vsYou);
    expect(again.games).toBe(7);
  });

  it('reads your lines from saved classic games only', () => {
    const rec = (mode: string, p1: string, san: string[], winners: ('p1' | 'p2')[]) => ({
      ...newRecord(1, { p1, p2: 'Bot' }, STANDARD_FEN, mode), meta: { startedAt: 0, players: { p1, p2: 'Bot' }, result: { reason: 'checkmate', winners }, san },
    }) as GameRecord;
    const out = linesFromRecords([
      rec('standard', 'Kid', ['e4', 'e5', 'Nf3', 'Nc6'], ['p1']),
      rec('atomic', 'Kid', ['e4', 'e5', 'Nf3', 'Nc6'], ['p1']),
      rec('standard', 'Someone', ['d4', 'd5', 'c4', 'e6'], ['p2']),
    ], 'Kid');
    expect(out).toEqual([{ c: 'w', san: 'e4 e5 Nf3 Nc6', r: 1 }]);
  });
});
