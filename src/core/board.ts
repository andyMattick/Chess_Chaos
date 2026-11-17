import type { BoardShape, GameState, Seat, Vec } from './types';

export function rectBoard(width: number, height: number): BoardShape {
  return { width, height, wrapFiles: false, blocked: new Array(width * height).fill(false) };
}

export const fileOf = (b: BoardShape, sq: number) => sq % b.width;
export const rankOf = (b: BoardShape, sq: number) => Math.floor(sq / b.width);
export const square = (b: BoardShape, f: number, r: number) => r * b.width + f;

/** Square reached from sq by (df, dr), or -1 if off the board or blocked. */
export function step(b: BoardShape, sq: number, df: number, dr: number): number {
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
  const c = seat.promo.axis === 'r' ? rankOf(b, sq) : fileOf(b, sq);
  return c === seat.promo.value;
}

export function isLightSquare(b: BoardShape, sq: number): boolean {
  return (fileOf(b, sq) + rankOf(b, sq)) % 2 === 1;
}
