import { useSyncExternalStore } from 'react';
import type { LUAction, Side } from '../levelup/rules';
import { roomServerUrl } from './client';
import type { EmoteId } from './protocol';
import type { LUClientMsg, LURoomSeat, LUServerMsg } from './luRoom';

/**
 * Browser side of live Level-Up rooms. One WebSocket; if it drops (a phone
 * sleeping), it reconnects and takes the same seat back with its token.
 */
export interface LUSnapshot {
  status: 'idle' | 'connecting' | 'open' | 'closed';
  code: string | null;
  seat: Side | null;
  seed: number | null;
  actions: LUAction[];
  seats: Partial<Record<Side, LURoomSeat>>;
  rematch: Side[];
  score: Partial<Record<Side, number>>;
  games: number;
  error: string | null;
  emote: { from: Side; id: EmoteId; at: number } | null;
}

const KEY = 'chess-chaos:lu-room';
const EMPTY: LUSnapshot = { status: 'idle', code: null, seat: null, seed: null, actions: [], seats: {}, rematch: [], score: {}, games: 0, error: null, emote: null };

class LUSession {
  snap: LUSnapshot = EMPTY;
  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private queue: LUClientMsg[] = [];
  private wantOpen = false;
  private retry = 0;

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  get = () => this.snap;
  private set(patch: Partial<LUSnapshot>) { this.snap = { ...this.snap, ...patch }; this.listeners.forEach((l) => l()); }

  private saved(): { code: string; token: string } | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
  }
  /** The live room this device is in (kept when you step away or close the app). */
  savedCode(): string | null { return this.saved()?.code ?? null; }

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
      // After a drop, take our seat back before anything else.
      if (saved && !pending.some((m) => m.t === 'lu-create' || m.t === 'lu-join')) ws.send(JSON.stringify({ t: 'lu-rejoin', ...saved }));
      for (const m of pending) ws.send(JSON.stringify(m));
    };
    ws.onmessage = (e) => {
      let m: LUServerMsg;
      try { m = JSON.parse(String(e.data)); } catch { return; }
      if (!m || typeof m.t !== 'string' || !m.t.startsWith('lu-')) return;
      if (m.t === 'lu-joined') {
        try { localStorage.setItem(KEY, JSON.stringify({ code: m.code, token: m.token })); } catch { /* private mode */ }
        this.set({ code: m.code, seat: m.seat, error: null });
      } else if (m.t === 'lu-room') this.set({ code: m.code, seed: m.seed, actions: m.actions, seats: m.seats, rematch: m.rematch, score: m.score, games: m.games });
      else if (m.t === 'lu-emote') this.set({ emote: { from: m.from, id: m.id, at: Date.now() } });
      else if (m.t === 'lu-error') {
        if (m.message === 'That game has ended.') { try { localStorage.removeItem(KEY); } catch { /* */ } this.set({ ...EMPTY, status: this.snap.status, error: m.message }); }
        else this.set({ error: m.message });
      }
    };
    ws.onclose = () => {
      this.ws = null;
      if (!this.wantOpen) { this.set({ status: 'closed' }); return; }
      this.set({ status: 'connecting' });
      const wait = Math.min(8000, 500 * 2 ** this.retry++);
      setTimeout(() => { if (this.wantOpen) this.connect(); }, wait);
    };
  }

  send(m: LUClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else { this.queue.push(m); if (!this.ws) this.connect(); }
  }
  create(name: string, colour: 'p1' | 'p2' | 'random') { this.set({ ...EMPTY, status: this.snap.status }); this.send({ t: 'lu-create', name, colour }); }
  join(code: string, name: string) { this.set({ ...EMPTY, status: this.snap.status }); this.send({ t: 'lu-join', code, name }); }
  act(action: LUAction, ply: number) { this.send({ t: 'lu-action', action, ply }); }
  emote(id: EmoteId) { this.send({ t: 'lu-emote', id }); }
  rematchVote() { this.send({ t: 'lu-rematch' }); }
  /** Rejoin a room this tab was in (after a reload). */
  resume(): boolean {
    const saved = this.saved();
    if (!saved) return false;
    if (!this.ws) this.connect();
    else if (this.ws.readyState === WebSocket.OPEN && this.snap.code !== saved.code) this.ws.send(JSON.stringify({ t: 'lu-rejoin', ...saved }));
    return true;
  }
  leave() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'lu-leave' }));
    try { localStorage.removeItem(KEY); } catch { /* */ }
    this.wantOpen = false;
    this.ws?.close();
    this.ws = null;
    this.queue = [];
    this.set({ ...EMPTY, status: 'closed' });
  }
}

export const luSession = new LUSession();
export function useLuRoom(): LUSnapshot {
  return useSyncExternalStore(luSession.subscribe, luSession.get, luSession.get);
}
