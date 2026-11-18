import { paintOf } from '../core/modes2';
import type { GameState } from '../core/types';

/** Paint the board: each painted square tinted in its army's colour. */
const PAINT: Record<string, string> = { p1: 'rgba(255, 120, 190, 0.5)', p2: 'rgba(70, 120, 255, 0.5)', p3: 'rgba(255, 200, 40, 0.55)', p4: 'rgba(40, 200, 150, 0.5)' };
export const PAINT_NAME: Record<string, string> = { p1: 'pink', p2: 'blue', p3: 'yellow', p4: 'green' };
export function paintTints(s: GameState, into: Map<number, string> = new Map()): Map<number, string> {
  if (s.mode !== 'paint' && s.mode !== 'battle-paint') return into;
  paintOf(s).forEach((p, i) => { if (p) into.set(i, PAINT[p]); });
  return into;
}
export const PAINT_COLOUR = PAINT;
