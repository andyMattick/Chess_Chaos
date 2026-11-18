import { describe, expect, it } from 'vitest';
import { newRecord, initialState, type GameRecord } from '../src/core/record';
import { legalActions, play } from '../src/core/rules';
import { parseSAN, toSAN } from '../src/core/san';
import { fromFEN } from '../src/core/setup';
import type { GameState } from '../src/core/types';
import { armyCost, bossLives, hiddenQueens, lavaNow, progressOf, randomArmy, reserveOf, shrinkIn } from '../src/core/modes2';

const sq = (n: string, w = 8) => (+n.slice(1) - 1) * w + n.charCodeAt(0) - 97;
function start(mode: string, extra?: GameRecord['setup']['extra']): GameState {
  const rec = newRecord(11, { p1: 'A', p2: 'B' }, undefined, mode);
  if (extra) rec.setup = { ...rec.setup, extra };
  return initialState(rec);
}
function fen(mode: string, f: string): GameState { return { ...fromFEN(f), mode }; }
const go = (s: GameState, ...sans: string[]) => sans.reduce((x, t) => { const m = parseSAN(x, t); if (!m) throw new Error(`bad ${t}`); return play(x, m); }, s);
/** Play random legal moves (seeded) to check a mode never crashes. */
function fuzz(s: GameState, n = 80) {
  let seed = 7;
  for (let i = 0; i < n && !s.result; i++) {
    const moves = legalActions(s);
    if (!moves.length) break;
    seed = (seed * 1103515245 + 12345) >>> 0;
    s = play(s, moves[seed % moves.length]);
  }
  return s;
}

