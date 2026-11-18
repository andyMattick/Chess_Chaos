import { roomServerUrl } from '../net/client';

/**
 * Chess.com Published-Data API client (docs/06). Read-only, no key.
 * Rules: one request at a time, cache aggressively, documented endpoints only.
 * Tries the API directly from the browser; if the browser blocks it, goes
 * through the room server's small relay (/chesscom/...).
 */
const BASE = 'https://api.chess.com/pub';
const CACHE_KEY = 'chess-chaos:cc-cache';
const HOUR = 3600_000;

export class ChessComError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type CacheEntry = { at: number; ttl: number; data: unknown };
function readCache(): Record<string, CacheEntry> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); } catch { return {}; }
}
function writeCache(c: Record<string, CacheEntry>) {
  // Keep the cache small: newest 40 entries.
  const entries = Object.entries(c).sort((a, b) => b[1].at - a[1].at).slice(0, 40);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries))); } catch { /* full */ }
}

function relayBase(): string | null {
  const ws = roomServerUrl();
  if (!ws) return null;
  return ws.replace(/^ws/, 'http').replace(/\/ws$/, '') + '/chesscom';
}

let queue: Promise<unknown> = Promise.resolve();
let directBlocked = false;

async function fetchOnce(path: string): Promise<unknown> {
  const tryUrl = async (url: string) => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 404) throw new ChessComError(404, 'We could not find that player.');
    if (res.status === 410) throw new ChessComError(410, 'That data is not available.');
    if (res.status === 429) throw new ChessComError(429, 'Chess.com says slow down. Try again in a minute.');
    if (!res.ok) throw new ChessComError(res.status, 'Chess.com did not answer. Try again later.');
    return res.json();
  };
  if (!directBlocked) {
    try {
      return await tryUrl(BASE + path);
    } catch (e) {
      if (e instanceof ChessComError) throw e;
      directBlocked = true; // network/CORS failure: use the relay from now on
    }
  }
  const relay = relayBase();
  if (!relay) throw new ChessComError(0, 'Could not reach Chess.com from this page.');
  return tryUrl(relay + path);
}

/** GET a PubAPI path like `/player/hikaru`, serially, with caching. */
export function get<T>(path: string, ttl = 12 * HOUR): Promise<T> {
  const cache = readCache();
  const hit = cache[path];
  if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.data as T);
  const job = queue.then(async () => {
    const data = await fetchOnce(path);
    const c = readCache();
    c[path] = { at: Date.now(), ttl, data };
    writeCache(c);
    return data as T;
  });
  queue = job.catch(() => undefined);
  return job;
}

export interface CCProfile { username: string; name?: string; avatar?: string; country?: string; joined?: number; title?: string; url?: string }
export interface CCStatBlock { last?: { rating: number }; best?: { rating: number }; record?: { win: number; loss: number; draw: number } }
export interface CCStats { chess_rapid?: CCStatBlock; chess_blitz?: CCStatBlock; chess_bullet?: CCStatBlock; chess_daily?: CCStatBlock; tactics?: { highest?: { rating: number } } }
export interface CCGame { url: string; pgn?: string; time_class: string; rules: string; rated: boolean; end_time: number; white: { username: string; rating: number; result: string }; black: { username: string; rating: number; result: string } }

const clean = (u: string) => encodeURIComponent(u.trim().toLowerCase());

export const chesscom = {
  profile: (u: string) => get<CCProfile>(`/player/${clean(u)}`),
  stats: (u: string) => get<CCStats>(`/player/${clean(u)}/stats`),
  archives: (u: string) => get<{ archives: string[] }>(`/player/${clean(u)}/games/archives`),
  /** One month of games. Past months never change, so they are cached for a long time. */
  month: (u: string, year: number, month: number) => {
    const now = new Date();
    const current = now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month;
    return get<{ games: CCGame[] }>(`/player/${clean(u)}/games/${year}/${String(month).padStart(2, '0')}`, current ? HOUR : 24 * 30 * HOUR);
  },
  dailyPuzzle: () => get<{ title: string; fen: string; pgn: string; url: string }>('/puzzle', 6 * HOUR),
};

/** Most recent standard games, newest first, reading back through months until `limit` are found. */
export async function recentGames(u: string, limit = 30, maxMonths = 3): Promise<CCGame[]> {
  const { archives } = await chesscom.archives(u);
  const out: CCGame[] = [];
  for (const url of [...archives].reverse().slice(0, maxMonths)) {
    const m = /\/(\d{4})\/(\d{2})$/.exec(url);
    if (!m) continue;
    const { games } = await chesscom.month(u, +m[1], +m[2]);
    for (const g of [...games].reverse()) if (g.rules === 'chess' && g.pgn) out.push(g);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
