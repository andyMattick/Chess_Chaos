import { rankMoves } from '../ai/search';
import { replay, type GameRecord } from '../core/record';
import { sameMove } from '../core/rules';
import { toSAN } from '../core/san';
import { STANDARD_FEN, toFEN } from '../core/setup';
import type { PlayerId } from '../core/types';
import { tacticsOfMove, TACTIC_NAMES } from '../tactics/detectors';
import { evaluate } from './analysis';

/**
 * Blunder replay (docs/06 CC-05): your own big slips come back as puzzles.
 * A slip is one of your moves after your move 8 where the score dropped by 2
 * pawns or more while a move existed that kept things level. The puzzle is
 * the position before it: "you played this; can you find better?" Any move
 * about as good as the best one counts as right. Pure; runs in the AI worker.
 */
export interface Slip {
  /** Game id + ply: the same slip is never found twice. */
  id: string;
  fen: string;
  /** What you played, and the best move, in SAN. */
  played: string;
  best: string;
  /** Moves that also count as right (SAN), best first. */
  ok: string[];
  /** Pawns lost by the slip. */
  drop: number;
  /** The tactic the best move had, if any (fork, pin…), for the miss map. */
  tactic?: string;
  /** Short kid-friendly line for the puzzle card. */
  text: string;
  /** Where the game came from: this app or Chess.com. */
  from: 'here' | 'chesscom';
  at: number;
}

/** Your move number from which slips count (the opening is for the opening trainer). */
export const SLIP_FROM_MOVE = 9;
/** Score drop (centipawns) that makes a slip. */
export const SLIP_DROP = 200;
/** "Kept it level": the best move's score was at least this. */
export const SLIP_LEVEL = -100;
/** A move this close to the best (centipawns) also counts as right. */
export const SLIP_OK_MARGIN = 60;
/** Puzzles made per session (CC-05: cap at 10). */
export const SLIPS_PER_SESSION = 10;

/** Standard 1 vs 1 games only (puzzles start from a FEN). */
export function slipReady(record: GameRecord): boolean {
  return record.setup.kind === 'fen' && record.setup.fen === STANDARD_FEN && record.setup.mode === 'standard' && !record.setup.party;
}

export function findSlips(record: GameRecord, player: PlayerId, from: Slip['from'], max = 3, depth = 2): Slip[] {
  if (!slipReady(record)) return [];
  const states = replay(record);
  const out: Slip[] = [];
  let mine = 0;
  for (let i = 0; i < record.actions.length && out.length < max; i++) {
    const a = record.actions[i];
    const before = states[i];
    const after = states[i + 1];
    if (a.t !== 'move' || before.turn !== player || !after) continue;
    mine++;
    if (mine < SLIP_FROM_MOVE) continue;
    const ev = evaluate(before, depth);
    if (!ev.best || sameMove(ev.best, a) || ev.score < SLIP_LEVEL || ev.score >= 2000) continue;
    const evAfter = evaluate(after, depth);
    const afterScore = after.turn === player ? evAfter.score : -evAfter.score;
    const drop = ev.score - afterScore;
    if (drop < SLIP_DROP) continue;
    // Everything about as good as the best move counts (not the move you played).
    const ranked = rankMoves(before, depth, true, 2500);
    const top = Math.max(ev.score, ...ranked.map((r) => r.score));
    const ok = ranked.filter((r) => r.score >= top - SLIP_OK_MARGIN && !sameMove(r.move, a)).map((r) => r.move);
    if (!ok.some((m) => sameMove(m, ev.best!))) ok.unshift(ev.best);
    const tactic = tacticsOfMove(before, ev.best)[0];
    const best = toSAN(before, ev.best);
    out.push({
      id: `${record.id}:${i}`,
      fen: toFEN(before),
      played: toSAN(before, a),
      best,
      ok: ok.slice(0, 6).map((m) => toSAN(before, m)),
      drop: Math.round(drop / 10) / 10,
      tactic,
      text: tactic ? `You played ${toSAN(before, a)}. There was a ${TACTIC_NAMES[tactic].word} here!` : `You played ${toSAN(before, a)}. Can you find something better?`,
      from,
      at: Date.now(),
    });
  }
  return out;
}
