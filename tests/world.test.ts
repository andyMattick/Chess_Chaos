import { describe, expect, it } from 'vitest';
import { authToken, handleBox, handleVault, memoryBoxes, newSaveKey, playerExists, verifyPlayer, vaultRoute } from '../src/net/vault';
import { handleWorld, memoryWorld, maskNumber, MAIL_TIMEOUT_MS, BOARD_TOP, type MailGame } from '../src/net/world';
import { parseSAN, replay } from '../src/core';

/** A little server like server/dev-bun.ts. */
function server() {
  const boxes = memoryBoxes();
  const world = memoryWorld();
  const openBox = async (n: string, r: Request) => handleBox(r, boxes(n));
  let now = 1_000_000;
  const fetch = async (req: Request) => {
    const url = new URL(req.url);
    const v = vaultRoute(url.pathname);
    if (v) return handleVault(req, v, openBox);
    const n = req.headers.get('x-player') ?? '';
    const who = (await verifyPlayer(req, n, openBox)) ? n : null;
    return handleWorld(req, world, who, (x) => playerExists(url.origin, x, openBox), now);
  };
  async function player() {
    const key = newSaveKey();
    const auth = { authorization: `Bearer ${await authToken(key)}` };
    const { number } = await (await fetch(new Request('https://x.dev/vault', { method: 'POST', headers: auth }))).json();
    const call = async (method: string, path: string, body?: unknown, as = number) =>
      fetch(new Request(`https://x.dev/world${path}`, { method, body: body ? JSON.stringify(body) : undefined, headers: { ...auth, 'x-player': as } }));
    return { number: number as string, call };
  }
  return { player, fetch, later: (ms: number) => { now += ms; } };
}

describe('world leaderboard', () => {
  it('ranks players by number only, masks the others, and needs the key to post', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player();
    expect((await a.call('POST', `/board/${a.number}`, { rating: 900, games: 12, w: 7, l: 4, d: 1 })).status).toBe(200);
    expect((await b.call('POST', `/board/${b.number}`, { rating: 1100, games: 3 })).status).toBe(200);
    // Posting for someone else is refused.
    expect((await a.call('POST', `/board/${b.number}`, { rating: 3000, games: 1 })).status).toBe(403);
    // A wrong key is not this player.
    const forged = await sv.fetch(new Request(`https://x.dev/world/board/${a.number}`, { method: 'POST', body: '{"rating":3000,"games":1}', headers: { authorization: `Bearer ${await authToken(newSaveKey())}`, 'x-player': a.number } }));
    expect(forged.status).toBe(403);
    const board = await (await sv.fetch(new Request(`https://x.dev/world/board?me=${a.number}`))).json();
    expect(board.players).toBe(2);
    expect(board.top[0]).toEqual({ rank: 1, n: maskNumber(b.number), r: 1100, g: 3, w: 0, l: 0, d: 0, me: false });
    expect(board.top[1]).toEqual({ rank: 2, n: a.number, r: 900, g: 12, w: 7, l: 4, d: 1, me: true });
    expect(board.me.rank).toBe(2);
    expect(JSON.stringify(board)).not.toContain(b.number);
    // A friend's number you already know comes back in full, with their rank and record.
    const withFriend = await (await sv.fetch(new Request(`https://x.dev/world/board?me=${a.number}&look=${b.number},99999999`))).json();
    expect(withFriend.friends).toEqual([{ rank: 1, n: b.number, r: 1100, g: 3, w: 0, l: 0, d: 0, me: false }]);
    expect(withFriend.top[0].n).toBe(b.number);
    // Leaving the board.
    await b.call('DELETE', `/board/${b.number}`);
    expect((await (await sv.fetch(new Request('https://x.dev/world/board'))).json()).players).toBe(1);
    expect(BOARD_TOP).toBeGreaterThan(10);
  });
});

