import { describe, expect, it } from 'vitest';
import { LU_PIECES, LEVEL_AT } from '../src/content/levelup';
import {
  battleOdds, battleOutcome, blankGame, inCheck, legalActions, newGame, play, put, sqAt, strikeOutcome, viewOf, visible, identified, type LUAction, type LUState,
} from '../src/levelup/rules';

const S = (f: number, r: number) => sqAt(f, r);
const acts = (s: LUState, id: number) => legalActions(s).filter((a) => 'piece' in a && a.piece === id);
const has = (s: LUState, a: Partial<LUAction>) => legalActions(s).some((x) => Object.entries(a).every(([k, v]) => (x as never)[k] === v));
/** Make the next die rolls come out as wanted (searching seeds). */
function withRolls(s: LUState, rolls: number[]): LUState {
  for (let seed = 1; seed < 200000; seed++) {
    let r = seed | 0;
    const out: number[] = [];
    for (let i = 0; i < rolls.length; i++) {
      let t = (r = (r + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      out.push(1 + Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * 6));
    }
    if (out.every((x, i) => x === rolls[i])) return { ...s, rng: seed | 0 };
  }
  throw new Error('no seed');
}
/** Kings tucked away in the corners, so tests are legal positions. */
function kings(s: LUState) {
  put(s, 'king', 'p1', S(0, 0));
  put(s, 'king', 'p2', S(15, 15));
  return s;
}

describe('Level-Up Chess: setup', () => {
  it('two armies of 24 on a 16 x 16 board, a forest in the middle, three race missions and a secret each', () => {
    const s = newGame(7);
    expect(s.pieces.length).toBe(48);
    expect(s.pieces.filter((p) => p.owner === 'p1' && p.type === 'pawn').length).toBe(12);
    for (const t of ['catapult', 'medic', 'miner', 'scout']) expect(s.pieces.filter((p) => p.type === t).length).toBe(2);
    const trees = s.trees.filter((x) => x > 0).length;
    expect(trees).toBeGreaterThan(20);
    // The forest is the same for both sides.
    for (let i = 0; i < 256; i++) expect(s.trees[i]).toBe(s.trees[255 - i]);
    expect(s.globals.length).toBe(3);
    expect(s.raceDeck.length).toBe(11);
    expect(s.secret.p1 && s.secret.p2).toBeTruthy();
    expect(legalActions(s).length).toBeGreaterThan(30);
  });
  it('the same seed and moves give the same game', () => {
    let a = newGame(3), b = newGame(3);
    for (let i = 0; i < 30 && !a.result; i++) { const m = legalActions(a)[i % legalActions(a).length]; a = play(a, m); b = play(b, m); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('battles', () => {
  it('higher total wins; a big loss crushes the attacker', () => {
    const s = kings(blankGame());
    const a = put(s, 'pawn', 'p1', S(5, 5));
    const d = put(s, 'queen', 'p2', S(6, 6));
    expect(battleOutcome(s, a, d, 6, 1).outcome).toBe('win'); // 1+6=7 vs 5+1=6
    expect(battleOutcome(s, a, d, 4, 2).outcome).toBe('bounce'); // 5 vs 7
    expect(battleOutcome(s, a, d, 1, 6).outcome).toBe('crushed'); // 2 vs 11
  });
  it('ties: a combined attack wins, then bases decide', () => {
    const s = kings(blankGame());
    const a = put(s, 'knight', 'p1', S(5, 5), { base: 'triangle' });
    const d = put(s, 'bishop', 'p2', S(7, 6), { base: 'circle' });
    expect(battleOutcome(s, a, d, 3, 3).outcome).toBe('win'); // triangle beats circle
    d.base = 'square';
    expect(battleOutcome(s, a, d, 3, 3).outcome).toBe('bounce'); // square beats triangle
    put(s, 'pawn', 'p1', S(8, 6)); // a friend next to the target
    expect(battleOutcome(s, a, d, 3, 3).outcome).toBe('win');
  });
  it('odds add up and a queen usually beats a pawn', () => {
    const s = kings(blankGame());
    const q = put(s, 'queen', 'p1', S(5, 5)), p = put(s, 'pawn', 'p2', S(5, 9));
    const o = battleOdds(s, q, p);
    expect(o.win + o.bounce + o.crushed).toBeCloseTo(1);
    expect(o.win).toBeGreaterThan(0.8);
    expect(battleOdds(s, p, q).crushed).toBeGreaterThan(0.3);
  });
  it('a won battle moves in, earns points and shakes the trees around', () => {
    let s = kings(blankGame());
    const n = put(s, 'knight', 'p1', S(5, 5));
    const e = put(s, 'bishop', 'p2', S(6, 3));
    s.trees[S(7, 3)] = 2;
    s = withRolls(s, [6, 1]);
    s = play(s, { t: 'attack', piece: n.id, to: S(6, 3) });
    expect(s.pieces[e.id].at).toBe(-1);
    expect(s.pieces[n.id].at).toBe(S(6, 3));
    expect(s.pieces[n.id].xp).toBe(2); // win + big piece
    expect(s.trees[S(7, 3)]).toBe(1);
    expect(s.events.some((x) => x.k === 'battle' && x.outcome === 'win')).toBe(true);
    expect(s.pieces[e.id].known).toContain('p1');
  });
  it('a bounce leaves both where they were', () => {
    let s = kings(blankGame());
    const n = put(s, 'knight', 'p1', S(5, 5));
    put(s, 'bishop', 'p2', S(6, 7));
    s = withRolls(s, [1, 3]); // 4 vs 6
    s = play(s, { t: 'attack', piece: n.id, to: S(6, 7) });
    expect(s.pieces[n.id].at).toBe(S(5, 5));
  });
});

describe('levels', () => {
  it('3 points to level 2, 8 to level 3, with a level-up event', () => {
    expect(LEVEL_AT).toEqual([0, 3, 8]);
    let s = kings(blankGame());
    const p = put(s, 'pawn', 'p1', S(6, 5), { xp: 2 });
    s = play(s, { t: 'move', piece: p.id, to: S(6, 6) }); // reaches the centre: +1
    expect(s.pieces[p.id].xp).toBe(3);
    expect(s.events.some((x) => x.k === 'levelup' && x.level === 2)).toBe(true);
  });
  it('a level 2 pawn attacks two squares away diagonally; level 3 moves any way', () => {
    const s = kings(blankGame());
    const p = put(s, 'pawn', 'p1', S(5, 5), { xp: 3 });
    put(s, 'rook', 'p2', S(7, 7));
    expect(has(s, { t: 'attack', piece: p.id, to: S(7, 7) })).toBe(true);
    s.pieces[p.id].xp = 8;
    expect(has(s, { t: 'move', piece: p.id, to: S(5, 4) })).toBe(true);
  });
  it('kings are never attacked in battle, only checked', () => {
    const s = kings(blankGame());
    put(s, 'rook', 'p1', S(15, 3));
    expect(legalActions(s).some((a) => a.t === 'attack' && a.to === S(15, 15))).toBe(false);
  });
});

describe('check and winning', () => {
  it('check earns points and you must answer it', () => {
    let s = kings(blankGame());
    const r = put(s, 'rook', 'p1', S(3, 3));
    s = play(s, { t: 'move', piece: r.id, to: S(15, 3) });
    expect(s.events.some((x) => x.k === 'check')).toBe(true);
    expect(s.pieces[r.id].xp).toBe(2);
    expect(inCheck(s, 'p2')).toBe(true);
    for (const a of legalActions(s)) expect(a.t === 'move' && s.pieces[a.piece].type === 'king').toBe(true);
  });
  it('checkmate wins; a secret mission done makes it a complete win', () => {
    let s = kings(blankGame());
    put(s, 'rook', 'p1', S(1, 14));
    const r = put(s, 'rook', 'p1', S(2, 3));
    s.secret.p1 = 'S-life';
    s.secretDone.p1 = true;
    s = play(s, { t: 'move', piece: r.id, to: S(2, 15) });
    expect(s.result?.reason).toBe('checkmate');
    expect(s.result?.winner).toBe('p1');
    expect(s.result?.grade).toBe('Complete win');
  });
  it('race missions: the first to do one gets the bonus', () => {
    let s = kings(blankGame());
    s.globals = [{ id: 'G-kill', winner: null }];
    const n = put(s, 'knight', 'p1', S(5, 5));
    put(s, 'pawn', 'p2', S(6, 3));
    s = withRolls(s, [6, 1]);
    s = play(s, { t: 'attack', piece: n.id, to: S(6, 3) });
    expect(s.raceDone).toEqual([{ id: 'G-kill', winner: 'p1' }]);
    expect(s.globals).toEqual([]); // nothing left in the deck
    expect(s.pieces[n.id].xp).toBe(1 + 2);
  });
  it('race missions are a deck: claim one and the next card turns face up', () => {
    let s = kings(blankGame());
    s.globals = [{ id: 'G-mine', winner: null }, { id: 'G-kill', winner: null }, { id: 'G-tree', winner: null }];
    s.raceDeck = ['G-fork', 'G-check'];
    const mi = put(s, 'miner', 'p1', S(5, 5));
    s = play(s, { t: 'mine', piece: mi.id, to: S(5, 6) });
    expect(s.globals.map((g) => g.id)).toEqual(['G-fork', 'G-kill', 'G-tree']);
    expect(s.raceDeck).toEqual(['G-check']);
    expect(s.raceDone[0]).toEqual({ id: 'G-mine', winner: 'p1' });
  });
  it('only a level 3 scout can strike a king, and that wins at once', () => {
    let s = kings(blankGame());
    const sc = put(s, 'scout', 'p1', S(14, 14));
    expect(has(s, { t: 'strike', piece: sc.id, to: S(15, 15) })).toBe(false);
    s.pieces[sc.id].xp = 8;
    expect(has(s, { t: 'strike', piece: sc.id, to: S(15, 15) })).toBe(true);
    // An assassin never gives check.
    expect(inCheck(s, 'p2')).toBe(false);
    s = withRolls(s, [5]);
    s = play(s, { t: 'strike', piece: sc.id, to: S(15, 15) });
    expect(s.result?.reason).toBe('assassin');
    expect(s.result?.grade).toBe('Sneak attack win');
  });
  it('scout strikes: 1 falls, 2-3 bounce, 4-6 win (+1 at level 3)', () => {
    const s = blankGame();
    const sc = put(s, 'scout', 'p1', S(1, 1));
    expect([1, 2, 3, 4, 5, 6].map((r) => strikeOutcome(sc, r))).toEqual(['crushed', 'bounce', 'bounce', 'win', 'win', 'win']);
    sc.xp = 8;
    expect(strikeOutcome(sc, 3)).toBe('win');
    expect(strikeOutcome(sc, 1)).toBe('crushed');
  });
});

describe('the new pieces', () => {
  it('catapult: warning first, the target can step away; a hit destroys it and earns points', () => {
    let s = kings(blankGame());
    const c = put(s, 'catapult', 'p1', S(5, 2));
    const t = put(s, 'pawn', 'p2', S(5, 5));
    const t2 = put(s, 'knight', 'p2', S(8, 5));
    s = play(s, { t: 'fire', piece: c.id, to: S(5, 5) });
    expect(s.events.some((x) => x.k === 'shot')).toBe(true);
    s = play(s, { t: 'move', piece: t.id, to: S(5, 4) }); // dodges
    expect(s.pieces[t.id].at).toBe(S(5, 4));
    expect(s.events.some((x) => x.k === 'miss')).toBe(true);
    s = play(s, { t: 'fire', piece: c.id, to: S(8, 5) });
    s = play(s, { t: 'move', piece: s.pieces.find((p) => p.type === 'king' && p.owner === 'p2')!.id, to: S(14, 15) }); // ignores it
    expect(s.pieces[t2.id].at).toBe(-1);
    expect(s.pieces[c.id].xp).toBe(2);
  });
  it('level 3 catapult: the blast hits the diagonals too and leaves a crater nothing can cross', () => {
    let s = kings(blankGame());
    const c = put(s, 'catapult', 'p1', S(5, 2), { xp: 8 });
    const centre = put(s, 'pawn', 'p2', S(5, 6));
    const diag = put(s, 'knight', 'p2', S(6, 7));
    const side = put(s, 'pawn', 'p2', S(6, 6)); // next to it, not diagonal: safe
    const rook = put(s, 'rook', 'p1', S(0, 6));
    expect(legalActions(s).some((a) => a.t === 'fire' && a.piece === c.id && a.to === S(5, 7))).toBe(true); // reach 5
    expect(legalActions(s).some((a) => a.t === 'fire' && a.piece === c.id && a.to === S(5, 8))).toBe(false); // not 6
    s = play(s, { t: 'fire', piece: c.id, to: S(5, 6) });
    s = play(s, { t: 'move', piece: s.pieces.find((p) => p.type === 'king' && p.owner === 'p2')!.id, to: S(14, 15) });
    expect(s.pieces[centre.id].at).toBe(-1);
    expect(s.pieces[diag.id].at).toBe(-1);
    expect(s.pieces[side.id].at).toBe(S(6, 6));
    expect(s.craters).toContain(S(5, 6));
    expect(s.events.some((x) => x.k === 'crater')).toBe(true);
    // The rook's row is cut at the crater, for good.
    const rookTo = legalActions(s).filter((a) => a.t === 'move' && a.piece === rook.id).map((a) => (a as { to: number }).to);
    expect(rookTo).toContain(S(4, 6));
    expect(rookTo).not.toContain(S(5, 6));
    expect(legalActions(s).some((a) => 'to' in a && a.to === S(5, 6))).toBe(false); // no piece can go there
  });
  it('a level 2 rook shields the piece behind it from a catapult', () => {
    let s = kings(blankGame());
    const c = put(s, 'catapult', 'p1', S(5, 2));
    const t = put(s, 'pawn', 'p2', S(5, 6));
    put(s, 'rook', 'p2', S(5, 5), { xp: 3 });
    s = play(s, { t: 'fire', piece: c.id, to: S(5, 6) });
    s = play(s, legalActions(s).find((a) => a.t === 'move' && s.pieces[a.piece].type === 'king')!);
    expect(s.pieces[t.id].at).toBe(S(5, 6));
    expect(s.events.some((x) => x.k === 'shield')).toBe(true);
  });
  it('medic: brings a friend back within 2 squares and 3 turns; a level 3 bishop from anywhere', () => {
    let s = kings(blankGame());
    const m = put(s, 'medic', 'p1', S(5, 3));
    const lost = put(s, 'knight', 'p1', S(6, 5), { xp: 2 });
    const enemy = put(s, 'queen', 'p2', S(6, 8));
    s = withRolls(s, [6, 1]);
    s.turn = 'p2';
    s = play(s, { t: 'attack', piece: enemy.id, to: S(6, 5) });
    expect(s.pieces[lost.id].at).toBe(-1);
    const rev = acts(s, m.id).find((a) => a.t === 'revive');
    expect(rev).toBeDefined();
    s = play(s, rev!);
    expect(s.pieces[lost.id].at).toBeGreaterThanOrEqual(0);
    expect(s.pieces[lost.id].xp).toBe(2); // keeps its experience
    // Too late: four turns on.
    const b = kings(blankGame());
    const med = put(b, 'medic', 'p1', S(5, 3));
    const gone = put(b, 'pawn', 'p1', S(6, 4));
    b.pieces[gone.id].at = -1; b.sq[S(6, 4)] = -1;
    b.fallen.push({ id: gone.id, at: S(6, 4), ply: 0 });
    b.ply = 8;
    expect(acts(b, med.id).some((a) => a.t === 'revive')).toBe(false);
    const bish = put(b, 'bishop', 'p1', S(10, 1), { xp: 8 });
    expect(acts(b, bish.id).some((a) => a.t === 'revive')).toBe(true);
  });
  it('mines: hidden from the enemy, blow up the first enemy to step on one (kings just clear them)', () => {
    let s = kings(blankGame());
    const mi = put(s, 'miner', 'p1', S(5, 5));
    const foe = put(s, 'rook', 'p2', S(5, 12));
    s = play(s, { t: 'mine', piece: mi.id, to: S(5, 6) });
    expect(viewOf(s, 'p2').scouted.has(S(5, 6))).toBe(false);
    // To the rook it looks like open ground.
    const into = acts(s, foe.id).find((a) => a.t === 'move' && a.to === S(5, 6));
    expect(into).toBeDefined();
    s = play(s, into!);
    expect(s.pieces[foe.id].at).toBe(-1);
    expect(s.events.some((x) => x.k === 'boom')).toBe(true);
  });
  it('scouts dash up to 4 squares; level 2 is invisible except to scouts', () => {
    const s = kings(blankGame());
    const sc = put(s, 'scout', 'p1', S(5, 5));
    expect(has(s, { t: 'move', piece: sc.id, to: S(5, 9) })).toBe(true);
    expect(has(s, { t: 'move', piece: sc.id, to: S(5, 10) })).toBe(false);
    const spy = put(s, 'scout', 'p2', S(6, 7), { xp: 3 });
    put(s, 'pawn', 'p1', S(6, 6));
    const v = viewOf(s, 'p1');
    expect(v.seen.has(S(6, 7))).toBe(true);
    expect(visible(s, v, 'p1', spy)).toBe(true); // our scout is right there
    s.pieces[sc.id].at = -1; s.sq[S(5, 5)] = -1;
    const v2 = viewOf(s, 'p1');
    expect(visible(s, v2, 'p1', spy)).toBe(false);
  });
  it('fog: enemy pieces far away are hidden; seen ones are a mystery until they fight or a scout sees them', () => {
    const s = newGame(5);
    const v = viewOf(s, 'p1');
    const far = s.pieces.find((p) => p.owner === 'p2' && p.type === 'queen')!;
    expect(visible(s, v, 'p1', far)).toBe(false);
    expect(identified(v, 'p1', far)).toBe(false);
  });
});

describe('a whole game', () => {
  it('300 random actions never break the board', () => {
    let s = newGame(11);
    let x = 5;
    for (let i = 0; i < 300 && !s.result; i++) {
      const moves = legalActions(s);
      x = (x * 1103515245 + 12345) % 2147483648;
      s = play(s, moves[x % moves.length]);
      for (const p of s.pieces) if (p.at >= 0) expect(s.sq[p.at]).toBe(p.id);
      for (let q = 0; q < 256; q++) if (s.sq[q] >= 0) expect(s.pieces[s.sq[q]].at).toBe(q);
    }
    expect(LU_PIECES.queen.value).toBe(5);
  });
});

describe('the Level-Up bot', () => {
  it('only plays legal actions and finishes a game', async () => {
    const { chooseAction } = await import('../src/levelup/ai');
    let s = newGame(101);
    let x = 3;
    const rand = () => (x = (x * 16807) % 2147483647) / 2147483647;
    while (!s.result && s.ply < 400) s = play(s, chooseAction(s, 'hard', rand)!);
    expect(s.result).not.toBeNull();
  });
  it('takes a mate in one when it sees one', async () => {
    const { chooseAction } = await import('../src/levelup/ai');
    const s = kings(blankGame());
    put(s, 'rook', 'p1', S(1, 14));
    put(s, 'rook', 'p1', S(2, 3));
    const a = chooseAction(s, 'easy', () => 0.99)!;
    expect(play(s, a).result?.reason).toBe('checkmate');
  });
});
