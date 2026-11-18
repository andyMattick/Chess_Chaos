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

/* ---------------------------------------------------------------------------
 * Bonus objectives (docs/02 s5): checked once the game is over, never end it.
 * `states[i]` is the position before `actions[i]`; the last state is the end.
 * ------------------------------------------------------------------------- */
type AnyAction = { t: string; piece?: number; to?: number };

/** The mating move and the piece that made it, when the player won by checkmate. */
function matingMove(states: GameState[], actions: AnyAction[], player: PlayerId) {
  const end = states[states.length - 1];
  if (end.result?.reason !== 'checkmate' || !end.result.winners.includes(player)) return null;
  for (let i = actions.length - 1; i >= 0; i--) {
    const a = actions[i];
    if (a.t !== 'move' || a.piece === undefined) continue;
    if (states[i].turn !== player) return null;
    return { before: states[i], piece: states[i].pieces[a.piece], at: end.pieces[a.piece].at };
  }
  return null;
}

/** "Back rank" for a player: their own first row. */
const backRow = (s: GameState, p: PlayerId, sq: number) => rel(s, p, sq) === 0;

export const BONUS_CHECKS: Record<string, (states: GameState[], actions: AnyAction[], player: PlayerId) => boolean> = {
  /** MISSION-03: won, and the queen you started with is still on the board. */
  'MISSION-03': (states, _a, player) => {
    const end = states[states.length - 1];
    if (!end.result?.winners.includes(player)) return false;
    const queens = states[0].pieces.filter((p) => p.owner === player && p.at >= 0 && base(p.type) === 'queen');
    return queens.length > 0 && queens.every((q) => end.pieces[q.id].at >= 0);
  },
  /** MISSION-09: checkmate made by a knight or bishop move. */
  'MISSION-09': (states, actions, player) => {
    const m = matingMove(states, actions, player);
    return !!m && ['knight', 'bishop'].includes(base(m.piece.type));
  },
  /**
   * MISSION-20: checkmate by a rook or queen standing on the enemy's back row,
   * with the enemy king on that row and every square in front of it filled by its own pieces.
   */
  'MISSION-20': (states, actions, player) => {
    const m = matingMove(states, actions, player);
    if (!m || !['rook', 'queen'].includes(base(m.piece.type))) return false;
    const end = states[states.length - 1];
    const enemy = enemyOf(end, player);
    const king = end.pieces.find((p) => p.owner === enemy && p.type === 'king' && p.at >= 0);
    if (!king || !backRow(end, enemy, king.at) || !backRow(end, enemy, m.at)) return false;
    const [fx, fy] = seatOf(end, enemy).forward;
    const f = fileOf(end.board, king.at), r = rankOf(end.board, king.at);
    let front = 0;
    for (const df of [-1, 0, 1]) {
      const nf = f + df + fx, nr = r + fy;
      if (nf < 0 || nf >= end.board.width || nr < 0 || nr >= end.board.height) continue;
      const sq = nr * end.board.width + nf;
      if (end.board.blocked[sq]) continue;
      const id = end.sq[sq];
      if (id < 0 || end.pieces[id].owner !== enemy) return false;
      front++;
    }
    return front > 0;
  },
  /**
   * MISSION-24: one of your moves is answered by a capture that leaves you at
   * least 2 points down on balance, you are still that far down 3 of your
   * moves later (or when the game ends), and you win.
   */
  'MISSION-24': (states, actions, player) => {
    const end = states[states.length - 1];
    if (!end.result?.winners.includes(player)) return false;
    const enemy = enemyOf(end, player);
    const bal = (s: GameState) => material(s, player) - material(s, enemy);
    for (let i = 0; i + 1 < actions.length; i++) {
      if (actions[i].t !== 'move' || states[i].turn !== player) continue;
      const reply = actions[i + 1];
      if (reply.t !== 'move' || states[i + 1].turn !== enemy || reply.to === undefined) continue;
      const victim = states[i + 1].sq[reply.to];
      if (victim < 0 || states[i + 1].pieces[victim].owner !== player) continue;
      const before = bal(states[i]);
      if (bal(states[i + 2]) > before - 2) continue;
      // Three of your own moves later (or the end).
      let mine = 0, j = i + 2;
      while (j < states.length - 1 && mine < 3) { if (states[j].turn === player) mine++; j++; }
      let still = true;
      for (let k = i + 2; k <= j; k++) if (bal(states[k]) > before - 2) { still = false; break; }
      if (still) return true;
    }
    return false;
  },
};

/** Was this bonus objective done? (Only checked once the game has ended.) */
export function bonusDone(id: string, states: GameState[], actions: AnyAction[], player: PlayerId): boolean {
  const f = BONUS_CHECKS[id];
  if (!f || !states[states.length - 1].result) return false;
  try { return f(states, actions, player); } catch { return false; }
}
