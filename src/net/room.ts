import { chooseMove } from '../ai/strength';
import { newBattleRecord, newRecord, replay, type GameRecord } from '../core/record';
import { BOTS } from '../content/bots';
import { PARTY_DECK, redactParty, refereeMission, setupParty } from '../systems/party';
import { play } from '../core/rules';
import type { Action, GameState, PlayerId } from '../core/types';
import { cleanHand, cleanLook, cleanName, EMOTES, ROOM_GAMES, type ArmyLook, type ClientMsg, type ClockSetting, type ClockState, type RoomGame, type SeatInfo, type ServerMsg } from './protocol';

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
  /** Power cards for party games. Public once the game starts (setup.party.cards). */
  hand?: string[];
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
  /** Every position so far (the referee needs the history for missions). */
  states: GameState[] = [];
  rematchVotes = new Set<PlayerId>();
  emptySince: number | null = null;
  private lastEmote = new Map<string, number>();
  /** Chess clock (online games). Time left is stored as of `turnStart`. */
  clockSetting: ClockSetting | null = null;
  left: Partial<Record<PlayerId, number>> = {};
  turnStart: number | null = null;

  seatIds: PlayerId[];
  host: PlayerId | null = null;
  /** Match score across rematches, keyed by seat token so it follows players when seats rotate. */
  tally = new Map<string, number>();
  gamesPlayed = 0;
  private counted = false;

  constructor(public code: string, private now: () => number, seed: number, clock: ClockSetting | null = null, public game: RoomGame = 'standard') {
    const n = ROOM_GAMES.find((g) => g.id === game)?.seats ?? 2;
    this.seatIds = (['p1', 'p2', 'p3', 'p4'] as PlayerId[]).slice(0, n);
    this.record = this.freshRecord(seed, {});
    this.state = replay(this.record)[0];
    this.states = [this.state];
    this.setClock(clock);
  }

  /** Party rooms: once everyone is seated, draw the mode and deal modifiers and missions. */
  private maybeStartParty() {
    if (this.game !== 'party' || !this.allSeated() || this.record.setup.party || this.record.actions.length) return;
    const mode = PARTY_DECK[Math.floor(Math.random() * PARTY_DECK.length)];
    const p = (k: PlayerId) => ({ rating: this.seats[k]!.rating, bot: this.seats[k]!.botControlled });
    const party = setupParty({ mode, online: true, players: { p1: p('p1'), p2: p('p2') } }, Math.random);
    const hand = (k: PlayerId) => (this.seats[k]!.botControlled ? [] : this.seats[k]!.hand ?? []);
    party.cards = { p1: hand('p1'), p2: hand('p2') };
    const names = { ...this.record.meta.players };
    this.record = { ...newRecord(this.record.seed, names, undefined, mode), id: this.record.id };
    this.record.setup = { ...this.record.setup, party };
    this.state = replay(this.record)[0];
    this.states = [this.state];
  }

  private freshRecord(seed: number, players: Record<string, string>): GameRecord {
    switch (this.game) {
      case 'battle-3': return newBattleRecord(seed, players, 'three');
      case 'battle-4': return newBattleRecord(seed, players, 'four');
      case 'battle-teams': return newBattleRecord(seed, players, 'teams');
      case 'battle-hill-4': return newBattleRecord(seed, players, 'four', 'battle-hill');
      case 'standard': case 'party': return newRecord(seed, players);
      // Every other 2-player game is a core mode with the same id.
      default: return newRecord(seed, players, undefined, this.game);
    }
  }

  allSeated(): boolean {
    return this.seatIds.every((k) => !!this.seats[k]);
  }

  /** Host fills empty seats with bots so a 3 or 4 player game can start. */
  fillBots() {
    const humans = Object.values(this.seats).filter(Boolean) as Seat[];
    const avg = humans.length ? humans.reduce((a, x) => a + x.rating, 0) / humans.length : 600;
    const pool = [...BOTS].sort((a, b) => Math.abs(a.rating - avg) - Math.abs(b.rating - avg));
    let i = 0;
    for (const k of this.seatIds) {
      if (this.seats[k]) continue;
      const b = pool[i++ % pool.length];
      this.seats[k] = { name: `${b.emoji} ${b.name}`, rating: b.rating, connected: false, botControlled: true, token: token(), conn: null, leftAt: null };
      this.record.meta.players[k] = this.seats[k]!.name;
    }
    this.maybeStartParty();
    this.broadcast();
  }

  private setClock(c: ClockSetting | null) {
    if (c) {
      const minutes = Math.min(60, Math.max(1, Math.round(c.minutes)));
      const increment = Math.min(30, Math.max(0, Math.round(c.increment)));
      this.clockSetting = { minutes, increment };
      this.left = Object.fromEntries(this.seatIds.map((k) => [k, minutes * 60_000]));
    } else {
      this.clockSetting = null;
      this.left = {};
    }
    this.turnStart = null;
  }

  /** Whose clock is ticking: nobody until the first move is made, or once the game ends. */
  private runningSeat(): PlayerId | null {
    if (!this.clockSetting || this.state.result || !this.allSeated()) return null;
    if (this.record.actions.length === 0) return null;
    return this.state.turn;
  }

  clockSnapshot(): ClockState | null {
    if (!this.clockSetting) return null;
    const running = this.runningSeat();
    const left = { ...this.left };
    if (running && this.turnStart !== null) left[running] = Math.max(0, (left[running] ?? 0) - (this.now() - this.turnStart));
    return { left, running, increment: this.clockSetting.increment };
  }

  seatOf(conn: Conn): PlayerId | undefined {
    return (Object.keys(this.seats) as PlayerId[]).find((k) => this.seats[k]?.conn?.id === conn.id);
  }

  addPlayer(conn: Conn, seat: PlayerId, name: string, rating: number, look?: ArmyLook, wheels = false, hand: string[] = []): Seat {
    const s: Seat = { hand: cleanHand(hand), wheels: wheels && this.seatIds.length === 2, look: cleanLook(look), name: cleanName(name), rating: Math.max(100, Math.min(3000, Math.round(rating) || 600)), connected: true, botControlled: false, token: token(), conn, leftAt: null };
    this.seats[seat] = s;
    this.host ??= seat;
    this.maybeStartParty();
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

  /** Called on a timer: flag fallen clocks, hand absent players' seats to a bot, run bot moves. */
  tick() {
    let changed = false;
    const snap = this.clockSnapshot();
    if (snap?.running && (snap.left[snap.running] ?? 1) <= 0) {
      this.apply({ t: 'timeout', by: snap.running });
      changed = true;
    }
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
    if (this.clockSetting && (a.t === 'move' || (a.t === 'buff' && this.state.turn !== play(this.state, a).turn))) {
      const running = this.runningSeat();
      if (running && this.turnStart !== null) {
        this.left[running] = Math.max(0, (this.left[running] ?? 0) - (this.now() - this.turnStart) + this.clockSetting.increment * 1000);
      }
    }
    this.state = play(this.state, a);
    this.record = { ...this.record, actions: [...this.record.actions, a] };
    this.states.push(this.state);
    // Party referee: did that move complete the mover's secret mission?
    const party = this.record.setup.party;
    if (party && !this.state.result) {
      const done = refereeMission(this.states, this.record.actions, party);
      if (done) {
        this.state = play(this.state, done);
        this.record = { ...this.record, actions: [...this.record.actions, done] };
        this.states.push(this.state);
      }
    }
    if (this.state.result) {
      this.record.meta.result = this.state.result;
      this.countResult();
    }
    this.turnStart = this.now();
  }

  handle(conn: Conn, msg: ClientMsg) {
    const seat = this.seatOf(conn);
    if (!seat) return conn.send({ t: 'error', message: 'You are not in this room.' });
    switch (msg.t) {
      case 'action': {
        const a = msg.action;
        if (!this.allSeated()) return conn.send({ t: 'error', message: 'Waiting for everyone to join.' });
        if (a.t === 'resign') {
          if (this.state.result) return;
          this.apply({ t: 'resign', by: seat });
        } else if (a.t === 'move') {
          if (this.state.turn !== seat) return conn.send({ t: 'error', message: 'Not your turn.' });
          // A move that arrives after the flag fell does not count.
          const snap = this.clockSnapshot();
          if (snap?.running === seat && (snap.left[seat] ?? 1) <= 0) {
            this.apply({ t: 'timeout', by: seat });
            this.broadcast();
            return;
          }
          try {
            this.apply(a);
          } catch {
            return conn.send({ t: 'error', message: 'That move is not allowed.' });
          }
        } else if (a.t === 'buff') {
          if (this.state.turn !== seat || a.by !== seat) return conn.send({ t: 'error', message: 'Buffs are used on your own turn.' });
          try {
            this.apply(a);
          } catch (e) {
            return conn.send({ t: 'error', message: `That buff did not work: ${(e as Error).message}` });
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
      case 'wheels': {
        // Only in 1 vs 1 games, and only before the first move, so the other player always knows before they start.
        if (this.seatIds.length !== 2 || this.record.actions.length > 0) return conn.send({ t: 'error', message: 'Training wheels can only change before the first move.' });
        this.seats[seat]!.wheels = !!msg.on;
        this.broadcast();
        return;
      }
      case 'rating': {
        // Only after a game ends, so nobody changes their rating mid-game.
        if (!this.state.result || typeof msg.rating !== 'number') return;
        this.seats[seat]!.rating = Math.max(100, Math.min(3000, Math.round(msg.rating) || 600));
        this.broadcast();
        return;
      }
      case 'rematch': {
        if (!this.state.result) return;
        if (msg.hand) this.seats[seat]!.hand = cleanHand(msg.hand);
        this.rematchVotes.add(seat);
        const humans = (Object.keys(this.seats) as PlayerId[]).filter((k) => !this.seats[k]!.botControlled);
        if (humans.every((k) => this.rematchVotes.has(k))) this.rematch();
        this.broadcast();
        return;
      }
      case 'fill-bots':
        if (seat === this.host && !this.allSeated()) this.fillBots();
        return;
      case 'leave':
        this.disconnect(conn);
        return;
      default:
        return;
    }
  }

  private countResult() {
    if (this.counted || !this.state.result) return;
    this.counted = true;
    this.gamesPlayed++;
    const { winners } = this.state.result;
    for (const k of this.seatIds) {
      const s = this.seats[k];
      if (!s) continue;
      const pts = winners.length ? (winners.includes(k) ? 1 : 0) : 0.5;
      this.tally.set(s.token, (this.tally.get(s.token) ?? 0) + pts);
    }
  }

  scoreboard(): Partial<Record<PlayerId, number>> {
    const out: Partial<Record<PlayerId, number>> = {};
    for (const k of this.seatIds) { const s = this.seats[k]; if (s) out[k] = this.tally.get(s.token) ?? 0; }
    return out;
  }

  /** Everyone moves one seat round (two players swap colours) and play starts again. */
  private rematch() {
    const ids = this.seatIds;
    const rotated: Partial<Record<PlayerId, Seat>> = {};
    ids.forEach((k, i) => { rotated[ids[(i + 1) % ids.length]] = this.seats[k]; });
    this.seats = rotated;
    if (this.host) this.host = ids[(ids.indexOf(this.host) + 1) % ids.length];
    const names = Object.fromEntries(ids.map((k) => [k, this.seats[k]?.name ?? '']));
    this.record = this.freshRecord((Math.random() * 0xffffffff) | 0, names);
    this.state = replay(this.record)[0];
    this.states = [this.state];
    this.counted = false;
    this.setClock(this.clockSetting);
    this.maybeStartParty();
    this.rematchVotes.clear();
    for (const k of ids) {
      const s = this.seats[k];
      s?.conn?.send({ t: 'joined', code: this.code, seat: k, token: s.token });
    }
  }

  broadcast() {
    const seats: Partial<Record<PlayerId, SeatInfo>> = {};
    for (const k of Object.keys(this.seats) as PlayerId[]) {
      const { name, rating, connected, botControlled, look, wheels } = this.seats[k]!;
      seats[k] = { name, rating, connected, botControlled, look, wheels: !!wheels };
    }
    const base = { t: 'room' as const, code: this.code, seats, seatIds: this.seatIds, game: this.game, host: this.host, rematchVotes: [...this.rematchVotes], clock: this.clockSnapshot(), score: this.scoreboard(), gamesPlayed: this.gamesPlayed };
    const party = this.record.setup.party;
    for (const k of this.seatIds) {
      const s = this.seats[k];
      if (!s?.conn) continue;
      // Each player only sees their own secret mission until the game ends.
      const record = party && !this.state.result ? { ...this.record, setup: { ...this.record.setup, party: redactParty(party, k) } } : this.record;
      s.conn.send({ ...base, record });
    }
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
      const game = ROOM_GAMES.some((g) => g.id === msg.game) ? msg.game! : 'standard';
      const room = new Room(this.newCode(), this.now, (Math.random() * 0xffffffff) | 0, msg.clock ?? null, game);
      this.rooms.set(room.code, room);
      this.connRoom.set(conn.id, room);
      const seat: PlayerId = room.seatIds.length > 2 ? 'p1' : msg.colour === 'random' ? (Math.random() < 0.5 ? 'p1' : 'p2') : msg.colour === 'p2' ? 'p2' : 'p1';
      room.addPlayer(conn, seat, msg.name, msg.rating, msg.look, !!msg.wheels, msg.hand);
      return;
    }
    if (msg.t === 'join') {
      const room = this.rooms.get(String(msg.code).toUpperCase().trim());
      if (!room) return conn.send({ t: 'error', message: 'No room with that code. Check the letters?' });
      // Already sitting here (a double tap or a page reload)? Just resend the room.
      const already = room.seatOf(conn);
      if (already) {
        conn.send({ t: 'joined', code: room.code, seat: already, token: room.seats[already]!.token });
        room.broadcast();
        return;
      }
      const free = room.seatIds.find((k) => !room.seats[k]);
      if (!free) return conn.send({ t: 'error', message: 'That room is full.' });
      this.leaveCurrent(conn);
      this.connRoom.set(conn.id, room);
      room.addPlayer(conn, free, msg.name, msg.rating, msg.look, !!msg.wheels, msg.hand);
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
