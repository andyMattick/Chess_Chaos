import { describe, expect, it } from 'vitest';
import { CANDY, HANDICAP_LADDER, MATE_LADDER, MAZES, MINIS } from '../src/content/minis';
import { GUARD_DUTY, MATE_IN_ONE, SPOTLIGHT, TRADES } from '../src/content/minisPositions';
import { guardsAll, isMate, isSpotlightBest, pathMoves, pathPar, pathStars, pathState, pathStep, sqOf, tradeMove } from '../src/systems/minis';
import { fromFEN, legalActions, parseSAN } from '../src/core';
import { captureGain, hanging } from '../src/tactics/attacks';

describe('mini-games', () => {
  it('lists every catalog mini-game', () => {
    expect(MINIS.map((m) => m.id)).toEqual(['MINI-01', 'MINI-02', 'MINI-03', 'MINI-04', 'MINI-05', 'MINI-06', 'MINI-07', 'MINI-08', 'MINI-09']);
  });
  it('every maze and candy level can be finished, with a par of at least 2', () => {
    for (const l of [...MAZES, ...CANDY]) {
      const par = pathPar(l);
      expect(par, JSON.stringify(l)).toBeGreaterThanOrEqual(2);
      expect(l.walls).not.toContain(l.start);
      for (const g of l.goals) expect(l.walls).not.toContain(g);
    }
  });
  it('walls block the piece, and it keeps moving on its own', () => {
    const s = pathState(MAZES[0]);
    expect(pathMoves(s).some((m) => m.to === sqOf('e1'))).toBe(false); // the d-file wall stops the rook
    const n = pathStep(s, pathMoves(s).find((m) => m.to === sqOf('a8'))!);
    expect(pathMoves(n).some((m) => m.to === sqOf('h8'))).toBe(true);
    expect(pathStars(2, 2)).toBe(3);
    expect(pathStars(4, 2)).toBe(2);
    expect(pathStars(9, 2)).toBe(1);
  });
  it('every sprint position is mate in one with the listed answer', () => {
    expect(MATE_IN_ONE.length).toBeGreaterThanOrEqual(40);
    for (const p of MATE_IN_ONE) expect(isMate(p.fen, parseSAN(fromFEN(p.fen), p.answers[0])!), p.fen).toBe(true);
  });
  it('guard duty positions have something hanging and a move that fixes it', () => {
    for (const p of GUARD_DUTY) {
      const s = fromFEN(p.fen);
      expect(hanging(s, 'p1').length).toBeGreaterThan(0);
      expect(legalActions(s).some((m) => guardsAll(p.fen, m))).toBe(true);
    }
  });
  it('trade answers match the exchange count, about half yes', () => {
    for (const t of TRADES) expect(captureGain(fromFEN(t.fen), tradeMove(t.fen, t.move)!) > 0).toBe(t.wins);
    const yes = TRADES.filter((t) => t.wins).length;
    expect(Math.abs(yes - TRADES.length / 2)).toBeLessThanOrEqual(3);
  });
  it('spotlight answers are moves of the lit piece', () => {
    for (const p of SPOTLIGHT) {
      const s = fromFEN(p.fen);
      const piece = s.sq[p.square];
      expect(piece).toBeGreaterThanOrEqual(0);
      for (const san of p.best) {
        const m = parseSAN(s, san)!;
        expect(m.piece).toBe(piece);
        expect(isSpotlightBest(p.fen, p.best, m)).toBe(true);
      }
    }
  });
  it('ladder positions are legal and White moves first', () => {
    for (const l of [...MATE_LADDER, ...HANDICAP_LADDER]) expect(legalActions(fromFEN(l.fen)).length).toBeGreaterThan(0);
    expect(HANDICAP_LADDER[0].fen.split(' ')[0]).not.toContain('q'); // starts without its queen
  });
});
