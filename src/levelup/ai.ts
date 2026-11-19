import { LU_PIECES } from '../content/levelup';
import {
  attacked, battleOdds, dist, identified, inCheck, isCentre, legalActions, level, pieceAt, play, rankOf, strikeOdds, threats, viewOf, visible,
  type LUAction, type LUPiece, type LUState, type Side,
} from './rules';

/**
 * The Level-Up bot. It plays by the same fog of war as you: it only aims at
 * enemy pieces it can see, and a piece it hasn't identified counts as worth 2.
 * It scores each action on dice odds, safety, points earned and missions,
 * then picks one: Easy picks loosely from the best few, Hard picks the best.
 */
export type LUBotLevel = 'easy' | 'normal' | 'hard';

const UNKNOWN_VALUE = 2;

function worth(p: LUPiece, known = true): number {
  return (known ? LU_PIECES[p.type].value : UNKNOWN_VALUE) * 10 + (level(p) - 1) * 6;
}

export function scoreAction(s: LUState, a: LUAction, side: Side): number {
  if (a.t === 'resign') return -1e9;
  const v = viewOf(s, side);
  const me = s.pieces[a.piece];
  const target = 'to' in a ? pieceAt(s, a.to) : undefined;
  const enemy = target && target.owner !== side ? target : undefined;
  const known = (q: LUPiece) => identified(v, side, q);
  let score = 0;
  switch (a.t) {
    case 'attack': {
      if (!enemy || !visible(s, v, side, enemy)) return -50;
      const o = battleOdds(s, me, enemy);
      score += o.win * (worth(enemy, known(enemy)) + 12) - o.crushed * worth(me) - o.bounce * 2;
      break;
    }
    case 'strike': {
      if (!enemy) return -50;
      const o = strikeOdds(me);
      if (enemy.type === 'king') return 5000 * o.win;
      score += o.win * (worth(enemy, known(enemy)) + 12) - o.crushed * worth(me);
      break;
    }
    case 'fire': {
      const q = pieceAt(s, a.to);
      // Only shoot at what you can see; they get a turn to step away, so it's a threat more than a hit.
      if (!q || q.owner === side || !visible(s, v, side, q) || q.type === 'king') return -20;
      score += 0.4 * worth(q, known(q)) + 3;
      break;
    }
    case 'revive': score += worth(s.pieces[a.fallen]) + 5; break;
    case 'mine': {
      const ahead = side === 'p1' ? rankOf(a.to) : 15 - rankOf(a.to);
      score += 2 + Math.min(6, ahead) * 0.5;
      break;
    }
    case 'castle': score += 14; break;
    case 'move': break;
  }
  // Where the piece ends up.
  if (a.t === 'move' || a.t === 'castle' || a.t === 'attack') {
    const from = me.at;
    const after = a.t === 'attack' ? a.to : a.to;
    const danger = (sq: number) => attacked(s, sq, side === 'p1' ? 'p2' : 'p1');
    if (a.t !== 'attack' && danger(from) && me.type !== 'king') score += 0.45 * worth(me);
    if (danger(after) && me.type !== 'king') score -= 0.45 * worth(me);
    if (isCentre(after) && !me.centre) score += 6;
    if (me.type === 'pawn') score += 1.5;
    // Head toward the fight, slowly.
    const towards = side === 'p1' ? rankOf(after) - rankOf(from) : rankOf(from) - rankOf(after);
    score += towards * (me.type === 'king' ? -2 : 0.6);
  }
  // Check, mate, forks: try it (assuming any battle is won) and look.
  if (a.t === 'move' || a.t === 'attack' || a.t === 'castle') {
    try {
      const ghost = { ...s, pieces: s.pieces.map((p) => ({ ...p })), sq: s.sq.slice() };
      const p = ghost.pieces[me.id];
      if (a.t === 'attack' && enemy) { ghost.pieces[enemy.id].at = -1; }
      ghost.sq[p.at] = -1; p.at = a.to; ghost.sq[a.to] = p.id;
      const hits = threats(ghost, p).map((t) => pieceAt(ghost, t)).filter((q): q is LUPiece => !!q && q.owner !== side && visible(s, v, side, q));
      if (hits.some((q) => q.type === 'king')) score += 10;
      if (hits.filter((q) => q.type === 'king' || LU_PIECES[q.type].value >= 3).length >= 2) score += 7;
    } catch { /* ignore */ }
  }
  return score;
}

/** Pick an action for `side`. `rand` is only for the bot's choice, never the game's dice. */
export function chooseAction(s: LUState, level: LUBotLevel = 'normal', rand: () => number = Math.random): LUAction | null {
  const side = s.turn;
  const moves = legalActions(s);
  if (!moves.length) return null;
  // A win on the board right now beats everything.
  const king = s.pieces.find((p) => p.type === 'king' && p.owner !== side && p.at >= 0);
  for (const a of moves) {
    if (a.t !== 'move' || !king) continue;
    const me = s.pieces[a.piece];
    if (!['queen', 'rook', 'bishop', 'knight', 'pawn'].includes(me.type)) continue;
    // Only moves that would check are worth trying out in full.
    const ghost = { ...s, pieces: s.pieces.map((p) => ({ ...p })), sq: s.sq.slice() };
    const g = ghost.pieces[me.id];
    ghost.sq[g.at] = -1; g.at = a.to; ghost.sq[a.to] = g.id;
    if (!threats(ghost, g).includes(king.at)) continue;
    if (play(s, a).result?.winner === side) return a;
  }
  const scored = moves.map((a) => ({ a, v: scoreAction(s, a, side) + rand() * (level === 'hard' ? 1 : level === 'normal' ? 3 : 8) }));
  scored.sort((x, y) => y.v - x.v);
  const pool = level === 'hard' ? 1 : level === 'normal' ? 2 : 5;
  return scored[Math.floor(rand() * Math.min(pool, scored.length))].a;
}

/** For tests and the screen: is this side in danger right now? */
export const inDanger = (s: LUState, side: Side) => inCheck(s, side);
export { dist };
