import { describe, expect, it } from 'vitest';
import { applySetup, fromFEN, legalActions, parseSAN, play, standardStart, toSAN, parseSquare, IMPLEMENTED, replay, newRecord } from '../src/core';
import type { GameState } from '../src/core';
import { MODIFIERS, BONUS_MISSIONS } from '../src/content/party';
import { bonusDone } from '../src/systems/missions';
import { dealBonus, pickModifiers, redactParty, setupParty } from '../src/systems/party';

const sq = (s: GameState, n: string) => parseSquare(s.board, n);
const at = (s: GameState, n: string) => s.pieces[s.sq[sq(s, n)]];
const party = (s: GameState, mods: Record<string, string[]>, pick = () => 0) => applySetup(s, mods, pick);
const sans = (s: GameState) => legalActions(s).map((m) => toSAN(s, m));
const go = (s: GameState, line: string) => line.split(' ').reduce((x, san) => {
  const m = parseSAN(x, san);
  if (!m) throw new Error(`no ${san}: ${sans(x).join(',')}`);
  return play(x, m);
}, s);
/** Play a line and keep every state (states[i] before action i), for the bonus checks. */
function line(s: GameState, moves: string) {
  const states = [s];
  const actions: { t: string; piece?: number; to?: number }[] = [];
  for (const san of moves.split(' ')) {
    const x = states[states.length - 1];
    const m = parseSAN(x, san);
    if (!m) throw new Error(`no ${san}: ${sans(x).join(',')}`);
    actions.push(m);
    states.push(play(x, m));
  }
  return { states, actions };
}

