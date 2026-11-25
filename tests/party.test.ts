import { newRecord, replay, play, parseSAN, initialState, legalActions } from '../src/core';
import type { Action, GameState } from '../src/core';
import { MISSIONS, MODIFIERS } from '../src/content/party';
import { IMPLEMENTED } from '../src/core/modifiers';
import { blockingMoves, blockingMoves2, dealMissions, defenceMoves, drawMode, missionDefence, missionOff, missionWinsAtOnce, pickModifiers, refereeAll, refereeMission, setupParty, slotsForGap, redactParty, undoingMoves, PARTY_DECK } from '../src/systems/party';
import { missionChallenges } from '../src/core/rules';
import { MISSION_DEFENCE_TURNS, MISSION_DEFENCE_TURNS_VS_UNDERDOG, PARTY_MODE_GROUPS } from '../src/content/party';
import { missionDone, missionHolds, MISSION_CHECKS } from '../src/systems/missions';
import { fromFEN } from '../src/core';

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('party setup', () => {
  it('modifier slots follow the rating gap table exactly', () => {
    expect(slotsForGap(99)).toEqual({ underdog: [], favourite: [] });
    expect(slotsForGap(100)).toEqual({ underdog: ['Minor'], favourite: [] });
    expect(slotsForGap(250)).toEqual({ underdog: ['Major'], favourite: [] });
    expect(slotsForGap(300)).toEqual({ underdog: ['Major'], favourite: ['Minor'] });
    expect(slotsForGap(450)).toEqual({ underdog: ['Major', 'Minor'], favourite: ['Minor'] });
    expect(slotsForGap(500)).toEqual({ underdog: ['Major', 'Minor'], favourite: ['Major'] });
  });
  it('buffs go to the underdog, handicaps to the favourite', () => {
    const m = pickModifiers({ mode: 'standard', online: false, players: { p1: { rating: 400, bot: false }, p2: { rating: 1000, bot: true } } }, seeded(3));
    expect(m.p1.length).toBe(2);
    expect(m.p1.every((id) => id.startsWith('BUFF'))).toBe(true);
    expect(m.p2.length).toBe(1);
    expect(m.p2[0].startsWith('HCAP')).toBe(true);
  });
  it('bots only get always-on rules', () => {
    for (let i = 0; i < 50; i++) {
      const m = pickModifiers({ mode: 'standard', online: false, players: { p1: { rating: 1400, bot: false }, p2: { rating: 400, bot: true } } }, seeded(i + 1));
      for (const id of m.p2) {
        const d = MODIFIERS.find((x) => x.id === id)!;
        expect(d.oneShot).toBeUndefined();
        expect(d.humanOnly).toBeFalsy();
      }
    }
  });
  it('online games never get bot-only modifiers', () => {
    for (let i = 0; i < 50; i++) {
      const m = pickModifiers({ mode: 'standard', online: true, players: { p1: { rating: 400, bot: false }, p2: { rating: 1400, bot: false } } }, seeded(i + 7));
      expect([...m.p1, ...m.p2]).not.toContain('BUFF-03');
      expect([...m.p1, ...m.p2]).not.toContain('HCAP-07');
    }
  });
  it('shuffle start never deals castling handicaps', () => {
    for (let i = 0; i < 80; i++) {
      const m = pickModifiers({ mode: 'shuffle', online: false, players: { p1: { rating: 400, bot: false }, p2: { rating: 1000, bot: false } } }, seeded(i + 11));
      expect(m.p2).not.toContain('HCAP-06');
    }
  });
  it('every listed modifier is implemented', () => {
    for (const d of MODIFIERS) expect(IMPLEMENTED.has(d.id)).toBe(true);
  });
  it('missions: favourite gets Hard at 200+, never the same mission', () => {
    for (let i = 0; i < 40; i++) {
      const m = dealMissions({ mode: 'standard', online: false, players: { p1: { rating: 600, bot: false }, p2: { rating: 900, bot: true } } }, seeded(i + 5));
      expect(MISSIONS.find((x) => x.id === m.p2)!.category).toBe('Hard');
      expect(MISSIONS.find((x) => x.id === m.p1)!.category).toBe('Medium');
      expect(m.p1).not.toBe(m.p2);
    }
  });
  it('every mission has a detector', () => {
    for (const m of MISSIONS) expect(MISSION_CHECKS[m.id]).toBeDefined();
  });
  it('mode deck never repeats until it runs out, and avoids the last mode first', () => {
    let deck: string[] = [];
    const seen: string[] = [];
    const rand = seeded(9);
    for (let i = 0; i < PARTY_DECK.length; i++) {
      const d = drawMode(deck, seen.at(-1), rand);
      seen.push(d.mode); deck = d.deck;
    }
    expect([...seen].sort()).toEqual([...PARTY_DECK].sort());
    const next = drawMode(deck, 'koth', () => 0.0);
    expect(next.mode).not.toBe('koth');
  });
  it('redacts the other mission', () => {
    const p = { modifiers: {}, missions: { p1: 'MISSION-05', p2: 'MISSION-06' }, gate: { p1: 10, p2: 10 } };
    expect(redactParty(p, 'p1').missions).toEqual({ p1: 'MISSION-05', p2: '?' });
  });
});

