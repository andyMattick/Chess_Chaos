import { parsePGN, recordFromPGN } from '../src/chesscom/pgn';
import { replay } from '../src/core';

const CC_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.11.01"]
[White "kidA"]
[Black "kidB"]
[Result "0-1"]
[UTCDate "2026.11.01"]
[UTCTime "15:04:05"]
[Termination "kidB won by checkmate"]

1. f3 {[%clk 0:09:58.1]} 1... e5 {[%clk 0:09:57]} 2. g4 $2 (2. e4 Nf6) 2... Qh4# {[%clk 0:09:50]} 0-1`;

describe('PGN import', () => {
  it('reads headers and strips comments, variations and NAGs', () => {
    const p = parsePGN(CC_PGN);
    expect(p.headers.White).toBe('kidA');
    expect(p.san).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
  });
  it('builds a replayable record with the result', () => {
    const rec = recordFromPGN(CC_PGN)!;
    expect(rec.actions.length).toBe(4);
    expect(rec.meta.players).toEqual({ p1: 'kidA', p2: 'kidB' });
    expect(rec.meta.result).toEqual({ reason: 'checkmate', winners: ['p2'] });
    expect(replay(rec).at(-1)!.result?.reason).toBe('checkmate');
  });
  it('uses the termination for resignations', () => {
    const rec = recordFromPGN(`[White "a"]\n[Black "b"]\n[Result "1-0"]\n[Termination "a won by resignation"]\n\n1. e4 e5 2. Nf3 1-0`)!;
    expect(rec.meta.result).toEqual({ reason: 'resign', winners: ['p1'] });
  });
  it('skips variants', () => {
    expect(recordFromPGN(`[Variant "Chess960"]\n\n1. e4 *`)).toBeNull();
  });
});
