import { parsePGN } from '../chesscom/pgn';
import { inCheck } from '../core/movegen';
import { legalActions, play, sameMove } from '../core/rules';
import { parseSAN } from '../core/san';
import { fromFEN } from '../core/setup';
import type { GameState, MoveAction, PlayerId } from '../core/types';

/**
 * Puzzles (docs/06 CC-02, CC-03). A puzzle is a start position and a scripted
 * line. The solver plays every other move; the replies are played for them.
 * Pure: no DOM, no network. The UI fetches Chess.com puzzles and feeds them in.
 */
export interface Puzzle {
  id: string;
  title: string;
  source: 'daily' | 'random' | 'built-in' | 'slip';
  start: GameState;
  /** Full line: solver move, reply, solver move, ... */
  line: MoveAction[];
  solver: PlayerId;
  url?: string;
  /** Other first moves that also count as right (blunder replay: anything about as good as the best). */
  ok?: MoveAction[];
}

/** Build a puzzle from a FEN and the moves in a PGN. Null if the line cannot be read. */
export function puzzleFrom(o: { id: string; title: string; source: Puzzle['source']; fen: string; pgn?: string; san?: string[]; url?: string }): Puzzle | null {
  let start: GameState;
  try { start = fromFEN(o.fen); } catch { return null; }
  const san = o.san ?? (o.pgn ? parsePGN(o.pgn).san : []);
  const line: MoveAction[] = [];
  let s = start;
  for (const t of san) {
    const m = parseSAN(s, t);
    if (!m) break;
    line.push(m);
    s = play(s, m);
    if (s.result) break;
  }
  if (!line.length) return null;
  return { id: o.id, title: o.title, source: o.source, start, line, solver: start.turn, url: o.url };
}

export function isMate(s: GameState): boolean {
  return !s.result ? legalActions(s).length === 0 && inCheck(s, s.turn) : s.result.reason === 'checkmate';
}

/**
 * Is the solver's move at `ply` right? The scripted move always is. Any other
 * move that checkmates on the spot also counts: a mate is a mate.
 */
export function checkMove(p: Puzzle, state: GameState, ply: number, m: MoveAction): 'right' | 'wrong' {
  const want = p.line[ply];
  if (want && sameMove(want, m)) return 'right';
  if (ply === 0 && p.ok?.some((x) => sameMove(x, m))) return 'right';
  return isMate(play(state, m)) ? 'right' : 'wrong';
}

/** The solver's moves only (for "3 moves to find"). */
export function solverMoves(p: Puzzle): number {
  return Math.ceil(p.line.length / 2);
}

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(t = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
}

export interface PuzzleProgress {
  /** Days in a row with the daily puzzle solved. */
  streak: number;
  best: number;
  /** Day the daily puzzle was last solved. */
  lastDaily: string;
  solved: number;
  /** Puzzle ids already paid for (newest first, capped). */
  paid: string[];
  /** Puzzle gauntlet best score (MODE-11). */
  gauntletBest?: number;
}

export const EMPTY_PROGRESS: PuzzleProgress = { streak: 0, best: 0, lastDaily: '', solved: 0, paid: [] };

/** Streak as it stands today: it breaks if yesterday was missed. */
export function currentStreak(p: PuzzleProgress, today = dayKey()): number {
  return p.lastDaily === today || p.lastDaily === prevDay(today) ? p.streak : 0;
}

/** Record a solve. Returns the new progress and the coins earned (0 if this puzzle already paid). */
export function recordSolve(prev: PuzzleProgress, puzzle: Pick<Puzzle, 'id' | 'source'>, usedHint: boolean, today = dayKey()): { progress: PuzzleProgress; coins: number; streakUp: boolean } {
  const p = { ...EMPTY_PROGRESS, ...prev };
  const firstTime = !p.paid.includes(puzzle.id);
  let streak = p.streak;
  let lastDaily = p.lastDaily;
  let streakUp = false;
  if (puzzle.source === 'daily' && p.lastDaily !== today) {
    streak = p.lastDaily === prevDay(today) ? p.streak + 1 : 1;
    lastDaily = today;
    streakUp = true;
  }
  let coins = 0;
  if (firstTime) {
    coins = puzzle.source === 'daily' ? 8 : 3;
    if (usedHint) coins = Math.ceil(coins / 2);
    if (streakUp && streak > 1) coins += Math.min(streak, 7);
  }
  return {
    progress: {
      ...p,
      streak, lastDaily, best: Math.max(p.best, streak),
      solved: p.solved + (firstTime ? 1 : 0),
      paid: firstTime ? [puzzle.id, ...p.paid].slice(0, 200) : p.paid,
    },
    coins, streakUp,
  };
}

/**
 * Built-in puzzles, used when Chess.com cannot be reached and as a warm-up.
 * Hand-written classic patterns; every line is checked in tests/puzzle.test.ts.
 */
export const BUILT_IN: { id: string; title: string; fen: string; san: string[] }[] = [
  { id: 'bi-backrank', title: 'Stuck behind the wall', fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', san: ['Ra8#'] },
  { id: 'bi-kiss', title: 'The queen kiss', fen: 'k7/7Q/1K6/8/8/8/8/8 w - - 0 1', san: ['Qb7#'] },
  { id: 'bi-black-backrank', title: 'Black traps the king', fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', san: ['Ra1#'] },
  { id: 'bi-smother', title: 'Smothered!', fen: '6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1', san: ['Nf7#'] },
  { id: 'bi-ladder', title: 'Rook ladder', fen: '6k1/R7/1R6/8/8/8/8/6K1 w - - 0 1', san: ['Rb8#'] },
  { id: 'bi-scholar', title: "Scholar's mate", fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', san: ['Qxf7#'] },
  { id: 'bi-fool', title: "Fool's mate", fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', san: ['Qh4#'] },
  { id: 'bi-fork', title: 'Knight attacks two at once', fen: 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', san: ['Nc7+', 'Kd7', 'Nxa8'] },
];

export function builtInPuzzles(): Puzzle[] {
  return BUILT_IN.map((b) => puzzleFrom({ ...b, source: 'built-in' })!).filter(Boolean);
}
