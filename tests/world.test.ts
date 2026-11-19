import { describe, expect, it } from 'vitest';
import { authToken, handleBox, handleVault, memoryBoxes, newSaveKey, playerExists, verifyPlayer, vaultRoute } from '../src/net/vault';
import { handleWorld, memoryWorld, maskNumber, MAIL_TIMEOUT_MS, BOARD_TOP, LIVE_INVITE_MS, ladderAfter, luReplay, mailTurn, type MailGame } from '../src/net/world';
import { chooseAction } from '../src/levelup/ai';
import { legalActions, parseSAN, replay } from '../src/core';

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
  it('ranks players by number (open board: numbers in full), and needs the key to post', async () => {
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
    expect(board.top[0]).toEqual({ rank: 1, n: b.number, r: 1100, g: 3, w: 0, l: 0, d: 0, me: false });
    expect(board.top[1]).toEqual({ rank: 2, n: a.number, r: 900, g: 12, w: 7, l: 4, d: 1, me: true });
    expect(board.me.rank).toBe(2);
    // Friends you look up come back with their rank and record.
    const withFriend = await (await sv.fetch(new Request(`https://x.dev/world/board?me=${a.number}&look=${b.number},99999999`))).json();
    expect(withFriend.friends).toEqual([{ rank: 1, n: b.number, r: 1100, g: 3, w: 0, l: 0, d: 0, me: false }]);
    // Leaving the board.
    await b.call('DELETE', `/board/${b.number}`);
    expect((await (await sv.fetch(new Request('https://x.dev/world/board'))).json()).players).toBe(1);
    expect(BOARD_TOP).toBeGreaterThan(10);
  });
  it('friends only: masked on the board; strangers cannot challenge, invite or friend-request; friends and people you asked can', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player(), c = await sv.player(), d = await sv.player();
    await a.call('POST', `/board/${a.number}`, { rating: 900, games: 1 });
    // Strangers can reach anyone on the open board...
    expect((await c.call('POST', '/games', { to: a.number })).status).toBe(201);
    // ...until a switches on friends only, with b as a friend.
    expect((await c.call('POST', `/privacy/${a.number}`, { friendsOnly: true })).status).toBe(403); // only a can
    await a.call('POST', `/privacy/${a.number}`, { friendsOnly: true, friends: [b.number] });
    const board = await (await sv.fetch(new Request('https://x.dev/world/board'))).json();
    expect(board.top[0].n).toBe(maskNumber(a.number));
    expect((await c.call('POST', '/games', { to: a.number })).status).toBe(403);
    expect((await c.call('POST', `/friends/${a.number}`)).status).toBe(403);
    expect((await c.call('POST', '/tournaments', { players: [a.number] })).status).toBe(403);
    expect((await b.call('POST', '/games', { to: a.number })).status).toBe(201);
    // Someone a asked first can answer and play.
    await a.call('POST', `/friends/${d.number}`);
    expect((await d.call('POST', `/friends/${a.number}`)).status).toBe(200);
    expect((await d.call('POST', '/games', { to: a.number })).status).toBe(201);
    // Switched off: open again.
    await a.call('DELETE', `/privacy/${a.number}`);
    expect((await c.call('POST', '/games', { to: a.number })).status).toBe(201);
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

describe('Level-Up challenges', () => {
  it('plays a Level-Up game a move at a time, checked by the server', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player();
    const g0 = (await (await a.call('POST', '/games', { to: b.number, game: 'levelup', colour: 'p2' })).json()).game as MailGame;
    expect(g0.game).toBe('levelup');
    expect(g0.lu?.actions).toEqual([]);
    expect(g0.players.p2).toBe(a.number);
    await b.call('POST', `/games/${g0.id}/accept`, {});
    let g = g0;
    const s0 = luReplay(g);
    const first = chooseAction(s0, 'easy', () => 0.3)!;
    // Out of turn, a made-up move, and a stale ply are all refused.
    expect((await a.call('POST', `/games/${g.id}/move`, { action: first, ply: 0 })).status).toBe(400);
    expect((await b.call('POST', `/games/${g.id}/move`, { action: { t: 'move', piece: 0, to: 200 }, ply: 0 })).status).toBe(400);
    g = (await (await b.call('POST', `/games/${g.id}/move`, { action: first, ply: 0 })).json()).game;
    expect(g.lu!.actions.length).toBe(1);
    expect(mailTurn(g)).toBe('p2');
    expect((await a.call('POST', `/games/${g.id}/move`, { action: first, ply: 0 })).status).toBe(409);
    // A few more moves each, then Red gives up.
    for (let i = 0; i < 6; i++) {
      const s = luReplay(g);
      const who = s.turn === 'p1' ? b : a;
      g = (await (await who.call('POST', `/games/${g.id}/move`, { action: chooseAction(s, 'easy', () => 0.5), ply: g.lu!.actions.length })).json()).game;
    }
    expect(g.lu!.actions.length).toBe(7);
    g = (await (await a.call('POST', `/games/${g.id}/resign`, {})).json()).game;
    expect(g.status).toBe('done');
    expect(g.record.meta.result).toEqual({ reason: 'resign', winners: ['p1'] });
  });
  it('the quiet player gives up after the time limit', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player();
    const g = (await (await a.call('POST', '/games', { to: b.number, game: 'levelup', colour: 'p1' })).json()).game as MailGame;
    await b.call('POST', `/games/${g.id}/accept`, {});
    sv.later(MAIL_TIMEOUT_MS + 1000);
    const done = ((await (await b.call('GET', '/games')).json()).games as MailGame[]).find((x) => x.id === g.id)!;
    expect(done.status).toBe('done');
    expect(done.record.meta.result?.winners).toEqual(['p2']);
  });
});

