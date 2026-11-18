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
    expect((await a.call('POST', `/board/${a.number}`, { rating: 900, games: 12 })).status).toBe(200);
    expect((await b.call('POST', `/board/${b.number}`, { rating: 1100, games: 3 })).status).toBe(200);
    // Posting for someone else is refused.
    expect((await a.call('POST', `/board/${b.number}`, { rating: 3000, games: 1 })).status).toBe(403);
    // A wrong key is not this player.
    const forged = await sv.fetch(new Request(`https://x.dev/world/board/${a.number}`, { method: 'POST', body: '{"rating":3000,"games":1}', headers: { authorization: `Bearer ${await authToken(newSaveKey())}`, 'x-player': a.number } }));
    expect(forged.status).toBe(403);
    const board = await (await sv.fetch(new Request(`https://x.dev/world/board?me=${a.number}`))).json();
    expect(board.players).toBe(2);
    expect(board.top[0]).toEqual({ rank: 1, n: maskNumber(b.number), r: 1100, g: 3, me: false });
    expect(board.top[1]).toEqual({ rank: 2, n: a.number, r: 900, g: 12, me: true });
    expect(board.me.rank).toBe(2);
    expect(JSON.stringify(board)).not.toContain(b.number);
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
