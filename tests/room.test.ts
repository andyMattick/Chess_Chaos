import { RoomServer, type Conn } from '../src/net/room';
import type { ServerMsg } from '../src/net/protocol';
import { parseSAN, replay } from '../src/core';

function client(id: string) {
  const inbox: ServerMsg[] = [];
  const conn: Conn = { id, send: (m) => inbox.push(JSON.parse(JSON.stringify(m))) };
  const last = <T extends ServerMsg['t']>(t: T) => [...inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  return { conn, inbox, last };
}

function setup(clock: { minutes: number; increment: number } | null = null) {
  let now = 0;
  const server = new RoomServer(() => now);
  const a = client('a'), b = client('b');
  server.handle(a.conn, { t: 'create', name: 'Ava', rating: 600, colour: 'p1', clock });
  const code = a.last('joined')!.code;
  server.handle(b.conn, { t: 'join', code, name: 'Ben', rating: 700 });
  return { server, a, b, code, advance: (ms: number) => { now += ms; } };
}

function move(server: RoomServer, c: ReturnType<typeof client>, san: string) {
  const room = c.last('room')!;
  const s = replay(room.record).at(-1)!;
  const m = parseSAN(s, san)!;
  server.handle(c.conn, { t: 'action', action: m });
}

describe('room server', () => {
  it('creates a room with a 4-letter code and seats both players', () => {
    const { a, b, code } = setup();
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect(a.last('joined')!.seat).toBe('p1');
    expect(b.last('joined')!.seat).toBe('p2');
    expect(b.last('room')!.seats.p1!.name).toBe('Ava');
  });

  it('relays legal moves to both players', () => {
    const { server, a, b } = setup();
    move(server, a, 'e4');
    move(server, b, 'e5');
    expect(a.last('room')!.record.actions.length).toBe(2);
    expect(b.last('room')!.record.actions.length).toBe(2);
  });

  it('rejects out-of-turn and illegal moves', () => {
    const { server, a, b } = setup();
    move(server, a, 'e4');
    const s = replay(a.last('room')!.record).at(-1)!;
    server.handle(a.conn, { t: 'action', action: { t: 'move', piece: s.sq[11], to: 27 } });
    expect(a.last('error')!.message).toMatch(/turn/);
    server.handle(b.conn, { t: 'action', action: { t: 'move', piece: s.sq[52], to: 28 } });
    expect(b.last('error')!.message).toMatch(/not allowed/);
    expect(a.last('room')!.record.actions.length).toBe(1);
  });

  it('rejects a full room and unknown codes', () => {
    const { server, code } = setup();
    const c = client('c');
    server.handle(c.conn, { t: 'join', code, name: 'Cal', rating: 600 });
    expect(c.last('error')!.message).toMatch(/full/);
    server.handle(c.conn, { t: 'join', code: 'ZZZZ', name: 'Cal', rating: 600 });
    expect(c.last('error')!.message).toMatch(/No room/);
  });

  it('cleans nicknames', () => {
    const { server } = setup();
    const c = client('c');
    server.handle(c.conn, { t: 'create', name: '<b>shitlord</b>', rating: 600, colour: 'p1' });
    expect(c.last('room')!.seats.p1!.name).toBe('Player');
  });

  it('holds a seat, then hands it to a bot, and lets the player rejoin', () => {
    const { server, a, b, code, advance } = setup();
    const tokenB = b.last('joined')!.token;
    move(server, a, 'e4');
    server.close(b.conn);
    advance(30_000); server.tick();
    expect(a.last('room')!.seats.p2!.botControlled).toBe(false);
    advance(31_000); server.tick();
    expect(a.last('room')!.seats.p2!.botControlled).toBe(true);
    expect(a.last('room')!.record.actions.length).toBe(2); // bot replied
    const b2 = client('b2');
    server.handle(b2.conn, { t: 'rejoin', code, token: tokenB });
    expect(b2.last('joined')!.seat).toBe('p2');
    expect(b2.last('room')!.seats.p2!.botControlled).toBe(false);
  });

  it('resign ends the game and a double rematch swaps colours', () => {
    const { server, a, b } = setup();
    server.handle(a.conn, { t: 'action', action: { t: 'resign', by: 'p1' } });
    expect(b.last('room')!.record.meta.result).toEqual({ reason: 'resign', winners: ['p2'] });
    server.handle(a.conn, { t: 'rematch' });
    expect(b.last('room')!.rematchVotes).toEqual(['p1']);
    server.handle(b.conn, { t: 'rematch' });
    expect(a.last('joined')!.seat).toBe('p2');
    expect(b.last('joined')!.seat).toBe('p1');
    expect(a.last('room')!.record.actions.length).toBe(0);
  });

  it('rate-limits emotes', () => {
    const { server, a, b, advance } = setup();
    server.handle(a.conn, { t: 'emote', id: 'nice' });
    server.handle(a.conn, { t: 'emote', id: 'nice' });
    expect(b.inbox.filter((m) => m.t === 'emote').length).toBe(1);
    advance(2000);
    server.handle(a.conn, { t: 'emote', id: 'gg' });
    expect(b.inbox.filter((m) => m.t === 'emote').length).toBe(2);
  });

  it('deletes rooms that stay empty', () => {
    const { server, a, b, code, advance } = setup();
    server.close(a.conn); server.close(b.conn);
    advance(11 * 60_000); server.tick();
    expect(server.rooms.has(code)).toBe(false);
  });

  it('runs a chess clock with increment and flags a player who runs out', () => {
    const { server, a, b, advance } = setup({ minutes: 1, increment: 2 });
    expect(a.last('room')!.clock!.running).toBeNull(); // waits for the first move
    move(server, a, 'e4');
    expect(a.last('room')!.clock!.running).toBe('p2');
    advance(10_000);
    move(server, b, 'e5');
    const c = a.last('room')!.clock!;
    expect(c.left.p2).toBe(52_000); // 60s - 10s + 2s
    expect(c.running).toBe('p1');
    advance(61_000);
    server.tick();
    expect(b.last('room')!.record.meta.result).toEqual({ reason: 'time', winners: ['p2'] });
  });

  it('ignores a move that arrives after the flag fell', () => {
    const { server, a, b, advance } = setup({ minutes: 1, increment: 0 });
    move(server, a, 'e4');
    advance(70_000);
    move(server, b, 'e5');
    expect(a.last('room')!.record.meta.result?.reason).toBe('time');
    expect(a.last('room')!.record.actions.at(-1)).toEqual({ t: 'timeout', by: 'p2' });
  });

  it('games without a clock have none', () => {
    const { a } = setup();
    expect(a.last('room')!.clock).toBeNull();
  });
});
