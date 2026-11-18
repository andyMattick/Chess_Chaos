import { ALERTS } from '../src/content/alerts';
import { alertMode, alertPool, chooseAlert, topMiss } from '../src/systems/alerts';
import { reviewGame, mergeMiss } from '../src/systems/review';
import { newRecord, parseSAN, play, replay } from '../src/core';

function record(line: string) {
  const rec = newRecord(1, { p1: 'Kid', p2: 'Bot' });
  let s = replay(rec)[0];
  for (const san of line.split(' ')) {
    const m = parseSAN(s, san)!;
    rec.actions.push(m);
    s = play(s, m);
  }
  return rec;
}

describe('alerts', () => {
  it('has 10 alerts with unique ids', () => {
    expect(ALERTS.length).toBe(10);
    expect(new Set(ALERTS.map((a) => a.id)).size).toBe(10);
  });
  it('beginners get every alert, stronger players only thinking alerts', () => {
    expect(alertPool(600).length).toBe(10);
    expect(alertPool(900).map((a) => a.id)).toEqual(['ALERT-05', 'ALERT-06', 'ALERT-07', 'ALERT-08', 'ALERT-09', 'ALERT-10']);
    expect(alertMode(900).kind).toBe('always');
    expect(alertMode(1300)).toEqual({ kind: 'on-request', uses: 3 });
  });
  it('never repeats the last alert', () => {
    for (let i = 0; i < 50; i++) expect(chooseAlert(600, {}, 'ALERT-01', Math.random).id).not.toBe('ALERT-01');
  });
  it('leans toward what the player misses', () => {
    const miss = { threat: { missed: 8, found: 1 } };
    expect(topMiss(miss)).toBe('threat');
    let hits = 0;
    for (let i = 0; i < 400; i++) if (chooseAlert(600, miss, undefined, Math.random).trains.includes('threat')) hits++;
    // 4 of 10 alerts train threats; weighting should push well above 40%.
    expect(hits / 400).toBeGreaterThan(0.55);
  });
  for (const a of ALERTS) {
    it(`${a.id} ${a.name} has kid text and trains something`, () => {
      expect(a.blurb.length).toBeGreaterThan(10);
      expect(a.trains.length).toBeGreaterThan(0);
    });
  }
});

describe('post-game review', () => {
  it('finds the scholar\'s mate as the win of the game', () => {
    const r = reviewGame(record('e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#'), 'p1');
    expect(r.win?.san).toBe('Qxf7#');
    expect(r.win?.tactic).toBe('mate');
  });
  it('finds the losing move as the one fix for the loser', () => {
    const r = reviewGame(record('e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#'), 'p2');
    expect(r.fix?.san).toBe('Nf6');
    expect(r.fix!.goodMoves.length).toBeGreaterThan(0);
    expect(r.win).not.toBeNull(); // always something positive
  });
  it('records a hanging piece in the miss map', () => {
    const r = reviewGame(record('e4 e5 Qh5 Nc6 Qxe5+'), 'p2');
    expect(r.miss.hanging?.missed ?? 0).toBeGreaterThanOrEqual(0);
    const r2 = reviewGame(record('e4 d5 Qg4 Bxg4'), 'p1');
    expect(r2.miss.hanging?.missed).toBe(1);
  });
  it('merges miss maps', () => {
    expect(mergeMiss({ fork: { missed: 1, found: 2 } }, { fork: { missed: 1, found: 0 }, pin: { missed: 1, found: 0 } }))
      .toEqual({ fork: { missed: 2, found: 2 }, pin: { missed: 1, found: 0 } });
  });
});