describe('more modes', () => {
  it('atomic: captures explode, blowing up the king wins, kings cannot capture', () => {
    let s = go(start('atomic'), 'e4', 'd5', 'exd5');
    expect(s.sq[sq('d5')]).toBe(-1);
    expect(s.sq[sq('e4')]).toBe(-1);
    // Blow up the king: knight takes f7 next to e8.
    s = go(fen('atomic', 'rnbqkbnr/ppppp1pp/8/5p2/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1'), 'Ne5', 'g6', 'Nxd7');
    expect(s.result?.winners).toEqual(['p1']);
    const k = fen('atomic', '4k3/8/8/8/8/8/3p4/4K3 w - - 0 1');
    expect(legalActions(k).some((m) => m.to === sq('d2'))).toBe(false);
    fuzz(start('atomic'));
  });

  it('giveaway: captures are forced, losing everything wins', () => {
    const s = go(start('giveaway'), 'e3', 'b5');
    expect(legalActions(s).every((m) => s.sq[m.to] >= 0)).toBe(true); // Bxb5 forced
    const end = fen('giveaway', '8/8/8/p7/8/8/8/R7 w - - 0 1');
    expect(legalActions(end).length).toBe(1); // Rxa5 is forced
    const won = play(end, legalActions(end)[0]);
    expect(won.result?.winners).toEqual(['p2']); // Black has nothing left: Black wins
    fuzz(start('giveaway'));
  });

  it('racing kings: no checks, first to the far row; Black gets one reply', () => {
    const s = start('racing-kings');
    expect(s.pieces.some((p) => p.type === 'pawn')).toBe(false);
    expect(legalActions(s).length).toBeGreaterThan(5);
    // Arriving is not enough: Black gets one turn to chase the king away.
    const w = go(fen('racing-kings', '8/6K1/8/8/8/8/k7/8 w - - 0 1'), 'Kg8');
    expect(w.result).toBeNull();
    expect(go(w, 'Kb3').result?.winners).toEqual(['p1']); // not chased: White wins
    // Chasing: a rook may give check to a king on the top row.
    let c = go(fen('racing-kings', '8/6K1/8/8/8/8/k7/1r6 w - - 0 1'), 'Kg8');
    expect(legalActions(c).some((m) => m.to === 57 && c.pieces[m.piece].type === 'rook')).toBe(true);
    c = go(c, 'Rb8+');
    expect(c.result).toBeNull(); // in check: no win
    // Both kings up there: a draw.
    const close = go(fen('racing-kings', '8/k5K1/8/8/8/8/8/8 w - - 0 1'), 'Kg8');
    expect(go(close, 'Kb8').result?.winners).toEqual([]);
    // Normally checks are not allowed.
    const quiet = fen('racing-kings', '8/8/8/3k4/8/8/8/R5K1 w - - 0 1');
    expect(legalActions(quiet).some((m) => m.to === sq('a5'))).toBe(false); // Ra5+ would be check
    fuzz(start('racing-kings'));
  });

  it('wrap-around: a rook slides off one edge and comes back on the other', () => {
    const s = fen('wrap', '4k3/8/8/8/8/8/8/4K2R w - - 0 1');
    s.board = { ...s.board, wrapFiles: true };
    const tos = legalActions(s).filter((m) => m.piece === s.sq[sq('h1')]).map((m) => m.to);
    expect(tos).toContain(sq('a1'));
    expect(tos).toContain(sq('d1'));
    expect(legalActions(start('wrap')).some((m) => m.castle)).toBe(false);
    fuzz(start('wrap'));
  });

  it('lava appears after 5 full moves and blocks sliding', () => {
    let s = start('lava');
    for (let i = 0; i < 10; i++) s = play(s, legalActions(s)[0]);
    expect(lavaNow(s).length).toBe(3);
    for (const m of legalActions(s)) expect(lavaNow(s)).not.toContain(m.to);
    fuzz(start('lava'), 60);
  });

  it('mini board is 5 by 5 with single-step pawns', () => {
    const s = start('mini');
    expect([s.board.width, s.board.height]).toEqual([5, 5]);
    expect(s.pieces.length).toBe(20);
    expect(legalActions(s).filter((m) => s.pieces[m.piece].type === 'pawn-slow').every((m) => m.to < 15)).toBe(true);
    expect(toSAN(s, legalActions(s)[0])).toBeTruthy();
    fuzz(s);
  });

  it('horde: 36 pawns, Black wins by taking them all', () => {
    const s = start('horde');
    expect(s.pieces.filter((p) => p.owner === 'p1').length).toBe(36);
    const end = go(fen('horde', '4k3/8/8/8/8/8/1p6/P7 b - - 0 1'), 'bxa1=Q');
    expect(end.result?.winners).toEqual(['p2']);
    fuzz(start('horde'), 40);
  });

  it('monster: White moves twice', () => {
    let s = start('monster');
    s = go(s, 'e4');
    expect(s.turn).toBe('p1');
    s = go(s, 'd4');
    expect(s.turn).toBe('p2');
    fuzz(start('monster'));
  });

  it('shrinking board: the edge falls every 15 full moves', () => {
    let s = start('shrinking');
    expect(shrinkIn(s)).toBe(30);
    for (let i = 0; i < 30 && !s.result; i++) s = play(s, legalActions(s)[0]);
    expect(s.board.blocked.filter(Boolean).length).toBe(28);
    expect(s.result).toBeNull(); // kings on the edge jump inside instead of losing
    expect(s.pieces.filter((p) => p.type === 'king' && p.at >= 0).length).toBe(2);
    for (const m of legalActions(s)) expect(s.board.blocked[m.to]).toBe(false);
    fuzz(start('shrinking'), 60);
  });

  it('progressive: 1 move, then 2, then 3', () => {
    let s = start('progressive');
    s = go(s, 'e4');
    expect(s.turn).toBe('p2');
    s = go(s, 'e5');
    expect(s.turn).toBe('p2');
    s = go(s, 'd5');
    expect(s.turn).toBe('p1');
    expect(progressOf(s)).toEqual({ quota: 3, left: 3 });
    fuzz(start('progressive'));
  });

  it('drop-in: a captured piece can be dropped back in by the capturer', () => {
    let s = go(start('drop-in'), 'e4', 'd5', 'exd5');
    expect(reserveOf(s, 'p1').map((p) => p.type)).toEqual(['pawn']);
    s = go(s, 'Qxd5');
    expect(reserveOf(s, 'p2').map((p) => p.type)).toEqual(['pawn']);
    const drop = legalActions(s).find((m) => s.pieces[m.piece].at < 0 && m.to === sq('e3'))!;
    expect(drop).toBeTruthy();
    expect(toSAN(s, drop)).toBe('P@e3');
    s = play(s, drop);
    expect(s.pieces[s.sq[sq('e3')]].owner).toBe('p1');
    fuzz(start('drop-in'));
  });

  it('boss battle: the boss has 3 lives', () => {
    let s = start('boss', { boss: 'p2' });
    expect(s.pieces.filter((p) => p.at >= 0 && p.owner === 'p2' && p.type !== 'pawn').map((p) => p.type).sort()).toEqual(['boss', 'king']);
    s = fen('boss', '3qk3/8/8/8/8/8/8/3RK3 w - - 0 1');
    s.pieces[s.sq[sq('d8')]].type = 'boss';
    s.modeData = { bossLives: 3 };
    s = go(s, 'Rxd8+');
    expect(bossLives(s)).toBe(2);
    fuzz(start('boss', { boss: 'p1' }), 60);
  });

  it('mystery army and draft armies are fair and legal', () => {
    let r = 5;
    const army = randomArmy(39, (n) => (r = (r * 31 + 7) % 97) % n);
    expect(armyCost(army)).toBeLessThanOrEqual(39);
    const s = start('mystery-army');
    const w = s.pieces.filter((p) => p.owner === 'p1').map((p) => p.type).sort();
    const b = s.pieces.filter((p) => p.owner === 'p2').map((p) => p.type).sort();
    expect(w).toEqual(b);
    const d = start('draft', { armies: { p1: ['queen', 'queen', 'rook', 'rook', 'pawn', 'pawn'], p2: ['knight', 'knight', 'knight', 'knight', 'rook', 'rook', 'bishop', 'pawn'] } });
    expect(d.pieces.filter((p) => p.owner === 'p1' && p.type === 'queen').length).toBe(2);
    fuzz(d);
  });

  it('hidden queen: a marked pawn moves like a queen once, then is a queen', () => {
    let s = start('hidden-queen');
    s = play(s, { t: 'buff', by: 'p1', id: 'MODE-19', piece: s.sq[sq('e2')] });
    expect(hiddenQueens(s).p1).toBe(s.sq[sq('e2')]);
    s = go(s, 'd4', 'a6');
    const qMove = legalActions(s).find((m) => m.piece === s.sq[sq('e2')] && m.to === sq('h5'));
    expect(qMove).toBeTruthy();
    s = play(s, qMove!);
    expect(s.pieces[s.sq[sq('h5')]].type).toBe('queen');
    // The other side's view: they only know "a pawn was marked" and the move still replays.
    let o = start('hidden-queen');
    o = play(o, { t: 'buff', by: 'p1', id: 'MODE-19' });
    expect(hiddenQueens(o).p1).toBe('hidden');
    o = go(o, 'd4', 'a6');
    o = play(o, { t: 'move', piece: o.sq[sq('e2')], to: sq('h5') });
    expect(o.pieces[o.sq[sq('h5')]].type).toBe('queen');
  });

  it('endgame survival: hold 20 moves and you win', () => {
    let s = start('survival', { fen: '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1', survivor: 'p2' });
    expect(s.pieces.length).toBe(3);
    s = { ...s, modeData: { ...s.modeData, surviveFrom: s.ply - 39 } };
    s = play(s, legalActions(s)[0]);
    expect(s.result?.winners).toEqual(['p2']);
  });
});

