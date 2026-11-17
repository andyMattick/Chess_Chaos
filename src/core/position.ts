import { pieceType } from './pieces';
import type { GameState } from './types';

/**
 * Key that identifies a position for repetition counting and opening books:
 * occupancy, side to move, castling rights (unmoved kings and rooks) and en passant.
 */
export function positionKey(s: GameState): string {
  let k = '';
  for (let i = 0; i < s.sq.length; i++) {
    const id = s.sq[i];
    if (id < 0) { k += '.'; continue; }
    const p = s.pieces[id];
    const l = pieceType(p.type).letter;
    k += p.owner === 'p1' ? l : p.owner === 'p2' ? l.toLowerCase() : `${p.owner}${l}`;
    if ((p.type === 'king' || p.type === 'rook') && !p.moved) k += '*';
  }
  k += `|${s.turn}`;
  if (s.enPassant) k += `|ep${s.enPassant.square}`;
  return k;
}

/** Short stable hash (FNV-1a) used to compare replays. */
export function hashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
