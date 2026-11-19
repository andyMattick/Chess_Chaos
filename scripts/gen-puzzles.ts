/**
 * Build the built-in puzzle set (owner, 2026-11-19: "more puzzles, and fewer
 * simple finishing moves"). Our own bots play each other; the engine keeps
 * positions where ONE move is clearly best, so a player is never marked wrong
 * for an equally good move:
 *   - forced mate in 2 where only one first move works (checked exhaustively);
 *   - tactics where the best move wins at least 2 pawns more than any other,
 *     and is not just taking back a piece; the line goes on while the solver's
 *     next move is also clearly the only good one.
 * Output: src/content/puzzles.ts (plain data, checked again in tests).
 * Run: bun scripts/gen-puzzles.ts [games]
 */
import { writeFileSync } from 'node:fs';
import { bestMove, rankMoves, MATE } from '../src/ai/search';
import { chooseMove } from '../src/ai/strength';
import { inCheck, makeMove, pseudoMovesFor } from '../src/core/movegen';
import { pieceType } from '../src/core/pieces';
import { initialState, newRecord } from '../src/core/record';
import { legalActions, sameMove } from '../src/core/rules';
import { toSAN } from '../src/core/san';
import { fromFEN, toFEN } from '../src/core/setup';
import type { GameState, MoveAction, PlayerId } from '../src/core/types';

// bun scripts/gen-puzzles.ts <games> <seed> <out.json>   (find; several can run side by side)
// bun scripts/gen-puzzles.ts merge a.json b.json ...      (write src/content/puzzles.ts)
const MERGE = process.argv[2] === 'merge';
const GAMES = MERGE ? 0 : Number(process.argv[2] ?? 160);
const OUT = process.argv[4];

let seed = Number(process.argv[3] ?? 20261119);
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const value = (t: string) => (t === 'king' ? 100 : pieceType(t).value);
const isMate = (s: GameState) => legalActions(s).length === 0 && inCheck(s, s.turn);
const mateMoves = (s: GameState) => legalActions(s).filter((m) => isMate(makeMove(s, m)));

/** Does `m` force mate next move, against every reply? */
function forcesMateIn2(s: GameState, m: MoveAction): boolean {
  const a = makeMove(s, m);
  const replies = legalActions(a);
  if (!replies.length) return false; // mate in 1 or stalemate
  return replies.every((r) => mateMoves(makeMove(a, r)).length > 0);
}

interface Found { fen: string; san: string[]; theme: string; level: number; key: string }
const found: Found[] = [];
const seen = new Set<string>();

/** Which enemy pieces (worth 3+, or the king) does the piece on `at` hit now? */
function hits(s: GameState, at: number, me: PlayerId): string[] {
  const id = s.sq[at];
  if (id < 0) return [];
  const view = { ...s, turn: me };
  return pseudoMovesFor(view, s.pieces[id]).map((x) => s.sq[x.to]).filter((t) => t >= 0 && s.pieces[t].owner !== me).map((t) => s.pieces[t].type).filter((t) => t === 'king' || value(t) >= 3);
}

function themeOf(s: GameState, line: MoveAction[], me: PlayerId, savesMaterial: boolean): { theme: string; level: number } {
  const m = line[0];
  // Everything else loses something: a defensive puzzle.
  if (savesMaterial && s.sq[m.to] < 0 && !inCheck(makeMove(s, m), s.turn === 'p1' ? 'p2' : 'p1')) return { theme: 'save', level: 2 };
  const after = makeMove(s, m);
  const captured = s.sq[m.to] >= 0 ? s.pieces[s.sq[m.to]].type : null;
  const forked = hits(after, m.to, me);
  const check = inCheck(after, after.turn);
  const moverChecks = forked.includes('king');
  if (forked.length >= 2) return { theme: 'fork', level: 2 };
  if (check && !moverChecks) return { theme: 'discovered', level: 3 };
  if (check) return { theme: 'check', level: 2 };
  if (captured && line.length === 1) return { theme: 'free', level: 1 };
  if (!captured) return { theme: 'quiet', level: 3 };
  return { theme: 'win', level: 2 };
}