import { SURVIVAL } from '../src/content/survival';
describe('survival levels', () => {
  it('every level starts as a legal, unfinished game', () => {
    for (const l of SURVIVAL) {
      const s = start('survival', { fen: l.fen, survivor: l.survivor });
      expect(s.result, l.id).toBeNull();
      expect(legalActions(s).length, l.id).toBeGreaterThan(0);
    }
  });
});

import { cardChessOf, hasTriple } from '../src/core/modes2';
import { baseType } from '../src/core/pieces';
describe('card chess', () => {
  it('deals 3 cards each from a deck that matches the army', () => {
    const s = start('card-chess');
    const cc = cardChessOf(s);
    expect(cc.hands.p1.length).toBe(3);
    expect(cc.hands.p1.length + cc.decks.p1.length).toBe(16);
    expect(cc.decks.p1.concat(cc.hands.p1).filter((c) => c === 'pawn').length).toBe(8);
  });
  it('you may only move pieces shown on your cards, then you draw back to 3', () => {
    let s = start('card-chess');
    const hand = cardChessOf(s).hands.p1;
    for (const m of legalActions(s)) expect(hand.includes(baseType(s.pieces[m.piece].type)) || legalActions(s).length === 20).toBe(true);
    s = play(s, legalActions(s)[0]);
    expect(cardChessOf(s).hands.p1.length).toBe(3);
    expect(cardChessOf(s).decks.p1.length).toBe(12);
  });
  it('discarding uses your turn', () => {
    let s = start('card-chess');
    const before = cardChessOf(s).decks.p1.length;
    s = play(s, { t: 'buff', by: 'p1', id: 'DRAW', target: 0 });
    expect(s.turn).toBe('p2');
    expect(cardChessOf(s).hands.p1.length).toBe(3);
    expect(cardChessOf(s).decks.p1.length).toBe(before - 1);
  });
  it('three of a kind gives two moves', () => {
    let s = start('card-chess');
    s = { ...s, modeData: { ...s.modeData, cc: { ...cardChessOf(s), hands: { ...cardChessOf(s).hands, p1: ['pawn', 'pawn', 'pawn'] } } } };
    expect(hasTriple(cardChessOf(s).hands.p1)).toBe('pawn');
    s = go(s, 'e4');
    expect(s.turn).toBe('p1');
    expect(cardChessOf(s).hands.p1).toEqual(['pawn', 'pawn']);
    s = go(s, 'd4');
    expect(s.turn).toBe('p2');
    expect(cardChessOf(s).hands.p1.length).toBe(3);
    fuzz(start('card-chess'), 120);
  });
});

