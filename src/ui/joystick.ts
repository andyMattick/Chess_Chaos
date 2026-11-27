/**
 * The world map's joystick (owner, 2026-11-27): drag the knob and the hero keeps
 * walking that way, one tile at a time, until you let go. The world is a grid,
 * so the drag snaps to the nearest of the four directions.
 */

/** How far the knob can travel from the middle, in pixels. */
export const KNOB_TRAVEL = 30;
/** A drag shorter than this (pixels) is a wobble, not a direction. */
export const DEAD_ZONE = 10;

export type Dir = readonly [dx: -1 | 0 | 1, dy: -1 | 0 | 1];

/** Which way to walk for a drag of (dx, dy) pixels from the middle: up, down, left, right, or not at all. */
export function joystickDir(dx: number, dy: number, deadZone = DEAD_ZONE): Dir | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < deadZone) return null;
  return Math.abs(dx) > Math.abs(dy) ? [dx < 0 ? -1 : 1, 0] : [0, dy < 0 ? -1 : 1];
}

/** Where to draw the knob: the drag, held inside the ring. */
export function knobAt(dx: number, dy: number, travel = KNOB_TRAVEL): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (!Number.isFinite(d) || d === 0) return { x: 0, y: 0 };
  const k = Math.min(1, travel / d);
  return { x: dx * k, y: dy * k };
}

export const sameDir = (a: Dir | null, b: Dir | null) => (a === null || b === null ? a === b : a[0] === b[0] && a[1] === b[1]);
