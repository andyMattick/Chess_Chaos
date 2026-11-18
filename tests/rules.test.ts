import {
  fromFEN, toFEN, play, parseSAN, toSAN, legalActions, standardStart, STANDARD_FEN,
  newRecord, replay, stateHash, insufficientMaterial,
} from '../src/core';
import type { GameState } from '../src/core';

function playSAN(s: GameState, line: string): GameState {
  for (const san of line.split(/\s+/).filter(Boolean)) {
    const m = parseSAN(s, san);
    if (!m) throw new Error(`Illegal SAN ${san} in ${toFEN(s)}`);
    s = play(s, m);
  }
  return s;
}

describe('standard rules', () => {
  it('round-trips FEN', () => {
    const fens = [
      STANDARD_FEN,
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
    ];
    for (const f of fens) expect(toFEN(fromFEN(f))).toBe(f);
  });

  it("fool's mate is checkmate", () => {
    const s = playSAN(standardStart(), 'f3 e5 g4 Qh4#');
    expect(s.result).toEqual({ reason: 'checkmate', winners: ['p2'] });
  });

  it('detects stalemate', () => {
    const s = fromFEN('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
    const after = play(s, parseSAN(s, 'Kh6')!);
    expect(after.result?.reason).toBe('stalemate');
  });

  it('detects threefold repetition', () => {
    const s = playSAN(standardStart(), 'Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8');
    expect(s.result?.reason).toBe('draw-repetition');
  });

  it('detects the fifty-move rule', () => {
    const s = fromFEN('8/8/4k3/8/8/4K3/8/R7 w - - 99 80');
    const after = play(s, parseSAN(s, 'Ra2')!);
    expect(after.result?.reason).toBe('draw-50');
  });

  it('detects insufficient material', () => {
    expect(insufficientMaterial(fromFEN('8/8/4k3/8/8/4K3/8/7N w - - 0 1'))).toBe(true);
    expect(insufficientMaterial(fromFEN('8/8/4k3/8/8/4K3/8/7R w - - 0 1'))).toBe(false);
    expect(insufficientMaterial(fromFEN('5b2/8/4k3/8/8/4K3/8/2B5 w - - 0 1'))).toBe(true);
    const s = fromFEN('8/8/4k3/8/8/4K3/8/n6R w - - 0 1');
    expect(play(s, parseSAN(s, 'Rh2')!).result).toBeNull();
    const t = fromFEN('8/8/4k3/8/8/4K3/5p2/7N w - - 0 1');
    expect(play(t, parseSAN(t, 'Nxf2')!).result?.reason).toBe('draw-material');
  });

  it('plays en passant', () => {
    const s = playSAN(standardStart(), 'e4 a6 e5 d5');
    const m = parseSAN(s, 'exd6');
    expect(m).toBeDefined();
    const after = play(s, m!);
    expect(toFEN(after).split(' ')[0]).toBe('rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR');
  });

  it('en passant is only available immediately', () => {
    const s = playSAN(standardStart(), 'e4 a6 e5 d5 Nf3 a5');
    expect(parseSAN(s, 'exd6')).toBeUndefined();
  });

  it('offers all four promotions', () => {
    const s = fromFEN('8/4P3/8/8/8/k7/8/K7 w - - 0 1');
    const promos = legalActions(s).filter((m) => m.promo).map((m) => m.promo).sort();
    expect(promos).toEqual(['bishop', 'knight', 'queen', 'rook']);
    expect(toSAN(s, legalActions(s).find((m) => m.promo === 'knight')!)).toBe('e8=N');
  });

  it('castles both ways and moves the rook', () => {
    const s = fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(toFEN(play(s, parseSAN(s, 'O-O')!)).split(' ')[0]).toBe('r3k2r/8/8/8/8/8/8/R4RK1');
    expect(toFEN(play(s, parseSAN(s, 'O-O-O')!)).split(' ')[0]).toBe('r3k2r/8/8/8/8/8/8/2KR3R');
  });

  it('cannot castle through or out of check', () => {
    const through = fromFEN('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
    expect(parseSAN(through, 'O-O')).toBeUndefined();
    expect(parseSAN(through, 'O-O-O')).toBeDefined();
    const inCheck = fromFEN('r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1');
    expect(parseSAN(inCheck, 'O-O')).toBeUndefined();
  });

  it('loses castling rights when the rook moves', () => {
    const s = playSAN(fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'Rh2 Rh7 Rh1 Rh8');
    expect(parseSAN(s, 'O-O')).toBeUndefined();
    expect(parseSAN(s, 'O-O-O')).toBeDefined();
  });

  it('disambiguates SAN', () => {
    const s = fromFEN('k7/8/8/8/8/8/8/KR3R2 w - - 0 1');
    const sans = legalActions(s).map((m) => toSAN(s, m));
    expect(sans).toContain('Rbd1');
    expect(sans).toContain('Rfd1');
  });

  it('marks check and mate in SAN', () => {
    const s = playSAN(standardStart(), 'e4 e5 Bc4 Nc6 Qh5 Nf6');
    expect(toSAN(s, parseSAN(s, 'Qxf7')!)).toBe('Qxf7#');
  });

  it('resignation ends the game', () => {
    const s = play(standardStart(), { t: 'resign', by: 'p1' });
    expect(s.result).toEqual({ reason: 'resign', winners: ['p2'] });
  });

  it('timeout loses, unless the opponent cannot mate', () => {
    expect(play(standardStart(), { t: 'timeout', by: 'p1' }).result).toEqual({ reason: 'time', winners: ['p2'] });
    const bare = fromFEN('4k3/8/8/8/8/8/PPPP4/4K3 w - - 0 1');
    expect(play(bare, { t: 'timeout', by: 'p1' }).result).toEqual({ reason: 'time', winners: [] });
  });

  it('rejects illegal moves', () => {
    const s = standardStart();
    expect(() => play(s, { t: 'move', piece: s.sq[12], to: 36 + 8 })).toThrow();
  });
});

describe('records', () => {
  it('replays deterministically', () => {
    const rec = newRecord(42, { p1: 'A', p2: 'B' });
    let s = replay(rec)[0];
    for (const san of 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'.split(' ')) {
      const m = parseSAN(s, san)!;
      rec.actions.push(m);
      s = play(s, m);
    }
    const json = JSON.parse(JSON.stringify(rec));
    const states = replay(json);
    expect(states.length).toBe(11);
    expect(stateHash(states[10])).toBe(stateHash(s));
  });
});
