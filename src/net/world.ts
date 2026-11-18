/**
 * World features by player number (owner, 2026-11-18): a world leaderboard
 * and challenges (games played a move at a time). Shared by the Cloudflare
 * worker, the local dev server and the tests, so Web APIs and core only.
 *
 * Kid safety: no names and no messages on the server. The leaderboard shows
 * other players' numbers masked ("••••5678"), so strangers cannot challenge
 * someone they saw there; a challenge needs the full number, which a player
 * only gets from a friend. Every write needs that number's save key.
 */
import { replay, play, newRecord } from '../core';
import type { Action, GameRecord, PlayerId } from '../core';
import { ROOM_GAMES, type RoomGame } from './protocol';
import { isNumber, vaultResponse } from './vault';

export const WORLD_PREFIX = '/world';
/** Board entries not updated for this long drop off. */
export const BOARD_STALE_MS = 90 * 24 * 3600 * 1000;
export const BOARD_TOP = 50;
/** A challenge nobody answered, or a game where the player to move went quiet, ends after this. */
export const MAIL_TIMEOUT_MS = 14 * 24 * 3600 * 1000;
/** Open (invited or playing) games per player. */
export const MAX_OPEN_GAMES = 12;

/** 1 vs 1 modes that work a move at a time (no hidden information or pre-game setup). */
export const MAIL_GAMES: RoomGame[] = ROOM_GAMES.filter((g) => g.seats === 2 && !['party', 'draft', 'hidden-queen', 'boss'].includes(g.id)).map((g) => g.id);

export interface WorldStore {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<Map<string, string>>;
}

/** A leaderboard entry: rating, games, and the player's overall wins, losses and draws. */
export interface BoardEntry { r: number; g: number; w?: number; l?: number; d?: number; at: number }
export interface BoardRow { rank: number; n: string; r: number; g: number; w: number; l: number; d: number; me: boolean }
export interface MailGame {
  id: string;
  /** Player numbers: p1 is White. */
  players: { p1: string; p2: string };
  /** Ratings when the game began (for the rating change at the end). */
  ratings: { p1: number; p2: number };
  game: RoomGame;
  status: 'invited' | 'playing' | 'done' | 'declined' | 'expired';
  from: string;
  record: GameRecord;
  createdAt: number;
  updatedAt: number;
}

export function maskNumber(n: string): string {
  return `••••${n.slice(4)}`;
}

export function memoryWorld(): WorldStore {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k),
    put: async (k, v) => { m.set(k, v); },
    delete: async (k) => { m.delete(k); },
    list: async (prefix) => new Map([...m].filter(([k]) => k.startsWith(prefix))),
  };
}

const json = (x: unknown, status = 200) => vaultResponse(JSON.stringify(x), status);
const bad = (error: string, status = 400) => json({ error }, status);

function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** What a player sees of a game: ids are numbers (theirs shown in full, the other one too: they share it). */
function view(g: MailGame) {
  return g;
}

/**
 * Handle /world/... . `who` is the player number already checked against its
 * save key (null when the request had none); `exists(n)` says whether a
 * player number is real.
 */
