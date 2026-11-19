import { actor, newGame, play, type LUAction, type LUState, type Side } from '../levelup/rules';
import { cleanName, EMOTES, type EmoteId } from './protocol';

/**
 * Live Level-Up Chess rooms (owner, 2026-11-19): two people, a 4-letter code,
 * moves as they happen. The server keeps the game in memory, checks every
 * action with the Level-Up rules and sends both players the seed and the
 * action list (each phone works out its own fog of war, as in challenges).
 * Names are nicknames only, cleaned; no chat, only the fixed emotes.
 */
export type LUClientMsg =
  | { t: 'lu-create'; name: string; colour: 'p1' | 'p2' | 'random' }
  | { t: 'lu-join'; code: string; name: string }
  | { t: 'lu-rejoin'; code: string; token: string }
  | { t: 'lu-action'; action: LUAction; ply: number }
  | { t: 'lu-emote'; id: EmoteId }
  | { t: 'lu-rematch' }
  | { t: 'lu-leave' };

export interface LURoomSeat { name: string; connected: boolean }
export type LUServerMsg =
  | { t: 'lu-joined'; code: string; seat: Side; token: string }
  | { t: 'lu-room'; code: string; seed: number; actions: LUAction[]; seats: Partial<Record<Side, LURoomSeat>>; rematch: Side[]; score: Partial<Record<Side, number>>; games: number }
  | { t: 'lu-emote'; from: Side; id: EmoteId }
  | { t: 'lu-error'; message: string };

export interface LUConn { id: string; send(msg: LUServerMsg): void }

/** A room with nobody in it goes after this long. */
export const LU_ROOM_IDLE_MS = 10 * 60 * 1000;
const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';

interface SeatState { conn: LUConn | null; name: string; token: string }

class LURoom {
  seed = (Math.random() * 0xffffffff) | 0;
  state: LUState;
  actions: LUAction[] = [];
  seats: Partial<Record<Side, SeatState>> = {};
  rematch: Side[] = [];
  score: Partial<Record<Side, number>> = {};
  games = 0;
  emptySince: number | null = null;
  constructor(public code: string) {
    this.state = newGame(this.seed);
  }
  seatOf(conn: LUConn): Side | null {
    return (['p1', 'p2'] as Side[]).find((k) => this.seats[k]?.conn?.id === conn.id) ?? null;
  }
  send(seat: Side, msg: LUServerMsg) { this.seats[seat]?.conn?.send(msg); }
  broadcast() {
    const seats = Object.fromEntries((['p1', 'p2'] as Side[]).filter((k) => this.seats[k]).map((k) => [k, { name: this.seats[k]!.name, connected: !!this.seats[k]!.conn }]));
    const msg: LUServerMsg = { t: 'lu-room', code: this.code, seed: this.seed, actions: this.actions, seats, rematch: this.rematch, score: this.score, games: this.games };
    for (const k of ['p1', 'p2'] as Side[]) this.send(k, msg);
  }
  /** Count a finished game in the room's score. */
  scoreIfOver() {
    const r = this.state.result;
    if (!r) return;
    this.games++;
    if (r.winner) this.score[r.winner] = (this.score[r.winner] ?? 0) + 1;
    else for (const k of ['p1', 'p2'] as Side[]) this.score[k] = (this.score[k] ?? 0) + 0.5;
  }
  newGame() {
    // Swap colours each game.
    const a = this.seats.p1, b = this.seats.p2;
    this.seats = { p1: b, p2: a };
    for (const k of ['p1', 'p2'] as Side[]) if (this.seats[k]?.conn) this.send(k, { t: 'lu-joined', code: this.code, seat: k, token: this.seats[k]!.token });
    const sc = this.score;
    this.score = { p1: sc.p2 ?? 0, p2: sc.p1 ?? 0 };
    this.seed = (Math.random() * 0xffffffff) | 0;
    this.state = newGame(this.seed);
    this.actions = [];
    this.rematch = [];
  }
}