function partyGame(missions: Record<string, string>, gate = 0, mods = {}) {
  const rec = newRecord(1, { p1: 'A', p2: 'B' });
  rec.setup.party = { modifiers: mods, missions, gate: { p1: gate, p2: gate } };
  return rec;
}

function partyFen(fen: string, missions: Record<string, string>) {
  const rec = newRecord(1, { p1: 'A', p2: 'B' }, fen);
  rec.setup.party = { modifiers: {}, missions, gate: { p1: 0, p2: 0 } };
  return rec;
}

/** Play a line with the referee after every move, like the app does. */
function go(rec: ReturnType<typeof partyGame>, line: string) {
  let states = [initialState(rec)];
  let actions: Action[] = [];
  const added: Action[] = [];
  for (const san of line.split(' ')) {
    const s = states.at(-1)!;
    if (s.result) break;
    const m = parseSAN(s, san);
    if (!m) throw new Error('bad ' + san);
    actions = [...actions, m]; states = [...states, play(s, m)];
    const r = refereeAll(states, actions, rec.setup.party!);
    states = r.states; actions = r.actions; added.push(...r.added);
  }
  return { last: states.at(-1)!, added };
}

function run(rec: ReturnType<typeof partyGame>, line: string): { states: GameState[]; actions: Action[]; done: Action | null } {
  const states = [initialState(rec)];
  const actions: Action[] = [];
  let done: Action | null = null;
  for (const san of line.split(' ')) {
    const s = states.at(-1)!;
    const m = parseSAN(s, san);
    if (!m) throw new Error('bad ' + san);
    actions.push(m); states.push(play(s, m));
    done = refereeMission(states, actions, rec.setup.party!);
    if (done) break;
  }
  return { states, actions, done };
}

