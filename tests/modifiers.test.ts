import { applySetup, fromFEN, legalActions, parseSAN, play, standardStart, toSAN, parseSquare, IMPLEMENTED } from '../src/core';
import type { GameState } from '../src/core';

const sq = (s: GameState, n: string) => parseSquare(s.board, n);
const at = (s: GameState, n: string) => s.pieces[s.sq[sq(s, n)]];
const party = (s: GameState, mods: Record<string, string[]>) => applySetup(s, mods, () => 0);
const sans = (s: GameState) => legalActions(s).map((m) => toSAN(s, m));
const go = (s: GameState, line: string) => line.split(' ').reduce((x, san) => {
  const m = parseSAN(x, san);
  if (!m) throw new Error(`no ${san}: ${sans(x).join(',')}`);
  return play(x, m);
}, s);

describe('buffs', () => {
  it('BUFF-05 pawn sprint: two squares any time', () => {
    const s = go(party(standardStart(), { p1: ['BUFF-05'] }), 'e3 a6');
    expect(sans(s)).toContain('e5');
  });
  it('BUFF-07 long jump: knights also leap 3+1', () => {
    const s = party(standardStart(), { p1: ['BUFF-07'] });
    expect(sans(s)).toContain('Nc4');
  });
  it('BUFF-08 early crown: promote on the seventh', () => {
    const s = party(fromFEN('k7/8/4P3/8/8/8/8/K7 w - - 0 1'), { p1: ['BUFF-08'] });
    expect(legalActions(s).some((m) => m.promo)).toBe(true);
  });
  it('BUFF-10 backpedal: each pawn may step back once', () => {
    let s = go(party(standardStart(), { p1: ['BUFF-10'] }), 'e4 a6');
    const back = legalActions(s).find((m) => m.to === sq(s, 'e3') && s.pieces[m.piece].at === sq(s, 'e4'))!;
    expect(back).toBeDefined();
    s = play(s, back);
    s = go(s, 'a5 e4 a4');
    expect(legalActions(s).some((m) => m.to === sq(s, 'e3') && s.pieces[m.piece].at === sq(s, 'e4'))).toBe(false);
  });
  it('BUFF-06 second wind: first lost piece comes home', () => {
    let s = party(fromFEN('k7/8/8/8/8/8/1r6/KN6 b - - 0 1'), { p1: ['BUFF-06'] });
    s = go(s, 'Rxb1+');
    // White knight returned to b1? It was captured there, so it goes to the nearest empty back-rank square.
    const knights = s.pieces.filter((p) => p.owner === 'p1' && p.type === 'knight' && p.at >= 0);
    expect(knights.length).toBe(1);
  });
  it('BUFF-02 shield: piece cannot be taken for two enemy turns', () => {
    let s = party(fromFEN('k7/8/8/3r4/8/8/8/K2R4 w - - 0 1'), { p1: ['BUFF-02'] });
    const rook = at(s, 'd1');
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-02', target: rook.id });
    expect(s.turn).toBe('p1'); // does not use the move
    s = go(s, 'Kb1');
    expect(sans(s)).not.toContain('Rxd1+');
    expect(() => play(s, { t: 'buff', by: 'p2', id: 'BUFF-02', target: 0 })).toThrow();
  });
  it('BUFF-02 can only be used once', () => {
    let s = party(standardStart(), { p1: ['BUFF-02'] });
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-02', target: at(s, 'b1').id });
    expect(() => play(s, { t: 'buff', by: 'p1', id: 'BUFF-02', target: at(s, 'g1').id })).toThrow();
  });
  it('BUFF-15 freeze ray: enemy piece skips a turn', () => {
    let s = party(fromFEN('k7/8/8/3r4/8/8/8/K2R4 w - - 0 1'), { p1: ['BUFF-15'] });
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-15', target: at(s, 'd5').id });
    s = go(s, 'Kb1');
    expect(legalActions(s).every((m) => s.pieces[m.piece].type !== 'rook')).toBe(true);
  });
  it('BUFF-21 home guard: back rank safe for one enemy turn', () => {
    let s = party(fromFEN('k7/8/8/3r4/8/8/8/K2R4 w - - 0 1'), { p1: ['BUFF-21'] });
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-21' });
    s = go(s, 'Kb2');
    expect(sans(s)).not.toContain('Rxd1');
  });
  it('BUFF-11 swap two pieces, uses the move', () => {
    let s = party(standardStart(), { p1: ['BUFF-11'] });
    const n = at(s, 'b1'), b = at(s, 'c1');
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-11', piece: n.id, target: b.id });
    expect(at(s, 'c1').type).toBe('knight');
    expect(s.turn).toBe('p2');
  });
  it('BUFF-17 sidestep a pawn', () => {
    let s = go(party(standardStart(), { p1: ['BUFF-17'] }), 'e4 a6');
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-17', piece: at(s, 'e4').id, to: sq(s, 'd4') });
    expect(at(s, 'd4').type).toBe('pawn');
  });
  it("BUFF-18 knight's blessing: a bishop jumps like a knight", () => {
    let s = go(party(standardStart(), { p1: ['BUFF-18'] }), 'e4 a6');
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-18', piece: at(s, 'f1').id, to: sq(s, 'e3') });
    expect(at(s, 'e3').type).toBe('bishop');
    expect(() => play(go(party(standardStart(), { p1: ['BUFF-18'] }), 'e4 a6'), { t: 'buff', by: 'p1', id: 'BUFF-18', piece: 0, to: 0 })).toThrow();
  });
  it('BUFF-20 recall a piece home', () => {
    let s = go(party(standardStart(), { p1: ['BUFF-20'] }), 'Nf3 a6');
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-20', piece: at(s, 'f3').id });
    expect(at(s, 'g1').type).toBe('knight');
  });
  it('BUFF-14 reinforcements: a new pawn', () => {
    let s = go(party(standardStart(), { p1: ['BUFF-14'] }), 'e4 a6');
    const before = s.pieces.filter((p) => p.at >= 0).length;
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-14', to: sq(s, 'e2') });
    expect(s.pieces.filter((p) => p.at >= 0).length).toBe(before + 1);
  });
  it('BUFF-16 royal dash: king moves two', () => {
    let s = party(fromFEN('k7/8/8/8/8/8/8/K7 w - - 0 1'), { p1: ['BUFF-16'] });
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-16', to: sq(s, 'c3') });
    expect(at(s, 'c3').type).toBe('king');
  });
  it('BUFF-01 double step', () => {
    let s = party(standardStart(), { p1: ['BUFF-01'] });
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-01', piece: at(s, 'g1').id, to: sq(s, 'f3'), to2: sq(s, 'g5') });
    expect(at(s, 'g5').type).toBe('knight');
    expect(s.turn).toBe('p2');
  });
});

