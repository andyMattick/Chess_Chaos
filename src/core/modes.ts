import { fileOf, rankOf } from './board';
import { activeSeats, eliminate, legalMoves } from './movegen';
import type { RuleModule } from './rules';
import type { GameResult, GameState, PlayerId } from './types';

/**
 * Mode rule modules (docs/03 Game modes, docs/09 section 5). Each mode is a
 * list of modules; rules.ts looks them up by GameState.mode.
 * Kept free of imports from rules.ts to avoid a cycle.
 */

/** The hill: central 4 squares on 8x8, central 16 on the four-player board. */
export function hillSquares(s: GameState): Set<number> {
  const b = s.board;
  const size = b.width >= 12 ? 4 : 2;
  const f0 = Math.floor((b.width - size) / 2);
  const r0 = Math.floor((b.height - size) / 2);
  const out = new Set<number>();
  for (let f = f0; f < f0 + size; f++) for (let r = r0; r < r0 + size; r++) out.add(r * b.width + f);
  return out;
}

/** Three and four player battles: kings are captured, not checkmated (docs/09 s4). */
const battle: RuleModule = {
  id: 'battle',
  checkEnforced: () => false,
  // No en passant with more than two players.
  filterMoves: (s, moves) =>
    moves.filter((m) => !(s.pieces[m.piece].type === 'pawn' && s.sq[m.to] < 0 && fileOf(s.board, m.to) !== fileOf(s.board, s.pieces[m.piece].at) && rankOf(s.board, m.to) !== rankOf(s.board, s.pieces[m.piece].at))),
  // A player who cannot move at all is out (they would be stuck forever).
  afterMove: (s) => {
    let n = s;
    for (let guard = 0; guard < 4 && activeSeats(n).length > 1; guard++) {
      if (legalMoves(n, false).length > 0) break;
      n = eliminate(n, n.turn);
    }
    return n;
  },
};

/** MODE-02 King of the hill: a king that reaches the centre wins. Two players. */
const kingOfTheHill: RuleModule = {
  id: 'koth',
  checkEnd: (s, prev, action) => {
    if (action.t !== 'move') return undefined;
    const p = s.pieces[action.piece];
    if (p.type === 'king' && hillSquares(s).has(p.at)) return { reason: 'mode-win', winners: [prev.turn] };
    return undefined;
  },
};

export interface HillData { scores: Record<string, number>; target: number }

export function hillData(s: GameState): HillData {
  const d = s.modeData?.hill as HillData | undefined;
  return d ?? { scores: {}, target: s.seats.length > 2 ? 30 : 20 };
}

/**
 * MODE-29 Hill wars: at the end of every full round each player scores 1 per
 * hill square they hold, 2 for their king. First to the target wins.
 */
const hillWars: RuleModule = {
  id: 'hill-wars',
  afterMove: (s, prev) => {
    const order = s.seats.filter((x) => x.status === 'active').map((x) => x.id);
    // A round ends when play comes back round to the first active seat.
    const roundEnded = order.length > 0 && s.turn === order[0] && prev.turn !== s.turn;
    if (!roundEnded) return s;
    const hill = hillSquares(s);
    const d = hillData(s);
    const scores = { ...d.scores };
    for (const sq of hill) {
      const id = s.sq[sq];
      if (id < 0) continue;
      const p = s.pieces[id];
      if (!order.includes(p.owner)) continue;
      scores[p.owner] = (scores[p.owner] ?? 0) + (p.type === 'king' ? 2 : 1);
    }
    return { ...s, modeData: { ...(s.modeData ?? {}), hill: { ...d, scores } } };
  },
  checkEnd: (s): GameResult | undefined => {
    const d = hillData(s);
    const leaders = Object.entries(d.scores).filter(([, v]) => v >= d.target).sort((a, b) => b[1] - a[1]);
    if (!leaders.length) return undefined;
    const top = leaders[0][1];
    const winners = leaders.filter(([, v]) => v === top).map(([k]) => k as PlayerId);
    const team = s.seats.find((x) => x.id === winners[0])?.team;
    return { reason: 'mode-win', winners: team ? s.seats.filter((x) => x.team === team).map((x) => x.id) : winners };
  },
};

export const MODE_MODULES: Record<string, RuleModule[]> = {
  standard: [],
  koth: [kingOfTheHill],
  'hill-wars': [hillWars],
  battle: [battle],
  'battle-hill': [battle, hillWars],
};

export interface ModeInfo {
  id: string;
  catalogId: string;
  name: string;
  emoji: string;
  players: number[];
  blurb: string;
}

export const MODE_INFO: ModeInfo[] = [
  { id: 'standard', catalogId: 'MODE-00', name: 'Classic chess', emoji: '♟️', players: [2], blurb: 'Normal chess. Checkmate wins.' },
  { id: 'koth', catalogId: 'MODE-02', name: 'King of the hill', emoji: '⛰️', players: [2], blurb: 'Get your king to one of the 4 middle squares to win, or checkmate.' },
  { id: 'hill-wars', catalogId: 'MODE-29', name: 'Hill wars', emoji: '🚩', players: [2, 3, 4], blurb: 'Hold the middle! Every round you score 1 point per hill square you sit on, 2 for your king. First to the target wins.' },
  { id: 'battle', catalogId: 'MODE-26/27/28', name: 'Battle royale', emoji: '⚔️', players: [3, 4], blurb: 'Everyone for themselves (or 2 vs 2). Capture a king to knock that player out. Last king standing wins.' },
];
