import { fileOf, rankOf, seatOf } from '../core/board';
import { baseType, pieceType } from '../core/pieces';
import { inCheck, makeMove } from '../core/movegen';
import type { GameState, MoveAction, PlayerId } from '../core/types';
import { attackersOf, defendersOf } from '../tactics/attacks';
import { isDiscovered, isFork, isPin, isSkewer } from '../tactics/detectors';

/**
 * Secret-mission detectors (docs/03 Secret missions), checked by the referee
 * right after the mission owner's own move. Simplified where the catalog asks
 * for "wins material within 2 moves": the tactic itself is enough (doc 08 log).
 */
export interface MissionCtx {
  /** states[i] is the position before actions[i]; the last state is after the latest move. */
  states: GameState[];
  /** Index of the move just played by `player`. */
  ply: number;
  move: MoveAction;
  player: PlayerId;
  /** How many moves the player has made, including this one. */
  movesMade: number;
}

const rel = (s: GameState, p: PlayerId, sq: number) => {
  const f = seatOf(s, p).forward;
  return f[1] > 0 ? rankOf(s.board, sq) : f[1] < 0 ? s.board.height - 1 - rankOf(s.board, sq) : f[0] > 0 ? fileOf(s.board, sq) : s.board.width - 1 - fileOf(s.board, sq);
};
const base = (t: string) => baseType(t);
const live = (s: GameState, owner: PlayerId, type: string) => s.pieces.filter((p) => p.at >= 0 && p.owner === owner && base(p.type) === type);
const enemyOf = (s: GameState, p: PlayerId) => s.seats.find((x) => x.id !== p)!.id;
const material = (s: GameState, p: PlayerId) => s.pieces.filter((x) => x.at >= 0 && x.owner === p && x.type !== 'king').reduce((a, x) => a + Math.floor(pieceType(base(x.type)).value), 0);

export const MISSION_CHECKS: Record<string, (c: MissionCtx) => boolean> = {
  'MISSION-04': ({ move }) => !!move.promo,
  'MISSION-05': ({ states, ply, move }) => isFork(states[ply], move),
  'MISSION-06': ({ states, ply, move }) => isPin(states[ply], move),
  'MISSION-07': ({ states, ply, player }) => {
    // A rook on the enemy pawn row now, that was also there after my previous move (it survived a reply).
    const now = states[ply + 1];
    const before = states[ply - 1];
    if (!before) return false;
    const target = now.board.height - 2;
    return live(now, player, 'rook').some((r) => rel(now, player, r.at) === target && before.pieces[r.id]?.at === r.at);
  },
  'MISSION-10': ({ states, ply, player }) => {
    const s = states[ply + 1];
    if (s.board.width !== 8) return false;
    const centre = [27, 28, 35, 36];
    const occupied = centre.filter((sq) => s.sq[sq] >= 0 && s.pieces[s.sq[sq]].owner === player).length;
    const controlled = centre.every((sq) => (s.sq[sq] >= 0 && s.pieces[s.sq[sq]].owner === player) || attackersOf(s, sq, enemyOf(s, player)).some((p) => p.owner === player));
    return occupied >= 2 && controlled;
  },
  'MISSION-11': ({ states, ply, player }) => {
    const now = states[ply + 1];
    const earlier = states[Math.max(0, ply - 3)];
    const queens = (s: GameState) => s.pieces.filter((p) => p.at >= 0 && base(p.type) === 'queen').length;
    return queens(now) === 0 && queens(earlier) >= 2 && material(now, player) - material(now, enemyOf(now, player)) >= 2;
  },
  'MISSION-12': ({ states, player, ply }) => {
    let checks = 0;
    for (let i = 0; i <= ply; i++) {
      if (states[i].turn !== player) continue;
      const after = states[i + 1];
      if (after && inCheck(after, enemyOf(after, player))) checks++;
    }
    return checks >= 3;
  },
  'MISSION-14': ({ states, ply, move }) => isDiscovered(states[ply], move),
  'MISSION-15': ({ states, ply, move }) => isSkewer(states[ply], move),
  'MISSION-16': ({ states, ply, move }) => {
    const s = states[ply];
    return base(s.pieces[move.piece].type) === 'pawn' && s.enPassant?.square === move.to && s.sq[move.to] < 0;
  },
  'MISSION-17': ({ states, ply, player }) => {
    const s = states[ply + 1];
    const enemy = live(s, enemyOf(s, player), 'pawn');
    return live(s, player, 'pawn').some((p) => {
      if (rel(s, player, p.at) < 4) return false;
      const f = fileOf(s.board, p.at);
      return !enemy.some((e) => Math.abs(fileOf(s.board, e.at) - f) <= 1 && rel(s, player, e.at) > rel(s, player, p.at));
    });
  },
  'MISSION-18': ({ states, ply, player }) => {
    const doubled = (s: GameState) => {
      const files = live(s, enemyOf(s, player), 'pawn').map((p) => fileOf(s.board, p.at));
      return new Set(files.filter((f, i) => files.indexOf(f) !== i));
    };
    const before = states[Math.max(0, ply - 1)];
    const now = states[ply + 1];
    const was = doubled(before);
    return [...doubled(now)].some((f) => !was.has(f));
  },
  'MISSION-19': ({ states, ply, player, movesMade }) => movesMade >= 20 && live(states[ply + 1], player, 'bishop').length >= 2,
  'MISSION-21': ({ states, ply, player }) => {
    const s = states[ply + 1];
    const enemyPawns = live(s, enemyOf(s, player), 'pawn');
    return live(s, player, 'knight').some((n) => {
      const r = rel(s, player, n.at);
      if (r !== 4 && r !== 5) return false;
      const guarded = defendersOf(s, n.at, player).some((d) => base(d.type) === 'pawn');
      const f = fileOf(s.board, n.at);
      const chasable = enemyPawns.some((e) => Math.abs(fileOf(s.board, e.at) - f) === 1 && rel(s, player, e.at) > r);
      return guarded && !chasable;
    });
  },
  'MISSION-23': ({ states, ply, player }) => {
    const s = states[ply + 1];
    const rooks = live(s, player, 'rook');
    if (rooks.length < 2) return false;
    const f = fileOf(s.board, rooks[0].at);
    if (rooks.some((r) => fileOf(s.board, r.at) !== f)) return false;
    return !s.pieces.some((p) => p.at >= 0 && base(p.type) === 'pawn' && fileOf(s.board, p.at) === f);
  },
};

export function missionDone(id: string, c: MissionCtx): boolean {
  const f = MISSION_CHECKS[id];
  try {
    return !!f && f(c);
  } catch {
    return false;
  }
}

export { makeMove };
