import { bestMove, MATE } from '../ai/search';
import { replay, type GameRecord } from '../core/record';
import { legalActions, play, sameMove } from '../core/rules';
import { toSAN } from '../core/san';
import { baseType, pieceType } from '../core/pieces';
import type { GameState, MoveAction, PlayerId } from '../core/types';
import { hanging } from '../tactics/attacks';
import { TACTIC_NAMES, tacticsOfMove } from '../tactics/detectors';

/**
 * Full game analysis: every move graded against what our own engine would
 * play, with a plain-words reason and the better move. No AI service: this is
 * the same search the bots use, so it sees about as far as a 1400 player.
 * Pure and deterministic; runs in the AI worker.
 */
export type Grade = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveNote {
  /** Index into record.actions. */
  ply: number;
  by: PlayerId;
  san: string;
  grade: Grade;
  /** Kid-friendly reason. */
  text: string;
  bestSan: string | null;
  best: { from: number; to: number } | null;
  played: { from: number; to: number };
  /** Points (pawns) lost compared with the best move. */
  drop: number;
}

export interface Analysis {
  /** Score after each state, from White's side, in pawns (clamped to ±10). */
  evals: number[];
  notes: MoveNote[];
  summary: Record<string, { best: number; good: number; inaccuracy: number; mistake: number; blunder: number; score: number }>;
}

export const GRADE_INFO: Record<Grade, { label: string; mark: string; colour: string }> = {
  best: { label: 'Great move', mark: '✓✓', colour: '#2fb36b' },
  good: { label: 'Good', mark: '✓', colour: '#8bc34a' },
  inaccuracy: { label: 'Hmm', mark: '?!', colour: '#f2b705' },
  mistake: { label: 'Oops', mark: '?', colour: '#ff8a3d' },
  blunder: { label: 'Big oops', mark: '??', colour: '#e8364b' },
};

const CLAMP = 1500;
const clamp = (cp: number) => Math.max(-CLAMP, Math.min(CLAMP, cp));

function gradeFor(drop: number): Grade {
  if (drop <= 20) return 'best';
  if (drop <= 70) return 'good';
  if (drop <= 150) return 'inaccuracy';
  if (drop <= 300) return 'mistake';
  return 'blunder';
}

/** Score of a position for the side to move (centipawns, mate as ±MATE). */
export function evaluate(s: GameState, depth: number): { score: number; best: MoveAction | null } {
  if (s.result) {
    if (!s.result.winners.length) return { score: 0, best: null };
    return { score: s.result.winners.includes(s.turn) ? MATE : -MATE, best: null };
  }
  const moves = legalActions(s);
  // The search returns 0 for a forced move; look one move further instead.
  if (moves.length === 1) {
    const next = play(s, moves[0]);
    const r = evaluate(next, depth);
    return { score: next.turn === s.turn ? r.score : -r.score, best: moves[0] };
  }
  const r = bestMove(s, { depth, quiescence: true, timeMs: 1500 });
  return { score: r.score, best: r.best };
}

const name = (t: string) => pieceType(baseType(t)).name.toLowerCase();

export function analyzeGame(record: GameRecord, depth = 2): Analysis {
  const states = replay(record);
  const ev = states.map((s) => evaluate(s, depth));
  const white = states[0].seats[0].id;
  const pov = (i: number) => (states[i].turn === white ? 1 : -1) * clamp(ev[i].score);
  const evals = states.map((_, i) => Math.round(pov(i) / 10) / 10);
  const notes: MoveNote[] = [];
  const summary: Analysis['summary'] = {};

  record.actions.forEach((a, i) => {
    const before = states[i];
    const after = states[i + 1];
    if (a.t !== 'move' || !after || before.seats.length !== 2) return;
    const by = before.turn;
    const bestScore = clamp(ev[i].score);
    const afterScore = clamp(after.turn === by ? ev[i + 1].score : -ev[i + 1].score);
    const best = ev[i].best;
    const isBest = !!best && sameMove(best, a);
    const drop = isBest ? 0 : Math.max(0, bestScore - afterScore);
    const grade = gradeFor(drop);
    const san = toSAN(before, a);
    const bestSan = best && !isBest ? toSAN(before, best) : null;

    let text: string;
    const played = tacticsOfMove(before, a);
    if (grade === 'best' || grade === 'good') {
      text = played[0] ? `You found a ${TACTIC_NAMES[played[0]].word}! ${TACTIC_NAMES[played[0]].explain}` : grade === 'best' ? 'That\'s the move our engine would play.' : 'A solid move.';
    } else if (ev[i + 1] && !after.result && (after.turn === by ? ev[i + 1].score : -ev[i + 1].score) <= -MATE + 100) {
      text = `This lets the other side checkmate. ${bestSan ? `${bestSan} was safer.` : ''}`;
    } else {
      const hungBefore = new Set(hanging(before, by, 2).map((h) => h.piece.id));
      const hung = hanging(after, by, 2).find((h) => !hungBefore.has(h.piece.id));
      const missed = best ? tacticsOfMove(before, best)[0] : undefined;
      if (missed === 'mate') text = `You had checkmate with ${bestSan}!`;
      else if (hung) text = `Your ${name(hung.piece.type)} can be taken after this. ${bestSan ? `Try ${bestSan} instead.` : ''}`;
      else if (missed) text = `You missed a ${TACTIC_NAMES[missed].word} with ${bestSan}. ${TACTIC_NAMES[missed].explain}`;
      else text = bestSan ? `${bestSan} was better.` : 'There was something better here.';
    }

    notes.push({
      ply: i, by, san, grade, text: text.trim(), bestSan,
      best: best && !isBest ? { from: before.pieces[best.piece].at, to: best.to } : null,
      played: { from: before.pieces[a.piece].at, to: a.to },
      drop: Math.round(drop / 10) / 10,
    });
    const sm = (summary[by] ??= { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, score: 0 });
    sm[grade]++;
  });

  // A simple 0-100 game score per player: fewer and smaller slips, higher score.
  for (const [p, sm] of Object.entries(summary)) {
    const mine = notes.filter((n) => n.by === p);
    const avgLoss = mine.reduce((x, n) => x + Math.min(3, n.drop), 0) / Math.max(1, mine.length);
    sm.score = Math.max(0, Math.round(100 - avgLoss * 33));
  }
  return { evals, notes, summary };
}
