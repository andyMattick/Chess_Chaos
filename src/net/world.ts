/**
 * World features by player number (owner, 2026-11-18): a world leaderboard
 * and challenges (games played a move at a time). Shared by the Cloudflare
 * worker, the local dev server and the tests, so Web APIs and core only.
 *
 * Kid safety: no names and no messages on the server. Owner, 2026-11-19: the
 * world leaderboard is open: anyone on it can challenge or friend-request anyone
 * else on it. A player (or a parent) can switch on "friends only" (pv:<n>): their
 * number is then masked on the board and the server refuses challenges,
 * tournament invites and friend requests from anyone not on the friend list
 * they sent (or anyone they asked first). Every write needs that number's save key.
 */
import { replay, play, newRecord } from '../core';
import type { Action, GameRecord, PlayerId } from '../core';
import { ROOM_GAMES, type RoomGame } from './protocol';
import { isNumber, vaultResponse } from './vault';
import { actor as luActor, newGame as luNewGame, play as luPlay, type LUAction, type LUState } from '../levelup/rules';

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
/** What a challenge can be: the chess modes above, or Level-Up Chess (owner, 2026-11-19; not in tournaments). */
export type MailChoice = RoomGame | 'levelup';
export const MAIL_CHOICES: MailChoice[] = [...MAIL_GAMES, 'levelup'];
export const mailLabel = (game: string) => (game === 'levelup' ? 'Level-Up Chess' : ROOM_GAMES.find((x) => x.id === game)?.label ?? game);

/**
 * The Level-Up game so far. Stored moves were checked when they were sent,
 * so they are replayed without checking again (keeps the server fast).
 */
export function luReplay(g: { lu?: { seed: number; actions: LUAction[] } }): LUState {
  let s = luNewGame(g.lu!.seed);
  for (const a of g.lu!.actions) s = luPlay(s, a, false);
  return s;
}

/** Whose move it is in a challenge game. */
export function mailTurn(g: MailGame): PlayerId {
  return g.lu ? luActor(luReplay(g)) : replay(g.record).at(-1)!.turn;
}

/** Copy a Level-Up result into the record's result, so lists and records read it like any game. */
function luFinish(g: MailGame, s: LUState) {
  if (!s.result) return;
  const reason = (s.result.reason === 'stalemate' ? 'stalemate' : s.result.reason === 'resign' ? 'resign' : 'checkmate') as NonNullable<GameRecord['meta']['result']>['reason'];
  g.record.meta.result = { reason, winners: s.result.winner ? [s.result.winner] : [] };
  g.status = 'done';
}

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
  game: MailChoice;
  /** Level-Up Chess: its own seed and moves (the record then only carries players and the result). */
  lu?: { seed: number; actions: LUAction[] };
  status: 'invited' | 'playing' | 'done' | 'declined' | 'expired';
  from: string;
  /** Part of a tournament (its id). */
  tournament?: string;
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

