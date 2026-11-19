import { authToken } from '../net/vault';
import type { LadderRow, MailChoice, MailGame, Tournament, TournamentBot } from '../net/world';
import type { LUAction } from '../levelup/rules';
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

export async function challenge(to: string, game: MailChoice, colour: 'p1' | 'p2' | 'random'): Promise<MailGame> {
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

/** Send a Level-Up move. `ply` is how many Level-Up actions the game had before it. */
export async function sendLuMove(id: string, action: LUAction, ply: number): Promise<MailGame> {
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
  // A friends-only player lets new friends in.
  if (activeProfile()?.friendsOnly) void syncPrivacy();
}

/* ---- Friend requests through the server (numbers only) ---- */
export interface FriendInbox { incoming: { n: string; at: number }[]; sent: { n: string; at: number }[]; accepted: { n: string; at: number }[] }

export async function friendInbox(): Promise<FriendInbox> {
  return answer<FriendInbox>(await call(activeProfile()!, 'GET', '/friends'));
}

/** Add someone by number: on your list now, and a request to them so they can add you back with one tap. */
export async function requestFriend(n: string, name?: string): Promise<'sent' | 'friends'> {
  addFriend(n, name);
  const r = await answer<{ status: 'sent' | 'friends' }>(await call(activeProfile()!, 'POST', `/friends/${n.replace(/\D/g, '')}`));
  return r.status;
}

export async function acceptFriend(n: string, name?: string): Promise<void> {
  await answer(await call(activeProfile()!, 'POST', `/friends/${n}/accept`));
  addFriend(n, name);
}

export async function declineFriend(n: string): Promise<void> {
  await answer(await call(activeProfile()!, 'POST', `/friends/${n}/decline`));
}

/** They said yes to your request: make sure they're on your list, then clear the note. Returns who. */
export async function takeAccepted(inbox: FriendInbox): Promise<string[]> {
  const p = activeProfile();
  if (!p) return [];
  for (const { n } of inbox.accepted) {
    addFriend(n);
    await call(p, 'POST', `/friends/${n}/seen`).catch(() => undefined);
  }
  return inbox.accepted.map((x) => x.n);
}

export function removeFriend(n: string) {
  updateProfile((x) => ({ ...x, friends: (x.friends ?? []).filter((f) => f !== n) }));
  syncPrivacy();
}

/** Tell the server this player's "friends only" choice, with the friend numbers allowed in. */
export async function syncPrivacy(p: Profile | undefined = activeProfile()): Promise<void> {
  if (!p?.cloud || !vaultBase()) return;
  if (p.friendsOnly) await call(p, 'POST', `/privacy/${p.cloud.number}`, { friendsOnly: true, friends: p.friends ?? [] }).catch(() => undefined);
  else await call(p, 'DELETE', `/privacy/${p.cloud.number}`).catch(() => undefined);
}
export async function setFriendsOnly(on: boolean): Promise<void> {
  updateProfile((x) => ({ ...x, friendsOnly: on }));
  await syncPrivacy();
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

export async function createTournament(players: string[], game: RoomGame, bots: TournamentBot[] = []): Promise<Tournament> {
  const p = activeProfile()!;
  return (await answer<{ tournament: Tournament }>(await call(p, 'POST', '/tournaments', { players, game, rating: p.rating, bots }))).tournament;
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

/* ---- Level-Up ladder (numbers only) ---- */
export async function fetchLadder(): Promise<LadderRow[]> {
  const base = vaultBase();
  if (!base) throw new Error('No server here.');
  const me = activeProfile()?.cloud?.number ?? '';
  return (await answer<{ rows: LadderRow[] }>(await fetch(`${base}/world/ladder?me=${me}`))).rows;
}
export async function joinLadder(): Promise<void> {
  await answer(await call(activeProfile()!, 'POST', '/ladder'));
}
export async function leaveLadder(): Promise<void> {
  const p = activeProfile()!;
  await answer(await call(p, 'DELETE', `/ladder/${p.cloud!.number}`));
}
export async function ladderChallenge(to: string): Promise<MailGame> {
  return (await answer<{ game: MailGame }>(await call(activeProfile()!, 'POST', '/ladder/challenge', { to }))).game;
}

/* ---- Live Level-Up invites (numbers and a room code only) ---- */
export async function sendLiveInvite(to: string, code: string): Promise<void> {
  await answer(await call(activeProfile()!, 'POST', `/live/${to}`, { code }));
}
export async function liveInvites(): Promise<{ n: string; code: string; at: number }[]> {
  return (await answer<{ invites: { n: string; code: string; at: number }[] }>(await call(activeProfile()!, 'GET', '/live'))).invites;
}
export async function dismissLiveInvite(from: string): Promise<void> {
  await answer(await call(activeProfile()!, 'DELETE', `/live/${from}`));
}
