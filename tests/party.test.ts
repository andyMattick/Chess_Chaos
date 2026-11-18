import { newRecord, replay, play, parseSAN, initialState, legalActions } from '../src/core';
import type { Action, GameState } from '../src/core';
import { MISSIONS, MODIFIERS } from '../src/content/party';
import { IMPLEMENTED } from '../src/core/modifiers';
import { dealMissions, drawMode, pickModifiers, refereeMission, setupParty, slotsForGap, redactParty, PARTY_DECK } from '../src/systems/party';
import { missionDone, MISSION_CHECKS } from '../src/systems/missions';
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
  it('MISSION-12 check three times', () => {
    const rec = partyGame({ p1: 'MISSION-12', p2: 'MISSION-23' });
    const r = run(rec, 'e4 f5 Qh5+ g6 Qxg6+ hxg6 Bc4 Rh5 Bf7+');
    expect(r.done).toEqual({ t: 'mission', by: 'p1', id: 'MISSION-12' });
    const end = play(r.states.at(-1)!, r.done!);
    expect(end.result).toEqual({ reason: 'mission', winners: ['p1'] });
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
