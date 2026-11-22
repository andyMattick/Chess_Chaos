/**
 * Plays a mission picture's line (content/missionPictures.ts) so the screen can
 * draw it and the tests can check it really shows the mission. Pure.
 */
import { play } from '../core/rules';
import { parseSAN } from '../core/san';
import { fromFEN } from '../core/setup';
import type { GameState, MoveAction } from '../core/types';
import type { MissionPicture } from '../content/missionPictures';

export interface PictureLine {
  states: GameState[];
  moves: MoveAction[];
  /** The position drawn, and the move shown as an arrow (squares). */
  shown: GameState;
  arrow: { from: number; to: number };
}

export function pictureLine(pic: MissionPicture): PictureLine | null {
  let s = fromFEN(pic.fen);
  const states = [s];
  const moves: MoveAction[] = [];
  for (const t of pic.san) {
    const m = parseSAN(s, t);
    if (!m) return null;
    moves.push(m);
    s = play(s, m);
    states.push(s);
  }
  const before = states[states.length - 2];
  const shown = pic.show === 'before' ? before : s;
  const k = Math.min(moves.length - 1, Math.max(0, pic.arrowMove ?? moves.length - 1));
  return { states, moves, shown, arrow: { from: states[k].pieces[moves[k].piece].at, to: moves[k].to } };
}

/** Square name (a1..h8) to index on an 8x8 board. */
export function sqIndex(name: string): number {
  return (Number(name[1]) - 1) * 8 + (name.charCodeAt(0) - 97);
}