describe('live Level-Up invites', () => {
  it('invite a friend to a live room: they see it; it goes after 15 minutes; friends only is respected', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player(), c = await sv.player();
    expect((await a.call('POST', `/live/${b.number}`, { code: 'ABCD' })).status).toBe(400); // not a Level-Up code
    expect((await a.call('POST', `/live/${b.number}`, { code: 'lxyz' })).status).toBe(200);
    const got = (await (await b.call('GET', '/live')).json()).invites;
    expect(got).toEqual([{ n: a.number, code: 'LXYZ', at: expect.any(Number) }]);
    await b.call('DELETE', `/live/${a.number}`);
    expect((await (await b.call('GET', '/live')).json()).invites).toEqual([]);
    await a.call('POST', `/live/${b.number}`, { code: 'LXYZ' });
    sv.later(LIVE_INVITE_MS + 1);
    expect((await (await b.call('GET', '/live')).json()).invites).toEqual([]);
    await b.call('POST', `/privacy/${b.number}`, { friendsOnly: true, friends: [] });
    expect((await c.call('POST', `/live/${b.number}`, { code: 'LXYZ' })).status).toBe(403);
  });
});

describe('Level-Up ladder', () => {
  it('join at the bottom; challenge 1 or 2 above; the winner takes the place', async () => {
    const sv = server();
    const [a, b, c, d] = [await sv.player(), await sv.player(), await sv.player(), await sv.player()];
    for (const x of [a, b, c, d]) await x.call('POST', '/ladder');
    const rows = async () => ((await (await sv.fetch(new Request('https://x.dev/world/ladder'))).json()).rows as { n: string }[]).map((r) => r.n);
    expect(await rows()).toEqual([a.number, b.number, c.number, d.number]);
    // d (4th) can reach b (2nd) and c (3rd), not a (1st); nobody challenges down.
    expect((await d.call('POST', '/ladder/challenge', { to: a.number })).status).toBe(400);
    expect((await b.call('POST', '/ladder/challenge', { to: d.number })).status).toBe(400);
    const g = (await (await d.call('POST', '/ladder/challenge', { to: b.number })).json()).game as MailGame;
    expect(g.ladder).toBe(true);
    expect(g.game).toBe('levelup');
    expect((await d.call('POST', '/ladder/challenge', { to: b.number })).status).toBe(400); // one at a time
    await b.call('POST', `/games/${g.id}/accept`, {});
    // b gives up: d takes 2nd place, b and c move down one.
    await b.call('POST', `/games/${g.id}/resign`, {});
    expect(await rows()).toEqual([a.number, d.number, b.number, c.number]);
    const board = (await (await sv.fetch(new Request('https://x.dev/world/ladder'))).json()).rows;
    expect(board[1]).toMatchObject({ rank: 2, n: d.number, w: 1, l: 0 });
    // Leaving.
    await c.call('DELETE', `/ladder/${c.number}`);
    expect(await rows()).toEqual([a.number, d.number, b.number]);
  });
  it('a defender who wins stays put', () => {
    const l = { order: ['1', '2', '3'], stats: {} };
    expect(ladderAfter(l, '3', '1', '1').order).toEqual(['1', '2', '3']);
    expect(ladderAfter(l, '3', '2', '3').order).toEqual(['1', '3', '2']);
    expect(ladderAfter(l, '3', '2', null).order).toEqual(['1', '2', '3']);
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

describe('tournament bots', () => {
  const pip = { kind: 'bot', botId: 'BOT-01', rating: 400 };
  const mirror = { kind: 'mirror', rating: 700, asWhite: [{ line: 'e4 e5 Nf3', weight: 2 }], asBlack: [{ line: 'e4 c5', weight: 1 }] };
  it('fills seats with bots; you play your bot game, and send its moves too', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player();
    const made = await a.call('POST', '/tournaments', { players: [b.number], game: 'standard', rating: 800, bots: [mirror, pip] });
    expect(made.status).toBe(201);
    const t0 = (await made.json()).tournament;
    expect(t0.players).toEqual([a.number, b.number, 'bot-1', 'bot-2']);
    expect(t0.joined).toContain('bot-2');
    expect(t0.status).toBe('invited'); // still waiting for the friend
    const t1 = (await (await b.call('POST', `/tournaments/${t0.id}/join`, { rating: 700 })).json()).tournament;
    expect(t1.status).toBe('running');
    expect(t1.bots['bot-1'].asWhite[0].line).toBe('e4 e5 Nf3');
    // Find a game with a bot in it and play both sides.
    const r = t1.rounds[0];
    for (let k = 0; k < r.pairs.length; k++) {
      const [x, y] = r.pairs[k];
      const human = [a, b].find((p) => p.number === x || p.number === y);
      const botIn = [x, y].some((n: string) => n.startsWith('bot-'));
      if (!human || !botIn || !r.games[k]) continue;
      const g = (await (await human.call('GET', `/games/${r.games[k]}`)).json()).game as MailGame;
      const s0 = replay(g.record).at(-1)!;
      const m = legalActions(s0)[0];
      expect((await human.call('POST', `/games/${g.id}/move`, { action: m, ply: 0 })).status).toBe(200); // whoever is to move
      const s1 = replay((await (await human.call('GET', `/games/${g.id}`)).json()).game.record).at(-1)!;
      expect((await human.call('POST', `/games/${g.id}/move`, { action: legalActions(s1)[0], ply: 1 })).status).toBe(200);
      // The bot game is in the human's list only.
      expect(((await (await human.call('GET', '/games')).json()).games as MailGame[]).some((z) => z.id === g.id)).toBe(true);
    }
  });
  it('you against one bot: a game you play on your phone, both sides; strangers cannot move in it', async () => {
    const sv = server();
    const a = await sv.player(), c = await sv.player();
    const t = (await (await a.call('POST', '/tournaments', { players: [], bots: [pip] })).json()).tournament;
    expect(t.status).toBe('running');
    const gid = t.rounds[0].games[0];
    let g = (await (await a.call('GET', `/games/${gid}`)).json()).game as MailGame;
    for (let ply = 0; ply < 4; ply++) {
      const s = replay(g.record).at(-1)!;
      const res = await a.call('POST', `/games/${gid}/move`, { action: legalActions(s)[0], ply });
      expect(res.status).toBe(200);
      g = (await res.json()).game;
    }
    expect(g.record.actions.length).toBe(4);
    expect((await c.call('POST', `/games/${gid}/move`, { action: legalActions(replay(g.record).at(-1)!)[0], ply: 4 })).status).toBe(404);
    // Losing to the bot ends the tournament with the bot as champion.
    const mySeat = g.players.p1 === a.number ? 'p1' : 'p2';
    await a.call('POST', `/games/${gid}/resign`);
    const done = (await (await a.call('GET', `/tournaments/${t.id}`)).json()).tournament;
    expect(done.status).toBe('done');
    expect(done.winner).toBe(g.players[mySeat === 'p1' ? 'p2' : 'p1']);
  });
  it('only bots: starts at once; two bots meeting are settled by a roll', async () => {
    const sv = server();
    const a = await sv.player();
    const made = await a.call('POST', '/tournaments', { players: [], game: 'standard', bots: [pip, mirror, { kind: 'nemesis', name: 'hikaru', rating: 1400, asWhite: [], asBlack: [] }] });
    const t = (await made.json()).tournament;
    expect(t.status).toBe('running');
    const r = t.rounds[0];
    expect(r.pairs.length).toBe(2);
    r.pairs.forEach(([x, y]: [string, string | null], k: number) => {
      if (y && x.startsWith('bot-') && y.startsWith('bot-')) { expect(r.games[k]).toBeNull(); expect([x, y]).toContain(r.winners[k]); }
    });
  });
  it('refuses bad bots and too many seats', async () => {
    const sv = server();
    const a = await sv.player();
    expect((await a.call('POST', '/tournaments', { players: [], bots: [{ kind: 'bot', botId: 'nope' }] })).status).toBe(400);
    expect((await a.call('POST', '/tournaments', { players: [], bots: [{ kind: 'nemesis', name: 'a b<script>' }] })).status).toBe(400);
    expect((await a.call('POST', '/tournaments', { players: [], bots: Array(8).fill(pip) })).status).toBe(400);
    expect((await a.call('POST', '/tournaments', { players: [] })).status).toBe(400);
  });
});


describe('friend requests', () => {
  it('ask, see it, say yes: both sides learn it; numbers only', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player();
    expect((await (await a.call('POST', `/friends/${b.number}`)).json()).status).toBe('sent');
    const inbox = await (await b.call('GET', '/friends')).json();
    expect(inbox.incoming.map((x: { n: string }) => x.n)).toEqual([a.number]);
    expect(JSON.stringify(inbox)).not.toMatch(/name/);
    expect((await (await a.call('GET', '/friends')).json()).sent.map((x: { n: string }) => x.n)).toEqual([b.number]);
    expect((await (await b.call('POST', `/friends/${a.number}/accept`)).json()).status).toBe('friends');
    const back = await (await a.call('GET', '/friends')).json();
    expect(back.accepted.map((x: { n: string }) => x.n)).toEqual([b.number]);
    expect(back.sent).toEqual([]);
    await a.call('POST', `/friends/${b.number}/seen`);
    expect((await (await a.call('GET', '/friends')).json()).accepted).toEqual([]);
    expect((await (await b.call('GET', '/friends')).json()).incoming).toEqual([]);
  });
  it('asking each other is a yes; no thanks and take back; strangers and bad numbers', async () => {
    const sv = server();
    const a = await sv.player(), b = await sv.player(), c = await sv.player();
    await a.call('POST', `/friends/${b.number}`);
    expect((await (await b.call('POST', `/friends/${a.number}`)).json()).status).toBe('friends');
    expect((await (await a.call('GET', '/friends')).json()).accepted.map((x: { n: string }) => x.n)).toEqual([b.number]);
    await c.call('POST', `/friends/${a.number}`);
    await a.call('POST', `/friends/${c.number}/decline`);
    expect((await (await c.call('GET', '/friends')).json()).sent).toEqual([]);
    await c.call('POST', `/friends/${b.number}`);
    await c.call('DELETE', `/friends/${b.number}`);
    expect((await (await b.call('GET', '/friends')).json()).incoming).toEqual([]);
    expect((await a.call('POST', '/friends/99999999')).status).toBe(404);
    expect((await a.call('POST', `/friends/${a.number}`)).status).toBe(400);
    expect((await a.call('POST', `/friends/${c.number}/accept`)).status).toBe(404);
  });
});