describe('owner tweaks', () => {
  it('progressive: runs stop growing at 5, and you can end a run early', () => {
    let s = start('progressive');
    s = go(s, 'e4', 'e5', 'd5');
    expect(progressOf(s)).toEqual({ quota: 3, left: 3 });
    expect(() => play(s, { t: 'buff', by: 'p1', id: 'STOP' })).toThrow(/at least one/);
    s = go(s, 'Nf3');
    s = play(s, { t: 'buff', by: 'p1', id: 'STOP' });
    expect(s.turn).toBe('p2');
    expect(progressOf(s)).toEqual({ quota: 4, left: 4 });
    s = go(s, 'Nc6');
    s = play(s, { t: 'buff', by: 'p2', id: 'STOP' });
    expect(progressOf(s).quota).toBe(5);
    s = go(s, 'a3');
    s = play(s, { t: 'buff', by: 'p1', id: 'STOP' });
    expect(progressOf(s).quota).toBe(5); // capped
  });
  it('card chess: you can throw a card away more than once', () => {
    let s = start('card-chess');
    s = play(s, { t: 'buff', by: 'p1', id: 'DRAW', target: 0 });
    s = play(s, { t: 'buff', by: 'p2', id: 'DRAW', target: 0 });
    s = play(s, { t: 'buff', by: 'p1', id: 'DRAW', target: 1 });
    expect(s.turn).toBe('p2');
  });
});

import { paintScores, paintRound, PAINT_ROUNDS } from '../src/core/modes2';
import { newBattleRecord } from '../src/core/record';
describe('paint the board and pawn wars', () => {
  it('paint: landing squares take your colour; most squares after 30 rounds wins', () => {
    let s = go(start('paint'), 'e4', 'e5', 'Nf3');
    expect(paintScores(s)).toEqual({ p1: 2, p2: 1 });
    s = go(s, 'Nc6', 'Nxe5');
    expect(paintScores(s)).toEqual({ p1: 3, p2: 1 }); // e5 repainted white
    s = fuzz(start('paint'), 200);
    expect(s.result).not.toBeNull();
    if (s.result?.reason === 'mode-win') expect(paintRound(s)).toBe(PAINT_ROUNDS);
  });
  it('paint works in a 4-way battle', () => {
    const rec = newBattleRecord(4, { p1: 'A', p2: 'B', p3: 'C', p4: 'D' }, 'four', 'battle-paint');
    let s = initialState(rec);
    s = fuzz(s, 30);
    expect(Object.keys(paintScores(s)).length).toBe(4);
    expect(Object.values(paintScores(s)).reduce((a, b) => a + b, 0)).toBeGreaterThan(5);
  });
  it('pawn wars: first to promote wins', () => {
    const s = start('pawn-wars');
    expect(s.pieces.filter((p) => p.type !== 'pawn' && p.type !== 'king').length).toBe(0);
    const w = go(fen('pawn-wars', '4k3/P7/8/8/8/8/7p/4K3 w - - 0 1'), 'a8=Q');
    expect(w.result?.winners).toEqual(['p1']);
    fuzz(start('pawn-wars'));
  });
});