describe('secret missions', () => {
  it('MISSION-12 check three times: shown, then undone by capturing the checker', () => {
    const rec = partyGame({ p1: 'MISSION-12', p2: 'MISSION-23' });
    const r = run(rec, 'e4 f5 Qh5+ g6 Qxg6+ hxg6 Bc4 Rh5 Bf7+');
    const bishop = r.actions.at(-1)!.t === 'move' ? (r.actions.at(-1) as { piece: number }).piece : -1;
    expect(r.done).toEqual({ t: 'mission', by: 'p1', id: 'MISSION-12', stage: 'reveal', target: [bishop], turns: MISSION_DEFENCE_TURNS });
    const shown = play(r.states.at(-1)!, r.done!);
    expect(shown.result).toBeFalsy();
    expect(missionChallenges(shown).p1).toEqual({ id: 'MISSION-12', left: MISSION_DEFENCE_TURNS, target: [bishop] });
    // Black can undo it: the king takes the bishop.
    const undo = undoingMoves(shown, 'p2');
    expect(undo.length).toBeGreaterThan(0);
    const g = go(rec, 'e4 f5 Qh5+ g6 Qxg6+ hxg6 Bc4 Rh5 Bf7+ Kxf7');
    expect(g.added.map((a) => a.t === 'mission' && a.stage)).toEqual(['reveal', 'off']);
    expect(g.last.result).toBeFalsy();
    expect(missionOff(g.last, 'p1')).toBe(true);
    expect(missionChallenges(g.last).p1).toBeUndefined();
  });
  it('a shown mission that still stands after the defender\'s turns wins', () => {
    const rec = partyFen('k7/8/8/8/3P4/8/8/K7 w - - 0 1', { p1: 'MISSION-17', p2: 'MISSION-23' });
    // It must stand until the end of Black's next turn.
    expect(go(rec, 'd5').last.result).toBeFalsy();
    const g = go(rec, 'd5 Kb7');
    expect(g.added.map((a) => a.t === 'mission' && a.stage)).toEqual(['reveal', 'win']);
    expect(g.last.result).toEqual({ reason: 'mission', winners: ['p1'] });
  });
  it('a board mission is undone when the position changes', () => {
    const rec = partyFen('8/8/8/2k5/3P4/8/8/R6K w - - 0 1', { p1: 'MISSION-17', p2: 'MISSION-23' });
    const shown = go(rec, 'd5');
    expect(shown.added[0]).toMatchObject({ stage: 'reveal' });
    const undo = undoingMoves(shown.last, 'p2');
    expect(undo.length).toBeGreaterThan(0);
    expect(undo.every((m) => shown.last.sq[m.to] >= 0)).toBe(true); // only taking the pawn undoes it
    const g = go(rec, 'd5 Kxd5');
    expect(g.added.map((a) => a.t === 'mission' && a.stage)).toEqual(['reveal', 'off']);
    // Out of play: a new passed pawn later does not bring it back.
    expect(missionOff(g.last, 'p1')).toBe(true);
  });
  it('older games where a mission won at once still replay', () => {
    const s = play(initialState(partyGame({ p1: 'MISSION-12', p2: 'MISSION-23' })), { t: 'mission', by: 'p1', id: 'MISSION-12' });
    expect(s.result).toEqual({ reason: 'mission', winners: ['p1'] });
  });
  it('missions do not count before the gate', () => {
    const rec = partyGame({ p1: 'MISSION-12', p2: 'MISSION-23' }, 10);
    const r = run(rec, 'e4 f5 Qh5+ g6 Qxg6+ hxg6 Bc4 Rh5 Bf7+');
    expect(r.done).toBeNull();
  });
  it('MISSION-04 promote', () => {
    const s = fromFEN('k7/4P3/8/8/8/8/8/K7 w - - 0 1');
    const m = legalActions(s).find((x) => x.promo === 'queen')!;
    expect(missionDone('MISSION-04', { states: [s, play(s, m)], ply: 0, move: m, player: 'p1', movesMade: 20 })).toBe(true);
  });
  it('MISSION-16 en passant', () => {
    const rec = partyGame({ p1: 'MISSION-16', p2: 'MISSION-23' });
    const r = run(rec, 'e4 a6 e5 d5 exd6');
    expect(r.done?.t).toBe('mission');
  });
  it('MISSION-17 passed pawn on the fifth', () => {
    const s = fromFEN('k7/8/8/8/3P4/8/8/K7 w - - 0 1');
    const m = parseSAN(s, 'd5')!;
    expect(missionDone('MISSION-17', { states: [s, play(s, m)], ply: 0, move: m, player: 'p1', movesMade: 20 })).toBe(true);
    const t = fromFEN('k7/4p3/8/8/3P4/8/8/K7 w - - 0 1');
    const n = parseSAN(t, 'd5')!;
    expect(missionDone('MISSION-17', { states: [t, play(t, n)], ply: 0, move: n, player: 'p1', movesMade: 20 })).toBe(false);
  });
  it('MISSION-23 rook tower on an open file', () => {
    const s = fromFEN('k7/8/8/8/8/8/3R4/K2R4 w - - 0 1');
    const m = parseSAN(s, 'Kb1')!;
    expect(missionDone('MISSION-23', { states: [s, play(s, m)], ply: 0, move: m, player: 'p1', movesMade: 20 })).toBe(true);
  });
  it('MISSION-19 bishop pair at move 20', () => {
    const s = initialState(newRecord(1, {}));
    const m = parseSAN(s, 'e4')!;
    expect(missionDone('MISSION-19', { states: [s, play(s, m)], ply: 0, move: m, player: 'p1', movesMade: 20 })).toBe(true);
    expect(missionDone('MISSION-19', { states: [s, play(s, m)], ply: 0, move: m, player: 'p1', movesMade: 19 })).toBe(false);
  });
  it('party records replay with modifiers applied', () => {
    const rec = partyGame({ p1: 'MISSION-12', p2: 'MISSION-23' }, 10, { p1: ['HCAP-05'] });
    const s = replay(rec)[0];
    expect(parseSAN(s, 'e4')).toBeUndefined();
  });
  it('setupParty gives a gate of 8 for beginners', () => {
    const p = setupParty({ mode: 'standard', online: false, players: { p1: { rating: 600, bot: false }, p2: { rating: 650, bot: true } } }, seeded(2));
    expect(p.gate).toEqual({ p1: 8, p2: 8 });
  });
});

