import { step } from '../core/board';
import { areEnemies, inCheck, makeMove, pieceAttacks } from '../core/movegen';
import { pieceType } from '../core/pieces';
import { legalActions } from '../core/rules';
import type { GameState, MoveAction, Piece } from '../core/types';
import { attackersOf, captureGain, defendersOf, see, value } from './attacks';

/**
 * Tactic detectors (docs/04 section 5). Each takes the position before a move
 * and the move, and says whether that move creates the tactic. Shared by the
 * "name the idea" alert, the miss map, badges, missions and card earn rules.
 */

export type TacticId = 'mate' | 'fork' | 'pin' | 'skewer' | 'discovered' | 'free-piece';

export const TACTIC_NAMES: Record<TacticId | 'hanging' | 'threat', { word: string; explain: string }> = {
  mate: { word: 'CHECKMATE', explain: 'The king is attacked and has no way out.' },
  fork: { word: 'FORK', explain: 'One piece attacks two things at once.' },
  pin: { word: 'PIN', explain: 'A piece cannot move without exposing its king.' },
  skewer: { word: 'SKEWER', explain: 'Attack a big piece; when it moves, take the one behind it.' },
  discovered: { word: 'SNEAK ATTACK', explain: 'Move one piece out of the way so another one attacks.' },
  'free-piece': { word: 'FREE PIECE', explain: 'Something you can take without losing anything back.' },
  hanging: { word: 'LEFT HANGING', explain: 'A piece that can be taken for free.' },
  threat: { word: 'THREAT', explain: 'What the other side is trying to do next.' },
};

function isSlider(p: Piece) {
  return pieceType(p.type).moves.some((m) => m.kind === 'ride');
}

/** Pieces reached along each ride direction of a slider: [first, second] per direction. */
function lines(s: GameState, p: Piece): { first: Piece; second?: Piece }[] {
  const out: { first: Piece; second?: Piece }[] = [];
  for (const m of pieceType(p.type).moves) {
    if (m.kind !== 'ride') continue;
    for (const [x, y] of m.dirs) {
      let sq = p.at;
      let first: Piece | undefined;
      for (let n = 1; n <= (m.max ?? 99); n++) {
        sq = step(s.board, sq, x, y);
        if (sq < 0 || sq === p.at) break;
        const id = s.sq[sq];
        if (id < 0) continue;
        if (!first) { first = s.pieces[id]; continue; }
        out.push({ first, second: s.pieces[id] });
        first = undefined;
        break;
      }
      if (first) out.push({ first });
    }
  }
  return out;
}

/** Is the moved piece safe on its new square (not losing more than it just won)? */
function moverIsSafe(after: GameState, m: MoveAction, gained: number): boolean {
  return see(after, m.to) <= gained;
}

export function isMate(s: GameState, m: MoveAction): boolean {
  const after = makeMove(s, m);
  return inCheck(after, after.turn) && legalActions(after).length === 0;
}

/** Wins at least 2 points of material outright, or takes an undefended piece. */
export function isFreePiece(s: GameState, m: MoveAction): boolean {
  const v = s.sq[m.to];
  if (v < 0) return false;
  const victim = s.pieces[v];
  if (victim.type === 'king') return false;
  const gain = captureGain(s, m);
  return gain >= 2 || (gain >= 1 && defendersOf(s, m.to, victim.owner).length === 0);
}

/** After the move, the moved piece attacks two or more enemy pieces that are each the king, worth more than it, or undefended. */
export function isFork(s: GameState, m: MoveAction): boolean {
  const after = makeMove(s, m);
  const mover = after.pieces[m.piece];
  const gained = s.sq[m.to] >= 0 ? value(s.pieces[s.sq[m.to]].type) : 0;
  if (!moverIsSafe(after, m, gained) && !inCheck(after, after.turn)) return false;
  if (!inCheck(after, after.turn) && see(after, m.to) > 0) return false;
  let targets = 0;
  for (const t of after.pieces) {
    if (t.at < 0 || !areEnemies(after, mover.owner, t.owner)) continue;
    if (!pieceAttacks(after, mover, t.at)) continue;
    if (t.type === 'king' || value(t.type) > value(mover.type) + 0.5 || defendersOf(after, t.at, t.owner).length === 0) targets++;
  }
  return targets >= 2;
}

