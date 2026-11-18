import type { SkinChoice, SkinId } from '../content/cosmetics';
import type { GameRecord } from '../core/record';
import type { Action, PlayerId } from '../core/types';
import type { WheelsAsk, ArmyLook, ClientMsg, ClockSetting, ClockState, EmoteId, RoomGame, SeatInfo, ServerMsg } from './protocol';

/**
 * Browser side of online play. Keeps one WebSocket, reconnects with the seat
 * token if the connection drops (phones sleeping, tunnels), and exposes a
 * snapshot for React.
 */

export interface OnlineSnapshot {
  status: 'idle' | 'connecting' | 'open' | 'closed';
  code: string | null;
  seat: PlayerId | null;
  record: GameRecord | null;
  seats: Partial<Record<PlayerId, SeatInfo>>;
  wheelsAsk?: WheelsAsk | null;
  rematchVotes: PlayerId[];
  error: string | null;
  lastEmote: { from: PlayerId; id: EmoteId; at: number } | null;
  clock: ClockState | null;
  seatIds: PlayerId[];
  /** Match score in this room (wins; draws count half). */
  score: Partial<Record<PlayerId, number>>;
  gamesPlayed: number;
  game: RoomGame;
  host: PlayerId | null;
  /** Local time when `clock` arrived, to count down between messages. */
  clockAt: number;
}

const SESSION_KEY = 'chess-chaos:online';

export function roomServerUrl(): string | null {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  if (env?.VITE_ROOM_SERVER) return env.VITE_ROOM_SERVER;
  if (typeof location !== 'undefined' && /^(localhost|127\.|192\.168\.)/.test(location.hostname)) return `ws://${location.hostname}:8787/ws`;
  return null;
}

class OnlineSession {
  snap: OnlineSnapshot = { status: 'idle', code: null, seat: null, record: null, seats: {}, rematchVotes: [], error: null, lastEmote: null, clock: null, clockAt: 0, seatIds: ['p1', 'p2'], game: 'standard', host: null, score: {}, gamesPlayed: 0 };
  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private queue: ClientMsg[] = [];
  private wantOpen = false;
  private retry = 0;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };
  get = () => this.snap;

  private set(patch: Partial<OnlineSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  private connect() {
    const url = roomServerUrl();
    if (!url) { this.set({ status: 'closed', error: 'Online play is not set up on this site yet.' }); return; }
    this.wantOpen = true;
    this.set({ status: 'connecting', error: null });
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.set({ status: 'open' });
      const saved = this.saved();
      const pending = this.queue.splice(0);
      // After a drop, rejoin our seat before anything else.
      if (saved && !pending.some((m) => m.t === 'create' || m.t === 'join')) ws.send(JSON.stringify({ t: 'rejoin', code: saved.code, token: saved.token }));
      pending.forEach((m) => ws.send(JSON.stringify(m)));
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(String(e.data)) as ServerMsg);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.set({ status: 'closed' });
      if (this.wantOpen && this.retry < 8) {
        const delay = Math.min(8000, 500 * 2 ** this.retry++);
        setTimeout(() => this.wantOpen && !this.ws && this.connect(), delay);
      }
    };
  }

  private onMessage(m: ServerMsg) {
    switch (m.t) {
      case 'joined':
        try { localStorage.setItem(SESSION_KEY, JSON.stringify({ code: m.code, token: m.token })); } catch { /* ignore */ }
        this.set({ code: m.code, seat: m.seat, error: null });
        break;
      case 'room':
        this.set({ code: m.code, record: m.record, seats: m.seats, rematchVotes: m.rematchVotes, clock: m.clock ?? null, clockAt: Date.now(), seatIds: m.seatIds ?? ['p1', 'p2'], game: m.game ?? 'standard', host: m.host ?? null, score: m.score ?? {}, gamesPlayed: m.gamesPlayed ?? 0, wheelsAsk: m.wheelsAsk ?? null });
        break;
      case 'emote':
        this.set({ lastEmote: { from: m.from, id: m.id, at: Date.now() } });
        break;
      case 'error':
        if (m.message === 'That game has ended.') this.forget();
        this.set({ error: m.message });
        break;
    }
  }

  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else {
      this.queue.push(m);
      if (!this.ws) this.connect();
    }
  }

  saved(): { code: string; token: string } | null {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'); } catch { return null; }
  }

  forget() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  create(name: string, rating: number, colour: 'p1' | 'p2' | 'random', clock: ClockSetting | null = null, game: RoomGame = 'standard', look?: ArmyLook, wheels = false, hand: string[] = []) {
    this.forget();
    this.set({ record: null, code: null, seat: null, seats: {}, error: null, clock: null });
    this.send({ t: 'create', name, rating, colour, clock, game, look, wheels, hand });
  }

  fillBots() {
    this.send({ t: 'fill-bots' });
  }

  join(code: string, name: string, rating: number, look?: ArmyLook, wheels = false, hand: string[] = []) {
    this.forget();
    this.set({ record: null, code: null, seat: null, seats: {}, error: null });
    this.send({ t: 'join', code: code.toUpperCase(), name, rating, look, wheels, hand });
  }

  resume() {
    if (this.saved()) this.send({ t: 'rejoin', ...this.saved()! });
  }

  /** Training wheels on or off for my seat (before the first move). */
  askWheels() { this.send({ t: 'wheels-ask' }); }
  answerWheels(answer: 'fun' | 'rated' | 'no') { this.send({ t: 'wheels-answer', answer }); }
  wheelsOk() { this.send({ t: 'wheels-ok' }); }
  /** Share my rating after a game ends. */
  shareRating(rating: number) { this.send({ t: 'rating', rating }); }
  act(action: Action) { this.send({ t: 'action', action }); }
  emote(id: EmoteId) { this.send({ t: 'emote', id }); }
  rematch(hand?: string[]) { this.send({ t: 'rematch', hand }); }

  leave() {
    this.send({ t: 'leave' });
    this.forget();
    this.wantOpen = false;
    this.ws?.close();
    this.ws = null;
    this.set({ status: 'idle', code: null, seat: null, record: null, seats: {}, rematchVotes: [], error: null, clock: null });
  }
}

export const online = new OnlineSession();

/**
 * Everyone's army as they dressed it: each seat that sent a look uses it;
 * seats without one fall back to this device's own choices.
 */
export function roomSkins(snap: OnlineSnapshot, mine: SkinChoice): SkinChoice {
  const armies = { ...mine.armies };
  const pieces = { ...mine.pieces };
  for (const [seat, info] of Object.entries(snap.seats)) {
    if (!info?.look) continue;
    armies[seat] = info.look.army as SkinId;
    pieces[seat] = info.look.pieces as Partial<Record<string, SkinId>>;
  }
  return { ...mine, armies, pieces };
}

/** Milliseconds left for a seat right now, counting down locally between server updates. */
export function timeLeft(snap: OnlineSnapshot, seat: PlayerId, now = Date.now()): number | null {
  const c = snap.clock;
  if (!c || c.left[seat] === undefined) return null;
  const base = c.left[seat]!;
  return c.running === seat ? Math.max(0, base - (now - snap.clockAt)) : base;
}
