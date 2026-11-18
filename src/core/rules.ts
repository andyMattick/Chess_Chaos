import { isLightSquare } from './board';
import { activeSeats, eliminate, inCheck, legalMoves, makeMove } from './movegen';
import { positionKey } from './position';
import { MODE_MODULES } from './modes';
import { extraModule } from './modifiers';
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
  /** Adjust the state after every action (scores, skipping stuck players…). */
  afterMove?(s: GameState, prev: GameState): GameState;
  /** Extra moves this rule allows (checked for legality like normal moves). */
  extraMoves?(s: GameState): MoveAction[];
  /** One-shot buffs: apply the buff action, or throw if it is not allowed. */
  applyBuff?(s: GameState, a: Extract<Action, { t: 'buff' }>): GameState;
}

const MODULES: Record<string, RuleModule[]> = { ...MODE_MODULES };

export function registerMode(mode: string, modules: RuleModule[]) {
  MODULES[mode] = modules;
}

function modulesFor(s: GameState): RuleModule[] {
  const base = MODULES[s.mode] ?? [];
  if (!s.rules?.length) return base;
  return [...base, ...s.rules.map(extraModule).filter((m): m is RuleModule => !!m)];
}

/** True when some module filters moves, so search must use the full legal list. */
export function hasMoveFilters(s: GameState): boolean {
  return modulesFor(s).some((m) => m.filterMoves || m.extraMoves);
}

export function isCheckEnforced(s: GameState): boolean {
  return modulesFor(s).every((m) => m.checkEnforced?.(s) ?? true);
}

/** Legal moves for the side to move, after every rule module's filter. */
export function legalActions(s: GameState): MoveAction[] {
  if (s.result) return [];
  const checks = isCheckEnforced(s);
  let moves = legalMoves(s, checks);
  const mods = modulesFor(s);
  for (const m of mods) {
    if (!m.extraMoves) continue;
    for (const x of m.extraMoves(s)) if (!checks || !inCheck(makeMove(s, x), s.turn)) moves.push(x);
  }
  for (const m of mods) if (m.filterMoves) moves = m.filterMoves(s, moves);
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
function isMulti(s: GameState) {
  return s.seats.length > 2;
}

function afterMove(n: GameState, prev: GameState): GameState {
  for (const m of modulesFor(n)) if (m.afterMove) n = m.afterMove(n, prev);
  return n;
}

/** Remaining sides in a three/four player game: teams count as one side. */
function sidesLeft(s: GameState): PlayerId[][] {
  const groups = new Map<string, PlayerId[]>();
  for (const id of activeSeats(s)) {
    const seat = s.seats.find((x) => x.id === id)!;
    const key = seat.team ?? id;
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  return [...groups.values()];
}

function multiEnd(n: GameState): GameResult | null {
  const sides = sidesLeft(n);
  if (sides.length > 1) return null;
  if (!sides.length) return { reason: 'last-standing', winners: [] };
  const team = n.seats.find((x) => x.id === sides[0][0])!.team;
  const winners = team ? n.seats.filter((x) => x.team === team).map((x) => x.id) : sides[0];
  return { reason: 'last-standing', winners };
}

export function play(s: GameState, action: Action): GameState {
  if (s.result) throw new Error('Game is over');
  if (isMulti(s) && (action.t === 'resign' || action.t === 'timeout')) {
    // With more than two players, giving up or running out of time knocks you out; the game goes on.
    let n = afterMove(eliminate(s, action.by), s);
    for (const m of modulesFor(n)) {
      const r = m.checkEnd?.(n, s, action);
      if (r) return { ...n, result: r };
    }
    const r = multiEnd(n);
    return r ? { ...n, result: r } : n;
  }
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
  if (action.t === 'mission') {
    const team = s.seats.find((x) => x.id === action.by)?.team;
    const winners = team ? s.seats.filter((x) => x.team === team).map((x) => x.id) : [action.by];
    return { ...s, result: { reason: 'mission', winners }, modeData: { ...(s.modeData ?? {}), missionWin: action.id } };
  }
  if (action.t === 'buff') {
    if (action.by !== s.turn) throw new Error('Buffs are used on your own turn');
    const mod = modulesFor(s).find((m) => m.id === `${action.id}@${action.by}` && m.applyBuff);
    if (!mod) throw new Error(`No buff ${action.id} for ${action.by}`);
    const used = (s.modeData?.usedBuffs as Record<string, string[]> | undefined) ?? {};
    if (used[action.by]?.includes(action.id)) throw new Error('Buff already used');
    let n = mod.applyBuff!(s, action);
    n = { ...n, modeData: { ...(n.modeData ?? {}), usedBuffs: { ...used, [action.by]: [...(used[action.by] ?? []), action.id] } } };
    n = afterMove(n, s);
    const key = positionKey(n);
    n = { ...n, positionCounts: { ...s.positionCounts, [key]: (s.positionCounts[key] ?? 0) + 1 } };
    const result = n.turn === s.turn ? null : detectEnd(n, s, action, s.turn);
    return result ? { ...n, result } : n;
  }
  if (action.t === 'draw-agreed') {
    return { ...s, result: { reason: 'draw-agreed', winners: [] } };
  }
  if (!isLegal(s, action)) throw new Error(`Illegal move ${JSON.stringify(action)}`);
  const mover = s.turn;
  let n = afterMove(makeMove(s, action), s);
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
  if (isMulti(n)) return multiEnd(n);
  if (legalActions(n).length === 0) {
    if (isCheckEnforced(n) && inCheck(n, n.turn)) return { reason: 'checkmate', winners: [mover] };
    return { reason: 'stalemate', winners: [] };
  }
  if (Object.values(n.positionCounts).some((c) => c >= 3)) return { reason: 'draw-repetition', winners: [] };
  if (n.halfmoveClock >= 100) return { reason: 'draw-50', winners: [] };
  if (insufficientMaterial(n)) return { reason: 'draw-material', winners: [] };
  return null;
}
