import { isPromotionSquare, lateral, rankOf, fileOf, seatOf, step } from './board';
import { pieceType } from './pieces';
import type { GameState, MoveAction, Piece, PlayerId, Seat } from './types';

/**
 * Move generation, attack detection and move application for any board shape
 * and 2 to 4 seats. Mode-specific behaviour is layered on top in rules.ts.
 */

export function areEnemies(s: GameState, a: PlayerId, b: PlayerId): boolean {
  if (a === b) return false;
  if (s.seats.length === 2) return true;
  const sa = seatOf(s, a);
  const sb = seatOf(s, b);
  if (sa.team && sb.team && sa.team === sb.team) return false;
  return true;
}

export function pieceAt(s: GameState, sq: number): Piece | undefined {
  const id = s.sq[sq];
  return id >= 0 ? s.pieces[id] : undefined;
}

/** Does piece p attack square target (as a capture, ignoring whose piece is there)? */
export function pieceAttacks(s: GameState, p: Piece, target: number): boolean {
  if (p.at < 0) return false;
  const b = s.board;
  const t = pieceType(p.type);
  const df = fileOf(b, target) - fileOf(b, p.at);
  const dr = rankOf(b, target) - rankOf(b, p.at);
  for (const m of t.moves) {
    if (m.kind === 'leap') {
      for (const [x, y] of m.offsets) if (step(b, p.at, x, y) === target) return true;
    } else if (m.kind === 'ride') {
      for (const [x, y] of m.dirs) {
        if (!b.wrapFiles && Math.abs(x) <= 1 && Math.abs(y) <= 1) {
          // Fast reject when the target is not on this ray.
          if (x === 0 ? df !== 0 : Math.sign(df) !== x) continue;
          if (y === 0 ? dr !== 0 : Math.sign(dr) !== y) continue;
          if (x !== 0 && y !== 0 && Math.abs(df) !== Math.abs(dr)) continue;
        }
        let sq = p.at;
        for (let n = 1; m.max === undefined || n <= m.max; n++) {
          sq = step(b, sq, x, y);
          if (sq < 0 || sq === p.at) break;
          if (sq === target) return true;
          if (s.sq[sq] >= 0) break;
        }
      }
    } else if (m.kind === 'pawn') {
      const seat = seatOf(s, p.owner);
      const [fx, fy] = seat.forward;
      const [lx, ly] = lateral(seat);
      if (step(b, p.at, fx + lx, fy + ly) === target) return true;
      if (step(b, p.at, fx - lx, fy - ly) === target) return true;
    }
  }
  return false;
}

/** Is square attacked by any piece that is an enemy of `defender`? */
export function isAttackedBy(s: GameState, target: number, defender: PlayerId): boolean {
  const two = s.seats.length === 2;
  for (const p of s.pieces) {
    if (p.at < 0 || p.owner === defender) continue;
    if (!two && (!areEnemies(s, p.owner, defender) || seatOf(s, p.owner).status !== 'active')) continue;
    if (pieceAttacks(s, p, target)) return true;
  }
  return false;
}

export function royals(s: GameState, owner: PlayerId): Piece[] {
  return s.pieces.filter((p) => p.at >= 0 && p.owner === owner && pieceType(p.type).royal);
}

export function inCheck(s: GameState, owner: PlayerId): boolean {
  for (const p of s.pieces) {
    if (p.at >= 0 && p.owner === owner && pieceType(p.type).royal && isAttackedBy(s, p.at, owner)) return true;
  }
  return false;
}

function canLandOn(s: GameState, p: Piece, sq: number): 'empty' | 'capture' | null {
  const id = s.sq[sq];
  if (id < 0) return 'empty';
  return areEnemies(s, p.owner, s.pieces[id].owner) ? 'capture' : null;
}

