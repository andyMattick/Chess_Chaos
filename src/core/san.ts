import { fileOf, rankOf, squareName } from './board';
import { inCheck, makeMove } from './movegen';
import { pieceType } from './pieces';
import { legalActions } from './rules';
import type { GameState, MoveAction } from './types';

/** Standard algebraic notation for a legal move in state s. */
export function toSAN(s: GameState, m: MoveAction, legal: MoveAction[] = legalActions(s)): string {
  const b = s.board;
  const p = s.pieces[m.piece];
  let san: string;
  if (m.castle) {
    san = m.castle === 'k' ? 'O-O' : 'O-O-O';
  } else {
    const isCapture = s.sq[m.to] >= 0 || (p.type === 'pawn' && s.enPassant?.square === m.to);
    const dest = squareName(b, m.to);
    if (p.type === 'pawn') {
      san = (isCapture ? `${squareName(b, p.at)[0]}x` : '') + dest;
      if (m.promo) san += `=${pieceType(m.promo).letter}`;
    } else {
      const rivals = legal.filter((o) => o.to === m.to && o.piece !== m.piece && !o.castle && s.pieces[o.piece].type === p.type);
      let dis = '';
      if (rivals.length) {
        const sameFile = rivals.some((o) => fileOf(b, s.pieces[o.piece].at) === fileOf(b, p.at));
        const sameRank = rivals.some((o) => rankOf(b, s.pieces[o.piece].at) === rankOf(b, p.at));
        const from = squareName(b, p.at);
        if (!sameFile) dis = from[0];
        else if (!sameRank) dis = from.slice(1);
        else dis = from;
      }
      san = pieceType(p.type).letter + dis + (isCapture ? 'x' : '') + dest;
    }
  }
  const after = makeMove(s, m);
  if (inCheck(after, after.turn)) {
    san += legalActions({ ...after, result: null }).length === 0 ? '#' : '+';
  }
  return san;
}

const clean = (san: string) => san.replace(/[+#!?]/g, '').replace(/0/g, 'O').replace('=', '').trim();

/** Find the legal move matching a SAN string, or undefined. */
export function parseSAN(s: GameState, san: string): MoveAction | undefined {
  const legal = legalActions(s);
  const want = clean(san);
  return legal.find((m) => clean(toSAN(s, m, legal)) === want);
}

export function moveFromUCI(s: GameState, uci: string): MoveAction | undefined {
  const legal = legalActions(s);
  return legal.find((m) => {
    const p = s.pieces[m.piece];
    const u = squareName(s.board, p.at) + squareName(s.board, m.to) + (m.promo ? pieceType(m.promo).letter.toLowerCase() : '');
    return u === uci;
  });
}

