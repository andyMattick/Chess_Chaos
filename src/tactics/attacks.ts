import { seatOf } from '../core/board';
import { areEnemies, inCheck, makeMove, pieceAttacks } from '../core/movegen';
import { pieceType } from '../core/pieces';
import type { GameState, MoveAction, Piece, PlayerId } from '../core/types';

/**
 * Attack maps and static exchange evaluation. Shared by alerts, missions,
 * card earn conditions, badges, the miss map and post-game review (docs/04 s5).
 * Values are in pawns; the king counts as 100 so it is never "traded".
 */

export function value(type: string): number {
  return type === 'king' ? 100 : pieceType(type).value;
}

/** Live pieces that attack `sq` and belong to an enemy of `defender`. */
export function attackersOf(s: GameState, sq: number, defender: PlayerId): Piece[] {
  return s.pieces.filter((p) => p.at >= 0 && areEnemies(s, p.owner, defender) && seatOf(s, p.owner).status === 'active' && pieceAttacks(s, p, sq));
}

/** Live pieces of `owner` (or their team) that defend `sq`. */
export function defendersOf(s: GameState, sq: number, owner: PlayerId): Piece[] {
  return s.pieces.filter((p) => p.at >= 0 && p.at !== sq && !areEnemies(s, p.owner, owner) && pieceAttacks(s, p, sq));
}

/** Number of enemy attackers on every square, from `defender`'s point of view. */
export function dangerMap(s: GameState, defender: PlayerId): number[] {
  const out = new Array(s.sq.length).fill(0);
  for (const p of s.pieces) {
    if (p.at < 0 || !areEnemies(s, p.owner, defender)) continue;
    for (let sq = 0; sq < s.sq.length; sq++) if (!s.board.blocked[sq] && pieceAttacks(s, p, sq)) out[sq]++;
  }
  return out;
}

/**
 * Static exchange evaluation: material the attackers of `sq` win (in pawns)
 * if they start capturing the piece on it, both sides always recapturing with
 * their least valuable piece and stopping when it stops paying. Never negative.
 */
export function see(s: GameState, sq: number): number {
  const victimId = s.sq[sq];
  if (victimId < 0) return 0;
  const victim = s.pieces[victimId];
  // Scratch board so x-ray attackers appear as pieces leave.
  const scratch: GameState = { ...s, sq: s.sq.slice(), pieces: s.pieces.slice() };
  const used = new Set<number>([victimId]);
  const gain: number[] = [];
  let onSquare = value(victim.type);
  let side: 'att' | 'def' = 'att';
  const pick = (who: 'att' | 'def') => {
    let best: Piece | undefined;
    for (const p of scratch.pieces) {
      if (p.at < 0 || used.has(p.id)) continue;
      const enemy = areEnemies(scratch, p.owner, victim.owner);
      if ((who === 'att') !== enemy) continue;
      if (!pieceAttacks(scratch, p, sq)) continue;
      if (!best || value(p.type) < value(best.type)) best = p;
    }
    return best;
  };
  let d = 0;
  gain[0] = 0;
  for (;;) {
    const a = pick(side);
    if (!a) break;
    gain[d + 1] = onSquare - gain[d];
    d++;
    used.add(a.id);
    scratch.sq[a.at] = -1;
    onSquare = value(a.type);
    side = side === 'att' ? 'def' : 'att';
    if (Math.max(-gain[d - 1], gain[d]) < 0) break;
  }
  while (--d > 0) gain[d] = -Math.max(-gain[d], gain[d + 1]);
  return Math.max(0, gain[1] ?? 0);
}

export interface Hanging {
  piece: Piece;
  /** Material lost (pawns) if the opponent captures now. */
  loss: number;
}

/** Pieces of `owner` that lose material to a capture right now. */
export function hanging(s: GameState, owner: PlayerId, minLoss = 1): Hanging[] {
  const out: Hanging[] = [];
  for (const p of s.pieces) {
    if (p.at < 0 || p.owner !== owner || p.type === 'king') continue;
    if (!attackersOf(s, p.at, owner).length) continue;
    const loss = see(s, p.at);
    if (loss >= minLoss) out.push({ piece: p, loss });
  }
  return out.sort((a, b) => b.loss - a.loss);
}

/** Material the mover nets with this capture once the opponent recaptures (0 for quiet moves). */
export function captureGain(s: GameState, m: MoveAction): number {
  const v = s.sq[m.to];
  const victimValue = v >= 0 ? value(s.pieces[v].type) : s.enPassant?.square === m.to && s.pieces[m.piece].type === 'pawn' ? 1 : 0;
  const promo = m.promo ? value(m.promo) - 1 : 0;
  const after = makeMove(s, m);
  return victimValue + promo - see(after, m.to);
}

/** Squares and pieces the last move started threatening (for "What does that move want?"). */
export interface Threat {
  kind: 'check' | 'attack';
  /** Square of the threatened piece. */
  square: number;
  loss: number;
}

export function newThreats(before: GameState, after: GameState, defender: PlayerId): Threat[] {
  const out: Threat[] = [];
  for (const p of after.pieces) {
    if (p.at >= 0 && p.owner === defender && p.type === 'king' && inCheck(after, defender)) out.push({ kind: 'check', square: p.at, loss: 100 });
  }
  const was = new Map(hanging(before, defender, 2).map((h) => [h.piece.id, h.loss]));
  for (const h of hanging(after, defender, 2)) {
    if ((was.get(h.piece.id) ?? 0) < h.loss) out.push({ kind: 'attack', square: h.piece.at, loss: h.loss });
  }
  return out;
}
