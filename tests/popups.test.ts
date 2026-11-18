import { describe, expect, it } from 'vitest';
import { newRecord, parseSAN, play, standardStart } from '../src/core';
import { popsFrom } from '../src/ui/Popups';
import type { MailGame, Tournament } from '../src/net/world';

const A = '11111111', B = '22222222';
function game(status: MailGame['status'], from: string, moves: string[] = []): MailGame {
  const record = newRecord(1, { p1: 'White', p2: 'Black' });
  let s = standardStart();
  for (const san of moves) { const m = parseSAN(s, san)!; record.actions.push(m); s = play(s, m); }
  return { id: `g${status}${moves.length}`, game: 'standard', players: { p1: A, p2: B }, from, status, record, createdAt: 0, updatedAt: 0, ratings: {} } as unknown as MailGame;
}

describe('pop-ups', () => {
  const name = (n: string) => (n === B ? 'Bumble queen' : n);
  it('a challenge for you, your move, friend requests, a tournament invite, a yes', () => {
    const t = { id: 't1', organizer: B, status: 'invited', joined: [B], declined: [], players: [B, A] } as unknown as Tournament;
    const pops = popsFrom(A, [game('invited', B), game('playing', B, ['e4', 'e5'])], [t], ['33333333'], [B], name);
    expect(pops.map((x) => x.emoji)).toEqual(['🤝', '🤝', '📨', '👉', '🏆']);
    expect(pops[2].text).toContain('Bumble queen challenged you');
    expect(pops[3].id).toBe('mvgplaying2:2'.replace('mvgplaying2', 'mv:gplaying2'));
  });
  it('nothing for your own challenge, their move, or bot games', () => {
    const bot = { ...game('playing', A, ['e4', 'e5']), players: { p1: A, p2: 'bot-1' } } as MailGame;
    expect(popsFrom(A, [game('invited', A), game('playing', A, ['e4']), bot], [], [], [], name)).toEqual([]);
  });
});