import { deckFor, pickModeFor, prefOf, cleanPrefs, PARTY_MODES } from '../src/systems/party';
describe('mode rankings', () => {
  it('ranks set how many copies of a mode are in the deck', () => {
    const d = deckFor({ atomic: 3, horde: 0 });
    expect(d.filter((m) => m === 'atomic').length).toBe(3);
    expect(d).not.toContain('horde');
    expect(d.filter((m) => m === 'standard').length).toBe(3);
    expect(prefOf({}, 'lava')).toBe(1);
    expect(deckFor(Object.fromEntries(PARTY_MODES.map((m) => [m, 0])))).toEqual(PARTY_MODES);
  });
  it('a never mode stops coming up; favourites come up more', () => {
    let deck: string[] = [];
    const prefs = { horde: 0, atomic: 3 };
    const rand = seeded(3);
    const seen: string[] = [];
    for (let i = 0; i < 200; i++) { const d = drawMode(deck, seen.at(-1), rand, prefs); seen.push(d.mode); deck = d.deck; }
    expect(seen).not.toContain('horde');
    expect(seen.filter((m) => m === 'atomic').length).toBeGreaterThan(seen.filter((m) => m === 'lava').length * 2);
  });
  it('online: both players count; a mode both hate never appears', () => {
    const rand = seeded(5);
    const a = { giveaway: 0 }, b = { giveaway: 0, atomic: 3 };
    const picks = Array.from({ length: 500 }, () => pickModeFor([a, b], rand));
    expect(picks).not.toContain('giveaway');
    expect(picks.filter((m) => m === 'atomic').length).toBeGreaterThan(picks.filter((m) => m === 'lava').length);
    expect(cleanPrefs({ atomic: 9, lava: 2, nope: 1 })).toEqual({ lava: 2 });
  });
});

describe('mission advantage for the weaker player', () => {
  it('the stronger player gets fewer turns to undo the weaker player\'s mission', () => {
    expect(missionDefence(800, 1200)).toEqual({ p1: MISSION_DEFENCE_TURNS_VS_UNDERDOG, p2: MISSION_DEFENCE_TURNS });
    expect(missionDefence(1200, 800)).toEqual({ p1: MISSION_DEFENCE_TURNS, p2: MISSION_DEFENCE_TURNS_VS_UNDERDOG });
    expect(missionDefence(800, 850)).toEqual({ p1: MISSION_DEFENCE_TURNS, p2: MISSION_DEFENCE_TURNS });
    expect(setupParty({ mode: 'standard', online: false, players: { p1: { rating: 600, bot: false }, p2: { rating: 900, bot: true } } }, seeded(3)).defence?.p1).toBe(0);
  });
  it('the weaker player\'s mission is shown to everyone and wins at once', () => {
    const rec = partyFen('k7/8/8/8/3P4/8/8/K7 w - - 0 1', { p1: 'MISSION-17', p2: 'MISSION-23' });
    rec.setup.party!.defence = { p1: 0, p2: 1 };
    expect(redactParty(rec.setup.party!, 'p2').missions).toEqual({ p1: 'MISSION-17', p2: 'MISSION-23' });
    expect(redactParty(rec.setup.party!, 'p1').missions).toEqual({ p1: 'MISSION-17', p2: '?' });
    // Runaway pawn is always shown first, even when open: the other player gets one turn to stop it.
    expect(missionWinsAtOnce(rec.setup.party!, 'p1')).toBe(false);
    const g = go(rec, 'd5');
    expect(g.added).toMatchObject([{ stage: 'reveal', turns: 1 }]);
    expect(g.last.result).toBeFalsy();
    const h = go(rec, 'd5 Kb7');
    expect(h.added.map((a) => a.t === 'mission' && a.stage)).toEqual(['reveal', 'win']);
    // Other open missions still win at once.
    rec.setup.party!.missions.p1 = 'MISSION-05';
    expect(missionWinsAtOnce(rec.setup.party!, 'p1')).toBe(true);
  });
});

describe('Skewer can be undone', () => {
  const skewer = (fen: string, defend: string) => {
    let s = fromFEN(fen);
    const m = parseSAN(s, 'Re1+')!;
    expect(missionDone('MISSION-15', { states: [s, play(s, m)], ply: 0, move: m, player: 'p1', movesMade: 20 })).toBe(true);
    s = play(play(s, m), parseSAN(play(s, m), defend)!);
    return missionHolds('MISSION-15', s, 'p1', [m.piece]);
  };
  it('still stands when the king steps aside and the piece behind is loose', () => {
    expect(skewer('4n3/8/8/4k3/8/8/8/R5K1 w - - 0 1', 'Kd5')).toBe(true);
  });
  it('is undone when the piece behind is guarded', () => {
    expect(skewer('4n2r/8/8/4k3/8/8/8/R5K1 w - - 0 1', 'Kd5')).toBe(false);
  });
  it('is undone by blocking the line', () => {
    expect(skewer('4n3/8/2b5/4k3/8/8/8/R5K1 w - - 0 1', 'Be4')).toBe(false);
  });
});

