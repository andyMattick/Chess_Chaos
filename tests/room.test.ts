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

import { relayPath } from '../src/net/chesscomRelay';
describe('chess.com relay', () => {
  it('only forwards documented read-only paths', () => {
    expect(relayPath('/chesscom/player/hikaru')).toBe('/player/hikaru');
    expect(relayPath('/chesscom/player/Hikaru/games/2026/10')).toBe('/player/hikaru/games/2026/10');
    expect(relayPath('/chesscom/puzzle')).toBe('/puzzle');
    expect(relayPath('/chesscom/player/x/../../admin')).toBeNull();
    expect(relayPath('/chesscom/club/abc')).toBeNull();
    expect(relayPath('/other')).toBeNull();
  });
});

describe('3 and 4 player rooms', () => {
  it('seats four, fills empty seats with bots, and bots play', () => {
    let now = 0;
    const server = new RoomServer(() => now);
    const a = client('a'), b = client('b');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 700, colour: 'p1', game: 'battle-4' });
    const code = a.last('joined')!.code;
    server.handle(b.conn, { t: 'join', code, name: 'Ben', rating: 700 });
    expect(b.last('joined')!.seat).toBe('p2');
    const room = a.last('room')!;
    expect(room.seatIds).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(room.host).toBe('p1');
    // Only the host can fill seats.
    server.handle(b.conn, { t: 'fill-bots' });
    expect(a.last('room')!.seats.p3).toBeUndefined();
    server.handle(a.conn, { t: 'fill-bots' });
    expect(a.last('room')!.seats.p3!.botControlled).toBe(true);
    expect(a.last('room')!.seats.p4!.botControlled).toBe(true);
    // Humans move, bots answer on the timer.
    const s0 = replay(a.last('room')!.record).at(-1)!;
    server.handle(a.conn, { t: 'action', action: legalActionsOf(s0)[0] });
    const s1 = replay(a.last('room')!.record).at(-1)!;
    server.handle(b.conn, { t: 'action', action: legalActionsOf(s1)[0] });
    now += 500; server.tick();
    now += 500; server.tick();
    expect(a.last('room')!.record.actions.length).toBe(4);
    expect(replay(a.last('room')!.record).at(-1)!.turn).toBe('p1');
  });

  it('three player rooms have three seats and a big board', () => {
    const server = new RoomServer(() => 0);
    const a = client('a');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 700, colour: 'p2', game: 'battle-3' });
    const r = a.last('room')!;
    expect(r.seatIds.length).toBe(3);
    expect(a.last('joined')!.seat).toBe('p1');
    expect(replay(r.record)[0].board.width).toBe(14);
  });

  it('rematch rotates everyone one seat', () => {
    const server = new RoomServer(() => 0);
    const a = client('a'), b = client('b'), c = client('c');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 700, colour: 'p1', game: 'battle-3' });
    const code = a.last('joined')!.code;
    server.handle(b.conn, { t: 'join', code, name: 'Ben', rating: 700 });
    server.handle(c.conn, { t: 'join', code, name: 'Cat', rating: 700 });
    server.handle(a.conn, { t: 'action', action: { t: 'resign', by: 'p1' } });
    expect(a.last('room')!.record.meta.result).toBeFalsy();
    server.handle(b.conn, { t: 'action', action: { t: 'resign', by: 'p2' } });
    expect(a.last('room')!.record.meta.result).toEqual({ reason: 'last-standing', winners: ['p3'] });
    for (const x of [a, b, c]) server.handle(x.conn, { t: 'rematch' });
    expect(a.last('joined')!.seat).toBe('p2');
    expect(c.last('joined')!.seat).toBe('p1');
  });
});

import { legalActions as legalActionsOf } from '../src/core';

describe('room extras', () => {
  it('a double join from the same connection keeps one seat', () => {
    const server = new RoomServer(() => 0);
    const a = client('a'), b = client('b');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 700, colour: 'p1', game: 'battle-3' });
    const code = a.last('joined')!.code;
    server.handle(b.conn, { t: 'join', code, name: 'Ben', rating: 700 });
    server.handle(b.conn, { t: 'join', code, name: 'Ben', rating: 700 });
    expect(Object.keys(a.last('room')!.seats).length).toBe(2);
  });
  it('keeps a match score that follows players across rematches', () => {
    const server = new RoomServer(() => 0);
    const a = client('a'), b = client('b');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 700, colour: 'p1' });
    server.handle(b.conn, { t: 'join', code: a.last('joined')!.code, name: 'Ben', rating: 700 });
    server.handle(b.conn, { t: 'action', action: { t: 'resign', by: 'p2' } });
    expect(a.last('room')!.score).toEqual({ p1: 1, p2: 0 });
    server.handle(a.conn, { t: 'rematch' }); server.handle(b.conn, { t: 'rematch' });
    // Colours swapped; Ava is now p2 and keeps her point.
    expect(a.last('room')!.score).toEqual({ p1: 0, p2: 1 });
    server.handle(a.conn, { t: 'action', action: { t: 'resign', by: 'p2' } });
    expect(a.last('room')!.score).toEqual({ p1: 1, p2: 1 });
    expect(a.last('room')!.gamesPlayed).toBe(2);
  });
});