function pushPawnMove(s: GameState, seat: Seat, p: Piece, to: number, out: MoveAction[]) {
  if (isPromotionSquare(s.board, seat, to)) {
    for (const promo of pieceType(p.type).promotesTo ?? ['queen']) out.push({ t: 'move', piece: p.id, to, promo });
  } else {
    out.push({ t: 'move', piece: p.id, to });
  }
}

/** Moves for one piece that obey movement rules but may leave the own king in check. */
export function pseudoMovesFor(s: GameState, p: Piece, out: MoveAction[] = []): MoveAction[] {
  if (p.at < 0) return out;
  const b = s.board;
  const t = pieceType(p.type);
  for (const m of t.moves) {
    if (m.kind === 'leap') {
      for (const [x, y] of m.offsets) {
        const to = step(b, p.at, x, y);
        if (to >= 0 && canLandOn(s, p, to)) out.push({ t: 'move', piece: p.id, to });
      }
    } else if (m.kind === 'ride') {
      for (const [x, y] of m.dirs) {
        let sq = p.at;
        for (let n = 1; m.max === undefined || n <= m.max; n++) {
          sq = step(b, sq, x, y);
          if (sq < 0 || sq === p.at) break;
          const land = canLandOn(s, p, sq);
          if (land) out.push({ t: 'move', piece: p.id, to: sq });
          if (land !== 'empty') break;
        }
      }
    } else if (m.kind === 'pawn') {
      const seat = seatOf(s, p.owner);
      const [fx, fy] = seat.forward;
      const [lx, ly] = lateral(seat);
      const one = step(b, p.at, fx, fy);
      if (one >= 0 && s.sq[one] < 0) {
        pushPawnMove(s, seat, p, one, out);
        const canDouble = m.double === 'always' || (m.double === 'first' && !p.moved);
        if (canDouble) {
          const two = step(b, one, fx, fy);
          if (two >= 0 && s.sq[two] < 0) out.push({ t: 'move', piece: p.id, to: two });
        }
      }
      for (const side of [1, -1]) {
        const to = step(b, p.at, fx + side * lx, fy + side * ly);
        if (to < 0) continue;
        if (canLandOn(s, p, to) === 'capture') pushPawnMove(s, seat, p, to, out);
        else if (s.enPassant && s.enPassant.square === to && s.sq[to] < 0) {
          const victim = pieceAt(s, s.enPassant.victim);
          if (victim && areEnemies(s, p.owner, victim.owner)) out.push({ t: 'move', piece: p.id, to });
        }
      }
    }
  }
  return out;
}

/** Castling moves for the side to move, in any seat orientation (docs/02, MODE rules may disable). */
export function castlingMoves(s: GameState, owner: PlayerId, out: MoveAction[] = []): MoveAction[] {
  const b = s.board;
  const seat = seatOf(s, owner);
  const [lx, ly] = lateral(seat);
  for (const k of royals(s, owner)) {
    if (k.moved || k.type !== 'king') continue;
    if (isAttackedBy(s, k.at, owner)) continue;
    for (const r of s.pieces) {
      if (r.at < 0 || r.owner !== owner || r.type !== 'rook' || r.moved) continue;
      // Rook must be on the king's lateral line.
      const dfr = fileOf(b, r.at) - fileOf(b, k.at);
      const drr = rankOf(b, r.at) - rankOf(b, k.at);
      const along = lx !== 0 ? dfr : drr;
      const across = lx !== 0 ? drr : dfr;
      if (across !== 0 || along === 0 || Math.abs(along) < 3) continue;
      const dir = Math.sign(along);
      const dx = lx * dir, dy = ly * dir;
      // All squares between king and rook empty.
      let ok = true;
      let sq = k.at;
      for (let n = 1; n < Math.abs(along); n++) {
        sq = step(b, sq, dx, dy);
        if (sq < 0 || s.sq[sq] >= 0) { ok = false; break; }
      }
      if (!ok) continue;
      const pass = step(b, k.at, dx, dy);
      const dest = step(b, pass, dx, dy);
      if (isAttackedBy(s, pass, owner) || isAttackedBy(s, dest, owner)) continue;
      // King side is toward the higher file (the h-file on a standard board).
      out.push({ t: 'move', piece: k.id, to: dest, castle: dir > 0 ? 'k' : 'q' });
    }
  }
  return out;
}

