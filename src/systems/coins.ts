import { BOTS } from '../content/bots';

/**
 * Coins: earned by playing, spent in the Wardrobe. Every finished game pays
 * something, so beginners always make progress; wins and learning pay more.
 */
export interface CoinInput {
  kind: 'bot' | 'online' | 'training';
  result: 'win' | 'draw' | 'loss';
  /** Opponent rating (bot or online player). */
  opponent: number;
  /** Player rating before the game. */
  rating: number;
  goalsDone?: number;
  tacticsFound?: number;
  /** First ever win against this bot (bot path). */
  firstWin?: boolean;
  /** Moves played by this player; very short games pay less so resigning early is not a farm. */
  movesPlayed: number;
}

export interface CoinAward {
  total: number;
  lines: { label: string; coins: number }[];
}

export function coinsFor(i: CoinInput): CoinAward {
  const lines: CoinAward['lines'] = [];
  if (i.movesPlayed < 5) return { total: 0, lines: [{ label: 'Game too short for coins', coins: 0 }] };
  const base = i.result === 'win' ? 10 : i.result === 'draw' ? 6 : 3;
  lines.push({ label: i.result === 'win' ? 'Win' : i.result === 'draw' ? 'Draw' : 'Good fight', coins: base });
  if (i.result === 'win' && i.opponent > i.rating) {
    const upset = Math.min(15, Math.round((i.opponent - i.rating) / 20));
    if (upset > 0) lines.push({ label: 'Beat a stronger player', coins: upset });
  }
  if (i.goalsDone) lines.push({ label: `Goals done ×${i.goalsDone}`, coins: i.goalsDone * 4 });
  if (i.tacticsFound) lines.push({ label: `Tricks found ×${Math.min(i.tacticsFound, 5)}`, coins: Math.min(i.tacticsFound, 5) * 2 });
  if (i.firstWin) lines.push({ label: 'New bot beaten!', coins: 25 });
  return { total: lines.reduce((a, l) => a + l.coins, 0), lines };
}

/**
 * Bot path: bots in rating order; the first three are open, each win opens the next.
 * A placement test result (systems/placement.ts) also opens every bot up to that rating.
 */
export const PATH = [...BOTS].sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));

export function unlockedCount(botRecords: Record<string, { w: number }>, placedAt?: number): number {
  let n = 3;
  if (placedAt) n = Math.max(n, PATH.filter((b) => b.rating <= placedAt).length);
  for (let i = 0; i < PATH.length; i++) {
    if ((botRecords[PATH[i].id]?.w ?? 0) > 0) n = Math.max(n, i + 2);
  }
  return Math.min(PATH.length, n);
}
