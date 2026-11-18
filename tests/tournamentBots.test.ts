import { describe, expect, it } from 'vitest';
import { botForSeat, seatBotLabel, tournamentBots } from '../src/systems/tournamentBots';
import type { Nemesis } from '../src/systems/nemesis';

const nem = (key: string, mirror = false): Nemesis => ({
  key, name: key, mirror, rating: 900, ccRating: null, games: 5, record: { w: 1, l: 1, d: 0 },
  asWhite: [{ line: 'e4 e5 Nf3', weight: 3 }], asBlack: [{ line: 'd4 d5', weight: 1 }], topWhite: [], topBlack: [], firstMove: 'e4', builtAt: 1,
});

describe('tournament bots', () => {
  it('Mirror first, then nemeses, then a mix of path bots around your rating', () => {
    const bots = tournamentBots({ rating: 800, mirror: nem('@me', true), nemeses: [nem('hikaru'), nem('magnus')] }, 7);
    expect(bots.map((b) => b.kind)).toEqual(['mirror', 'nemesis', 'nemesis', 'bot', 'bot', 'bot', 'bot']);
    const ratings = bots.filter((b) => b.kind === 'bot').map((b) => b.rating);
    expect(new Set(ratings).size).toBe(4); // a variety, not four bots of one strength
    expect(ratings.some((r) => r > 800) && ratings.some((r) => r <= 800)).toBe(true);
    expect(Math.max(...ratings.map((r) => Math.abs(r - 800)))).toBeLessThanOrEqual(300);
  });
  it('no Mirror yet: path bots only; never more than asked', () => {
    expect(tournamentBots({ rating: 600 }, 3).every((b) => b.kind === 'bot')).toBe(true);
    expect(tournamentBots({ rating: 600, nemeses: [nem('a'), nem('b')] }, 1).length).toBe(1);
    expect(tournamentBots({ rating: 600 }, 0)).toEqual([]);
  });
  it('a seat becomes a playable bot with its own book', () => {
    const [m] = tournamentBots({ rating: 800, mirror: nem('@me', true) }, 1);
    const bot = botForSeat('abc', 'bot-1', m, 'Ava')!;
    expect(bot.name).toBe('Mirror of Ava');
    expect(bot.asWhite[0].line).toBe('e4 e5 Nf3');
    expect(bot.id).toBe('NEM:t-abc-bot-1');
    expect(seatBotLabel(m, 'You')).toBe('🪞 Your Mirror');
    expect(botForSeat('abc', 'bot-2', { kind: 'bot', botId: 'BOT-01', rating: 400 }, 'Ava')!.name).toBe('Pip');
  });
});
