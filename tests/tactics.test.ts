import { fromFEN, parseSAN, play, standardStart, makeMove, parseSquare } from '../src/core';
import type { GameState, MoveAction } from '../src/core';
import { see, hanging, newThreats, captureGain, dangerMap } from '../src/tactics/attacks';
import { isFork, isPin, isSkewer, isDiscovered, isFreePiece, isMate, availableTactics } from '../src/tactics/detectors';
import { EASY_GOALS } from '../src/tactics/missions';

const mv = (s: GameState, san: string): MoveAction => {
  const m = parseSAN(s, san);
  if (!m) throw new Error(`no move ${san}`);
  return m;
};
const sq = (s: GameState, n: string) => parseSquare(s.board, n);

describe('static exchange', () => {
  it('undefended rook attacked by pawn loses 5', () => {
    const s = fromFEN('k7/8/8/3r4/4P3/8/8/K7 b - - 0 1');
    expect(see(s, sq(s, 'd5'))).toBe(5);
  });
  it('defended pawn attacked by queen is not hanging', () => {
    const s = fromFEN('k7/8/2p5/3p4/8/8/3Q4/K7 b - - 0 1');
    expect(see(s, sq(s, 'd5'))).toBe(0);
  });
  it('rook defended by pawn attacked by knight loses 2', () => {
    const s = fromFEN('k7/4p3/3r4/8/4N3/8/8/K7 b - - 0 1');
    expect(see(s, sq(s, 'd6'))).toBe(2);
  });
  it('sees x-ray attackers', () => {
    // Doubled white rooks against a knight defended once.
    const s = fromFEN('k2r4/8/3n4/8/8/8/3R4/K2R4 b - - 0 1');
    expect(see(s, sq(s, 'd6'))).toBe(3);
  });
  it('lists hanging pieces and capture gains', () => {
    const s = fromFEN('k7/8/8/3r4/4P3/8/8/K7 w - - 0 1');
    expect(hanging(s, 'p2').map((h) => h.piece.type)).toEqual(['rook']);
    expect(captureGain(s, mv(s, 'exd5'))).toBe(5);
  });
  it('builds a danger map', () => {
    const s = standardStart();
    const d = dangerMap(s, 'p1');
    expect(d[sq(s, 'e6')]).toBeGreaterThan(0);
    expect(d[sq(s, 'e4')]).toBe(0);
  });
  it('spots new threats after a move', () => {
    const s = fromFEN('k7/8/8/8/8/2n5/8/K2Q4 b - - 0 1');
    const after2 = makeMove(s, mv(s, 'Nb5'));
    expect(newThreats(s, after2, 'p1').length).toBe(0);
    const t = fromFEN('k7/8/8/8/8/4n3/8/K2Q4 b - - 0 1');
    const t2 = makeMove(t, mv(t, 'Nc2+'));
    const threats = newThreats(t, t2, 'p1');
    expect(threats.some((x) => x.kind === 'check')).toBe(true);
  });
});

