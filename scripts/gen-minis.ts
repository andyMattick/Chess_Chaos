/**
 * Makes the positions for the solo mini-games (docs/03 MINI-05 to MINI-08)
 * with the game's own engine, and writes src/content/minisPositions.ts.
 * Fixed seed: the same code makes the same file.
 *
 *   bun scripts/gen-minis.ts
 */
import { writeFileSync } from 'node:fs';
import { fromFEN, toFEN } from '../src/core/setup';
import { legalActions, play } from '../src/core/rules';
import { inCheck } from '../src/core/movegen';
import { toSAN } from '../src/core/san';
import { chooseMove } from '../src/ai/strength';
import { rankMoves } from '../src/ai/search';
import { captureGain, hanging } from '../src/tactics/attacks';
import type { GameState } from '../src/core/types';

let x = 20261118;
const rand = () => ((x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) ^ (x + 0x6d2b79f5)) >>> 0) / 4294967296;
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

/* ---- MINI-05: mate in one -------------------------------------------- */
function boardFen(pieces: Record<number, string>): string {
  let rows = '';
  for (let r = 7; r >= 0; r--) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const c = pieces[r * 8 + f];
      if (c) { if (empty) { row += empty; empty = 0; } row += c; } else empty++;
    }
    if (empty) row += empty;
    rows += row + (r ? '/' : '');
  }
  return rows;
}
const SETS = [['Q'], ['R', 'R'], ['Q', 'B'], ['R', 'B'], ['Q', 'N'], ['R', 'N', 'B'], ['Q', 'R'], ['R', 'P', 'P']];
const mates: { fen: string; answers: string[] }[] = [];
for (let tries = 0; mates.length < 60 && tries < 400000; tries++) {
  const used = new Set<number>();
  const place = (c: string, ok: (sq: number) => boolean = () => true) => {
    for (let i = 0; i < 50; i++) { const sq = Math.floor(rand() * 64); if (!used.has(sq) && ok(sq)) { used.add(sq); return [sq, c] as const; } }
    return null;
  };
  // The losing king near an edge, with a pawn or two in front, like a real game.
  const edge = (sq: number) => sq >= 56 || sq % 8 === 0 || sq % 8 === 7;
  const bk = place('k', edge); const wk = place('K', (sq) => !bk || Math.abs((sq >> 3) - (bk[0] >> 3)) > 1 || Math.abs((sq & 7) - (bk[0] & 7)) > 1);
  if (!bk || !wk) continue;
  const pieces: Record<number, string> = { [bk[0]]: 'k', [wk[0]]: 'K' };
  for (const c of pick(SETS)) { const p = place(c, (sq) => (c === 'P' ? sq >= 8 && sq < 56 : true)); if (p) pieces[p[0]] = p[1]; }
  const nb = Math.floor(rand() * 3);
  for (let i = 0; i < nb; i++) { const p = place('p', (sq) => sq >= 8 && sq < 56); if (p) pieces[p[0]] = p[1]; }
  let s: GameState;
  try { s = fromFEN(`${boardFen(pieces)} w - - 0 1`); } catch { continue; }
  if (inCheck(s, 'p1') || inCheck(s, 'p2')) continue;
  const legal = legalActions(s);
  if (!legal.length) continue;
  const answers = legal.filter((m) => play(s, m).result?.reason === 'checkmate').map((m) => toSAN(s, m, legal));
  if (answers.length === 1 || answers.length === 2) {
    const fen = toFEN(s);
    if (!mates.some((m) => m.fen === fen)) mates.push({ fen, answers });
  }
}

/* ---- Positions from bot games (MINI-06 to MINI-08) ------------------- */
function gamePosition(): GameState | null {
  let s = fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const plies = 12 + Math.floor(rand() * 24);
  for (let i = 0; i < plies && !s.result; i++) {
    const c = chooseMove(s, { rating: 600, random: rand });
    if (!c) return null;
    s = play(s, c.move);
  }
  return s.result || s.turn !== 'p1' || inCheck(s, 'p1') ? null : s;
}

const guards: { fen: string }[] = [];
const trades: { fen: string; move: string; wins: boolean }[] = [];
const spots: { fen: string; square: number; best: string[] }[] = [];
for (let tries = 0; (guards.length < 40 || trades.length < 50 || spots.length < 40) && tries < 6000; tries++) {
  const s = gamePosition();
  if (!s) continue;
  const legal = legalActions(s);
  const fen = toFEN(s);
  // Guard duty: something of yours is hanging, and some (not most) moves fix everything.
  if (guards.length < 40 && hanging(s, 'p1').length) {
    const fixes = legal.filter((m) => { const n = play(s, m); return !n.result && hanging(n, 'p1').length === 0; });
    if (fixes.length && fixes.length <= legal.length * 0.4) guards.push({ fen });
  }
  // Trade or no trade: a capture, and whether it wins material once the other side takes back. Keep yes and no even.
  const caps = legal.filter((m) => s.sq[m.to] >= 0);
  if (trades.length < 50 && caps.length) {
    const m = pick(caps);
    const wins = captureGain(s, m) > 0;
    const yes = trades.filter((t) => t.wins).length;
    if ((wins && yes < 25) || (!wins && trades.length - yes < 25)) trades.push({ fen, move: toSAN(s, m, legal), wins });
  }
  // Spotlight: one piece, its moves differ a lot, and the best are clear.
  if (spots.length < 40) {
    const ranked = rankMoves(s, 2, true, 1500);
    const byPiece = new Map<number, typeof ranked>();
    for (const r of ranked) byPiece.set(r.move.piece, [...(byPiece.get(r.move.piece) ?? []), r]);
    const choices = [...byPiece.entries()].filter(([id, rs]) => s.pieces[id].type !== 'king' && rs.length >= 3 && rs[0].score - rs[rs.length - 1].score >= 150);
    if (choices.length) {
      const [id, rs] = pick(choices);
      const top = rs[0].score;
      const best = rs.filter((r) => r.score >= top - 40).map((r) => toSAN(s, r.move, legal));
      if (best.length <= 2) spots.push({ fen, square: s.pieces[id].at, best });
    }
  }
}

const out = `// Made by scripts/gen-minis.ts with the game's own engine. Do not edit by hand: run the script.
/** MINI-05 Mate in one sprint: White to move and mate. */
export const MATE_IN_ONE: { fen: string; answers: string[] }[] = ${JSON.stringify(mates, null, 0)};
/** MINI-06 Guard duty: White to move; something is hanging. Any move that leaves nothing hanging is right. */
export const GUARD_DUTY: { fen: string }[] = ${JSON.stringify(guards, null, 0)};
/** MINI-07 Trade or no trade: does White's capture win material once Black takes back? */
export const TRADES: { fen: string; move: string; wins: boolean }[] = ${JSON.stringify(trades, null, 0)};
/** MINI-08 Spotlight: the best moves for the piece on \`square\`. */
export const SPOTLIGHT: { fen: string; square: number; best: string[] }[] = ${JSON.stringify(spots, null, 0)};
`;
writeFileSync('src/content/minisPositions.ts', out);
console.log({ mates: mates.length, guards: guards.length, trades: trades.length, spots: spots.length });