const token = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export class LURoomServer {
  rooms = new Map<string, LURoom>();
  private connRoom = new Map<string, LURoom>();
  constructor(private now: () => number = Date.now) {}

  private newCode(): string {
    for (;;) {
      // "L" first so a Level-Up code never looks like a chess room code.
      let c = 'L';
      for (let i = 0; i < 3; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  handle(conn: LUConn, msg: LUClientMsg) {
    if (msg.t === 'lu-create') {
      this.leave(conn);
      const room = new LURoom(this.newCode());
      const seat: Side = msg.colour === 'p2' ? 'p2' : msg.colour === 'p1' ? 'p1' : Math.random() < 0.5 ? 'p1' : 'p2';
      room.seats[seat] = { conn, name: cleanName(msg.name), token: token() };
      this.rooms.set(room.code, room);
      this.connRoom.set(conn.id, room);
      conn.send({ t: 'lu-joined', code: room.code, seat, token: room.seats[seat]!.token });
      room.broadcast();
      return;
    }
    if (msg.t === 'lu-join') {
      const room = this.rooms.get(String(msg.code).toUpperCase().trim());
      if (!room) return conn.send({ t: 'lu-error', message: 'No Level-Up room with that code. Check the letters?' });
      const already = room.seatOf(conn);
      if (already) { conn.send({ t: 'lu-joined', code: room.code, seat: already, token: room.seats[already]!.token }); room.broadcast(); return; }
      const free = (['p1', 'p2'] as Side[]).find((k) => !room.seats[k]);
      if (!free) return conn.send({ t: 'lu-error', message: 'That room is full.' });
      this.leave(conn);
      room.seats[free] = { conn, name: cleanName(msg.name), token: token() };
      room.emptySince = null;
      this.connRoom.set(conn.id, room);
      conn.send({ t: 'lu-joined', code: room.code, seat: free, token: room.seats[free]!.token });
      room.broadcast();
      return;
    }
    if (msg.t === 'lu-rejoin') {
      const room = this.rooms.get(String(msg.code).toUpperCase());
      const seat = room && (['p1', 'p2'] as Side[]).find((k) => room.seats[k]?.token === msg.token);
      if (!room || !seat) return conn.send({ t: 'lu-error', message: 'That game has ended.' });
      room.seats[seat]!.conn = conn;
      room.emptySince = null;
      this.connRoom.set(conn.id, room);
      conn.send({ t: 'lu-joined', code: room.code, seat, token: msg.token });
      room.broadcast();
      return;
    }
    const room = this.connRoom.get(conn.id);
    if (!room) return conn.send({ t: 'lu-error', message: 'Join a room first.' });
    const seat = room.seatOf(conn);
    if (!seat) return;
    switch (msg.t) {
      case 'lu-action': {
        if (!room.seats.p1 || !room.seats.p2) return conn.send({ t: 'lu-error', message: 'Wait for the other player to join.' });
        if (room.state.result) return;
        // The ply number guards against a move sent twice: the client resyncs from the room.
        if (msg.ply !== room.actions.length) { room.broadcast(); return; }
        const a = msg.action;
        if (!a || typeof a !== 'object') return;
        if (a.t === 'resign' ? a.by !== seat : actor(room.state) !== seat) { room.broadcast(); return; }
        try { room.state = play(room.state, a); } catch { conn.send({ t: 'lu-error', message: 'That move is not allowed.' }); room.broadcast(); return; }
        room.actions.push(a);
        room.scoreIfOver();
        room.broadcast();
        return;
      }
      case 'lu-emote':
        if (!EMOTES.some((e) => e.id === msg.id)) return;
        for (const k of ['p1', 'p2'] as Side[]) room.send(k, { t: 'lu-emote', from: seat, id: msg.id });
        return;
      case 'lu-rematch':
        if (!room.state.result) return;
        if (!room.rematch.includes(seat)) room.rematch.push(seat);
        if (room.rematch.length === 2) room.newGame();
        room.broadcast();
        return;
      case 'lu-leave':
        this.leave(conn, true);
        return;
    }
  }

  /** A player left or dropped. `forGood`: give up a game in progress and free the seat. */
  private leave(conn: LUConn, forGood = false) {
    const room = this.connRoom.get(conn.id);
    if (!room) return;
    this.connRoom.delete(conn.id);
    const seat = room.seatOf(conn);
    if (!seat) return;
    if (forGood) {
      if (!room.state.result && room.seats.p1 && room.seats.p2 && room.actions.length) {
        const a: LUAction = { t: 'resign', by: seat };
        room.state = play(room.state, a);
        room.actions.push(a);
        room.scoreIfOver();
      }
      delete room.seats[seat];
    } else room.seats[seat]!.conn = null;
    if (!(['p1', 'p2'] as Side[]).some((k) => room.seats[k]?.conn)) room.emptySince = this.now();
    room.broadcast();
  }

  close(conn: LUConn) { this.leave(conn); }

  tick() {
    for (const [code, room] of this.rooms) if (room.emptySince !== null && this.now() - room.emptySince >= LU_ROOM_IDLE_MS) this.rooms.delete(code);
  }
}
