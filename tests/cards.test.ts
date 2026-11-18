import { describe, expect, it } from 'vitest';
import { fromFEN, STANDARD_FEN } from '../src/core/setup';
import { legalActions, play } from '../src/core/rules';
import { parseSAN } from '../src/core/san';
import { inCheck } from '../src/core/movegen';
import { newRecord, replay } from '../src/core/record';
import type { GameState, PlayerId } from '../src/core/types';
import { PLAYABLE_CARDS } from '../src/core/cards';

const sq = (n: string) => (+n[1] - 1) * 8 + n.charCodeAt(0) - 97;
function withCards(fen: string, cards: string[], who: PlayerId = 'p1'): GameState {
  return { ...fromFEN(fen), rules: cards.map((c) => `${c}@${who}`) };
}
const at = (s: GameState, n: string) => s.sq[sq(n)];
const card = (s: GameState, id: string, f: { piece?: string; target?: string; to?: string } = {}, by: PlayerId = 'p1') =>
  play(s, { t: 'buff', by, id, piece: f.piece ? at(s, f.piece) : undefined, target: f.target ? at(s, f.target) : undefined, to: f.to ? sq(f.to) : undefined });
const tos = (s: GameState, from: string) => legalActions(s).filter((m) => m.piece === at(s, from)).map((m) => m.to).sort((a, b) => a - b);
const names = (list: number[]) => list.map((i) => String.fromCharCode(97 + (i % 8)) + (Math.floor(i / 8) + 1));

