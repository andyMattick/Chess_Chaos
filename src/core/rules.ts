import { isLightSquare } from './board';
import { inCheck, legalMoves, makeMove } from './movegen';
import { positionKey } from './position';
import type { Action, GameResult, GameState, MoveAction, PlayerId } from './types';

/**
 * Game layer: legal actions and end-of-game rules on top of movegen.
 *
 * Rule modules (docs/04 section 3) hook in here. Phase 0 ships only the
 * standard module; modes, modifiers and cards register more in later phases.
 */
export interface RuleModule {
  id: string;
  filterMoves?(s: GameState, moves: MoveAction[]): MoveAction[];
  checkEnforced?(s: GameState): boolean;
  checkEnd?(s: GameState, prev: GameState, action: Action): GameResult | undefined;
}

const MODULES: Record<string, RuleModule[]> = {
  standard: [],
};

export function registerMode(mode: string, modules: RuleModule[]) {
  MODULES[mode] = modules;
}

function modulesFor(s: GameState): RuleModule[] {
  return MODULES[s.mode] ?? [];
}

/** True when some module filters moves, so search must use the full legal list. */
export function hasMoveFilters(s: GameState): boolean {
  return modulesFor(s).some((m) => m.filterMoves);
}

export function isCheckEnforced(s: GameState): boolean {
  return modulesFor(s).every((m) => m.checkEnforced?.(s) ?? true);
}

/** Legal moves for the side to move, after every rule module's filter. */
export function legalActions(s: GameState): MoveAction[] {
  if (s.result) return [];
  let moves = legalMoves(s, isCheckEnforced(s));
  for (const m of modulesFor(s)) if (m.filterMoves) moves = m.filterMoves(s, moves);
  return moves;
}

export function sameMove(a: MoveAction, b: MoveAction): boolean {
  return a.piece === b.piece && a.to === b.to && (a.promo ?? null) === (b.promo ?? null) && (a.castle ?? null) === (b.castle ?? null);
}

export function isLegal(s: GameState, a: MoveAction): boolean {
  return legalActions(s).some((m) => sameMove(m, a));
}

function otherSeats(s: GameState, p: PlayerId): PlayerId[] {
  return s.seats.filter((x) => x.id !== p && x.status === 'active').map((x) => x.id);
}

/** Neither side can possibly checkmate: K v K, K+minor v K, K+B v K+B with same-coloured bishops. */
export function insufficientMaterial(s: GameState): boolean {
  const live = s.pieces.filter((p) => p.at >= 0 && p.type !== 'king');
  if (live.length === 0) return true;
  if (live.some((p) => p.type !== 'bishop' && p.type !== 'knight')) return false;
  if (live.length === 1) return true;
  if (live.every((p) => p.type === 'bishop')) {
    const colours = new Set(live.map((p) => isLightSquare(s.board, p.at)));
    return colours.size === 1;
  }
  return false;
}

/**
 * Apply any action with full bookkeeping: repetition counts and end-of-game
 * detection. Throws on an illegal action.
 */
export function play(s: GameState, action: Action): GameState {
  if (s.result) throw new Error('Game is over');
  if (action.t === 'resign') {
    return { ...s, result: { reason: 'resign', winners: otherSeats(s, action.by) } };
  }
  if (action.t === 'timeout') {
    // Out of time loses, unless the other side could never checkmate anyway.
    const others = otherSeats(s, action.by);
    const canMate = s.pieces.some((p) => p.at >= 0 && others.includes(p.owner) && p.type !== 'king' && !(p.type === 'knight' || p.type === 'bishop'))
      || s.pieces.filter((p) => p.at >= 0 && others.includes(p.owner) && p.type !== 'king').length >= 2;
    return { ...s, result: { reason: 'time', winners: canMate ? others : [] } };
  }
  if (action.t === 'draw-agreed') {
    return { ...s, result: { reason: 'draw-agreed', winners: [] } };
  }
  if (!isLegal(s, action)) throw new Error(`Illegal move ${JSON.stringify(action)}`);
  const mover = s.turn;
  let n = makeMove(s, action);
  const key = positionKey(n);
  n = { ...n, positionCounts: { ...s.positionCounts, [key]: (s.positionCounts[key] ?? 0) + 1 } };
  const result = detectEnd(n, s, action, mover);
  return result ? { ...n, result } : n;
}

function detectEnd(n: GameState, prev: GameState, action: Action, mover: PlayerId): GameResult | null {
  for (const m of modulesFor(n)) {
    const r = m.checkEnd?.(n, prev, action);
    if (r) return r;
  }
  if (legalActions(n).length === 0) {
    if (isCheckEnforced(n) && inCheck(n, n.turn)) return { reason: 'checkmate', winners: [mover] };
    return { reason: 'stalemate', winners: [] };
  }
  if (Object.values(n.positionCounts).some((c) => c >= 3)) return { reason: 'draw-repetition', winners: [] };
  if (n.halfmoveClock >= 100) return { reason: 'draw-50', winners: [] };
  if (insufficientMaterial(n)) return { reason: 'draw-material', winners: [] };
  return null;
}