describe('challenges', () => {
  it('challenge, accept, play moves in turn, finish', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player();
    const made = await a.call('POST', '/games', { to: b.number, game: 'standard', colour: 'p1', rating: 700 });
    expect(made.status).toBe(201);
    const g0 = (await made.json()).game as MailGame;
    expect(g0.players).toEqual({ p1: a.number, p2: b.number });
    expect(g0.status).toBe('invited');
    // The challenger cannot accept their own challenge; moves wait for the answer.
    expect((await a.call('POST', `/games/${g0.id}/accept`, {})).status).toBe(400);
    const s0 = replay(g0.record)[0];
    expect((await a.call('POST', `/games/${g0.id}/move`, { action: parseSAN(s0, 'e4'), ply: 0 })).status).toBe(400);
    expect(((await (await b.call('GET', '/games')).json()).games as MailGame[])[0].id).toBe(g0.id);
    await b.call('POST', `/games/${g0.id}/accept`, { rating: 900 });
    // Out of turn and stale plies are refused.
    expect((await b.call('POST', `/games/${g0.id}/move`, { action: parseSAN(s0, 'e4'), ply: 0 })).status).toBe(400);
    let g = (await (await a.call('POST', `/games/${g0.id}/move`, { action: parseSAN(s0, 'e4'), ply: 0 })).json()).game as MailGame;
    expect(g.record.actions.length).toBe(1);
    expect((await a.call('POST', `/games/${g0.id}/move`, { action: parseSAN(s0, 'd4'), ply: 0 })).status).toBe(409);
    // Fool's mate the other way round.
    const line = ['f5', 'd4', 'g5', 'Qh5#'];
    const who = [b, a, b, a];
    for (let i = 0; i < line.length; i++) {
      const s = replay(g.record).at(-1)!;
      g = (await (await who[i].call('POST', `/games/${g.id}/move`, { action: parseSAN(s, line[i]), ply: g.record.actions.length })).json()).game;
    }
    expect(g.status).toBe('done');
    expect(g.record.meta.result).toEqual({ reason: 'checkmate', winners: ['p1'] });
    expect(g.ratings).toEqual({ p1: 700, p2: 900 });
  });

  it('refuses unknown numbers, yourself, and strangers reading a game', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player(), c = await sv.player();
    expect((await a.call('POST', '/games', { to: '12345678' })).status).toBe(404);
    expect((await a.call('POST', '/games', { to: a.number })).status).toBe(400);
    const g = (await (await a.call('POST', '/games', { to: b.number })).json()).game as MailGame;
    expect((await c.call('GET', `/games/${g.id}`)).status).toBe(404);
    // No key at all.
    expect((await sv.fetch(new Request('https://x.dev/world/games'))).status).toBe(401);
  });

  it('a quiet player loses on time; an unanswered challenge expires', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player();
    const g = (await (await a.call('POST', '/games', { to: b.number, colour: 'p1' })).json()).game as MailGame;
    const h = (await (await a.call('POST', '/games', { to: b.number, colour: 'p1' })).json()).game as MailGame;
    await b.call('POST', `/games/${g.id}/accept`, {});
    sv.later(MAIL_TIMEOUT_MS + 1000);
    const list = (await (await b.call('GET', '/games')).json()).games as MailGame[];
    const done = list.find((x) => x.id === g.id)!;
    expect(done.status).toBe('done');
    expect(done.record.meta.result?.winners).toEqual(['p2']); // White never moved
    expect(list.find((x) => x.id === h.id)!.status).toBe('expired');
  });
});

