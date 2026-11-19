import type { BoardShape, GameState, Seat, Vec } from './types';

export function rectBoard(width: number, height: number): BoardShape {
  return { width, height, wrapFiles: false, blocked: new Array(width * height).fill(false) };
}

export const fileOf = (b: BoardShape, sq: number) => sq % b.width;
export const rankOf = (b: BoardShape, sq: number) => Math.floor(sq / b.width);
export const square = (b: BoardShape, f: number, r: number) => r * b.width + f;

/* ---------------------------------------------------------------------------
 * The three-player hexagon (owner, 2026-11-18). Each seat owns a half-board of
 * 8 files x 4 ranks; its left half (files a-d) meets the seat before it and its
 * right half (files e-h) the seat after it, like two halves of a normal board:
 * file f meets file 7-f, and "forward" becomes "back toward their own row".
 * The six middle squares (d4 and e4 of each seat) touch at one point; a
 * diagonal through that point comes out of the square opposite.
 * ------------------------------------------------------------------------- */
export const TRI_RANKS = 4;
export const triSector = (b: BoardShape, sq: number) => Math.floor(rankOf(b, sq) / TRI_RANKS);
export const triRank = (b: BoardShape, sq: number) => rankOf(b, sq) % TRI_RANKS;
const triSq = (sector: number, f: number, r: number) => (sector * TRI_RANKS + r) * 8 + f;

/**
 * One step from sq in direction (df, dr) with |df|, |dr| <= 1, in the local frame
 * of the square's half-board. Returns the square and the direction to keep going
 * in (it turns when the line crosses into another half-board). [-1] if off the board.
 */
export function stepDir(b: BoardShape, sq: number, df: number, dr: number): [number, number, number] {
  if (b.topology !== 'tri') return [step(b, sq, df, dr), df, dr];
  const s = triSector(b, sq);
  const f = fileOf(b, sq), r = triRank(b, sq);
  const f2 = f + df, r2 = r + dr;
  if (f2 < 0 || f2 > 7 || r2 < 0) return [-1, df, dr];
  const open = (t: number) => (b.blocked[t] ? -1 : t);
  if (r2 < TRI_RANKS) return [open(triSq(s, f2, r2)), df, dr];
  // Crossing the middle line.
  if (f === 3 && f2 === 4) return [open(triSq((s + 1) % 3, 4, 3)), 1, -1];
  if (f === 4 && f2 === 3) return [open(triSq((s + 2) % 3, 3, 3)), -1, -1];
  const to = f2 <= 3 ? (s + 2) % 3 : (s + 1) % 3;
  return [open(triSq(to, 7 - f2, 3)), -df || 0, -1];
}

/** Squares a leaper (knight, camel...) reaches: walk the long leg then the short one, or the other way round. */
export function leapTargets(b: BoardShape, sq: number, x: number, y: number): number[] {
  if (b.topology !== 'tri') { const t = step(b, sq, x, y); return t >= 0 ? [t] : []; }
  const out: number[] = [];
  for (const order of [[[Math.sign(x), 0, Math.abs(x)], [0, Math.sign(y), Math.abs(y)]], [[0, Math.sign(y), Math.abs(y)], [Math.sign(x), 0, Math.abs(x)]]]) {
    let at = sq;
    // The frame flips each time a leg crosses the middle (orthogonal steps never use the middle point).
    let flip = 1;
    for (const [dx, dy, n] of order) {
      for (let i = 0; i < n && at >= 0; i++) {
        const [next, ndf, ndr] = stepDir(b, at, dx * flip, dy * flip);
        if (next >= 0 && (ndf !== dx * flip || ndr !== dy * flip)) flip = -flip;
        at = next;
      }
    }
    if (at >= 0 && at !== sq && !out.includes(at)) out.push(at);
  }
  return out;
}

/** Square reached from sq by (df, dr), or -1 if off the board or blocked. */
export function step(b: BoardShape, sq: number, df: number, dr: number): number {
  if (b.topology === 'tri') {
    if (Math.abs(df) <= 1 && Math.abs(dr) <= 1) return stepDir(b, sq, df, dr)[0];
    return leapTargets(b, sq, df, dr)[0] ?? -1;
  }
  let f = (sq % b.width) + df;
  const r = Math.floor(sq / b.width) + dr;
  if (b.wrapFiles) f = ((f % b.width) + b.width) % b.width;
  if (f < 0 || f >= b.width || r < 0 || r >= b.height) return -1;
  const t = r * b.width + f;
  return b.blocked[t] ? -1 : t;
}

export function squareName(b: BoardShape, sq: number): string {
  return String.fromCharCode(97 + fileOf(b, sq)) + (rankOf(b, sq) + 1);
}

export function parseSquare(b: BoardShape, name: string): number {
  const m = /^([a-z])(\d{1,2})$/.exec(name);
  if (!m) return -1;
  const f = m[1].charCodeAt(0) - 97;
  const r = parseInt(m[2], 10) - 1;
  if (f < 0 || f >= b.width || r < 0 || r >= b.height) return -1;
  return square(b, f, r);
}

/** The axis pawns move sideways along when capturing, and kings move along when castling. */
export function lateral(seat: Seat): Vec {
  return seat.forward[1] !== 0 ? [1, 0] : [0, 1];
}

const seatCache = new WeakMap<Seat[], Record<string, Seat>>();

export function seatOf(s: GameState, id: string): Seat {
  let map = seatCache.get(s.seats);
  if (!map) {
    map = {};
    for (const x of s.seats) map[x.id] = x;
    seatCache.set(s.seats, map);
  }
  const seat = map[id];
  if (!seat) throw new Error(`No seat ${id}`);
  return seat;
}

/** True when any seat has a team (four-player teams mode). */
export function hasTeams(s: GameState): boolean {
  return s.seats.some((x) => x.team);
}

export function isPromotionSquare(b: BoardShape, seat: Seat, sq: number): boolean {
  // Hexagon: any other player's back row.
  if (b.topology === 'tri') return triRank(b, sq) === 0 && triSector(b, sq) !== seat.promo.value;
  const c = seat.promo.axis === 'r' ? rankOf(b, sq) : fileOf(b, sq);
  return c === seat.promo.value;
}

export function isLightSquare(b: BoardShape, sq: number): boolean {
  return (fileOf(b, sq) + rankOf(b, sq)) % 2 === 1;
}
