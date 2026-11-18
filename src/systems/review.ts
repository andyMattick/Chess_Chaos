import { allowsMateInOne, bestMove, rankMoves } from '../ai/search';
import { makeMove } from '../core/movegen';
import { replay, type GameRecord } from '../core/record';
import { sameMove } from '../core/rules';
import { toSAN } from '../core/san';
import type { GameState, MoveAction, PlayerId } from '../core/types';
import { hanging, newThreats } from '../tactics/attacks';
import { availableTactics, TACTIC_NAMES, tacticsOfMove, type TacticId } from '../tactics/detectors';
import type { MissMap } from './alerts';

/**
 * Post-game review (FB-01 win of the game, FB-02 one fix, FB-07 miss map,
 * FB-04 badge progress). Pure and deterministic; runs in the AI worker.
 * Scores are centipawns from the player's point of view.
 */

export interface ReviewMoment {
  /** Index into the record's actions. */
  ply: number;
  san: string;
  text: string;
  tactic?: TacticId;
}

export interface ReviewFix extends ReviewMoment {
  bestSan: string;
  /** Any of these counts as a good retry. */
  goodMoves: MoveAction[];
  drop: number;
}

export interface ReviewResult {
  win: ReviewMoment | null;
  fix: ReviewFix | null;
  miss: MissMap;
  /** Badge progress earned this game. */
  badges: Record<string, number>;
}

const FIX_THRESHOLD = 150;

function scoreFor(s: GameState, pov: PlayerId, depth: number): number {
  const r = bestMove(s, { depth, quiescence: true });
  if (!r.best) return 0;
  return s.turn === pov ? r.score : -r.score;
}

export function reviewGame(record: GameRecord, player: PlayerId, depth = 2): ReviewResult {
  const states = replay(record);
  const miss: MissMap = {};
  const bump = (k: string, f: 'missed' | 'found') => {
    miss[k] ??= { missed: 0, found: 0 };
    miss[k][f]++;
  };
  const badges: Record<string, number> = {};
  let win: ReviewMoment | null = null;
  let winRank = -1;
  let fix: ReviewFix | null = null;
  let prevAfter: number | null = null;
  let streak = 0;

  record.actions.forEach((a, i) => {
    const before = states[i];
    if (a.t !== 'move' || before.turn !== player || before.result) return;
    const after = makeMove(before, a);
    const san = toSAN(before, a);

    // Tactics found or missed.
    const avail = new Set(availableTactics(before).map((t) => t.id));
    const played = tacticsOfMove(before, a);
    for (const id of avail) bump(id, played.includes(id) ? 'found' : 'missed');
    for (const id of played) badges[id] = (badges[id] ?? 0) + 1;

    // Pieces left hanging, and threats answered.
    const wasHanging = new Set(hanging(before, player, 2).map((h) => h.piece.id));
    const nowHanging = hanging(after, player, 2);
    const newlyHung = nowHanging.filter((h) => !wasHanging.has(h.piece.id));
    if (newlyHung.length) bump('hanging', 'missed');
    if (i > 0) {
      const threats = newThreats(states[i - 1], before, player).filter((t) => t.kind === 'attack');
      if (threats.length) {
        const stillHanging = nowHanging.some((h) => threats.some((t) => before.sq[t.square] === h.piece.id));
        bump('threat', stillHanging ? 'missed' : 'found');
      }
    }
    streak = nowHanging.length === 0 ? streak + 1 : 0;
    if (streak > 0 && streak % 10 === 0) badges['no-hang-streak'] = (badges['no-hang-streak'] ?? 0) + 1;

    // Evaluation: how much worse was the played move than the best one?
    const best = scoreFor(before, player, depth);
    const playedScore = scoreFor(after, player, Math.max(1, depth - 1));
    const drop = best - playedScore;

    // Win of the game: the most important tactic, else the biggest step forward.
    const rankOf = (t: TacticId) => ['free-piece', 'discovered', 'pin', 'skewer', 'fork', 'mate'].indexOf(t);
    const top = played.slice().sort((x, y) => rankOf(y) - rankOf(x))[0];
    if (top && rankOf(top) + 1000 > winRank) {
      winRank = rankOf(top) + 1000;
      win = { ply: i, san, tactic: top, text: `You found a ${TACTIC_NAMES[top].word}! ${TACTIC_NAMES[top].explain}` };
    } else if (!top && drop <= 40) {
      const gain = prevAfter === null ? 0 : playedScore - prevAfter;
      if (gain > winRank && winRank < 1000) {
        winRank = gain;
        win = { ply: i, san, text: drop <= 10 ? 'That was the best move on the board. Nice eye!' : 'A strong move that made your position better.' };
      }
    }
    prevAfter = playedScore;

    // One fix: the biggest drop.
    if (drop >= FIX_THRESHOLD && (!fix || drop > fix.drop)) {
      fix = { ply: i, san, text: '', bestSan: '', goodMoves: [], drop };
    }
  });

  // Fill in the fix details only for the chosen position (it is the costly bit).
  const f = fix as ReviewFix | null;
  if (f) {
    const before = states[f.ply];
    const ranked = rankMoves(before, depth);
    const top = ranked[0];
    f.goodMoves = ranked.filter((r) => r.score >= top.score - 50 && !allowsMateInOne(before, r.move)).map((r) => r.move);
    f.bestSan = toSAN(before, top.move);
    const a = record.actions[f.ply] as MoveAction;
    const hung = hanging(makeMove(before, a), player, 2)[0];
    f.text = hung
      ? `After ${f.san}, your ${hung.piece.type} could be taken. Can you find a safer move?`
      : `${f.san} let the other side get ahead. Can you find something better?`;
    if (f.goodMoves.some((m) => sameMove(m, a))) return { win, fix: null, miss, badges };
  }
  if (!win) {
    // There is always a positive moment, even in a loss.
    const firstMove = record.actions.findIndex((a, i) => a.t === 'move' && states[i].turn === player);
    if (firstMove >= 0) win = { ply: firstMove, san: toSAN(states[firstMove], record.actions[firstMove] as MoveAction), text: 'You got in the game and kept fighting. Every game makes you stronger!' };
  }
  return { win, fix: f, miss, badges };
}

export function mergeMiss(a: MissMap, b: MissMap): MissMap {
  const out: MissMap = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const o = out[k] ?? { missed: 0, found: 0 };
    out[k] = { missed: o.missed + v.missed, found: o.found + v.found };
  }
  return out;
}
