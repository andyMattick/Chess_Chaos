import { chooseMove } from '../ai/strength';
import { newRecord, replay, type GameRecord } from '../core/record';
import { play } from '../core/rules';
import type { Action, GameState, PlayerId } from '../core/types';
import { cleanName, EMOTES, type ClientMsg, type SeatInfo, type ServerMsg } from './protocol';

/**
 * Transport-agnostic room server. Adapters (Bun for local dev, Cloudflare
 * Durable Objects for production) feed it connections and messages.
 */

export interface Conn {
  id: string;
  send(msg: ServerMsg): void;
}

interface Seat extends SeatInfo {
  token: string;
  conn: Conn | null;
  leftAt: number | null;
}

const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const SEAT_HOLD_MS = 60_000;
export const ROOM_IDLE_MS = 10 * 60_000;

function token() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export class Room {
  seats: Partial<Record<PlayerId, Seat>> = {};
  record: GameRecord;
  state: GameState;
  rematchVotes = new Set<PlayerId>();
  emptySince: number | null = null;
  private lastEmote = new Map<string, number>();

  constructor(public code: string, private now: () => number, seed: number) {
    this.record = newRecord(seed, {});
    this.state = replay(this.record)[0];
  }

  seatOf(conn: Conn): PlayerId | undefined {
    return (Object.keys(this.seats) as PlayerId[]).find((k) => this.seats[k]?.conn?.id === conn.id);
  }

  addPlayer(conn: Conn, seat: PlayerId, name: string, rating: number): Seat {
    const s: Seat = { name: cleanName(name), rating: Math.max(100, Math.min(3000, Math.round(rating) || 600)), connected: true, botControlled: false, token: token(), conn, leftAt: null };
    this.seats[seat] = s;
    this.record.meta.players[seat] = s.name;
    this.emptySince = null;
    conn.send({ t: 'joined', code: this.code, seat, token: s.token });
    this.broadcast();
    return s;
  }

  rejoin(conn: Conn, tok: string): boolean {
    for (const k of Object.keys(this.seats) as PlayerId[]) {
      const s = this.seats[k]!;
      if (s.token === tok) {
        s.conn = conn;
        s.connected = true;
        s.botControlled = false;
        s.leftAt = null;
        this.emptySince = null;
        conn.send({ t: 'joined', code: this.code, seat: k, token: s.token });
        this.broadcast();
        return true;
      }
    }
    return false;
  }

  disconnect(conn: Conn) {
    const seat = this.seatOf(conn);
    if (!seat) return;
    const s = this.seats[seat]!;
    s.conn = null;
    s.connected = false;
    s.leftAt = this.now();
    if (Object.values(this.seats).every((x) => !x?.connected)) this.emptySince = this.now();
    this.broadcast();
  }

  /** Called on a timer: hand absent players' seats to a bot, run bot moves. */
  tick() {
    let changed = false;
    for (const s of Object.values(this.seats)) {
      if (s && !s.connected && !s.botControlled && s.leftAt !== null && this.now() - s.leftAt >= SEAT_HOLD_MS) {
        s.botControlled = true;
        changed = true;
      }
    }
    if (this.runBot()) changed = true;
    if (changed) this.broadcast();
  }

  private runBot(): boolean {
    const st = this.state;
    if (st.result) return false;
    const seat = this.seats[st.turn];
    if (!seat?.botControlled) return false;
    // The opponent of an absent player still gets a fair game.
    const c = chooseMove(st, { rating: Math.min(1400, seat.rating) });
    if (!c) return false;
    this.apply(c.move);
    return true;
  }

  private apply(a: Action) {
    this.state = play(this.state, a);
    this.record = { ...this.record, actions: [...this.record.actions, a] };
    if (this.state.result) this.record.meta.result = this.state.result;
  }

  handle(conn: Conn, msg: ClientMsg) {
    const seat = this.seatOf(conn);
    if (!seat) return conn.send({ t: 'error', message: 'You are not in this room.' });
    switch (msg.t) {
      case 'action': {
        const a = msg.action;
        if (!this.seats.p1 || !this.seats.p2) return conn.send({ t: 'error', message: 'Waiting for your opponent to join.' });
        if (a.t === 'resign') {
          if (this.state.result) return;
          this.apply({ t: 'resign', by: seat });
        } else if (a.t === 'move') {
          if (this.state.turn !== seat) return conn.send({ t: 'error', message: 'Not your turn.' });
          try {
            this.apply(a);
          } catch {
            return conn.send({ t: 'error', message: 'That move is not allowed.' });
          }
        } else {
          return conn.send({ t: 'error', message: 'Unknown action.' });
        }
        this.rematchVotes.clear();
        this.broadcast();
        return;
      }
      case 'emote': {
        if (!EMOTES.some((e) => e.id === msg.id)) return;
        const last = this.lastEmote.get(seat);
        if (last !== undefined && this.now() - last < 1500) return; // no spamming
        this.lastEmote.set(seat, this.now());
        for (const s of Object.values(this.seats)) s?.conn?.send({ t: 'emote', from: seat, id: msg.id });
        return;
      }
      case 'rematch': {
        if (!this.state.result) return;
        this.rematchVotes.add(seat);
        const humans = (Object.keys(this.seats) as PlayerId[]).filter((k) => !this.seats[k]!.botControlled);
        if (humans.every((k) => this.rematchVotes.has(k))) this.rematch();
        this.broadcast();
        return;
      }
      case 'leave':
        this.disconnect(conn);
        return;
      default:
        return;
    }
  }

  /** Swap colours and start again. */
  private rematch() {
    const { p1, p2 } = this.seats;
    this.seats = { p1: p2, p2: p1 };
    this.record = newRecord((Math.random() * 0xffffffff) | 0, { p1: p2?.name ?? '', p2: p1?.name ?? '' });
    this.state = replay(this.record)[0];
    this.rematchVotes.clear();
    for (const k of ['p1', 'p2'] as PlayerId[]) {
      const s = this.seats[k];
      s?.conn?.send({ t: 'joined', code: this.code, seat: k, token: s.token });
    }
  }

  broadcast() {
    const seats: Partial<Record<PlayerId, SeatInfo>> = {};
    for (const k of Object.keys(this.seats) as PlayerId[]) {
      const { name, rating, connected, botControlled } = this.seats[k]!;
      seats[k] = { name, rating, connected, botControlled };
    }
    // Standard chess has no hidden information. Hidden modes will filter per seat here.
    const msg: ServerMsg = { t: 'room', code: this.code, record: this.record, seats, rematchVotes: [...this.rematchVotes] };
    for (const s of Object.values(this.seats)) s?.conn?.send(msg);
  }
}

