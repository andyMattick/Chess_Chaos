import { authToken } from '../net/vault';
import type { MailGame, Tournament } from '../net/world';
export type { Tournament };
import type { RoomGame } from '../net/protocol';
import type { Action } from '../core/types';
import { vaultBase } from './cloud';
import { activeProfile, updateProfile, type Profile } from './storage';

/**
 * World leaderboard and challenges (owner, 2026-11-18). Need a player number
 * (cloud save). Only numbers go to the server: no names, no messages.
 */

import type { BoardRow } from '../net/world';
export type { BoardRow };
export interface Board { players: number; top: BoardRow[]; me: BoardRow | null; friends: BoardRow[] }

async function call(p: Profile, method: string, path: string, body?: unknown): Promise<Response> {
  const base = vaultBase();
  if (!base || !p.cloud) throw new Error('Get a player number first (⚙️ Settings → Cloud save).');
  return fetch(`${base}/world${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { authorization: `Bearer ${await authToken(p.cloud.key)}`, 'x-player': p.cloud.number, 'content-type': 'application/json' },
  });
}

async function answer<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && res.status !== 409) throw new Error(data.error ?? 'The server did not answer. Try again soon.');
  return data;
}

export async function fetchBoard(me?: string, friends: string[] = []): Promise<Board> {
  const base = vaultBase();
  if (!base) throw new Error('No server here.');
  const q = new URLSearchParams();
  if (me) q.set('me', me);
  if (friends.length) q.set('look', friends.slice(0, 100).join(','));
  const res = await fetch(`${base}/world/board?${q}`);
  return answer<Board>(res);
}

/** Put (or keep) this player on the world leaderboard, unless they switched it off. */
export async function postBoard(p: Profile | undefined = activeProfile()): Promise<void> {
  if (!p?.cloud) return;
  if (p.worldBoard === false) return;
  await call(p, 'POST', `/board/${p.cloud.number}`, { rating: p.rating, games: p.gamesPlayed, ...myRecord(p) });
}

export async function setOnBoard(on: boolean): Promise<void> {
  const p = activeProfile();
  if (!p?.cloud) return;
  updateProfile((x) => ({ ...x, worldBoard: on }));
  if (on) { await postBoard({ ...p, worldBoard: true }); await postModeVotes({ ...p, worldBoard: true }); }
  else { await call(p, 'DELETE', `/board/${p.cloud.number}`); await call(p, 'DELETE', `/modes/${p.cloud.number}`); }
}

export async function myGames(): Promise<MailGame[]> {
  const p = activeProfile();
  if (!p) return [];
  return (await answer<{ games: MailGame[] }>(await call(p, 'GET', '/games'))).games;
}

export async function challenge(to: string, game: RoomGame, colour: 'p1' | 'p2' | 'random'): Promise<MailGame> {
  const p = activeProfile()!;
  return (await answer<{ game: MailGame }>(await call(p, 'POST', '/games', { to, game, colour, rating: p.rating }))).game;
}

export async function answerChallenge(id: string, act: 'accept' | 'decline' | 'cancel'): Promise<MailGame> {
  const p = activeProfile()!;
  return (await answer<{ game: MailGame }>(await call(p, 'POST', `/games/${id}/${act}`, { rating: p.rating }))).game;
}

export async function getGame(id: string): Promise<MailGame> {
  const p = activeProfile()!;
  return (await answer<{ game: MailGame }>(await call(p, 'GET', `/games/${id}`))).game;
}

/** Send a move. `ply` is how many actions the game had before it (guards against sending twice). */
export async function sendMailMove(id: string, action: Action, ply: number): Promise<MailGame> {
  const p = activeProfile()!;
  return (await answer<{ game: MailGame }>(await call(p, 'POST', `/games/${id}/move`, { action, ply }))).game;
}

export async function resignMail(id: string): Promise<MailGame> {
  const p = activeProfile()!;
  return (await answer<{ game: MailGame }>(await call(p, 'POST', `/games/${id}/resign`))).game;
}

/** Name a player number on this phone only ("Grandpa"). Never sent anywhere. */
export function nameNumber(n: string, name: string) {
  updateProfile((x) => ({ ...x, contacts: { ...(x.contacts ?? {}), [n]: name.trim().slice(0, 16) } }));
}

export function labelFor(p: Profile | undefined, n: string): string {
  return p?.contacts?.[n] || `Player ${n.slice(0, 4)} ${n.slice(4)}`;
}

/** Add a friend by player number, with a name only you see. */
export function addFriend(n: string, name?: string) {
  const num = n.replace(/\D/g, '');
  if (!/^\d{8}$/.test(num)) throw new Error('A player number has 8 digits.');
  updateProfile((x) => {
    if (x.cloud?.number === num) return x;
    const contacts = name?.trim() ? { ...(x.contacts ?? {}), [num]: name.trim().slice(0, 16) } : x.contacts;
    return { ...x, contacts, friends: [num, ...(x.friends ?? []).filter((f) => f !== num)].slice(0, 100) };
  });
}

export function removeFriend(n: string) {
  updateProfile((x) => ({ ...x, friends: (x.friends ?? []).filter((f) => f !== n) }));
}

/** Overall wins, losses and draws: every rated game against bots, online players and challenges. */
export function myRecord(p: Profile): { w: number; l: number; d: number } {
  const out = { w: 0, l: 0, d: 0 };
  for (const o of Object.values(p.opponents ?? {})) { out.w += o.w; out.l += o.l; out.d += o.d; }
  return out;
}

/** Your record against one player number (challenge games). */
export function recordVs(p: Profile | undefined, n: string): { w: number; l: number; d: number } | null {
  const o = p?.opponents?.[`mail:${n}`];
  return o ? { w: o.w, l: o.l, d: o.d } : null;
}

/* ---- Tournaments ---- */
export async function myTournaments(): Promise<Tournament[]> {
  const p = activeProfile();
  if (!p?.cloud) return [];
  return (await answer<{ tournaments: Tournament[] }>(await call(p, 'GET', '/tournaments'))).tournaments;
}

export async function createTournament(players: string[], game: RoomGame): Promise<Tournament> {
  const p = activeProfile()!;
  return (await answer<{ tournament: Tournament }>(await call(p, 'POST', '/tournaments', { players, game, rating: p.rating }))).tournament;
}

export async function tournamentAction(id: string, act: 'join' | 'decline' | 'start' | 'cancel'): Promise<Tournament> {
  const p = activeProfile()!;
  return (await answer<{ tournament: Tournament }>(await call(p, 'POST', `/tournaments/${id}/${act}`, { rating: p.rating }))).tournament;
}

/* ---- What everyone likes ---- */
export interface ModeVotes { voters: number; modes: { mode: string; average: number; favourite: number; never: number; votes: number }[] }

export async function fetchModeVotes(): Promise<ModeVotes> {
  const base = vaultBase();
  if (!base) throw new Error('No server here.');
  return answer<ModeVotes>(await fetch(`${base}/world/modes`));
}

/** Share this player's mode rankings (numbers only), unless they switched the world leaderboard off. */
export async function postModeVotes(p: Profile | undefined = activeProfile()): Promise<void> {
  if (!p?.cloud || p.worldBoard === false || !p.modePrefs || !Object.keys(p.modePrefs).length) return;
  await call(p, 'POST', `/modes/${p.cloud.number}`, p.modePrefs);
}