describe('power cards', () => {
  it('upgrades use the move, are used once, and the new piece moves its new way', () => {
    const s = withCards(STANDARD_FEN, ['CARD-07']);
    const n = card(s, 'CARD-07', { piece: 'g1' });
    expect(n.pieces[at(n, 'g1')].type).toBe('nightrider');
    expect(n.turn).toBe('p2');
    const n2 = play(play(n, parseSAN(n, 'e5')!), parseSAN(play(n, parseSAN(n, 'e5')!), 'e4')!);
    expect(() => card(play(n2, parseSAN(n2, 'a6')!), 'CARD-07', { piece: 'b1' })).toThrow(/already used/);
  });

  it('nightrider repeats its jump; chancellor adds knight jumps; camel leaps 3-1', () => {
    let s = withCards('4k3/8/8/8/8/8/8/N3K2R w - - 0 1', []);
    s.pieces[at(s, 'a1')].type = 'nightrider';
    expect(names(tos(s, 'a1')).sort()).toEqual(['b3', 'c2', 'c5', 'd7', 'e3', 'g4']);
    s = withCards('4k3/8/8/8/8/8/8/4K2R w - - 0 1', []);
    s.pieces[at(s, 'h1')].type = 'chancellor';
    expect(names(tos(s, 'h1'))).toContain('g3');
    expect(names(tos(s, 'h1'))).toContain('f2');
    s.pieces[at(s, 'h1')].type = 'camel';
    expect(names(tos(s, 'h1')).sort()).toEqual(['e2', 'g4']);
  });

  it('ghost bishop passes its own pieces; jumper rook passes one piece; cannon captures over a screen', () => {
    let s = withCards('4k3/8/8/8/8/8/1P6/B3K3 w - - 0 1', []);
    s.pieces[at(s, 'a1')].type = 'ghost-bishop';
    expect(names(tos(s, 'a1'))).toContain('c3');
    s = withCards('r3k3/8/8/8/p7/8/8/R3K3 w - - 0 1', []);
    s.pieces[at(s, 'a1')].type = 'jumper-rook';
    expect(names(tos(s, 'a1'))).toContain('a8'); // over the a4 pawn, captures a8
    expect(names(tos(s, 'a1'))).toContain('a4');
    s = withCards('r3k3/8/8/8/p7/8/8/R3K3 w - - 0 1', []);
    s.pieces[at(s, 'a1')].type = 'cannon';
    const c = names(tos(s, 'a1'));
    expect(c).toContain('a8'); // jumps the a4 pawn to capture
    expect(c).not.toContain('a4'); // cannot capture without a screen
    expect(c).toContain('a3');
  });

  it('cannon and grasshopper give check the fancy way', () => {
    let s = withCards('4k3/8/8/8/4p3/8/8/3K3R w - - 0 1', []);
    s.pieces[at(s, 'h1')].type = 'cannon';
    s = play(s, { t: 'move', piece: at(s, 'h1'), to: sq('e1') });
    expect(inCheck(s, 'p2')).toBe(true); // cannon on e1, screen e4, king e8
    const g = withCards('8/8/4k3/4p3/8/8/8/3K4 w - - 0 1', []);
    g.pieces.push({ id: g.pieces.length, type: 'grasshopper', owner: 'p1', home: sq('e2'), at: sq('e2'), moved: true });
    g.sq[sq('e2')] = g.pieces.length - 1;
    expect(names(tos(g, 'e2'))).not.toContain('e3'); // must hop, cannot just step
    expect(inCheck(g, 'p2')).toBe(true); // hops the e5 pawn onto the king on e6
  });

  it('lance moves forward any distance for both colours; super pawn and guard step any way', () => {
    let s = withCards('4k3/8/8/8/8/8/P7/4K3 w - - 0 1', []);
    s.pieces[at(s, 'a2')].type = 'lance';
    expect(names(tos(s, 'a2'))).toEqual(['a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    s = withCards('4k3/p7/8/8/8/8/8/4K3 b - - 0 1', []);
    s.pieces[at(s, 'a7')].type = 'lance';
    expect(names(tos(s, 'a7')).sort()).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
    s = withCards('4k3/8/8/8/3P4/8/8/4K3 w - - 0 1', []);
    s.pieces[at(s, 'd4')].type = 'guard';
    expect(tos(s, 'd4').length).toBe(8);
  });

  it('amazon turns back into a queen after its first capture', () => {
    let s = withCards('4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1', ['CARD-03']);
    s = card(s, 'CARD-03', { piece: 'd1' });
    s = play(s, parseSAN(s, 'Ke7')!);
    s = play(s, { t: 'move', piece: at(s, 'd1'), to: sq('d5') });
    expect(s.pieces[at(s, 'd5')].type).toBe('queen');
  });

  it('wall blocks and expires; bodyguard protects neighbours', () => {
    let s = withCards('r3k3/8/8/8/8/8/8/4K3 w - - 0 1', ['CARD-10']);
    expect(() => card(s, 'CARD-10', { to: 'a6' })).toThrow(/half/);
    s = card(s, 'CARD-10', { to: 'a3' });
    expect(s.pieces[at(s, 'a3')].type).toBe('wall');
    expect(names(tos(s, 'a8'))).not.toContain('a3');
    expect(names(tos(s, 'a8'))).not.toContain('a2');
    for (let i = 0; i < 6; i++) s = play(s, legalActions(s).find((m) => s.pieces[m.piece].type === 'king')!);
    expect(at(s, 'a3')).toBe(-1);

    let g = withCards('4k3/8/8/8/8/8/1P6/rN2K3 w - - 0 1', ['CARD-08']);
    g = card(g, 'CARD-08', { piece: 'b1' });
    expect(names(tos(g, 'a1'))).not.toContain('b2');
  });

  it('teleporter cannot give check; twin splits a rook and joins knights', () => {
    const s = withCards('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', ['CARD-11']);
    expect(() => card(s, 'CARD-11', { piece: 'a1', to: 'a8' })).toThrow(/check/);
    const t = card(s, 'CARD-11', { piece: 'a1', to: 'b7' });
    expect(t.pieces[at(t, 'b7')].type).toBe('rook');
    expect(t.turn).toBe('p2');
    let w = withCards('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', ['CARD-12']);
    w = card(w, 'CARD-12', { piece: 'a1', to: 'b2' });
    expect([w.pieces[at(w, 'a1')].type, w.pieces[at(w, 'b2')].type]).toEqual(['knight', 'knight']);
    let k = withCards('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1', ['CARD-12']);
    k = card(k, 'CARD-12', { piece: 'b1', target: 'f1' });
    expect(k.pieces[at(k, 'b1')].type).toBe('rook');
    expect(at(k, 'f1')).toBe(-1);
  });

  it('phoenix returns home once; bomb pawn takes the capturer with it', () => {
    let s = withCards('4k3/8/8/3b4/8/8/8/2N1K3 w - - 0 1', ['CARD-18']);
    s = card(s, 'CARD-18', { piece: 'c1' });
    s = play(s, parseSAN(s, 'Nb3')!);
    s = play(s, parseSAN(s, 'Bxb3')!);
    expect(s.pieces.find((p) => p.type === 'knight')!.at).toBe(sq('c1')); // back home

    let b = withCards('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', ['CARD-19']);
    b = card(b, 'CARD-19', { piece: 'e4' });
    b = play(b, parseSAN(b, 'Kd1')!); // effect cards do not use the move
    b = play(b, parseSAN(b, 'dxe4')!);
    expect(at(b, 'e4')).toBe(-1);
  });

  it('magnet pulls, battering ram pushes, medic revives a pawn', () => {
    let s = withCards('4k3/8/r7/8/8/8/8/R3K3 w - - 0 1', ['CARD-20']);
    s = card(s, 'CARD-20', { piece: 'a1', target: 'a6' });
    expect(s.pieces[at(s, 'a5')].type).toBe('rook');
    expect(s.turn).toBe('p1');
    let r = withCards('4k3/8/8/8/8/8/n7/R3K3 w - - 0 1', ['CARD-21']);
    r = card(r, 'CARD-21', { piece: 'a1', target: 'a2' });
    expect(r.pieces[at(r, 'a3')].type).toBe('knight');
    let m = withCards('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', ['CARD-22']);
    m.pieces.push({ id: m.pieces.length, type: 'pawn', owner: 'p1', home: sq('a2'), at: -1, moved: true });
    expect(() => card(m, 'CARD-22', { piece: 'c1', to: 'd1' })).toThrow(/first or last/);
    m = card(m, 'CARD-22', { piece: 'c1', to: 'd2' });
    expect(m.pieces[at(m, 'd2')].type).toBe('pawn');
  });

  it('one card per turn, and hands in a party record replay exactly', () => {
    let s = withCards('4k3/8/r7/8/8/8/8/R3K3 w - - 0 1', ['CARD-20', 'CARD-21']);
    s = card(s, 'CARD-20', { piece: 'a1', target: 'a6' });
    expect(() => card(s, 'CARD-21', { piece: 'a1', target: 'a5' })).toThrow(/one card per turn/i);
    const rec = newRecord(7, { p1: 'A', p2: 'B' });
    rec.setup = { ...rec.setup, party: { modifiers: {}, missions: {}, gate: {}, cards: { p1: ['CARD-07'], p2: ['CARD-04'] } } };
    const s0 = replay(rec)[0];
    rec.actions = [{ t: 'buff', by: 'p1', id: 'CARD-07', piece: s0.sq[sq('g1')] }, { t: 'buff', by: 'p2', id: 'CARD-04', piece: s0.sq[sq('e7')] }];
    const end = replay(rec).at(-1)!;
    expect(end.pieces[s0.sq[sq('g1')]].type).toBe('nightrider');
    expect(end.pieces[s0.sq[sq('e7')]].type).toBe('super-pawn');
    expect(PLAYABLE_CARDS.size).toBe(25);
  });
});

describe('king cards and suits', () => {
  it('every card has a suit, and every suit has cards', async () => {
    const { CARDS, SUITS } = await import('../src/content/cards');
    for (const c of CARDS) expect(SUITS).toContain(c.suit);
    for (const s of SUITS) expect(CARDS.filter((c) => c.suit === s && !c.notYet).length).toBeGreaterThanOrEqual(2);
  });
  it('Knight king jumps like a knight and is still the king', () => {
    let s = withCards('4k3/8/8/8/8/8/8/4K3 w - - 0 1', ['CARD-25']);
    s = play(s, { t: 'buff', by: 'p1', id: 'CARD-25', piece: s.sq[sq('e1')] });
    const k = s.pieces.find((p) => p.owner === 'p1')!;
    expect(k.type).toBe('knight-king');
    s = play(s, legalActions(s)[0]); // Black moves
    expect(legalActions(s).some((m) => m.piece === k.id && m.to === sq('f3'))).toBe(true);
    // Still royal: a rook giving check is check.
    const t = withCards('4k3/r7/8/8/8/8/8/4K3 w - - 0 1', ['CARD-25']);
    const u = play(t, { t: 'buff', by: 'p1', id: 'CARD-25', piece: t.sq[sq('e1')] });
    const v = play(u, parseSAN(u, 'Ra1')!);
    expect(inCheck(v, 'p1')).toBe(true);
  });
  it('Long-step king moves up to 2 squares but not over pieces', () => {
    let s = withCards('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', ['CARD-26']);
    s = play(s, { t: 'buff', by: 'p1', id: 'CARD-26', piece: s.sq[sq('e1')] });
    s = play(s, legalActions(s)[0]);
    const k = s.pieces.find((p) => p.owner === 'p1' && p.type === 'long-king')!;
    const to = legalActions(s).filter((m) => m.piece === k.id).map((m) => m.to);
    expect(to).toContain(sq('c1'));
    expect(to).toContain(sq('g3'));
    expect(to).not.toContain(sq('e3')); // the pawn on e2 is in the way
  });
});