describe('the last buffs', () => {
  it('BUFF-09 safe king: the first check goes back where it came from, once', () => {
    let s = party(fromFEN('4k2q/8/8/8/8/8/P2PP3/4K3 b - - 0 1'), { p1: ['BUFF-09'] });
    s = go(s, 'Qh4+');
    expect(at(s, 'h8').type).toBe('queen'); // sent back
    expect(s.turn).toBe('p1');
    s = go(s, 'a3 Qh4+');
    expect(at(s, 'h4').type).toBe('queen'); // the second check stays
  });
  it('BUFF-09 safe king: a mating move is undone too', () => {
    // Back-rank mate threat: Ra1-a8 would be mate.
    let s = party(fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'), { p2: ['BUFF-09'] });
    s = go(s, 'Ra8+');
    expect(s.result).toBeNull();
    expect(at(s, 'a1').type).toBe('rook');
  });
  it('BUFF-13 rally: after your next capture, move a second, different piece', () => {
    let s = party(fromFEN('4k3/8/8/3p4/4P3/8/8/R3K3 w - - 0 1'), { p1: ['BUFF-13'] });
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-13' });
    expect(s.turn).toBe('p1'); // free action
    s = go(s, 'exd5');
    expect(s.turn).toBe('p1'); // rally!
    expect(sans(s).some((x) => x.startsWith('d6'))).toBe(false); // not the same piece
    s = go(s, 'Ra7');
    expect(s.turn).toBe('p2');
    s = go(s, 'Kd8');
    expect(s.turn).toBe('p1');
    expect(() => play(s, { t: 'buff', by: 'p1', id: 'BUFF-13' })).toThrow(); // once
  });
  it('BUFF-13 rally waits when the capture gives check', () => {
    let s = party(fromFEN('4k3/8/8/8/8/8/4p3/4RK2 w - - 0 1'), { p1: ['BUFF-13'] });
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-13' });
    s = go(s, 'Rxe2+');
    expect(s.turn).toBe('p2');
    expect((s.modeData?.rallyArmed as string[])).toContain('p1');
  });
  it('BUFF-22 time bank and BUFF-23 peek are free actions, once', () => {
    let s = party(standardStart(), { p1: ['BUFF-22', 'BUFF-23'] });
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-22' });
    s = play(s, { t: 'buff', by: 'p1', id: 'BUFF-23' });
    expect(s.turn).toBe('p1');
    expect(() => play(s, { t: 'buff', by: 'p1', id: 'BUFF-23' })).toThrow();
  });
  it('BUFF-23 peek shows the secret mission in the redacted setup', () => {
    const p = { modifiers: {}, missions: { p1: 'MISSION-05', p2: 'MISSION-06' }, gate: { p1: 10, p2: 10 }, defence: { p1: 1, p2: 1 } };
    expect(redactParty(p, 'p1').missions.p2).toBe('?');
    expect(redactParty(p, 'p1', true).missions.p2).toBe('MISSION-06');
  });
});

describe('the last handicaps', () => {
  it('HCAP-15 sleepy start (White has it): Black moves twice first, no capture or check on the second', () => {
    let s = party(standardStart(), { p1: ['HCAP-15'] });
    expect(s.turn).toBe('p2');
    s = go(s, 'e5');
    expect(s.turn).toBe('p2');
    s = go(s, 'Qh4');
    expect(s.turn).toBe('p1');
    s = go(s, 'e3 Nc6');
    expect(s.turn).toBe('p1');
  });
  it('HCAP-15 sleepy start (Black has it): White moves twice', () => {
    let s = party(fromFEN('4k3/8/8/8/8/8/3q4/R3K3 w - - 0 1'), { p2: ['HCAP-15'] });
    s = go(s, 'Kxd2');
    expect(s.turn).toBe('p1');
    // The second move may not give check.
    expect(sans(s).some((x) => x.includes('+'))).toBe(false);
  });
  it('HCAP-08 blind spot picks a column at the start', () => {
    const s = party(standardStart(), { p1: ['HCAP-08'] }, () => 5);
    expect((s.modeData?.blindFile as Record<string, number>).p1).toBe(5);
  });
  it('every modifier in the catalogue is now playable', () => {
    for (const m of MODIFIERS) expect(IMPLEMENTED.has(m.id), m.id).toBe(true);
    expect(MODIFIERS.length).toBe(48);
  });
  it('clock and mission tags decide who can get Time bank and Peek', () => {
    const players = { p1: { rating: 600, bot: false }, p2: { rating: 1200, bot: false } };
    const seen = (o: object) => { const ids = new Set<string>(); for (let i = 0; i < 400; i++) { let x = i / 400; pickModifiers({ mode: 'standard', players, online: true, ...o }, () => (x = (x * 9301 + 0.49297) % 1)).p1.forEach((d) => ids.add(d)); } return ids; };
    expect(seen({ clock: false }).has('BUFF-22')).toBe(false);
    expect(seen({ clock: true }).has('BUFF-22')).toBe(true);
    expect(seen({ noMissions: true }).has('BUFF-23')).toBe(false);
  });
});

describe('bonus objectives', () => {
  it('about one player in three gets one; none without missions', () => {
    let n = 0, x = 0.1;
    const rand = () => (x = (x * 9301 + 0.49297) % 1);
    const o = { mode: 'standard', players: { p1: { rating: 800, bot: false }, p2: { rating: 800, bot: true } }, online: false };
    for (let i = 0; i < 600; i++) n += Object.keys(dealBonus(o, rand)).length;
    expect(n / 1200).toBeGreaterThan(0.25);
    expect(n / 1200).toBeLessThan(0.42);
    expect(Object.keys(dealBonus({ ...o, noMissions: true }, rand)).length).toBe(0);
    expect(BONUS_MISSIONS.map((b) => b.id)).toEqual(['MISSION-03', 'MISSION-09', 'MISSION-20', 'MISSION-24']);
    // The usual setup still deals the same modifiers and missions first.
    const r1 = setupParty(o, (() => { let y = 0.3; return () => (y = (y * 7 + 0.123) % 1); })());
    expect(r1.missions.p1).toBeDefined();
  });
  it('MISSION-03 queen survives: scholar\'s mate keeps the queen', () => {
    const { states, actions } = line(standardStart(), 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#');
    expect(bonusDone('MISSION-03', states, actions, 'p1')).toBe(true);
    expect(bonusDone('MISSION-03', states, actions, 'p2')).toBe(false);
  });
  it('MISSION-03: no queen at the end, no bonus', () => {
    const { states, actions } = line(fromFEN('7k/8/8/8/8/8/1q6/QK6 w - - 0 1'), 'Qxb2');
    expect(bonusDone('MISSION-03', states, actions, 'p1')).toBe(false); // game not over yet
  });
  it('MISSION-09 little hero mate: smothered mate by a knight', () => {
    const { states, actions } = line(fromFEN('6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1'), 'Nf7#');
    expect(states[states.length - 1].result?.reason).toBe('checkmate');
    expect(bonusDone('MISSION-09', states, actions, 'p1')).toBe(true);
    expect(bonusDone('MISSION-20', states, actions, 'p1')).toBe(false);
  });
  it('MISSION-20 back-row mate: rook on the back row, king stuck behind its pawns', () => {
    const { states, actions } = line(fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'), 'Ra8#');
    expect(bonusDone('MISSION-20', states, actions, 'p1')).toBe(true);
    expect(bonusDone('MISSION-09', states, actions, 'p1')).toBe(false);
  });
  it('MISSION-20 not when the king has a gap in front', () => {
    const { states, actions } = line(fromFEN('6k1/5p1p/6P1/8/8/8/8/R5K1 w - - 0 1'), 'Ra8+');
    expect(bonusDone('MISSION-20', states, actions, 'p1')).toBe(false);
  });
  it('MISSION-24 brave sacrifice: give the queen away, they never win... but they resign', () => {
    const { states, actions } = line(standardStart(), 'e4 Nf6 Qh5 Nxh5');
    const end = play(states[states.length - 1], { t: 'resign', by: 'p2' });
    states.push(end); actions.push({ t: 'resign' });
    expect(bonusDone('MISSION-24', states, actions, 'p1')).toBe(true);
    expect(bonusDone('MISSION-24', states, actions, 'p2')).toBe(false); // Black did not win
  });
  it('MISSION-24: a fair trade is not a sacrifice', () => {
    const { states, actions } = line(standardStart(), 'e4 d5 exd5 Qxd5');
    const end = play(states[states.length - 1], { t: 'resign', by: 'p2' });
    states.push(end); actions.push({ t: 'resign' });
    expect(bonusDone('MISSION-24', states, actions, 'p1')).toBe(false);
  });
});
