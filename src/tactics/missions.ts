import { fileOf, rankOf, seatOf } from '../core/board';
import type { GameState, MoveAction, PlayerId } from '../core/types';
import { hanging } from './attacks';

/**
 * Detectors for the Easy missions (docs/03), used as open "three-move goals"
 * in training (FB-03). Medium/Hard missions are added in phase 3.
 * Each check gets the game so far as a list of states and the player's moves.
 */
export interface GoalContext {
  /** states[i] is the position before action i; the last entry is the current position. */
  states: GameState[];
  actions: MoveAction[];
  player: PlayerId;
}

function myMoves(ctx: GoalContext) {
  const out: { before: GameState; m: MoveAction; after: GameState; n: number }[] = [];
  let n = 0;
  ctx.actions.forEach((m, i) => {
    const before = ctx.states[i];
    if (before.turn !== ctx.player) return;
    n++;
    out.push({ before, m, after: ctx.states[i + 1], n });
  });
  return out;
}

const homeRank = (s: GameState, p: PlayerId) => (seatOf(s, p).forward[1] > 0 ? 0 : s.board.height - 1);

export const EASY_GOALS = {
  /** MISSION-01: castle on or before your move 8. */
  'MISSION-01': (ctx: GoalContext) => myMoves(ctx).some(({ m, n }) => !!m.castle && n <= 8),
  /** MISSION-02: a knight of yours makes a capture. */
  'MISSION-02': (ctx: GoalContext) => myMoves(ctx).some(({ before, m }) => before.pieces[m.piece].type === 'knight' && before.sq[m.to] >= 0),
  /** MISSION-08: five turns in a row ending with nothing of yours hanging. */
  'MISSION-08': (ctx: GoalContext) => {
    let streak = 0;
    for (const { after } of myMoves(ctx)) {
      streak = hanging(after, ctx.player, 1).length === 0 ? streak + 1 : 0;
      if (streak >= 5) return true;
    }
    return false;
  },
  /** MISSION-13: all four knights and bishops off their starting squares by your move 10. */
  'MISSION-13': (ctx: GoalContext) => {
    for (const { after, n } of myMoves(ctx)) {
      if (n > 10) return false;
      const minors = after.pieces.filter((p) => p.owner === ctx.player && (p.type === 'knight' || p.type === 'bishop'));
      if (minors.length >= 4 && minors.every((p) => p.at < 0 || p.at !== p.home)) return true;
    }
    return false;
  },
  /** MISSION-22: both rooks on your back rank with nothing between them. */
  'MISSION-22': (ctx: GoalContext) => {
    const s = ctx.states[ctx.states.length - 1];
    const back = homeRank(s, ctx.player);
    const rooks = s.pieces.filter((p) => p.at >= 0 && p.owner === ctx.player && p.type === 'rook' && rankOf(s.board, p.at) === back);
    if (rooks.length !== 2) return false;
    const [a, b] = rooks.map((r) => fileOf(s.board, r.at)).sort((x, y) => x - y);
    for (let f = a + 1; f < b; f++) if (s.sq[back * s.board.width + f] >= 0) return false;
    return myMoves(ctx).length > 0;
  },
};

export type EasyGoalId = keyof typeof EASY_GOALS;

export const GOAL_TEXT: Record<EasyGoalId, { title: string; hint: string }> = {
  'MISSION-01': { title: 'Castle by move 8', hint: 'Tap your king, then two squares toward a rook.' },
  'MISSION-02': { title: 'Take something with a knight', hint: 'Knights jump in an L shape.' },
  'MISSION-08': { title: 'Nothing left hanging for 5 turns', hint: 'After each move, check every piece is guarded.' },
  'MISSION-13': { title: 'Get all 4 knights and bishops out by move 10', hint: 'Move each one off its starting square.' },
  'MISSION-22': { title: 'Connect your rooks', hint: 'Clear everything between your two rooks on the back row.' },
};