/** Privacy choice for a player: friends only, and the friend numbers allowed in. */
interface Privacy { fo: boolean; friends: string[] }
async function privacyOf(store: WorldStore, n: string): Promise<Privacy | null> {
  const v = await store.get(`pv:${n}`);
  return v ? (JSON.parse(v) as Privacy) : null;
}
/** May `from` challenge or friend-request `to`? */
async function reachable(store: WorldStore, to: string, from: string): Promise<boolean> {
  const pv = await privacyOf(store, to);
  if (!pv?.fo) return true;
  return pv.friends.includes(from) || !!(await store.get(`fs:${to}:${from}`));
}
export const FRIENDS_ONLY_MSG = 'This player only plays with friends. Ask them to add you.';

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
      // Open board (owner, 2026-11-19): every number shows in full, except players who chose friends only.
      const closed = new Set<string>();
      for (const [k, v] of await store.list('pv:')) if ((JSON.parse(v) as Privacy).fo) closed.add(k.slice(3));
      const known = (n: string) => n === me || look.has(n) || !closed.has(n);
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

  // ---- Privacy: friends only ---------------------------------------------
  if (parts[0] === 'privacy') {
    const n = parts[1];
    if (!n || !isNumber(n) || who !== n) return bad('wrong player', 403);
    if (req.method === 'DELETE') { await store.delete(`pv:${n}`); return json({ ok: true }); }
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as { friendsOnly?: boolean; friends?: unknown[] } | null;
      if (!body?.friendsOnly) { await store.delete(`pv:${n}`); return json({ ok: true }); }
      const friends = [...new Set((Array.isArray(body.friends) ? body.friends : []).map((x) => String(x)).filter(isNumber))].slice(0, 200);
      await store.put(`pv:${n}`, JSON.stringify({ fo: true, friends } satisfies Privacy));
      return json({ ok: true });
    }
    return bad('method', 405);
  }

  // ---- Friend requests ---------------------------------------------------
  // Numbers only, never names (owner, 2026-11-18). fr:<to>:<from> a request waiting,
  // fs:<from>:<to> the sender's copy, fa:<from>:<to> "they said yes" for the sender's phone.
  if (parts[0] === 'friends') {
    if (!who) return bad('no key', 401);
    const list = async (prefix: string) => {
      const out: { n: string; at: number }[] = [];
      for (const [k, v] of await store.list(prefix)) {
        const at = Number(v) || 0;
        if (now - at > FRIEND_REQUEST_MS) { await store.delete(k); continue; }
        out.push({ n: k.slice(prefix.length), at });
      }
      return out.sort((a, b) => b.at - a.at);
    };
    if (req.method === 'GET' && !parts[1]) {
      return json({ incoming: await list(`fr:${who}:`), sent: await list(`fs:${who}:`), accepted: await list(`fa:${who}:`) });
    }
    const other = parts[1];
    if (!other || !isNumber(other) || other === who) return bad('That is not a player number.');
    const befriend = async () => {
      await store.delete(`fr:${who}:${other}`);
      await store.delete(`fs:${other}:${who}`);
      await store.delete(`fr:${other}:${who}`);
      await store.delete(`fs:${who}:${other}`);
      await store.put(`fa:${other}:${who}`, String(now));
      // Friends-only players let their new friend in straight away.
      for (const [x, y] of [[who, other], [other, who]]) {
        const pv = await privacyOf(store, x);
        if (pv?.fo && !pv.friends.includes(y)) await store.put(`pv:${x}`, JSON.stringify({ fo: true, friends: [y, ...pv.friends].slice(0, 200) } satisfies Privacy));
      }
    };
    if (req.method === 'POST' && !parts[2]) {
      if (!(await exists(other))) return bad('No player has that number.', 404);
      // They already asked you: that's a yes from both.
      if (await store.get(`fr:${who}:${other}`)) { await befriend(); return json({ status: 'friends' }); }
      if (!(await reachable(store, other, who))) return bad(FRIENDS_ONLY_MSG, 403);
      if ([...(await store.list(`fr:${other}:`))].length >= FRIEND_REQUEST_MAX) return bad('They have too many friend requests waiting.', 429);
      await store.put(`fr:${other}:${who}`, String(now));
      await store.put(`fs:${who}:${other}`, String(now));
      return json({ status: 'sent' });
    }
    if (req.method === 'POST' && parts[2] === 'accept') {
      if (!(await store.get(`fr:${who}:${other}`))) return bad('No request from that player.', 404);
      await befriend();
      return json({ status: 'friends' });
    }
    if (req.method === 'POST' && parts[2] === 'decline') {
      await store.delete(`fr:${who}:${other}`);
      await store.delete(`fs:${other}:${who}`);
      return json({ ok: true });
    }
    // The sender's phone has added them: forget the "they said yes" note.
    if (req.method === 'POST' && parts[2] === 'seen') { await store.delete(`fa:${who}:${other}`); return json({ ok: true }); }
    // Take back a request you sent.
    if (req.method === 'DELETE' && !parts[2]) {
      await store.delete(`fs:${who}:${other}`);
      await store.delete(`fr:${other}:${who}`);
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
      if (!isBotSeat(g.players.p1)) await store.put(`i:${g.players.p1}:${g.id}`, '1');
      if (!isBotSeat(g.players.p2)) await store.put(`i:${g.players.p2}:${g.id}`, '1');
    };
    const mine = async () => {
      const idx = await store.list(`i:${who}:`);
      const out: MailGame[] = [];
      for (const k of idx.keys()) {
        const g = await load(k.split(':')[2]);
        if (!g) { await store.delete(k); continue; }
        // Time limits: an unanswered challenge expires; a quiet player to move loses on time.
        if (g.status === 'invited' && now - g.updatedAt > MAIL_TIMEOUT_MS) { g.status = 'expired'; await save(g); }
        if (g.status === 'playing' && now - g.updatedAt > MAIL_TIMEOUT_MS && g.lu) {
          // Level-Up: the quiet player gives up.
          const s = luReplay(g);
          const a: LUAction = { t: 'resign', by: luActor(s) };
          g.lu = { ...g.lu, actions: [...g.lu.actions, a] };
          luFinish(g, luPlay(s, a, false));
          await save(g);
        }
        if (g.status === 'playing' && now - g.updatedAt > MAIL_TIMEOUT_MS) {
          const s = replay(g.record).at(-1)!;
          // Against a bot the human plays both sides, so the human is the quiet one.
          const by: PlayerId = isBotSeat(g.players.p1) ? 'p2' : isBotSeat(g.players.p2) ? 'p1' : s.turn;
          g.record = { ...g.record, actions: [...g.record.actions, { t: 'timeout', by }] };
          g.record.meta.result = play(s, { t: 'timeout', by }).result;
          g.status = 'done';
          await save(g);
          if (g.tournament) await stepTournament(store, g.tournament, now);
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
      const game: MailChoice = MAIL_CHOICES.includes(body?.game as MailChoice) ? (body!.game as MailChoice) : 'standard';
      if (!(await exists(to))) return bad('No player has that number.', 404);
      if (!(await reachable(store, to, who))) return bad(FRIENDS_ONLY_MSG, 403);
      const open = (await mine()).filter((g) => g.status === 'invited' || g.status === 'playing');
      if (open.length >= MAX_OPEN_GAMES) return bad(`You already have ${MAX_OPEN_GAMES} games going. Finish one first.`, 429);
      const iAmWhite = body?.colour === 'p2' ? false : body?.colour === 'p1' ? true : Math.random() < 0.5;
      const players = iAmWhite ? { p1: who, p2: to } : { p1: to, p2: who };
      const rating = Math.max(100, Math.min(3000, Math.round(Number(body?.rating) || 600)));
      const seed = (Math.random() * 0xffffffff) | 0;
      const mode = game === 'standard' || game === 'levelup' ? 'standard' : game;
      const record = newRecord(seed, { p1: `#${players.p1}`, p2: `#${players.p2}` }, undefined, mode);
      const g: MailGame = {
        id: newId(), players, ratings: { p1: iAmWhite ? rating : 600, p2: iAmWhite ? 600 : rating }, game,
        ...(game === 'levelup' ? { lu: { seed, actions: [] } } : {}),
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
    if ((act === 'move' || act === 'resign') && g.lu) {
      if (g.status !== 'playing') return bad('This game is not being played.');
      const s = luReplay(g);
      let a: LUAction;
      if (act === 'resign') a = { t: 'resign', by: seat };
      else {
        if (body.ply !== g.lu.actions.length) return json({ game: view(g), stale: true }, 409);
        a = (body as { action?: LUAction }).action as LUAction;
        if (!a || typeof a !== 'object' || a.t === 'resign') return bad('Not a move.');
        if (luActor(s) !== seat) return bad('Not your turn.');
      }
      let n: LUState;
      try { n = luPlay(s, a); } catch { return bad('That move is not allowed.'); }
      g.lu = { ...g.lu, actions: [...g.lu.actions, a] };
      luFinish(g, n);
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
        // Against a bot, your phone plays the bot's moves too.
        const vsBot = isBotSeat(g.players[seat === 'p1' ? 'p2' : 'p1']);
        if (s.turn !== seat && !vsBot) return bad('Not your turn.');
        if (a.t === 'buff' && a.by !== s.turn) return bad('Not your turn.');
      }
      let n;
      try { n = play(s, a); } catch { return bad('That move is not allowed.'); }
      g.record = { ...g.record, actions: [...g.record.actions, a] };
      if (n.result) { g.record.meta.result = n.result; g.status = 'done'; }
      await save(g);
      if (g.status === 'done' && g.tournament) await stepTournament(store, g.tournament, now);
      return json({ game: view(g) });
    }
    return bad('Unknown action.', 404);
  }
  // ---- Tournaments ------------------------------------------------------
  if (parts[0] === 'tournaments') {
    if (!who) return bad('no key', 401);
    const mine = async () => {
      const out: Tournament[] = [];
      for (const k of (await store.list(`ti:${who}:`)).keys()) {
        let t = await loadT(store, k.split(':')[2]);
        if (!t) { await store.delete(k); continue; }
        if (t.status === 'running') t = (await stepTournament(store, t.id, now)) ?? t;
        if (t.status === 'invited' && now - t.updatedAt > MAIL_TIMEOUT_MS) { t.status = 'cancelled'; await saveT(store, t, now); }
        if (['done', 'cancelled'].includes(t.status) && now - t.updatedAt > 30 * 24 * 3600 * 1000) { await store.delete(k); continue; }
        out.push(t);
      }
      return out.sort((a, b) => b.updatedAt - a.updatedAt);
    };
    if (req.method === 'GET' && parts.length === 1) return json({ tournaments: await mine() });
    if (req.method === 'POST' && parts.length === 1) {
      const body = (await req.json().catch(() => null)) as { players?: string[]; game?: string; rating?: number; bots?: unknown[] } | null;
      const others = [...new Set((body?.players ?? []).map((x) => String(x).replace(/\D/g, '')).filter((x) => isNumber(x) && x !== who))];
      const botList = (Array.isArray(body?.bots) ? body!.bots : []).map(cleanBot);
      if (botList.some((b) => !b)) return bad('A bot was not right.');
      if (others.length + botList.length < 1 || others.length + botList.length > TOURNAMENT_MAX - 1) return bad(`Pick 1 to ${TOURNAMENT_MAX - 1} friends or bots.`);
      for (const n of others) if (!(await exists(n))) return bad(`No player has the number ${n}.`, 404);
      for (const n of others) if (!(await reachable(store, n, who))) return bad(`${n.slice(0, 4)} ${n.slice(4)}: ${FRIENDS_ONLY_MSG}`, 403);
      const game = MAIL_GAMES.includes(body?.game as RoomGame) ? (body!.game as RoomGame) : 'standard';
      const bots: Record<string, TournamentBot> = {};
      botList.forEach((b, i) => { bots[`bot-${i + 1}`] = b!; });
      const botSeats = Object.keys(bots);
      const t: Tournament = {
        id: newId(), organizer: who, game, players: [who, ...others, ...botSeats], joined: [who, ...botSeats], declined: [],
        ratings: { [who]: clampRating(body?.rating), ...Object.fromEntries(botSeats.map((k) => [k, bots[k].rating])) },
        ...(botSeats.length ? { bots } : {}), status: 'invited', rounds: [], createdAt: now, updatedAt: now,
      };
      // Only bots: nobody to wait for.
      if (!others.length) await startTournament(store, t, now);
      else await saveT(store, t, now);
      return json({ tournament: (await loadT(store, t.id)) ?? t }, 201);
    }
    const t = parts[1] ? await loadT(store, parts[1]) : null;
    if (!t || !t.players.includes(who)) return bad('No such tournament.', 404);
    if (req.method === 'GET' && parts.length === 2) return json({ tournament: t });
    if (req.method !== 'POST') return bad('method', 405);
    const body = (await req.json().catch(() => ({}))) as { rating?: number };
    const act = parts[2];
    if (act === 'join' || act === 'decline') {
      if (t.status !== 'invited' || t.joined.includes(who) || t.declined.includes(who)) return bad('Nothing to answer.');
      if (act === 'join') { t.joined.push(who); t.ratings[who] = clampRating(body.rating); } else t.declined.push(who);
      // Everyone answered: start by itself.
      if (t.joined.length + t.declined.length === t.players.length && t.joined.length >= 2) await startTournament(store, t, now);
      else await saveT(store, t, now);
      return json({ tournament: (await loadT(store, t.id)) ?? t });
    }
    if (act === 'start') {
      if (t.organizer !== who || t.status !== 'invited') return bad('Only the organizer can start it, once.');
      if (t.joined.length < 2) return bad('Wait until at least one friend has joined.');
      await startTournament(store, t, now);
      return json({ tournament: (await loadT(store, t.id)) ?? t });
    }
    if (act === 'cancel') {
      if (t.organizer !== who || t.status !== 'invited') return bad('Only the organizer can cancel it before it starts.');
      t.status = 'cancelled';
      await saveT(store, t, now);
      return json({ tournament: t });
    }
    return bad('Unknown action.', 404);
  }

  // ---- What everyone likes: mode rankings, added up ----------------------
  if (parts[0] === 'modes') {
    if (req.method === 'GET') {
      const sum: Record<string, { n: number; total: number; fav: number; never: number }> = {};
      for (const v of (await store.list('m:')).values()) {
        const prefs = JSON.parse(v) as Record<string, number>;
        for (const [mode, x] of Object.entries(prefs)) {
          const e = (sum[mode] ??= { n: 0, total: 0, fav: 0, never: 0 });
          e.n++; e.total += x; if (x === 3) e.fav++; if (x === 0) e.never++;
        }
      }
      return json({ voters: (await store.list('m:')).size, modes: Object.entries(sum).map(([mode, e]) => ({ mode, average: Math.round((e.total / e.n) * 100) / 100, favourite: e.fav, never: e.never, votes: e.n })).sort((a, b) => b.average - a.average) });
    }
    const n = parts[1];
    if (!n || !isNumber(n) || who !== n) return bad('wrong player', 403);
    if (req.method === 'DELETE') { await store.delete(`m:${n}`); return json({ ok: true }); }
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      const clean: Record<string, number> = {};
      for (const [mode, x] of Object.entries(body ?? {}).slice(0, 80)) {
        if (/^[a-z0-9-]{2,30}$/.test(mode) && [0, 1, 2, 3].includes(Number(x))) clean[mode] = Number(x);
      }
      await store.put(`m:${n}`, JSON.stringify(clean));
      return json({ ok: true });
    }
    return bad('method', 405);
  }
  return bad('not found', 404);
}

/* ---------------------------------------------------------------------------
 * Tournaments (owner, 2026-11-18): a knockout bracket of 2 to 8 friends, every
 * game a challenge game. Draw: the player who had Black goes through. A bye
 * goes straight to the next round.
 *
 * Bots fill empty seats (owner: Mirror first, then nemeses, then a mix).
 * The server cannot think, so a human playing a bot plays both sides of that
 * game on their own phone and sends the bot's moves too. Two bots meeting are
 * settled at once by a roll weighted by their ratings.
 * ------------------------------------------------------------------------- */
export const TOURNAMENT_MAX = 8;

/** Friend requests wait up to 30 days; at most 30 waiting for one player. */
export const FRIEND_REQUEST_MS = 30 * 24 * 3600 * 1000;
export const FRIEND_REQUEST_MAX = 30;

/** A bot seat: a path bot by id, or a Mirror/nemesis by its opening book. No player names: the Mirror is shown as "Mirror of <organizer>". */
export interface TournamentBot {
  kind: 'bot' | 'mirror' | 'nemesis';
  rating: number;
  /** Path bot id (BOT-xx). */
  botId?: string;
  /** Nemesis: the Chess.com username it copies (public). */
  name?: string;
  asWhite?: { line: string; weight?: number }[];
  asBlack?: { line: string; weight?: number }[];
}
export const BOT_SEAT = /^bot-[1-7]$/;
export const isBotSeat = (n: string | null | undefined) => !!n && BOT_SEAT.test(n);
/** Most book lines a tournament bot carries for each colour. */
const MAX_BOT_LINES = 30;

function cleanBot(x: unknown): TournamentBot | null {
  const b = x as Partial<TournamentBot> | null;
  if (!b || !['bot', 'mirror', 'nemesis'].includes(String(b.kind))) return null;
  const book = (l: unknown) => (Array.isArray(l) ? l : []).slice(0, MAX_BOT_LINES)
    .filter((y) => y && typeof y.line === 'string' && y.line.length <= 300 && /^[A-Za-z0-9+#=\- ]+$/.test(y.line))
    .map((y) => ({ line: y.line as string, weight: Math.max(0.05, Math.min(20, Number(y.weight) || 1)) }));
  const out: TournamentBot = { kind: b.kind as TournamentBot['kind'], rating: clampRating(b.rating) };
  if (b.kind === 'bot') {
    if (!/^BOT-\d{2}$/.test(String(b.botId))) return null;
    out.botId = String(b.botId);
  } else {
    out.asWhite = book(b.asWhite);
    out.asBlack = book(b.asBlack);
    if (b.kind === 'nemesis') {
      if (!/^[A-Za-z0-9_-]{1,25}$/.test(String(b.name))) return null;
      out.name = String(b.name);
    }
  }
  return out;
}

export interface Tournament {
  id: string;
  organizer: string;
  game: RoomGame;
  /** Everyone invited (organizer first). */
  players: string[];
  joined: string[];
  declined: string[];
  ratings: Record<string, number>;
  /** Bot seats ("bot-1"...), already joined. */
  bots?: Record<string, TournamentBot>;
  status: 'invited' | 'running' | 'done' | 'cancelled';
  /** Each round: pairs of player numbers (null = a bye) and the game for each pair. */
  rounds: { pairs: [string, string | null][]; games: (string | null)[]; winners: (string | null)[] }[];
  winner?: string;
  createdAt: number;
  updatedAt: number;
}

const clampRating = (x: unknown) => Math.max(100, Math.min(3000, Math.round(Number(x)) || 600));

async function loadT(store: WorldStore, id: string): Promise<Tournament | null> {
  const v = await store.get(`t:${id}`);
  return v ? (JSON.parse(v) as Tournament) : null;
}
async function saveT(store: WorldStore, t: Tournament, now: number) {
  t.updatedAt = now;
  await store.put(`t:${t.id}`, JSON.stringify(t));
  for (const n of t.players) if (!isBotSeat(n)) await store.put(`ti:${n}:${t.id}`, '1');
}

/** Shuffle with a fresh random order (seeding is luck, like drawing names from a hat). */
function shuffle<T>(a: T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

async function newRound(store: WorldStore, t: Tournament, players: string[], now: number) {
  const pairs: [string, string | null][] = [];
  for (let i = 0; i < players.length; i += 2) pairs.push([players[i], players[i + 1] ?? null]);
  const games: (string | null)[] = [];
  const winners: (string | null)[] = [];
  for (const [a, b] of pairs) {
    if (!b) { games.push(null); winners.push(a); continue; } // a bye
    if (isBotSeat(a) && isBotSeat(b)) {
      // Two bots: a quick roll, the stronger one more likely to win.
      const ra = t.ratings[a] ?? 600, rb = t.ratings[b] ?? 600;
      games.push(null);
      winners.push(Math.random() < 1 / (1 + 10 ** ((rb - ra) / 400)) ? a : b);
      continue;
    }
    const white = Math.random() < 0.5 ? a : b;
    const black = white === a ? b : a;
    const mode = t.game === 'standard' ? 'standard' : t.game;
    const g: MailGame = {
      id: newId(), players: { p1: white, p2: black }, ratings: { p1: t.ratings[white] ?? 600, p2: t.ratings[black] ?? 600 }, game: t.game,
      status: 'playing', from: t.organizer, tournament: t.id,
      record: newRecord((Math.random() * 0xffffffff) | 0, { p1: `#${white}`, p2: `#${black}` }, undefined, mode), createdAt: now, updatedAt: now,
    };
    await store.put(`g:${g.id}`, JSON.stringify(g));
    if (!isBotSeat(white)) await store.put(`i:${white}:${g.id}`, '1');
    if (!isBotSeat(black)) await store.put(`i:${black}:${g.id}`, '1');
    games.push(g.id);
    winners.push(null);
  }
  t.rounds.push({ pairs, games, winners });
}

async function startTournament(store: WorldStore, t: Tournament, now: number) {
  t.status = 'running';
  await newRound(store, t, shuffle(t.joined), now);
  await saveT(store, t, now);
  await stepTournament(store, t.id, now);
}

/** Move a running tournament on: record finished games, start the next round, crown the winner. */
export async function stepTournament(store: WorldStore, id: string, now: number): Promise<Tournament | null> {
  const t = await loadT(store, id);
  if (!t || t.status !== 'running') return t;
  for (;;) {
    const r = t.rounds[t.rounds.length - 1];
    for (let i = 0; i < r.pairs.length; i++) {
      if (r.winners[i] || !r.games[i]) continue;
      const v = await store.get(`g:${r.games[i]}`);
      const g = v ? (JSON.parse(v) as MailGame) : null;
      if (!g || g.status !== 'done') continue;
      const w = g.record.meta.result?.winners ?? [];
      // A draw: Black goes through.
      r.winners[i] = w.length ? g.players[w[0] as 'p1' | 'p2'] : g.players.p2;
    }
    if (r.winners.some((w) => !w)) break;
    const through = r.winners as string[];
    if (through.length === 1) { t.status = 'done'; t.winner = through[0]; break; }
    await newRound(store, t, through, now);
  }
  await saveT(store, t, now);
  return t;
}
