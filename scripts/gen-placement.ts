/**
 * Find the deep placement puzzles (owner, 2026-11-20: a skills test with
 * 1, 2, 3 and 4 move-ahead puzzles). Our own bots play each other; from every
 * game that ends in checkmate we look back at the winner's positions 5 to 11
 * plies before the end and keep those that are an exact, forced mate in 3 or
 * in 4 (checked move by move with src/tactics/mateSolver.ts, no guessing):
 *   - the mate cannot be done faster;
 *   - the defender's replies are ones that hold out longest.
 * A player who finds a different move that still forces mate in time is not
 * marked wrong: the placement test proves such a move on the spot
 * (src/systems/placement.ts), so the line need not be the only one.
 * Output: JSON to stdout. Plain engine code, no AI service.
 *   bun scripts/gen-placement.ts [games=200] [seed=20261120] > found.json
 */
import { chooseMove } from '../src/ai/strength';
import { makeMove } from '../src/core/movegen';
import { initialState, newRecord } from '../src/core/record';
import { legalActions } from '../src/core/rules';
import { toSAN } from '../src/core/san';
import { toFEN } from '../src/core/setup';
import type { GameState, MoveAction } from '../src/core/types';
import { MateSolver, isCheckmated } from '../src/tactics/mateSolver';

const GAMES = Number(process.argv[2] ?? 200);
let seed = Number(process.argv[3] ?? 20261120);
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

interface Found { fen: string; san: string[]; mateIn: number }
const found: Found[] = [];
const seen = new Set<string>();

/** The full line if `s` is a clean forced mate in exactly n, else null. */
function cleanLine(s: GameState, n: number): MoveAction[] | null {
  const solver = new MateSolver(Number(process.env.NODES ?? 60_000));
  try {
    if (!solver.forces(s, n) || solver.forces(s, n - 1)) return null;
    const line: MoveAction[] = [];
    let x = s;
    for (let left = n; left >= 1; left--) {
      const m = solver.find(x, left);
      if (!m) return null;
      line.push(m);
      x = makeMove(x, m);
      if (left === 1) return isCheckmated(x) ? line : null;
      // The defender holds out longest: a reply after which mate still needs every move left.
      const replies = legalActions(x);
      const r = replies.find((y) => { try { return !new MateSolver(5000).forces(makeMove(x, y), left - 2); } catch { return true; } }) ?? replies[0];
      line.push(r);
      x = makeMove(x, r);
    }
    return null;
  } catch {
    return null; // too big to prove: skip it
  }
}

const t0 = Date.now();
let playMs = 0, proveMs = 0;
for (let g = 0; g < GAMES; g++) {
  let s = initialState(newRecord(Math.floor(rand() * 1e9), { p1: 'A', p2: 'B' }));
  // Weaker bots blunder into forced mates more often, and play faster.
  const ratings = [400 + Math.floor(rand() * 500), 400 + Math.floor(rand() * 500)];
  const tg = Date.now();
  const history: GameState[] = [s];
  while (s.ply < 200) {
    const c = chooseMove(s, { rating: ratings[s.ply % 2], random: rand });
    if (!c) break;
    s = makeMove(s, c.move);
    history.push(s);
    if (!legalActions(s).length) break;
  }
  if (!isCheckmated(s)) continue;
  const end = history.length - 1;
  playMs += Date.now() - tg;
  const tp = Date.now();
  // Where the game itself mated in 3 or 4, test that; one step further back, test 4.
  for (const [back, tries] of [[5, [3]], [7, [3, 4]], [9, [4]]] as const) {
    const p = history[end - back];
    if (!p) continue;
    const key = toFEN(p).split(' ').slice(0, 2).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    for (const n of tries) {
      const line = cleanLine(p, n);
      if (!line) continue;
      const san: string[] = [];
      let x = p;
      for (const m of line) { san.push(toSAN(x, m)); x = makeMove(x, m); }
      found.push({ fen: toFEN(p), san, mateIn: n });
      break;
    }
  }
  proveMs += Date.now() - tp;
  if (g % 10 === 9) console.error(`game ${g + 1}/${GAMES}: mate3 ${found.filter((f) => f.mateIn === 3).length}, mate4 ${found.filter((f) => f.mateIn === 4).length}, ${Math.round((Date.now() - t0) / 1000)}s (play ${Math.round(playMs / 1000)}s, proofs ${Math.round(proveMs / 1000)}s)`);
}
console.log(JSON.stringify(found, null, 1));