/**
 * Apply a move without any end-of-game bookkeeping. Fast path used by search,
 * perft and legality checks. Returns a new state; the input is never mutated.
 */
export function makeMove(s: GameState, m: MoveAction): GameState {
  const b = s.board;
  const pieces = s.pieces.slice();
  const sq = s.sq.slice();
  const p = pieces[m.piece];
  const from = p.at;
  let capture = false;
  let ep: GameState['enPassant'] = null;

  // Castling: move the rook first.
  if (m.castle !== undefined) {
    const dir = Math.sign(fileOf(b, m.to) - fileOf(b, from)) || Math.sign(rankOf(b, m.to) - rankOf(b, from));
    const seat = seatOf(s, p.owner);
    const [lx, ly] = lateral(seat);
    let rookSq = m.to;
    let rook: Piece | undefined;
    for (;;) {
      rookSq = step(b, rookSq, lx * dir, ly * dir);
      if (rookSq < 0) break;
      const id = sq[rookSq];
      if (id >= 0) { rook = pieces[id]; break; }
    }
    if (!rook) throw new Error('Castling without a rook');
    const rookTo = step(b, from, lx * dir, ly * dir);
    sq[rook.at] = -1;
    sq[rookTo] = rook.id;
    pieces[rook.id] = { ...rook, at: rookTo, moved: true };
  }

  const victimId = sq[m.to];
  if (victimId >= 0) {
    pieces[victimId] = { ...pieces[victimId], at: -1 };
    capture = true;
  } else if (p.type === 'pawn' && s.enPassant && s.enPassant.square === m.to) {
    const vid = sq[s.enPassant.victim];
    if (vid >= 0) {
      pieces[vid] = { ...pieces[vid], at: -1 };
      sq[s.enPassant.victim] = -1;
      capture = true;
    }
  }

  if (p.type === 'pawn') {
    const seat = seatOf(s, p.owner);
    const [fx, fy] = seat.forward;
    const one = step(b, from, fx, fy);
    if (one >= 0 && step(b, one, fx, fy) === m.to) ep = { square: one, victim: m.to, by: p.owner };
  }

  sq[from] = -1;
  sq[m.to] = p.id;
  pieces[p.id] = { ...p, at: m.to, moved: true, type: m.promo ?? p.type };

  return {
    ...s,
    pieces,
    sq,
    enPassant: ep,
    halfmoveClock: capture || p.type === 'pawn' ? 0 : s.halfmoveClock + 1,
    ply: s.ply + 1,
    turn: nextSeat(s, p.owner),
  };
}

export function nextSeat(s: GameState, after: PlayerId): PlayerId {
  const i = s.seats.findIndex((x) => x.id === after);
  for (let n = 1; n <= s.seats.length; n++) {
    const seat = s.seats[(i + n) % s.seats.length];
    if (seat.status === 'active') return seat.id;
  }
  return after;
}

/** All pseudo-legal moves for the side to move (including castling). */
export function pseudoMoves(s: GameState): MoveAction[] {
  const owner = s.turn;
  const pseudo: MoveAction[] = [];
  for (const p of s.pieces) if (p.at >= 0 && p.owner === owner) pseudoMovesFor(s, p, pseudo);
  castlingMoves(s, owner, pseudo);
  return pseudo;
}

/** Legal moves for the side to move under standard check rules. */
export function legalMoves(s: GameState, checkEnforced = true): MoveAction[] {
  const owner = s.turn;
  const pseudo = pseudoMoves(s);
  if (!checkEnforced) return pseudo;
  const out: MoveAction[] = [];
  for (const m of pseudo) if (!inCheck(makeMove(s, m), owner)) out.push(m);
  return out;
}
