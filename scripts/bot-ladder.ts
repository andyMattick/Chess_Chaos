/**
 * Bot ladder: does each bot on the Bot Path still beat the one below it?
 * Every bot plays the next one up, colours swapped each game. A healthy path
 * has the stronger bot scoring well over half. Used by the weekly check to spot
 * bots getting stronger or weaker after engine changes.
 *
 *   bun scripts/bot-ladder.ts [gamesPerPair=6] [onlyHigherBots=Caro,Indy] > ladder.json
 *
 * Fixed seeds, so the same code gives the same numbers week to week.
 */
import { newRecord, initialState } from '../src/core/record';
import { play } from '../src/core/rules';
import { chooseMove } from '../src/ai/strength';
import { PATH } from '../src/systems/coins';
import type { Bot } from '../src/content/bots';

const GAMES = Number(process.argv[2] ?? 6);
const ONLY = process.argv[3]?.split(',');
const CAP = 240;

function seeded(seed: number) {
  let x = seed >>> 0 || 1;
  return () => ((x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) ^ (x + 0x6d2b79f5)) >>> 0) / 4294967296;
}

/** Score for `hi` (1 win, 0.5 draw) and game length. */
function game(lo: Bot, hi: Bot, seed: number): { score: number; plies: number } {
  const hiWhite = seed % 2 === 0;
  let s = initialState(newRecord(seed, { p1: 'A', p2: 'B' }));
  const rand = seeded(seed * 31337);
  while (!s.result && s.ply < CAP) {
    const b = (s.turn === 'p1') === hiWhite ? hi : lo;
    const c = chooseMove(s, { bot: b, rating: b.rating, random: rand });
    if (!c) break;
    s = play(s, c.move);
  }
  const w = s.result?.winners ?? [];
  const hiSeat = hiWhite ? 'p1' : 'p2';
  return { score: !s.result || !w.length ? 0.5 : w.includes(hiSeat) ? 1 : 0, plies: s.ply };
}

const pairs: Record<string, unknown>[] = [];
for (let i = 0; i + 1 < PATH.length; i++) {
  const lo = PATH[i], hi = PATH[i + 1];
  if (ONLY && !ONLY.includes(hi.name)) continue;
  let score = 0, plies = 0;
  const t0 = Date.now();
  for (let g = 0; g < GAMES; g++) {
    const r = game(lo, hi, 500 + g);
    score += r.score; plies += r.plies;
  }
  const row = { lower: `${lo.name} ★${lo.rating}`, higher: `${hi.name} ★${hi.rating}`, higherScore: score, games: GAMES, avgMoves: Math.round(plies / GAMES / 2), sec: Math.round((Date.now() - t0) / 100) / 10 };
  pairs.push(row);
  console.error(JSON.stringify(row));
}
console.log(JSON.stringify({ date: new Date().toISOString().slice(0, 10), pairs }, null, 2));