describe('tournaments', () => {
  it('runs a knockout of 3 friends with a bye, to a winner', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player(), c = await sv.player();
    const made = await a.call('POST', '/tournaments', { players: [b.number, c.number], game: 'koth', rating: 900 });
    expect(made.status).toBe(201);
    const t0 = (await made.json()).tournament;
    expect(t0.status).toBe('invited');
    await b.call('POST', `/tournaments/${t0.id}/join`, { rating: 700 });
    const t1 = (await (await c.call('POST', `/tournaments/${t0.id}/join`, { rating: 800 })).json()).tournament;
    expect(t1.status).toBe('running'); // everyone answered: it starts by itself
    expect(t1.rounds[0].pairs.length).toBe(2); // one game and one bye
    const k = t1.rounds[0].games.findIndex((x: string | null) => x);
    const gid = t1.rounds[0].games[k] as string;
    const players = [a, b, c];
    // Round 1: the game's Black player resigns. (The shuffle decides who gets the bye.)
    const someone = players.find((p) => t1.rounds[0].pairs[k].includes(p.number))!;
    let g = (await (await someone.call('GET', `/games/${gid}`)).json()).game as MailGame | undefined;
    const p1 = players.find((p) => p.number === (g?.players.p1 ?? ''))!;
    const p2 = players.find((p) => p.number === (g?.players.p2 ?? ''))!;
    g = (await (await p2.call('GET', `/games/${gid}`)).json()).game;
    expect(g!.tournament).toBe(t0.id);
    await p2.call('POST', `/games/${gid}/resign`);
    let t = (await (await a.call('GET', `/tournaments/${t0.id}`)).json()).tournament;
    expect(t.rounds.length).toBe(2); // final made
    expect(t.rounds[1].pairs[0]).toContain(p1.number);
    // Final: a draw-free finish, someone resigns; then there is a champion.
    const fid = t.rounds[1].games[0];
    const fg = (await (await p1.call('GET', `/games/${fid}`)).json()).game as MailGame;
    const loser = players.find((p) => p.number === fg.players.p2)!;
    await loser.call('POST', `/games/${fid}/resign`);
    t = (await (await a.call('GET', `/tournaments/${t0.id}`)).json()).tournament;
    expect(t.status).toBe('done');
    expect(t.winner).toBe(fg.players.p1);
  });
  it('organizer can start early with who joined, or cancel; strangers cannot see it', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player(), c = await sv.player(), d = await sv.player();
    const t0 = (await (await a.call('POST', '/tournaments', { players: [b.number, c.number] })).json()).tournament;
    expect((await d.call('GET', `/tournaments/${t0.id}`)).status).toBe(404);
    expect((await a.call('POST', `/tournaments/${t0.id}/start`)).status).toBe(400); // nobody joined yet
    await b.call('POST', `/tournaments/${t0.id}/join`);
    const t1 = (await (await a.call('POST', `/tournaments/${t0.id}/start`)).json()).tournament;
    expect(t1.status).toBe('running');
    expect(t1.rounds[0].pairs).toHaveLength(1);
    const t2 = (await (await a.call('POST', '/tournaments', { players: [c.number] })).json()).tournament;
    expect((await (await a.call('POST', `/tournaments/${t2.id}/cancel`)).json()).tournament.status).toBe('cancelled');
    expect((await a.call('POST', '/tournaments', { players: ['12345678'] })).status).toBe(404);
  });
});

describe('what everyone likes', () => {
  it('adds up mode rankings by player number', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player();
    await a.call('POST', `/modes/${a.number}`, { koth: 3, atomic: 0, standard: 2, 'bad mode!': 3 });
    await b.call('POST', `/modes/${b.number}`, { koth: 2, atomic: 1 });
    expect((await a.call('POST', `/modes/${b.number}`, { koth: 0 })).status).toBe(403);
    const r = await (await sv.fetch(new Request('https://x.dev/world/modes'))).json();
    expect(r.voters).toBe(2);
    expect(r.modes[0]).toEqual({ mode: 'koth', average: 2.5, favourite: 1, never: 0, votes: 2 });
    expect(r.modes.find((m: { mode: string }) => m.mode === 'atomic')).toEqual({ mode: 'atomic', average: 0.5, favourite: 0, never: 1, votes: 2 });
    expect(r.modes.some((m: { mode: string }) => m.mode === 'bad mode!')).toBe(false);
  });
});