describe('missions and modifiers fit the mode', () => {
  it('Pawn wars never deals a mission or buff for pieces that are not there', () => {
    for (let i = 0; i < 60; i++) {
      const o = { mode: 'pawn-wars', online: false, players: { p1: { rating: 600, bot: false }, p2: { rating: 1200, bot: false } } };
      const m = dealMissions(o, seeded(i + 1));
      for (const id of Object.values(m)) {
        const tags = MISSIONS.find((x) => x.id === id)!.tags ?? [];
        expect(tags.some((t) => ['needsKnights', 'needsBishops', 'needsRooks', 'needsQueen'].includes(t))).toBe(false);
      }
      for (const id of [...pickModifiers(o, seeded(i + 7)).p1, ...pickModifiers(o, seeded(i + 7)).p2]) {
        const tags = MODIFIERS.find((x) => x.id === id)!.tags ?? [];
        expect(tags.some((t) => ['needsKnights', 'needsBishops', 'needsRooks', 'needsQueen', 'needsStandardArmy'].includes(t))).toBe(false);
      }
    }
  });
});

describe('bots defend against missions', () => {
  it('a bot avoids moves that let the weaker player finish their open mission', () => {
    const rec = partyFen('k7/4p3/8/8/3P4/8/8/K7 b - - 0 1', { p1: 'MISSION-17', p2: 'MISSION-23' });
    rec.setup.party!.defence = { p1: 0, p2: 1 };
    const s = initialState(rec);
    const safe = blockingMoves([s], [], rec.setup.party!, 'p2');
    expect(safe.length).toBeGreaterThan(0);
    const e5 = parseSAN(s, 'e5')!;
    expect(safe.some((m) => m.piece === e5.piece && m.to === e5.to)).toBe(false); // e5 lets d5 make a runaway pawn
    expect(defenceMoves([s], [], rec.setup.party!, 'p2')).toEqual(safe);
    // A secret (not open) mission is not blocked: the bot does not know it.
    rec.setup.party!.defence = { p1: 1, p2: 1 };
    expect(blockingMoves([s], [], rec.setup.party!, 'p2')).toEqual([]);
  });
});

describe('bots look two moves ahead for open missions', () => {
  it('finds the plan and the moves that spoil it', () => {
    // White (the weaker player) wants a runaway pawn: d3-d4-d5 is two moves. Black's rook can stand in the way.
    const rec = partyFen('k7/8/8/8/7r/3P4/8/K7 b - - 0 1', { p1: 'MISSION-17', p2: 'MISSION-23' });
    rec.setup.party!.defence = { p1: 0, p2: 1 };
    const s = initialState(rec);
    expect(blockingMoves([s], [], rec.setup.party!, 'p2')).toEqual([]); // nothing to stop this move
    const later = blockingMoves2([s], rec.setup.party!, 'p2');
    expect(later.length).toBeGreaterThan(0);
    expect(later.length).toBeLessThan(legalActions(s).length);
    const has = (san: string) => { const m = parseSAN(s, san)!; return later.some((x) => x.piece === m.piece && x.to === m.to); };
    expect(has('Rd4')).toBe(true); // blocks the pawn
    expect(has('Kb7')).toBe(false); // does nothing about it
    expect(defenceMoves([s], [], rec.setup.party!, 'p2')).toEqual(later);
  });
});

describe('fairness tuning', () => {
  it('the weaker player gets one more buff in the lopsided modes', () => {
    const o = (mode: string) => ({ mode, online: false, players: { p1: { rating: 800, bot: false }, p2: { rating: 1200, bot: true } } });
    for (let i = 0; i < 20; i++) {
      const normal = pickModifiers(o('standard'), seeded(i + 1)).p1.length;
      expect(pickModifiers(o('three-check'), seeded(i + 1)).p1.length).toBe(normal + 1);
    }
  });
});

describe('Party mode groups', () => {
  it('put every Party mode in exactly one group', () => {
    const all = PARTY_MODE_GROUPS.flatMap((g) => g.modes);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...PARTY_MODES].sort());
  });
});
