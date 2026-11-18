/**
 * Bot-vs-bot playtest of every 1 vs 1 mode: how long games last, who wins,
 * how often they draw or stall, and how lively they are.
 *
 *   bun scripts/simulate-modes.ts [gamesPerMode=12] [rating=800] [modes=all] > report.json
 *
 * Plain engine code, no AI service. Results vary with the seed; use enough games.
 */
import { MODE_INFO } from '../src/core/modes';
import { newRecord, initialState } from '../src/core/record';
import { play } from '../src/core/rules';
import { inCheck } from '../src/core/movegen';
import { pieceType, baseType } from '../src/core/pieces';
import { chooseMove } from '../src/ai/strength';
import type { GameState, PlayerId } from '../src/core/types';

const GAMES = Number(process.argv[2] ?? 12);
const RATING = Number(process.argv[3] ?? 800);
const ONLY = process.argv[4]?.split(',');
const CAP = 300; // plies before we call it a stall

const material = (s: GameState, p: PlayerId) =>
  s.pieces.filter((x) => x.at >= 0 && x.owner === p && x.type !== 'king').reduce((a, x) => a + Math.min(13, pieceType(baseType(x.type)).value), 0);

function seeded(seed: number) {
  let x = seed >>> 0 || 1;
  return () => ((x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) ^ (x + 0x6d2b79f5)) >>> 0) / 4294967296;
}

interface GameOut { winner: string; reason: string; plies: number; captures: number; checks: number; leadChanges: number; ms: number; special?: string }

function playOne(mode: string, seed: number): GameOut {
  const rec = newRecord(seed, { p1: 'A', p2: 'B' }, undefined, mode);
  if (mode === 'boss') rec.setup = { ...rec.setup, extra: { boss: seed % 2 ? 'p1' : 'p2' } };
  let s = initialState(rec);
  const rand = seeded(seed * 7919);
  // Hidden queen: each side marks a random pawn on its first turn.
  const markIfNeeded = () => {
    if (mode !== 'hidden-queen' || (s.modeData?.hiddenQueen as Record<string, unknown> | undefined)?.[s.turn] !== undefined) return;
    const pawns = s.pieces.filter((x) => x.owner === s.turn && x.type === 'pawn' && x.at >= 0);
    if (pawns.length) s = play(s, { t: 'buff', by: s.turn, id: 'MODE-19', piece: pawns[Math.floor(rand() * pawns.length)].id });
  };
  const t0 = Date.now();
  let captures = 0, checks = 0, leadChanges = 0, lastLead = 0;
  while (!s.result && s.ply < CAP) {
    markIfNeeded();
    const c = chooseMove(s, { rating: RATING, random: rand });
    if (!c) break;
    const before = s;
    s = play(s, c.move);
    if (s.last?.captured || before.pieces.filter((x) => x.at >= 0).length > s.pieces.filter((x) => x.at >= 0).length) captures++;
    if (s.seats.some((x) => x.id !== before.turn && inCheck(s, x.id))) checks++;
    const lead = Math.sign(material(s, 'p1') - material(s, 'p2'));
    if (lead && lastLead && lead !== lastLead) leadChanges++;
    if (lead) lastLead = lead;
  }
  const w = s.result?.winners ?? [];
  return {
    winner: !s.result ? 'stall' : !w.length ? 'draw' : w[0] === 'p1' ? 'white' : 'black',
    reason: s.result?.reason ?? 'cap', plies: s.ply, captures, checks, leadChanges, ms: Date.now() - t0,
    // Boss battle: did the Boss side win?
    special: mode === 'boss' && w.length ? (w[0] === (seed % 2 ? 'p1' : 'p2') ? 'boss' : 'army') : undefined,
  };
}

const modes = MODE_INFO.filter((m) => m.players.includes(2) && m.id !== 'survival' && m.id !== 'battle').map((m) => m.id);
const out: Record<string, unknown> = {};
for (const mode of ['standard', ...modes.filter((m) => m !== 'standard')]) {
  if (ONLY && !ONLY.includes(mode)) continue;
  const games: GameOut[] = [];
  for (let i = 0; i < GAMES; i++) {
    try { games.push(playOne(mode, 1000 + i)); } catch (e) { games.push({ winner: 'crash', reason: String(e).slice(0, 80), plies: 0, captures: 0, checks: 0, leadChanges: 0, ms: 0 }); }
  }
  const n = games.length;
  const count = (w: string) => games.filter((g) => g.winner === w).length;
  const avg = (k: keyof GameOut) => Math.round((games.reduce((a, g) => a + (g[k] as number), 0) / n) * 10) / 10;
  const reasons: Record<string, number> = {};
  for (const g of games) reasons[g.reason] = (reasons[g.reason] ?? 0) + 1;
  out[mode] = { white: count('white'), black: count('black'), draw: count('draw'), stall: count('stall'), crash: count('crash'), avgMoves: Math.round(avg('plies') / 2), minMoves: Math.round(Math.min(...games.map((g) => g.plies)) / 2), maxMoves: Math.round(Math.max(...games.map((g) => g.plies)) / 2), captures: avg('captures'), checks: avg('checks'), leadChanges: avg('leadChanges'), secPerGame: Math.round(avg('ms') / 100) / 10, reasons, ...(mode === 'boss' ? { bossWins: games.filter((g) => g.special === 'boss').length, armyWins: games.filter((g) => g.special === 'army').length } : {}) };
  console.error(mode, JSON.stringify(out[mode]));
}
console.log(JSON.stringify(out, null, 2));