function add(s: GameState, line: MoveAction[], theme: string, level: number) {
  const key = toFEN(s).split(' ').slice(0, 2).join(' ');
  if (seen.has(key)) return;
  seen.add(key);
  const san: string[] = [];
  let x = s;
  for (const m of line) { san.push(toSAN(x, m)); x = makeMove(x, m); }
  found.push({ fen: toFEN(s), san, theme, level, key });
}

function tryMate(s: GameState): boolean {
  if (mateMoves(s).length) return false; // mate in 1: we have plenty of those
  const quick = bestMove(s, { depth: 3, quiescence: false, timeMs: 1500 });
  if (quick.score < MATE - 10 || !quick.best) return false;
  const all = legalActions(s).filter((m) => forcesMateIn2(s, m));
  if (all.length !== 1) return false;
  const m1 = all[0];
  const a = makeMove(s, m1);
  // The reply that holds out best: the one with the fewest mates afterwards.
  const r = legalActions(a).map((x) => ({ x, n: mateMoves(makeMove(a, x)).length })).sort((p, q) => p.n - q.n)[0].x;
  const b = makeMove(a, r);
  add(s, [m1, r, mateMoves(b)[0]], 'mate2', 3);
  return true;
}

function tryTactic(s: GameState, quick: { score: number }[], prevMove: MoveAction | null, prevCaptured: boolean) {
  const me = s.turn;
  if (quick.length < 2 || quick[0].score - quick[1].score < 150) return;
  const r = rankMoves(s, 4, true, 4000);
  const [best, second] = r;
  if (!best || !second) return;
  if (best.score >= MATE - 100) return;
  if (best.score - second.score < 200 || best.score < 150 || second.score > 120) return;
  // Not just taking back what was taken.
  if (prevMove && prevCaptured && best.move.to === prevMove.to) return;
  const line: MoveAction[] = [best.move];
  let x = makeMove(s, best.move);
  for (let k = 0; k < 2; k++) {
    if (!legalActions(x).length) break;
    const reply = bestMove(x, { depth: 3, timeMs: 1500 }).best;
    if (!reply) break;
    const y = makeMove(x, reply);
    if (!legalActions(y).length) break;
    const rr = rankMoves(y, 4, true, 3000);
    if (rr.length < 2 || rr[0].score - rr[1].score < 200) break;
    // Keep going only with a capture (or mate): that is where the win shows.
    const m = rr[0].move;
    if (y.sq[m.to] < 0 && !isMate(makeMove(y, m))) break;
    line.push(reply, m);
    x = makeMove(y, m);
  }
  const { theme, level } = themeOf(s, line, me, second.score < -150);
  add(s, line, theme, level + (line.length >= 5 ? 1 : 0));
}

const t0 = Date.now();
for (let g = 0; g < GAMES; g++) {
  let s = initialState(newRecord(Math.floor(rand() * 1e9)));
  // Weaker play makes mistakes, which is where puzzles come from.
  const ratings = [400 + Math.floor(rand() * 800), 400 + Math.floor(rand() * 800)];
  let prev: MoveAction | null = null;
  let prevCap = false;
  while (!s.result && s.ply < 160) {
    if (s.ply >= 12) {
      // A cheap look first; the deeper checks only where one move stands out.
      const quick = rankMoves(s, 2, true, 600);
      const lead = quick.length > 1 ? quick[0].score - quick[1].score : 0;
      if (lead >= 150 || (quick[0]?.score ?? 0) > 2000) { if (!tryMate(s)) tryTactic(s, quick, prev, prevCap); }
    }
    const c = chooseMove(s, { rating: ratings[s.ply % 2], random: rand });
    if (!c) break;
    prevCap = s.sq[c.move.to] >= 0;
    prev = c.move;
    s = makeMove(s, c.move);
    if (isMate(s) || legalActions(s).length === 0) break;
  }
  if (g % 10 === 9) console.error(`game ${g + 1}/${GAMES}: ${found.length} puzzles, ${Math.round((Date.now() - t0) / 1000)}s`);
}