describe('detectors', () => {
  it('fork: knight forks king and rook', () => {
    const s = fromFEN('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1');
    expect(isFork(s, mv(s, 'Nc7+'))).toBe(true);
  });
  it('fork: pawn forks knight and bishop', () => {
    const s = fromFEN('k7/8/2n1b3/8/3PP3/8/8/K7 w - - 0 1');
    expect(isFork(s, mv(s, 'd5'))).toBe(true);
  });
  it('fork: a check alone is not a fork', () => {
    const s = fromFEN('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1');
    expect(isFork(s, mv(s, 'Nd6+'))).toBe(false);
  });
  it('fork: not when the forking piece just gets taken', () => {
    const s = fromFEN('k7/8/1rp2r2/8/8/4N3/8/K7 w - - 0 1');
    expect(isFork(s, mv(s, 'Nd5'))).toBe(false);
  });

  it('pin: bishop pins knight to king', () => {
    const s = fromFEN('4k3/8/2n5/8/8/8/8/K4B2 w - - 0 1');
    expect(isPin(s, mv(s, 'Bb5'))).toBe(true);
  });
  it('pin: rook pins knight on a file', () => {
    const s = fromFEN('4k3/8/4n3/8/8/8/8/R6K w - - 0 1');
    expect(isPin(s, mv(s, 'Re1'))).toBe(true);
  });
  it('pin: an old pin does not count again', () => {
    const s = fromFEN('4k3/8/4n3/8/8/8/8/4R2K w - - 0 1');
    expect(isPin(s, mv(s, 'Kg1'))).toBe(false);
  });
  it('pin: something else behind is not a pin to the king', () => {
    const s = fromFEN('k7/1p6/2n5/8/8/8/6B1/K7 w - - 0 1');
    expect(isPin(s, mv(s, 'Be4'))).toBe(false);
  });

  it('skewer: rook checks the king with the queen behind', () => {
    const s = fromFEN('4q3/8/8/4k3/8/8/8/R6K w - - 0 1');
    expect(isSkewer(s, mv(s, 'Re1+'))).toBe(true);
  });
  it('skewer: bishop hits queen with rook behind', () => {
    const s = fromFEN('r6k/8/8/3q4/8/8/8/5B1K w - - 0 1');
    expect(isSkewer(s, mv(s, 'Bg2'))).toBe(true);
  });
  it('skewer: small piece in front is not a skewer', () => {
    const s = fromFEN('r6k/8/8/3n4/8/8/8/5B1K w - - 0 1');
    expect(isSkewer(s, mv(s, 'Bg2'))).toBe(false);
  });
  it('skewer: quiet rook move is not a skewer', () => {
    const s = fromFEN('4q3/8/8/4k3/8/8/8/R6K w - - 0 1');
    expect(isSkewer(s, mv(s, 'Rb1'))).toBe(false);
  });

  it('discovered: knight uncovers rook on queen', () => {
    const s = fromFEN('4q2k/8/8/8/4N3/8/8/4R2K w - - 0 1');
    expect(isDiscovered(s, mv(s, 'Nc5'))).toBe(true);
  });
  it('discovered: knight uncovers bishop check', () => {
    const s = fromFEN('7k/8/8/8/8/8/1N6/B6K w - - 0 1');
    expect(isDiscovered(s, mv(s, 'Nd3+'))).toBe(true);
  });
  it('discovered: nothing behind', () => {
    const s = fromFEN('k7/8/8/8/4N3/8/8/7K w - - 0 1');
    expect(isDiscovered(s, mv(s, 'Nc5'))).toBe(false);
  });
  it('discovered: uncovering a pawn does not count', () => {
    const s = fromFEN('4p2k/8/8/8/4N3/8/8/4R2K w - - 0 1');
    expect(isDiscovered(s, mv(s, 'Nc5'))).toBe(false);
  });

  it('free piece: undefended knight', () => {
    const s = fromFEN('k7/8/8/3n4/8/8/8/K2R4 w - - 0 1');
    expect(isFreePiece(s, mv(s, 'Rxd5'))).toBe(true);
  });
  it('free piece: pawn takes defended knight', () => {
    const s = fromFEN('k7/8/4p3/3n4/4P3/8/8/K7 w - - 0 1');
    expect(isFreePiece(s, mv(s, 'exd5'))).toBe(true);
  });
  it('free piece: queen for a defended rook is not free', () => {
    const s = fromFEN('k7/8/4p3/3r4/8/8/8/K2Q4 w - - 0 1');
    expect(isFreePiece(s, mv(s, 'Qxd5'))).toBe(false);
  });
  it('free piece: quiet move', () => {
    const s = fromFEN('k7/8/8/3n4/8/8/8/K2R4 w - - 0 1');
    expect(isFreePiece(s, mv(s, 'Rd2'))).toBe(false);
  });

  it('mate in one detected, quiet move not', () => {
    const s = fromFEN('k7/8/1K6/8/8/8/8/7R w - - 0 1');
    expect(isMate(s, mv(s, 'Rh8#'))).toBe(true);
    expect(isMate(s, mv(s, 'Rh7'))).toBe(false);
  });

  it('lists available tactics best first', () => {
    const s = fromFEN('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1');
    expect(availableTactics(s)[0].id).toBe('fork');
    expect(availableTactics(standardStart())).toEqual([]);
  });
});

function goalCtx(line: string, start = standardStart()) {
  const states = [start];
  const actions: MoveAction[] = [];
  for (const san of line.split(' ')) {
    const s = states[states.length - 1];
    const m = mv(s, san);
    actions.push(m);
    states.push(play(s, m));
  }
  return { states, actions, player: 'p1' as const };
}

describe('easy mission goals', () => {
  it('MISSION-01 castle by move 8', () => {
    expect(EASY_GOALS['MISSION-01'](goalCtx('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O'))).toBe(true);
    expect(EASY_GOALS['MISSION-01'](goalCtx('e4 e5 Nf3 Nc6 Bc4 Bc5'))).toBe(false);
  });
  it('MISSION-02 capture with a knight', () => {
    expect(EASY_GOALS['MISSION-02'](goalCtx('e4 d5 Nc3 dxe4 Nxe4'))).toBe(true);
    expect(EASY_GOALS['MISSION-02'](goalCtx('e4 d5 exd5'))).toBe(false);
  });
  it('MISSION-08 five turns with nothing hanging', () => {
    expect(EASY_GOALS['MISSION-08'](goalCtx('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6'))).toBe(true);
    expect(EASY_GOALS['MISSION-08'](goalCtx('e4 e5 Qh5 Nc6'))).toBe(false);
  });
  it('MISSION-13 develop all four minors by move 10', () => {
    expect(EASY_GOALS['MISSION-13'](goalCtx('e4 e5 Nf3 Nc6 Bc4 Bc5 Nc3 Nf6 d3 d6 Bg5 h6'))).toBe(true);
    expect(EASY_GOALS['MISSION-13'](goalCtx('e4 e5 Nf3 Nc6'))).toBe(false);
  });
  it('MISSION-22 connect the rooks', () => {
    expect(EASY_GOALS['MISSION-22'](goalCtx('Ke2 Kb8', fromFEN('k7/8/8/8/8/8/8/R3K2R w KQ - 0 1')))).toBe(true);
    expect(EASY_GOALS['MISSION-22'](goalCtx('e4 e5'))).toBe(false);
  });
});