export async function handleWorld(req: Request, store: WorldStore, who: string | null, exists: (n: string) => Promise<boolean>, now = Date.now()): Promise<Response> {
  if (req.method === 'OPTIONS') return vaultResponse(null, 204);
  const url = new URL(req.url);
  const parts = url.pathname.slice(WORLD_PREFIX.length).split('/').filter(Boolean);

  // ---- Leaderboard -------------------------------------------------------
  if (parts[0] === 'board') {
    if (req.method === 'GET') {
      const all = await store.list('b:');
      const rows: (BoardEntry & { n: string })[] = [];
      for (const [k, v] of all) {
        const e = JSON.parse(v) as BoardEntry;
        if (now - e.at > BOARD_STALE_MS) { await store.delete(k); continue; }
        rows.push({ ...e, n: k.slice(2) });
      }
      rows.sort((a, b) => b.r - a.r || b.g - a.g || a.n.localeCompare(b.n));
      const me = url.searchParams.get('me');
      // Friends: numbers the asker already knows in full (max 100). Shown in full, so the phone can put its own names on them.
      const look = new Set((url.searchParams.get('look') ?? '').split(',').filter(isNumber).slice(0, 100));
      const known = (n: string) => n === me || look.has(n);
      const show = (x: BoardEntry & { n: string }, i: number): BoardRow => ({ rank: i + 1, n: known(x.n) ? x.n : maskNumber(x.n), r: x.r, g: x.g, w: x.w ?? 0, l: x.l ?? 0, d: x.d ?? 0, me: x.n === me });
      const mine = me ? rows.findIndex((x) => x.n === me) : -1;
      const friends = rows.map((x, i) => [x, i] as const).filter(([x]) => look.has(x.n)).map(([x, i]) => show(x, i));
      return json({ players: rows.length, top: rows.slice(0, BOARD_TOP).map(show), me: mine >= 0 ? show(rows[mine], mine) : null, friends });
    }
    const n = parts[1];
    if (!n || !isNumber(n) || who !== n) return bad('wrong player', 403);
    if (req.method === 'DELETE') { await store.delete(`b:${n}`); return json({ ok: true }); }
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as { rating?: number; games?: number; w?: number; l?: number; d?: number } | null;
      const r = Math.round(Number(body?.rating));
      const g = Math.round(Number(body?.games));
      if (!Number.isFinite(r) || !Number.isFinite(g)) return bad('bad entry');
      const count = (x: unknown) => Math.max(0, Math.min(100000, Math.round(Number(x)) || 0));
      const entry: BoardEntry = { r: Math.max(100, Math.min(3000, r)), g: count(g), w: count(body?.w), l: count(body?.l), d: count(body?.d), at: now };
      await store.put(`b:${n}`, JSON.stringify(entry));
      return json({ ok: true });
    }
    return bad('method', 405);
  }

  // ---- Challenges --------------------------------------------------------
  if (parts[0] === 'games') {
    if (!who) return bad('no key', 401);
    const load = async (id: string) => { const v = await store.get(`g:${id}`); return v ? (JSON.parse(v) as MailGame) : null; };
    const save = async (g: MailGame) => {
      g.updatedAt = now;
      await store.put(`g:${g.id}`, JSON.stringify(g));
      await store.put(`i:${g.players.p1}:${g.id}`, '1');
      await store.put(`i:${g.players.p2}:${g.id}`, '1');
    };
    const mine = async () => {
      const idx = await store.list(`i:${who}:`);
      const out: MailGame[] = [];
      for (const k of idx.keys()) {
        const g = await load(k.split(':')[2]);
        if (!g) { await store.delete(k); continue; }
        // Time limits: an unanswered challenge expires; a quiet player to move loses on time.
        if (g.status === 'invited' && now - g.updatedAt > MAIL_TIMEOUT_MS) { g.status = 'expired'; await save(g); }
        if (g.status === 'playing' && now - g.updatedAt > MAIL_TIMEOUT_MS) {
          const s = replay(g.record).at(-1)!;
          g.record = { ...g.record, actions: [...g.record.actions, { t: 'timeout', by: s.turn }] };
          g.record.meta.result = play(s, { t: 'timeout', by: s.turn }).result;
          g.status = 'done';
          await save(g);
        }
        // Finished games stay listed for 30 days.
        if (['done', 'declined', 'expired'].includes(g.status) && now - g.updatedAt > 30 * 24 * 3600 * 1000) { await store.delete(k); continue; }
        out.push(g);
      }
      return out;
    };

    if (req.method === 'GET' && parts.length === 1) {
      const list = await mine();
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      return json({ games: list.map(view) });
    }
    if (req.method === 'POST' && parts.length === 1) {
      const body = (await req.json().catch(() => null)) as { to?: string; game?: string; colour?: string; rating?: number } | null;
      const to = String(body?.to ?? '').replace(/\D/g, '');
      if (!isNumber(to)) return bad('That player number needs 8 digits.');
      if (to === who) return bad('You cannot challenge yourself.');
      const game = MAIL_GAMES.includes(body?.game as RoomGame) ? (body!.game as RoomGame) : 'standard';
      if (!(await exists(to))) return bad('No player has that number.', 404);
      const open = (await mine()).filter((g) => g.status === 'invited' || g.status === 'playing');
      if (open.length >= MAX_OPEN_GAMES) return bad(`You already have ${MAX_OPEN_GAMES} games going. Finish one first.`, 429);
      const iAmWhite = body?.colour === 'p2' ? false : body?.colour === 'p1' ? true : Math.random() < 0.5;
      const players = iAmWhite ? { p1: who, p2: to } : { p1: to, p2: who };
      const rating = Math.max(100, Math.min(3000, Math.round(Number(body?.rating) || 600)));
      const seed = (Math.random() * 0xffffffff) | 0;
      const mode = game === 'standard' ? 'standard' : game;
      const record = newRecord(seed, { p1: `#${players.p1}`, p2: `#${players.p2}` }, undefined, mode);
      const g: MailGame = {
        id: newId(), players, ratings: { p1: iAmWhite ? rating : 600, p2: iAmWhite ? 600 : rating }, game,
        status: 'invited', from: who, record, createdAt: now, updatedAt: now,
      };
      await save(g);
      return json({ game: view(g) }, 201);
    }
    const g = parts[1] ? await load(parts[1]) : null;
    if (!g || (g.players.p1 !== who && g.players.p2 !== who)) return bad('No such game.', 404);
    const seat: PlayerId = g.players.p1 === who ? 'p1' : 'p2';
    const act = parts[2];
    if (req.method === 'GET' && !act) return json({ game: view(g) });
    if (req.method !== 'POST') return bad('method', 405);
    const body = (await req.json().catch(() => ({}))) as { rating?: number; action?: Action; ply?: number };

    if (act === 'accept' || act === 'decline') {
      if (g.status !== 'invited' || g.from === who) return bad('Nothing to answer.');
      if (act === 'decline') { g.status = 'declined'; await save(g); return json({ game: view(g) }); }
      g.ratings[seat] = Math.max(100, Math.min(3000, Math.round(Number(body.rating) || 600)));
      g.status = 'playing';
      await save(g);
      return json({ game: view(g) });
    }
    if (act === 'cancel') {
      if (g.status !== 'invited' || g.from !== who) return bad('Nothing to cancel.');
      g.status = 'declined';
      await save(g);
      return json({ game: view(g) });
    }
    if (act === 'move' || act === 'resign') {
      if (g.status !== 'playing') return bad('This game is not being played.');
      const states = replay(g.record);
      const s = states[states.length - 1];
      let a: Action;
      if (act === 'resign') a = { t: 'resign', by: seat };
      else {
        // The ply number guards against a move sent twice.
        if (body.ply !== g.record.actions.length) return json({ game: view(g), stale: true }, 409);
        a = body.action as Action;
        if (!a || (a.t !== 'move' && a.t !== 'buff')) return bad('Not a move.');
        if (s.turn !== seat) return bad('Not your turn.');
        if (a.t === 'buff' && a.by !== seat) return bad('Not your turn.');
      }
      let n;
      try { n = play(s, a); } catch { return bad('That move is not allowed.'); }
      g.record = { ...g.record, actions: [...g.record.actions, a] };
      if (n.result) { g.record.meta.result = n.result; g.status = 'done'; }
      await save(g);
      return json({ game: view(g) });
    }
    return bad('Unknown action.', 404);
  }
  return bad('not found', 404);
}
