import { fileOf, rankOf, seatOf } from '../core/board';
import { pieceType } from '../core/pieces';
import { areEnemies } from '../core/movegen';
import type { GameState, Piece, PlayerId } from '../core/types';
import { hillSquares } from '../core/modes';

/**
 * Static evaluation in centipawns from `pov`'s point of view.
 * Positional terms are computed from board geometry instead of fixed tables,
 * so they work on any board size (8x8, 5x5, the four-player board).
 */
export function evaluate(s: GameState, pov: PlayerId): number {
  const b = s.board;
  const cx = (b.width - 1) / 2;
  const cy = (b.height - 1) / 2;
  let nonPawnMaterial = 0;
  for (const p of s.pieces) if (p.at >= 0 && p.type !== 'pawn' && p.type !== 'king') nonPawnMaterial += pieceType(p.type).value;
  // 0 = opening, 1 = bare endgame.
  const endgame = Math.max(0, Math.min(1, 1 - (nonPawnMaterial - 10) / 52));

  let score = 0;
  // Three/four player games: being knocked out is the worst thing; knocking others out is great.
  if (s.seats.length > 2) {
    for (const seat of s.seats) {
      if (seat.status !== 'eliminated') continue;
      if (seat.id === pov) return -50000;
      score += areEnemies(s, pov, seat.id) ? 2500 : -2500;
    }
  }
  const out = new Set(s.seats.filter((x) => x.status === 'eliminated').map((x) => x.id));
  const bishops: Record<string, number> = {};
  for (const p of s.pieces) {
    if (p.at < 0 || out.has(p.owner)) continue;
    const v = pieceTerm(s, p, cx, cy, endgame);
    if (p.type === 'bishop') bishops[p.owner] = (bishops[p.owner] ?? 0) + 1;
    score += p.owner === pov ? v : areEnemies(s, pov, p.owner) ? -v : v * 0.5;
  }
  for (const [owner, n] of Object.entries(bishops)) {
    if (n >= 2) score += owner === pov ? 30 : -30;
  }
  score += hillTerm(s, pov);
  return Math.round(score);
}

function pieceTerm(s: GameState, p: Piece, cx: number, cy: number, endgame: number): number {
  const b = s.board;
  const t = pieceType(p.type);
  const f = fileOf(b, p.at);
  const r = rankOf(b, p.at);
  const centre = Math.abs(f - cx) + Math.abs(r - cy); // 1 (centre) .. 7 (corner) on 8x8
  const seat = seatOf(s, p.owner);
  const [fx, fy] = seat.forward;
  // Distance travelled forward from the seat's own edge.
  const advance = fy > 0 ? r : fy < 0 ? b.height - 1 - r : fx > 0 ? f : b.width - 1 - f;

  let v = t.value * 100;
  switch (p.type) {
    case 'pawn': {
      v += advance * advance * 2.5 * (0.5 + endgame);
      const lateralCentre = fy !== 0 ? Math.abs(f - cx) : Math.abs(r - cy);
      if (lateralCentre < 1 && advance >= 3) v += 18;
      break;
    }
    case 'knight':
      v += 28 - centre * 7;
      if (advance === 0) v -= 10;
      break;
    case 'bishop':
      v += 16 - centre * 3.5;
      if (advance === 0) v -= 10;
      break;
    case 'rook':
      if (advance === b.height - 2 || advance === b.width - 2) v += 20;
      v += openLineBonus(s, p);
      break;
    case 'queen':
      v += 6 - centre * 1.5;
      if (s.ply < 14 && advance > 1) v -= 15; // do not bring the queen out too early
      break;
    case 'king': {
      // Opening: stay home and tucked in. Endgame: walk to the centre.
      const home = -advance * 22 - (centre < 3 ? 25 : 0) + (p.moved && advance === 0 && centre > 4 ? 25 : 0);
      const active = 30 - centre * 9;
      v += home * (1 - endgame) + active * endgame;
      break;
    }
    default:
      v += 10 - centre * 2;
  }
  return v;
}

function openLineBonus(s: GameState, p: Piece): number {
  const b = s.board;
  const f = fileOf(b, p.at);
  let own = false;
  let enemy = false;
  for (let r = 0; r < b.height; r++) {
    const id = s.sq[r * b.width + f];
    if (id < 0) continue;
    const q = s.pieces[id];
    if (q.type !== 'pawn') continue;
    if (q.owner === p.owner) own = true; else enemy = true;
  }
  return own ? 0 : enemy ? 10 : 22;
}

/** King of the hill and Hill wars: sitting on (and racing a king to) the middle matters. */
function hillTerm(s: GameState, pov: PlayerId): number {
  const koth = s.mode === 'koth';
  if (!koth && s.mode !== 'hill-wars' && s.mode !== 'battle-hill') return 0;
  const hill = hillSquares(s);
  const b = s.board;
  let score = 0;
  for (const p of s.pieces) {
    if (p.at < 0) continue;
    const sign = p.owner === pov ? 1 : areEnemies(s, pov, p.owner) ? -1 : 0.5;
    if (hill.has(p.at)) {
      if (koth && p.type === 'king') return sign > 0 ? 90000 : -90000;
      score += sign * (p.type === 'king' ? 70 : 40);
    } else if (koth && p.type === 'king') {
      let d = 99;
      for (const h of hill) d = Math.min(d, Math.max(Math.abs(fileOf(b, h) - fileOf(b, p.at)), Math.abs(rankOf(b, h) - rankOf(b, p.at))));
      score += sign * (60 - d * 15);
    }
  }
  return score;
}
