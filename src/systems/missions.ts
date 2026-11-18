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

/* Positions that make a mission true. Used to spot it and, once it is shown, to see whether it still stands. */
const rookRaid = (s: GameState, player: PlayerId) => live(s, player, 'rook').filter((r) => rel(s, player, r.at) === s.board.height - 2);
const CENTRE = [27, 28, 35, 36];
const ownsCentre = (s: GameState, player: PlayerId) => {
  if (s.board.width !== 8 || s.board.height !== 8) return false;
  const occupied = CENTRE.filter((sq) => s.sq[sq] >= 0 && s.pieces[s.sq[sq]].owner === player).length;
  const controlled = CENTRE.every((sq) => (s.sq[sq] >= 0 && s.pieces[s.sq[sq]].owner === player) || attackersOf(s, sq, enemyOf(s, player)).some((p) => p.owner === player));
  return occupied >= 2 && controlled;
};
const lead = (s: GameState, player: PlayerId) => material(s, player) - material(s, enemyOf(s, player));
const passedPawns = (s: GameState, player: PlayerId) => {
  const enemy = live(s, enemyOf(s, player), 'pawn');
  return live(s, player, 'pawn').filter((p) => {
    if (rel(s, player, p.at) < 4) return false;
    const f = fileOf(s.board, p.at);
    return !enemy.some((e) => Math.abs(fileOf(s.board, e.at) - f) <= 1 && rel(s, player, e.at) > rel(s, player, p.at));
  });
};
const doubledFiles = (s: GameState, player: PlayerId) => {
  const files = live(s, enemyOf(s, player), 'pawn').map((p) => fileOf(s.board, p.at));
  return new Set(files.filter((f, i) => files.indexOf(f) !== i));
};
const outposts = (s: GameState, player: PlayerId) => {
  const enemyPawns = live(s, enemyOf(s, player), 'pawn');
  return live(s, player, 'knight').filter((n) => {
    const r = rel(s, player, n.at);
    if (r !== 4 && r !== 5) return false;
    const guarded = defendersOf(s, n.at, player).some((d) => base(d.type) === 'pawn');
    const f = fileOf(s.board, n.at);
    const chasable = enemyPawns.some((e) => Math.abs(fileOf(s.board, e.at) - f) === 1 && rel(s, player, e.at) > r);
    return guarded && !chasable;
  });
};
const rookTower = (s: GameState, player: PlayerId) => {
  const rooks = live(s, player, 'rook');
  if (rooks.length < 2) return false;
  const f = fileOf(s.board, rooks[0].at);
  if (rooks.some((r) => fileOf(s.board, r.at) !== f)) return false;
  return !s.pieces.some((p) => p.at >= 0 && base(p.type) === 'pawn' && fileOf(s.board, p.at) === f);
};

export const MISSION_CHECKS: Record<string, (c: MissionCtx) => boolean> = {
  'MISSION-04': ({ move }) => !!move.promo,
  'MISSION-05': ({ states, ply, move }) => isFork(states[ply], move),
  'MISSION-06': ({ states, ply, move }) => isPin(states[ply], move),
  'MISSION-07': ({ states, ply, player }) => {
    // A rook on the enemy pawn row now, that was also there after my previous move (it survived a reply).
    const before = states[ply - 1];
    if (!before) return false;
    return rookRaid(states[ply + 1], player).some((r) => before.pieces[r.id]?.at === r.at);
  },
  'MISSION-10': ({ states, ply, player }) => ownsCentre(states[ply + 1], player),
  'MISSION-11': ({ states, ply, player }) => {
    const now = states[ply + 1];
    const earlier = states[Math.max(0, ply - 3)];
    const queens = (s: GameState) => s.pieces.filter((p) => p.at >= 0 && base(p.type) === 'queen').length;
    return queens(now) === 0 && queens(earlier) >= 2 && lead(now, player) >= 2;
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
  'MISSION-17': ({ states, ply, player }) => passedPawns(states[ply + 1], player).length > 0,
  'MISSION-18': ({ states, ply, player }) => {
    const was = doubledFiles(states[Math.max(0, ply - 1)], player);
    return [...doubledFiles(states[ply + 1], player)].some((f) => !was.has(f));
  },
  'MISSION-19': ({ states, ply, player, movesMade }) => movesMade >= 20 && live(states[ply + 1], player, 'bishop').length >= 2,
  'MISSION-21': ({ states, ply, player }) => outposts(states[ply + 1], player).length > 0,
  'MISSION-23': ({ states, ply, player }) => rookTower(states[ply + 1], player),
};

/**
 * What to remember when a mission is shown: the pieces that did it (to be
 * captured), or for Pawn pile-up the new doubled files.
 */
export function missionTarget(id: string, c: MissionCtx): number[] {
  const now = c.states[c.ply + 1];
  if (id === 'MISSION-18') {
    const was = doubledFiles(c.states[Math.max(0, c.ply - 1)], c.player);
    return [...doubledFiles(now, c.player)].filter((f) => !was.has(f));
  }
  if (id === 'MISSION-07') return rookRaid(now, c.player).map((r) => r.id);
  if (id === 'MISSION-17') return passedPawns(now, c.player).map((p) => p.id);
  if (id === 'MISSION-21') return outposts(now, c.player).map((p) => p.id);
  return [c.move.piece];
}

/**
 * Does a shown mission still stand? 'piece' missions stand while a piece that
 * did it is still on the board; 'board' missions while the position still makes it true.
 */
export const MISSION_HOLDS: Record<string, (s: GameState, player: PlayerId, target: number[]) => boolean> = {
  'MISSION-07': (s, p) => rookRaid(s, p).length > 0,
  'MISSION-10': ownsCentre,
  'MISSION-11': (s, p) => lead(s, p) >= 2,
  'MISSION-17': (s, p) => passedPawns(s, p).length > 0,
  'MISSION-18': (s, p, files) => files.some((f) => doubledFiles(s, p).has(f)),
  'MISSION-19': (s, p) => live(s, p, 'bishop').length >= 2,
  'MISSION-21': (s, p) => outposts(s, p).length > 0,
  'MISSION-23': rookTower,
};

export function missionHolds(id: string, s: GameState, player: PlayerId, target: number[]): boolean {
  const f = MISSION_HOLDS[id];
  try {
    if (f) return f(s, player, target);
    return target.some((t) => s.pieces[t] && s.pieces[t].at >= 0 && s.pieces[t].owner === player);
  } catch {
    return true;
  }
}

export function missionDone(id: string, c: MissionCtx): boolean {
  const f = MISSION_CHECKS[id];
  try {
    return !!f && f(c);
  } catch {
    return false;
  }
}

export { makeMove };
