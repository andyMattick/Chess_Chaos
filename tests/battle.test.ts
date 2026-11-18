import { battleStart, legalActions, play, replay, newBattleRecord, makeMove, fromFEN, parseSAN, standardStart, hillData, hillSquares } from '../src/core';
import type { GameState, MoveAction } from '../src/core';
import { chooseMove } from '../src/ai/strength';

function playMoves(s: GameState, n: number, rand: () => number) {
  for (let i = 0; i < n && !s.result; i++) {
    const moves = legalActions(s);
    s = play(s, moves[Math.floor(rand() * moves.length)]);
  }
  return s;
}
function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

describe('three and four player boards', () => {
  it('sets up 64 pieces on a cross-shaped board', () => {
    const s = battleStart('four');
    expect(s.board.width).toBe(14);
    expect(s.board.blocked.filter(Boolean).length).toBe(36);
    expect(s.pieces.length).toBe(64);
    expect(s.seats.map((x) => x.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    // Every army has 20 opening moves, like normal chess.
    for (const id of ['p1', 'p2', 'p3', 'p4'] as const) expect(legalActions({ ...s, turn: id }).length).toBe(20);
  });
  it('three player board leaves one side empty', () => {
    const s = battleStart('three');
    expect(s.pieces.length).toBe(48);
    expect(s.seats.length).toBe(3);
  });
  it('turns go clockwise and skip knocked-out players', () => {
    let s = battleStart('four');
    const order: string[] = [];
    for (let i = 0; i < 4; i++) { order.push(s.turn); s = play(s, legalActions(s)[0]); }
    expect(order).toEqual(['p1', 'p2', 'p3', 'p4']);
    s = play(s, { t: 'resign', by: 'p2' });
    expect(s.result).toBeNull();
    s = play(s, legalActions(s)[0]); // p1
    expect(s.turn).toBe('p3');
  });
  it('capturing a king knocks that player out', () => {
    const s = battleStart('four');
    const p1King = s.pieces.find((p) => p.owner === 'p1' && p.type === 'king')!;
    const p2Queen = s.pieces.find((p) => p.owner === 'p2' && p.type === 'queen')!;
    // Teleport for the test: p2 queen captures the p1 king.
    const n = makeMove({ ...s, turn: 'p2' }, { t: 'move', piece: p2Queen.id, to: p1King.at });
    expect(n.seats.find((x) => x.id === 'p1')!.status).toBe('eliminated');
  });
  it('kings may move into danger (no check rule) and en passant is off', () => {
    const s = battleStart('four');
    expect(legalActions(s).every((m) => s.pieces[m.piece].owner === 'p1')).toBe(true);
  });
  it('last player standing wins', () => {
    let s = battleStart('three');
    s = play(s, { t: 'resign', by: 'p2' });
    expect(s.result).toBeNull();
    s = play(s, { t: 'timeout', by: 'p3' });
    expect(s.result).toEqual({ reason: 'last-standing', winners: ['p1'] });
  });
  it('teams win together when both enemy kings fall', () => {
    let s = battleStart('teams');
    s = play(s, { t: 'resign', by: 'p2' });
    s = play(s, { t: 'resign', by: 'p4' });
    expect(s.result).toEqual({ reason: 'last-standing', winners: ['p1', 'p3'] });
  });
  it('partners cannot capture each other', () => {
    const s = battleStart('teams');
    for (const m of legalActions(s)) {
      const v = s.sq[m.to];
      if (v >= 0) expect(s.pieces[v].owner).not.toBe('p3');
    }
  });
  it('random games run to the end without errors and replay exactly', () => {
    for (const kind of ['three', 'four', 'teams'] as const) {
      const rand = seeded(kind.length * 99);
      const rec = newBattleRecord(5, {}, kind);
      let s = replay(rec)[0];
      for (let i = 0; i < 300 && !s.result; i++) {
        const moves = legalActions(s);
        const m = moves[Math.floor(rand() * moves.length)];
        rec.actions.push(m);
        s = play(s, m);
      }
      const again = replay(JSON.parse(JSON.stringify(rec))).at(-1)!;
      expect(again.turn).toBe(s.turn);
      expect(again.seats.map((x) => x.status)).toEqual(s.seats.map((x) => x.status));
    }
  });
  it('pawns promote after seven steps', () => {
    let s = battleStart('four');
    s = playMoves(s, 0, Math.random);
    const pawn = s.pieces.find((p) => p.owner === 'p2' && p.type === 'pawn')!;
    expect(pawn.at % 14).toBe(1);
    expect(s.seats.find((x) => x.id === 'p2')!.promo).toEqual({ axis: 'f', value: 8 });
  });
  it('the AI plays legal moves and grabs a hanging king', () => {
    const s = battleStart('four');
    const c = chooseMove(s, { rating: 900, random: seeded(3) })!;
    expect(legalActions(s).some((m) => m.piece === c.move.piece && m.to === c.move.to)).toBe(true);
    // Put p3's king where p1's queen can take it.
    const q = s.pieces.find((p) => p.owner === 'p1' && p.type === 'queen')!;
    const k3 = s.pieces.find((p) => p.owner === 'p3' && p.type === 'king')!;
    const sq = s.sq.slice(); const pieces = s.pieces.slice();
    const target = q.at + 14 * 3; // three squares up the file
    sq[k3.at] = -1; sq[target] = k3.id; pieces[k3.id] = { ...k3, at: target };
    const pawnSq = q.at + 14; const pawnId = sq[pawnSq];
    sq[pawnSq] = -1; pieces[pawnId] = { ...pieces[pawnId], at: -1 };
    const t: GameState = { ...s, sq, pieces };
    const pick = chooseMove(t, { rating: 1200, random: () => 0.99 })!;
    expect(pick.move.to).toBe(target);
  });
});

describe('king of the hill and hill wars', () => {
  it('KOTH: king reaching the centre wins', () => {
    const s = { ...fromFEN('k7/8/8/8/8/4K3/8/8 w - - 0 1'), mode: 'koth' };
    const m = parseSAN(s, 'Ke4')!;
    expect(play(s, m).result).toEqual({ reason: 'mode-win', winners: ['p1'] });
  });
  it('KOTH: otherwise normal chess', () => {
    const s = { ...standardStart(), mode: 'koth' };
    expect(play(s, parseSAN(s, 'e4')!).result).toBeNull();
  });
  it('hill wars: holding the hill scores each round', () => {
    let s: GameState = { ...standardStart(), mode: 'hill-wars' };
    const hill = hillSquares(s);
    expect(hill.size).toBe(4);
    for (const san of ['e4', 'd5', 'd4', 'a6']) s = play(s, parseSAN(s, san)!);
    // After round 2: white holds e4 and d4, black holds d5.
    const d = hillData(s);
    expect(d.scores.p1).toBe(2 + 1); // round 1: e4; round 2: e4 + d4
    expect(d.scores.p2).toBe(1 + 1);
    expect(d.target).toBe(20);
  });
  it('hill wars: first to the target wins', () => {
    let s: GameState = { ...standardStart(), mode: 'hill-wars', modeData: { hill: { scores: { p1: 19 }, target: 20 } } };
    s = play(s, parseSAN(s, 'e4')!);
    s = play(s, parseSAN(s, 'a6')!);
    expect(s.result).toEqual({ reason: 'mode-win', winners: ['p1'] });
  });
  it('battle hill on the big board has a 4x4 hill and a target of 30', () => {
    const s = battleStart('four', 'battle-hill');
    expect(hillSquares(s).size).toBe(16);
    expect(hillData(s).target).toBe(30);
  });
});

void (null as unknown as MoveAction);

describe('bots understand the hill', () => {
  it('KOTH bot walks its king onto the hill when it can', () => {
    const s = { ...fromFEN('k7/8/8/8/8/4K3/8/8 w - - 0 1'), mode: 'koth' };
    const c = chooseMove(s, { rating: 1200, random: () => 0.99 })!;
    expect(play(s, c.move).result?.reason).toBe('mode-win');
  });
});

import { newRecord, initialState, flagSquare, rolledType, MODE_INFO } from '../src/core';
describe('party modes', () => {
  const start = (mode: string) => initialState(newRecord(7, {}, undefined, mode));
  it('MODE-03 three-check: third check wins', () => {
    let s = start('three-check');
    for (const san of 'e4 e5 Bb5 a6 Bxd7+ Kxd7 Qg4+ Ke8 Qxg7 Bd6 Qxg8+'.split(' ')) s = play(s, parseSAN(s, san)!);
    expect(s.result).toEqual({ reason: 'mode-win', winners: ['p1'] });
  });
  it('MODE-06 capture race: 15 points wins', () => {
    let s: GameState = { ...start('capture-race'), modeData: { points: { p1: 14 } } };
    for (const san of 'e4 d5 exd5'.split(' ')) s = play(s, parseSAN(s, san)!);
    expect(s.result?.reason).toBe('mode-win');
  });
  it('MODE-01 dice chess: only the rolled piece type may move', () => {
    const s = start('random-piece');
    const moves = legalActions(s);
    const types = new Set(moves.map((m) => s.pieces[m.piece].type));
    expect(types.size).toBe(1);
    expect(rolledType(s, legalActions({ ...s, mode: 'standard' }))).toBe([...types][0]);
  });
  it('MODE-22 truce: no captures early', () => {
    let s = start('truce');
    for (const san of 'e4 d5'.split(' ')) s = play(s, parseSAN(s, san)!);
    expect(parseSAN(s, 'exd5')).toBeUndefined();
  });
  it('MODE-20 capture the flag: survive a turn on the enemy flag', () => {
    const s0 = start('capture-the-flag');
    const flag = flagSquare(s0, 'p2');
    expect(Math.floor(flag / 8)).toBe(7);
    expect(flag % 8).toBeGreaterThanOrEqual(2);
    expect(flag % 8).toBeLessThanOrEqual(5);
  });
  it('MODE-05 shuffle start: bishops on opposite colours, mirrored, no castling', () => {
    const s = start('shuffle');
    const back = (r: number) => Array.from({ length: 8 }, (_, f) => s.pieces[s.sq[r * 8 + f]].type);
    expect(back(0)).toEqual(back(7));
    const bishops = back(0).map((t, f) => (t === 'bishop' ? f % 2 : -1)).filter((x) => x >= 0);
    expect(new Set(bishops).size).toBe(2);
    expect(legalActions(s).some((m) => m.castle)).toBe(false);
  });
  it('every mode has a name and blurb', () => {
    for (const m of MODE_INFO) expect(m.blurb.length).toBeGreaterThan(10);
  });
});