export class RoomServer {
  rooms = new Map<string, Room>();
  private connRoom = new Map<string, Room>();

  constructor(private now: () => number = Date.now) {}

  private newCode(): string {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  handle(conn: Conn, msg: ClientMsg) {
    if (msg.t === 'create') {
      this.leaveCurrent(conn);
      const room = new Room(this.newCode(), this.now, (Math.random() * 0xffffffff) | 0);
      this.rooms.set(room.code, room);
      this.connRoom.set(conn.id, room);
      const seat: PlayerId = msg.colour === 'random' ? (Math.random() < 0.5 ? 'p1' : 'p2') : msg.colour === 'p2' ? 'p2' : 'p1';
      room.addPlayer(conn, seat, msg.name, msg.rating);
      return;
    }
    if (msg.t === 'join') {
      const room = this.rooms.get(String(msg.code).toUpperCase().trim());
      if (!room) return conn.send({ t: 'error', message: 'No room with that code. Check the letters?' });
      const free = (['p1', 'p2'] as PlayerId[]).find((k) => !room.seats[k]);
      if (!free) return conn.send({ t: 'error', message: 'That room is full.' });
      this.leaveCurrent(conn);
      this.connRoom.set(conn.id, room);
      room.addPlayer(conn, free, msg.name, msg.rating);
      return;
    }
    if (msg.t === 'rejoin') {
      const room = this.rooms.get(String(msg.code).toUpperCase());
      if (!room || !room.rejoin(conn, msg.token)) return conn.send({ t: 'error', message: 'That game has ended.' });
      this.connRoom.set(conn.id, room);
      return;
    }
    const room = this.connRoom.get(conn.id);
    if (!room) return conn.send({ t: 'error', message: 'Join a room first.' });
    room.handle(conn, msg);
    if (msg.t === 'leave') this.connRoom.delete(conn.id);
  }

  private leaveCurrent(conn: Conn) {
    const room = this.connRoom.get(conn.id);
    if (room) room.disconnect(conn);
    this.connRoom.delete(conn.id);
  }

  close(conn: Conn) {
    this.leaveCurrent(conn);
  }

  /** Run every few seconds: bot takeovers and deleting idle rooms. */
  tick() {
    for (const [code, room] of this.rooms) {
      room.tick();
      if (room.emptySince !== null && this.now() - room.emptySince >= ROOM_IDLE_MS) this.rooms.delete(code);
    }
  }
}

export function parseClientMsg(raw: string): ClientMsg | null {
  try {
    const m = JSON.parse(raw);
    return m && typeof m.t === 'string' ? (m as ClientMsg) : null;
  } catch {
    return null;
  }
}