function pinsBy(s: GameState, owner: string): Set<string> {
  const out = new Set<string>();
  for (const p of s.pieces) {
    if (p.at < 0 || p.owner !== owner || !isSlider(p)) continue;
    for (const { first, second } of lines(s, p)) {
      if (!second) continue;
      if (areEnemies(s, owner as never, first.owner) && first.owner === second.owner && second.type === 'king' && first.type !== 'king') out.add(`${p.id}>${first.id}`);
    }
  }
  return out;
}

/** The move creates a new pin of an enemy piece to its king. */
export function isPin(s: GameState, m: MoveAction): boolean {
  const owner = s.pieces[m.piece].owner;
  const after = makeMove(s, m);
  if (see(after, m.to) > 0) return false;
  const before = pinsBy(s, owner);
  for (const k of pinsBy(after, owner)) if (!before.has(k)) return true;
  return false;
}

/** The moved slider attacks a big piece (king, queen or rook) with a smaller enemy piece behind it on the same line. */
export function isSkewer(s: GameState, m: MoveAction): boolean {
  const after = makeMove(s, m);
  const mover = after.pieces[m.piece];
  if (!isSlider(mover)) return false;
  if (see(after, m.to) > 0 && !inCheck(after, after.turn)) return false;
  for (const { first, second } of lines(after, mover)) {
    if (!second || !areEnemies(after, mover.owner, first.owner) || first.owner !== second.owner) continue;
    if (value(first.type) >= 5 && value(second.type) < value(first.type) && value(second.type) >= 3) return true;
  }
  return false;
}

/**
 * Does this piece still make a skewer threat? Either the skewer line still
 * stands, or (after the big piece stepped aside) it attacks a piece it wins:
 * one worth more than itself, or one nobody defends. Blocking the line,
 * capturing the piece or defending the one behind all end it.
 */
export function skewerStands(s: GameState, id: number): boolean {
  const p = s.pieces[id];
  if (!p || p.at < 0 || !isSlider(p)) return false;
  for (const { first, second } of lines(s, p)) {
    if (!areEnemies(s, p.owner, first.owner)) continue;
    if (second && first.owner === second.owner && value(first.type) >= 5 && value(second.type) < value(first.type) && value(second.type) >= 3) return true;
    if (first.type === 'king' || value(first.type) < 3) continue;
    if (value(first.type) > value(p.type) || defendersOf(s, first.at, first.owner).length === 0) return true;
  }
  return false;
}

/** Moving this piece opens a line so another piece of ours newly attacks the king or a piece worth 3+. */
export function isDiscovered(s: GameState, m: MoveAction): boolean {
  const owner = s.pieces[m.piece].owner;
  const after = makeMove(s, m);
  for (const p of after.pieces) {
    if (p.at < 0 || p.owner !== owner || p.id === m.piece || !isSlider(p)) continue;
    for (const t of after.pieces) {
      if (t.at < 0 || !areEnemies(after, owner, t.owner)) continue;
      if (t.type !== 'king' && value(t.type) < 3) continue;
      if (pieceAttacks(after, p, t.at) && !pieceAttacks(s, p, t.at)) {
        // Real threat: either check, or the target is worth more than the attacker or undefended.
        if (t.type === 'king' || value(t.type) > value(p.type) || attackersOf(after, t.at, t.owner).length > defendersOf(after, t.at, t.owner).length) return true;
      }
    }
  }
  return false;
}

/** Every tactic this move creates, most important first. */
export function tacticsOfMove(s: GameState, m: MoveAction): TacticId[] {
  const out: TacticId[] = [];
  if (isMate(s, m)) return ['mate'];
  if (isFork(s, m)) out.push('fork');
  if (isSkewer(s, m)) out.push('skewer');
  if (isPin(s, m)) out.push('pin');
  if (isDiscovered(s, m)) out.push('discovered');
  if (isFreePiece(s, m)) out.push('free-piece');
  return out;
}

export interface AvailableTactic { id: TacticId; move: MoveAction }

/** Tactics the side to move could play right now. */
export function availableTactics(s: GameState): AvailableTactic[] {
  const out: AvailableTactic[] = [];
  for (const m of legalActions(s)) for (const id of tacticsOfMove(s, m)) out.push({ id, move: m });
  const order: TacticId[] = ['mate', 'fork', 'skewer', 'pin', 'discovered', 'free-piece'];
  return out.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