if (!MERGE) {
  writeFileSync(OUT ?? '/tmp/puzzles.json', JSON.stringify(found));
  console.error(`found ${found.length}`);
  process.exit(0);
}
for (const f of process.argv.slice(3)) for (const x of JSON.parse(require('node:fs').readFileSync(f, 'utf8')) as Found[]) if (!seen.has(x.key)) { seen.add(x.key); found.push(x); }
// Better names: in check at the start means "escape the check"; a promotion is a new queen.
for (const x of found) {
  if (x.theme === 'mate2') continue;
  const s0 = fromFEN(x.fen);
  if (inCheck(s0, s0.turn)) { x.theme = 'escape'; x.level = 2; }
  else if (x.san[0].includes('=')) { x.theme = 'promote'; x.level = 1; }
}

// A spread of themes, easy to hard, no two from the same game moment.
const BY: Record<string, Found[]> = {};
for (const f of found) (BY[f.theme] ??= []).push(f);
const CAP: Record<string, number> = { escape: 6, promote: 3, free: 8, save: 10, check: 10, fork: 14, discovered: 8, win: 14, quiet: 8, mate2: 16 };
const pick = Object.entries(BY).flatMap(([t, list]) => list.slice(0, CAP[t] ?? 8));
pick.sort((a, b) => a.level - b.level || a.san.length - b.san.length);

const TITLES: Record<string, string[]> = {
  free: ['Free piece!', 'Help yourself', 'Nobody is guarding it', 'Snack time'],
  check: ['Check, then grab', 'Check first!', 'Chase the king, win a piece', 'Royal distraction'],
  fork: ['Double attack!', 'One move, two targets', 'Fork it!', 'Two birds, one stone'],
  discovered: ['Surprise from behind', 'Hidden attacker', 'Move one, attack with the other', 'Peek-a-boo check'],
  win: ['Win the trade', 'Come out ahead', 'Grab the bigger piece', 'Best capture'],
  quiet: ['A quiet killer', 'No capture, still wins', 'The sneaky move', 'Set the trap'],
  escape: ['Escape the check!', 'Only one good answer', 'Answer the check', 'Out of trouble'],
  promote: ['New queen!', 'Promote!', 'Last row, new piece'],
  save: ['Save your piece!', 'Danger! Find the escape', 'Don\'t lose it', 'Rescue mission'],
  mate2: ['Mate in 2', 'Two moves to checkmate', 'Mate in 2: find the first move', 'Two-step checkmate'],
};
const count: Record<string, number> = {};
const rows = pick.map((f, i) => {
  const n = (count[f.theme] = (count[f.theme] ?? 0) + 1);
  const titles = TITLES[f.theme];
  return { id: `gen-${f.theme}-${String(n).padStart(2, '0')}`, title: titles[(n - 1) % titles.length], theme: f.theme, level: f.level, fen: f.fen, san: f.san, order: i };
});

const body = `/**
 * Built-in puzzles made by scripts/gen-puzzles.ts (do not edit by hand; run it again).
 * Our own bots played each other; our engine kept positions where one move is
 * clearly the best (or the only forced mate in 2). Sorted easy to hard.
 * Themes: free (an unguarded piece), check (check, then win something),
 * fork (one move attacks two), discovered (move one piece, another attacks),
 * win (come out ahead in a trade), quiet (a winning move that is not a capture),
 * save (every other move loses something), escape (in check: only one good way out),
 * promote (a pawn becomes a queen),
 * mate2 (forced mate in two).
 */
export interface GenPuzzle { id: string; title: string; theme: string; level: number; fen: string; san: string[] }

export const GENERATED_PUZZLES: GenPuzzle[] = [
${rows.map((r) => `  ${JSON.stringify({ id: r.id, title: r.title, theme: r.theme, level: r.level, fen: r.fen, san: r.san })},`).join('\n')}
];
`;
writeFileSync('src/content/puzzles.ts', body);
console.error(`done: ${found.length} found, ${rows.length} kept`, Object.fromEntries(Object.entries(BY).map(([k, v]) => [k, v.length])));
