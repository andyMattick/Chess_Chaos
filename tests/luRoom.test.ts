import { describe, expect, it } from 'vitest';
import { LURoomServer, LU_ROOM_IDLE_MS, type LUServerMsg } from '../src/net/luRoom';
import { chooseAction } from '../src/levelup/ai';
import { newGame, play, type LUAction, type LUState } from '../src/levelup/rules';

function conn(id: string) {
  const got: LUServerMsg[] = [];
  return { id, got, send: (m: LUServerMsg) => { got.push(m); }, last<T extends LUServerMsg['t']>(t: T) { return [...got].reverse().find((m) => m.t === t) as Extract<LUServerMsg, { t: T }> | undefined; } };
}
const stateOf = (seed: number, actions: LUAction[]): LUState => actions.reduce((s, a) => play(s, a, false), newGame(seed));

describe('live Level-Up rooms', () => {
  it('make a room, join by code, play checked moves in turn', () => {
    let t = 0;
    const sv = new LURoomServer(() => t);
    const a = conn('a'), b = conn('b');
    sv.handle(a, { t: 'lu-create', name: 'Ann', colour: 'p1' });
    const code = a.last('lu-joined')!.code;
    expect(code).toMatch(/^L[A-Z]{3}$/);
    // Moves wait for the second player.
    const s0 = newGame(a.last('lu-room')!.seed);
    const first = chooseAction(s0, 'easy', () => 0.4)!;
    sv.handle(a, { t: 'lu-action', action: first, ply: 0 });
    expect(a.last('lu-error')!.message).toMatch(/Wait/);
    sv.handle(b, { t: 'lu-join', code: code.toLowerCase(), name: 'Bob' });
    expect(b.last('lu-joined')!.seat).toBe('p2');
    expect(b.last('lu-room')!.seats).toEqual({ p1: { name: 'Ann', connected: true }, p2: { name: 'Bob', connected: true } });
    // Out of turn: refused (the room is resent).
    sv.handle(b, { t: 'lu-action', action: first, ply: 0 });
    expect(b.last('lu-room')!.actions).toEqual([]);
    sv.handle(a, { t: 'lu-action', action: first, ply: 0 });
    expect(b.last('lu-room')!.actions).toEqual([first]);
    // A stale ply is ignored; a made-up move is refused.
    sv.handle(a, { t: 'lu-action', action: first, ply: 0 });
    sv.handle(b, { t: 'lu-action', action: { t: 'move', piece: 0, to: 300 }, ply: 1 });
    expect(b.last('lu-error')!.message).toMatch(/not allowed/);
    expect(a.last('lu-room')!.actions.length).toBe(1);
    // Free steps keep the turn: the bot plays both sides here.
    const room = () => a.last('lu-room')!;
    for (let i = 0; i < 10; i++) {
      const s = stateOf(room().seed, room().actions);
      const act = chooseAction(s, 'easy', () => 0.5)!;
      const who = (s.choose.length ? s.pieces[s.choose[0]].owner : s.turn) === 'p1' ? a : b;
      sv.handle(who, { t: 'lu-action', action: act, ply: room().actions.length });
    }
    expect(room().actions.length).toBe(11);
  });

  it('a drop keeps the seat (rejoin by token); leaving gives up; rematch swaps colours; empty rooms close', () => {
    let t = 0;
    const sv = new LURoomServer(() => t);
    const a = conn('a'), b = conn('b');
    sv.handle(a, { t: 'lu-create', name: 'Ann', colour: 'p1' });
    const { code, token } = a.last('lu-joined')!;
    sv.handle(b, { t: 'lu-join', code, name: 'Bob' });
    const s0 = newGame(a.last('lu-room')!.seed);
    sv.handle(a, { t: 'lu-action', action: chooseAction(s0, 'easy', () => 0.4)!, ply: 0 });
    sv.close(a);
    expect(b.last('lu-room')!.seats.p1).toEqual({ name: 'Ann', connected: false });
    const a2 = conn('a2');
    sv.handle(a2, { t: 'lu-rejoin', code, token });
    expect(a2.last('lu-joined')!.seat).toBe('p1');
    expect(a2.last('lu-room')!.actions.length).toBe(1);
    // Bob leaves for good: he gives up and Ann wins.
    sv.handle(b, { t: 'lu-leave' });
    const r = a2.last('lu-room')!;
    expect(r.actions.at(-1)).toEqual({ t: 'resign', by: 'p2' });
    expect(r.score).toEqual({ p1: 1 });
    // A new friend joins the free seat; rematch needs both; colours swap.
    const c = conn('c');
    sv.handle(c, { t: 'lu-join', code, name: 'Cal' });
    sv.handle(a2, { t: 'lu-rematch' });
    expect(a2.last('lu-room')!.rematch).toEqual(['p1']);
    sv.handle(c, { t: 'lu-rematch' });
    expect(a2.last('lu-joined')!.seat).toBe('p2');
    expect(c.last('lu-joined')!.seat).toBe('p1');
    expect(c.last('lu-room')!.actions).toEqual([]);
    expect(c.last('lu-room')!.score).toEqual({ p1: 0, p2: 1 });
    // Everyone gone: the room closes after the idle time.
    sv.close(a2); sv.close(c);
    t += LU_ROOM_IDLE_MS + 1;
    sv.tick();
    expect(sv.rooms.has(code)).toBe(false);
  });
});