describe('handicaps', () => {
  it('HCAP-02 frozen piece for 3 turns', () => {
    const s = party(standardStart(), { p1: ['HCAP-02'] });
    const frozen = s.modeData!.frozenPiece as number;
    expect(legalActions(s).some((m) => m.piece === frozen)).toBe(false);
  });
  it('HCAP-03 tired queen moves at most 3', () => {
    const s = party(fromFEN('k7/8/8/8/8/8/8/K6Q w - - 0 1'), { p1: ['HCAP-03'] });
    expect(sans(s)).toContain('Qe1');
    expect(sans(s)).not.toContain('Qd1');
  });
  it('HCAP-05 slow pawns', () => {
    expect(sans(party(standardStart(), { p1: ['HCAP-05'] }))).not.toContain('e4');
  });
  it('HCAP-06 no castling', () => {
    expect(sans(party(fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), { p1: ['HCAP-06'] }))).not.toContain('O-O');
  });
  it('HCAP-09 heavy rooks before move 10', () => {
    expect(sans(party(fromFEN('k7/8/8/8/8/8/8/R3K3 w - - 0 1'), { p1: ['HCAP-09'] })).some((x) => x.startsWith('R'))).toBe(false);
  });
  it('HCAP-11 mirror: move the same type the opponent just moved', () => {
    const s = go(party(standardStart(), { p2: ['HCAP-11'] }), 'Nf3');
    expect(legalActions(s).every((m) => s.pieces[m.piece].type === 'knight')).toBe(true);
  });
  it('HCAP-12 homesick king', () => {
    const s = party(fromFEN('k7/8/8/8/8/8/1K6/8 w - - 0 1'), { p1: ['HCAP-12'] });
    expect(sans(s)).not.toContain('Kb3');
    expect(sans(s)).toContain('Kb1');
  });
  it('HCAP-13 forced capture', () => {
    const s = party(fromFEN('k7/8/8/3p4/4P3/8/8/K7 w - - 0 1'), { p1: ['HCAP-13'] });
    expect(sans(s)).toEqual(['exd5']);
  });
  it('HCAP-14 missing pawn', () => {
    const s = party(standardStart(), { p1: ['HCAP-14'] });
    expect(s.pieces.filter((p) => p.owner === 'p1' && p.type === 'pawn' && p.at >= 0).length).toBe(7);
  });
  it('HCAP-17 rusty crown: knights only', () => {
    const s = party(fromFEN('k7/4P3/8/8/8/8/8/K7 w - - 0 1'), { p1: ['HCAP-17'] });
    expect(legalActions(s).filter((m) => m.promo).map((m) => m.promo)).toEqual(['knight']);
  });
  it('HCAP-18 slippery: slide all the way', () => {
    const s = party(fromFEN('2k5/8/8/8/8/8/8/R6K w - - 0 1'), { p1: ['HCAP-18'] });
    const rook = sans(s).filter((x) => x.startsWith('R'));
    expect(rook.sort()).toEqual(['Ra8+', 'Rg1']);
  });
  it('HCAP-19 one-way rooks', () => {
    const s = party(fromFEN('2k5/8/8/8/8/8/8/R6K w - - 0 1'), { p1: ['HCAP-19'] });
    expect(sans(s).some((x) => x === 'Rb1')).toBe(false);
    expect(sans(s)).toContain('Ra5');
  });
  it('HCAP-20 peaceful bishops cannot capture', () => {
    const s = party(fromFEN('k7/8/8/8/8/2p5/8/K3B3 w - - 0 1'), { p1: ['HCAP-20'] });
    expect(sans(s)).not.toContain('Bxc3');
  });
  it('HCAP-22 restless king every fifth turn', () => {
    let s = party(fromFEN('k7/pppppppp/8/8/8/8/PPPPPPPP/K7 w - - 0 1'), { p1: ['HCAP-22'] });
    s = go(s, 'a3 a6 b3 b6 c3 c6 d3 d6');
    expect(legalActions(s).every((m) => s.pieces[m.piece].type === 'king')).toBe(true);
  });
});

describe('modifier list', () => {
  it('tracks what is playable', () => {
    expect(IMPLEMENTED.size).toBeGreaterThanOrEqual(35);
  });
});
