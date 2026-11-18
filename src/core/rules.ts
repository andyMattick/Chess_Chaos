import { isLightSquare } from './board';
import { activeSeats, eliminate, inCheck, legalMoves, makeMove } from './movegen';
import { positionKey } from './position';
import { MODE_MODULES } from './modes';
import { MODE_MODULES_2 } from './modes2';
import { extraModule } from './modifiers';
import { cardModule } from './cards';
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
  /** Modes where bare kings are not a draw (Atomic, Giveaway, Horde…). */
  noMaterialDraw?: boolean;
  /** A mode action you can take again and again (Card chess discards, ending a Progressive run). */
  repeatable?: boolean;
  /** Modes with several moves in a turn, where positions repeat inside one turn (Progressive, Monster). */
  noRepetitionDraw?: boolean;
}

const MODULES: Record<string, RuleModule[]> = { ...MODE_MODULES };
// A mode listed in both tables gets both sets of rules (Battle + Paint).
for (const [k, v] of Object.entries(MODE_MODULES_2)) MODULES[k] = [...(MODULES[k] ?? []), ...v];

export function registerMode(mode: string, modules: RuleModule[]) {
  MODULES[mode] = modules;
}

function modulesFor(s: GameState): RuleModule[] {
  const base = MODULES[s.mode] ?? [];
  if (!s.rules?.length) return base;
  return [...base, ...s.rules.map((r) => extraModule(r) ?? cardModule(r)).filter((m): m is RuleModule => !!m)];
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
  if (action.t === 'mission' && action.stage === 'reveal') {
    const ch = missionChallenges(s);
    return { ...s, modeData: { ...(s.modeData ?? {}), missionChallenges: { ...ch, [action.by]: { id: action.id, left: action.turns ?? 2, target: action.target ?? [] } } } };
  }
  if (action.t === 'mission' && action.stage === 'off') {
    const { [action.by]: _gone, ...rest } = missionChallenges(s);
    void _gone;
    const off = (s.modeData?.missionsOff as Record<string, string> | undefined) ?? {};
    return { ...s, modeData: { ...(s.modeData ?? {}), missionChallenges: rest, missionsOff: { ...off, [action.by]: action.id } } };
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
    if (!mod.repeatable && used[action.by]?.includes(action.id)) throw new Error('Buff already used');
    let n = mod.applyBuff!(s, action);
    if (!mod.repeatable) n = { ...n, modeData: { ...(n.modeData ?? {}), usedBuffs: { ...used, [action.by]: [...(used[action.by] ?? []), action.id] } } };
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
  let n = tickChallenges(afterMove(makeMove(s, action), s), mover);
  const key = positionKey(n);
  n = { ...n, positionCounts: { ...s.positionCounts, [key]: (s.positionCounts[key] ?? 0) + 1 } };
  const result = detectEnd(n, s, action, mover);
  return result ? { ...n, result } : n;
}

/** Revealed secret missions waiting to be undone, by owner: mission, defender moves left, pieces that did it. */
export interface MissionChallenge { id: string; left: number; target: number[] }
export function missionChallenges(s: GameState): Partial<Record<PlayerId, MissionChallenge>> {
  return (s.modeData?.missionChallenges as Partial<Record<PlayerId, MissionChallenge>> | undefined) ?? {};
}

/** A move by anyone but the mission's owner uses up one of the defender's turns. */
function tickChallenges(n: GameState, mover: PlayerId): GameState {
  const ch = missionChallenges(n);
  const owners = Object.keys(ch) as PlayerId[];
  if (!owners.some((o) => o !== mover)) return n;
  const next: Partial<Record<PlayerId, MissionChallenge>> = {};
  for (const o of owners) next[o] = o === mover ? ch[o] : { ...ch[o]!, left: ch[o]!.left - 1 };
  return { ...n, modeData: { ...(n.modeData ?? {}), missionChallenges: next } };
}

/** Modes whose rules change the position after a move (explosions, double moves, drops…) or end the game their own way. */
export function needsFullRules(s: GameState): boolean {
  return modulesFor(s).some((m) => m.afterMove || m.checkEnd);
}

/**
 * For the AI: make a move and apply the mode's after-move rules and its own
 * win checks, without the legality check or the draw checks. Much cheaper than play().
 */
export function advance(s: GameState, m: MoveAction): GameState {
  const n = afterMove(makeMove(s, m), s);
  for (const mod of modulesFor(n)) {
    const r = mod.checkEnd?.(n, s, m);
    if (r) return { ...n, result: r };
  }
  return n;
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
  if (!modulesFor(n).some((m) => m.noRepetitionDraw) && Object.values(n.positionCounts).some((c) => c >= 3)) return { reason: 'draw-repetition', winners: [] };
  if (n.halfmoveClock >= 100) return { reason: 'draw-50', winners: [] };
  if (!modulesFor(n).some((m) => m.noMaterialDraw) && insufficientMaterial(n)) return { reason: 'draw-material', winners: [] };
  return null;
}