describe('online party rooms', () => {
  it('deals a mode, modifiers and missions when both are seated, and hides the other mission', () => {
    const server = new RoomServer(() => 0);
    const a = client('a'), b = client('b');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 400, colour: 'p1', game: 'party' });
    expect(a.last('room')!.record.setup.party).toBeUndefined();
    server.handle(b.conn, { t: 'join', code: a.last('joined')!.code, name: 'Ben', rating: 1000 });
    const pa = a.last('room')!.record.setup.party!;
    const pb = b.last('room')!.record.setup.party!;
    expect(pa.missions.p1).not.toBe('?');
    expect(pa.missions.p2).toBe('?');
    expect(pb.missions.p1).toBe('?');
    expect(pb.missions.p2).not.toBe('?');
    expect(pa.modifiers.p1!.length).toBe(2); // 600-point gap: major + minor buff
    expect(pa.modifiers.p2!.length).toBe(1); // and a major handicap
  });
  it('reveals both missions when the game ends', () => {
    const server = new RoomServer(() => 0);
    const a = client('a'), b = client('b');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 600, colour: 'p1', game: 'party' });
    server.handle(b.conn, { t: 'join', code: a.last('joined')!.code, name: 'Ben', rating: 600 });
    server.handle(b.conn, { t: 'action', action: { t: 'resign', by: 'p2' } });
    const m = a.last('room')!.record.setup.party!.missions;
    expect(m.p1).not.toBe('?');
    expect(m.p2).not.toBe('?');
  });
});

describe('online buffs', () => {
  it('a buff from the wrong player is refused', () => {
    const server = new RoomServer(() => 0);
    const a = client('a'), b = client('b');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 600, colour: 'p1', game: 'party' });
    server.handle(b.conn, { t: 'join', code: a.last('joined')!.code, name: 'Ben', rating: 600 });
    server.handle(b.conn, { t: 'action', action: { t: 'buff', by: 'p2', id: 'BUFF-21' } });
    expect(b.last('error')!.message).toMatch(/own turn/);
  });
});

describe('room modes and training wheels', () => {
  it('runs every 2-player core mode as a room game', () => {
    for (const game of ['three-check', 'capture-race', 'random-piece', 'truce', 'capture-the-flag', 'shuffle'] as const) {
      const server = new RoomServer(() => 0);
      const a = client('a'), b = client('b');
      server.handle(a.conn, { t: 'create', name: 'Ava', rating: 600, colour: 'p1', game });
      server.handle(b.conn, { t: 'join', code: a.last('joined')!.code, name: 'Ben', rating: 700 });
      const room = b.last('room')!;
      expect(room.game).toBe(game);
      expect(replay(room.record)[0].mode).toBe(game);
    }
  });

  it('shows each seat\'s training wheels, changeable only before the first move', () => {
    const server = new RoomServer(() => 0);
    const a = client('a'), b = client('b');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 400, colour: 'p1', wheels: true });
    server.handle(b.conn, { t: 'join', code: a.last('joined')!.code, name: 'Ben', rating: 900 });
    expect(b.last('room')!.seats.p1!.wheels).toBe(true);
    expect(b.last('room')!.seats.p2!.wheels).toBe(false);
    server.handle(b.conn, { t: 'wheels', on: true });
    expect(a.last('room')!.seats.p2!.wheels).toBe(true);
    move(server, a, 'e4');
    server.handle(b.conn, { t: 'wheels', on: false });
    expect(b.last('error')!.message).toMatch(/before the first move/);
    expect(a.last('room')!.seats.p2!.wheels).toBe(true);
  });

  it('ignores training wheels in 3 and 4 player games', () => {
    const server = new RoomServer(() => 0);
    const a = client('a');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 400, colour: 'p1', game: 'battle-3', wheels: true });
    expect(a.last('room')!.seats.p1!.wheels).toBe(false);
  });
});

describe('ratings after a game', () => {
  it('accepts a new rating only after the game ends, and shares it', () => {
    const server = new RoomServer(() => 0);
    const a = client('a'), b = client('b');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 600, colour: 'p1' });
    server.handle(b.conn, { t: 'join', code: a.last('joined')!.code, name: 'Ben', rating: 700 });
    server.handle(a.conn, { t: 'rating', rating: 2500 });
    expect(b.last('room')!.seats.p1!.rating).toBe(600);
    server.handle(a.conn, { t: 'action', action: { t: 'resign', by: 'p1' } });
    expect(b.last('room')!.record.actions.length).toBe(1);
    server.handle(a.conn, { t: 'rating', rating: 588 });
    expect(b.last('room')!.seats.p1!.rating).toBe(588);
  });
});

describe('power cards online', () => {
  it('deals each player\'s hand into a party room and plays a card', () => {
    const server = new RoomServer(() => 0);
    const a = client('a'), b = client('b');
    server.handle(a.conn, { t: 'create', name: 'Ava', rating: 600, colour: 'p1', game: 'party', hand: ['CARD-07', 'CARD-07', 'NOPE', 'CARD-10'] });
    server.handle(b.conn, { t: 'join', code: a.last('joined')!.code, name: 'Ben', rating: 640, hand: ['CARD-20'] });
    const room = a.last('room')!;
    expect(room.record.setup.party!.cards).toEqual({ p1: ['CARD-07', 'CARD-10'], p2: ['CARD-20'] });
    const s = replay(room.record).at(-1)!;
    if (s.mode === 'standard' || s.mode === 'koth' || s.mode === 'three-check' || s.mode === 'truce' || s.mode === 'capture-race' || s.mode === 'hill-wars' || s.mode === 'capture-the-flag') {
      server.handle(a.conn, { t: 'action', action: { t: 'buff', by: 'p1', id: 'CARD-07', piece: s.sq[6] } });
      const after = replay(b.last('room')!.record).at(-1)!;
      expect(after.pieces[s.sq[6]].type).toBe('nightrider');
      expect(after.turn).toBe('p2');
    }
  });
});
