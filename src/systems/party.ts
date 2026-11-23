import { MISSION_DEFENCE_TURNS, MISSION_DEFENCE_TURNS_VS_UNDERDOG, MISSION_UNDERDOG_GAP, BONUS_CHANCE, BONUS_MISSIONS, MISSIONS, MODIFIERS, UNDERDOG_BONUS_MODES, type ModifierDef } from '../content/party';
import { advance, legalActions, missionChallenges, play } from '../core/rules';
import { IMPLEMENTED } from '../core/modifiers';
import { movesMade } from '../core/modifiers';
import type { GameRecord } from '../core/record';
import type { Action, GameState, MoveAction, PlayerId } from '../core/types';
import { missionDone, missionHolds, missionTarget } from './missions';

/**
 * Party match pipeline (docs/02): draw a mode from the player's mode deck,
 * give buffs/handicaps from the rating gap, deal secret missions, and referee
 * the missions after every move.
 */

/** Modes in the deck. Classic chess appears three times (docs/08 Q6). */
export const PARTY_DECK = [
  'standard', 'standard', 'standard', 'koth', 'three-check', 'capture-race', 'random-piece', 'truce', 'capture-the-flag', 'shuffle', 'hill-wars',
  'atomic', 'giveaway', 'racing-kings', 'wrap', 'lava', 'mini', 'horde', 'monster', 'shrinking', 'progressive', 'drop-in', 'boss', 'mystery-army', 'hidden-queen', 'card-chess', 'paint', 'pawn-wars',
];

/** Capabilities each mode removes, for tag filtering (docs/02 s7). */
const MODE_REMOVES: Record<string, string[]> = {
  shuffle: ['needsCastling'],
  wrap: ['needsStandardBoard', 'needsCastling'],
  mini: ['needsStandardBoard', 'needsCastling', 'needsStandardArmy'],
  giveaway: ['needsCheck', 'needsCastling'],
  atomic: ['needsCheck'],
  'racing-kings': ['needsPawns', 'needsCastling', 'needsStandardArmy', 'needsCheck'],
  horde: ['needsStandardArmy', 'needsCastling'],
  monster: ['needsStandardArmy', 'needsCastling'],
  boss: ['needsStandardArmy'],
  'mystery-army': ['needsStandardArmy', 'needsCastling'],
  shrinking: ['needsStandardBoard'],
  // Kings and pawns only.
  'pawn-wars': ['needsStandardArmy', 'needsCastling', 'needsKnights', 'needsBishops', 'needsRooks', 'needsQueen'],
};

/**
 * Mode preferences: each player ranks modes 0 (never) to 3 (favourite). The
 * number is how many copies of that mode go in the deck. Classic starts at 3,
 * everything else at 1.
 */
export type ModePrefs = Record<string, number>;
export const PARTY_MODES = [...new Set(PARTY_DECK)];
export const PREF_LABELS = ['🚫 Never', '😐 Sometimes', '👍 Often', '❤️ Favourite'];

export function prefOf(prefs: ModePrefs | undefined, mode: string): number {
  const v = prefs?.[mode];
  return typeof v === 'number' && v >= 0 && v <= 3 ? Math.round(v) : mode === 'standard' ? 3 : 1;
}

/** The full deck for these preferences. If everything is "never", every mode comes back once. */
export function deckFor(prefs?: ModePrefs): string[] {
  const d = PARTY_MODES.flatMap((m) => Array(prefOf(prefs, m)).fill(m) as string[]);
  return d.length ? d : [...PARTY_MODES];
}

/** Keep only known modes and levels 0 to 3 (online messages). */
export function cleanPrefs(raw: unknown): ModePrefs {
  if (!raw || typeof raw !== 'object') return {};
  const out: ModePrefs = {};
  for (const m of PARTY_MODES) {
    const v = (raw as Record<string, unknown>)[m];
    if (typeof v === 'number' && v >= 0 && v <= 3) out[m] = Math.round(v);
  }
  return out;
}

/** Online party: both players' rankings count equally (average weight per mode). */
export function pickModeFor(players: (ModePrefs | undefined)[], rand: () => number): string {
  const weights = PARTY_MODES.map((m) => players.reduce((a, p) => a + prefOf(p, m), 0) / Math.max(1, players.length));
  const total = weights.reduce((a, w) => a + w, 0);
  if (total <= 0) return PARTY_MODES[Math.floor(rand() * PARTY_MODES.length)];
  let x = rand() * total;
  for (let i = 0; i < PARTY_MODES.length; i++) if ((x -= weights[i]) < 0) return PARTY_MODES[i];
  return PARTY_MODES[PARTY_MODES.length - 1];
}

export function shuffleDeck(rand: () => number, prefs?: ModePrefs): string[] {
  const d = deckFor(prefs);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/** Take the top mode; reshuffle when empty, never repeating the last mode first. */
export function drawMode(deck: string[], last: string | undefined, rand: () => number, prefs?: ModePrefs): { mode: string; deck: string[] } {
  // Modes you have since switched to "never" drop out of the current deck.
  let d = deck.filter((m) => PARTY_DECK.includes(m) && (prefOf(prefs, m) > 0 || deckFor(prefs).includes(m)));
  if (!d.length) {
    d = shuffleDeck(rand, prefs);
    if (d[0] === last) d.push(d.shift()!);
  }
  return { mode: d[0], deck: d.slice(1) };
}

/** docs/02 s4: what the underdog and the favourite get, by rating gap. */
export function slotsForGap(gap: number): { underdog: ('Major' | 'Minor')[]; favourite: ('Major' | 'Minor')[] } {
  if (gap < 100) return { underdog: [], favourite: [] };
  if (gap < 200) return { underdog: ['Minor'], favourite: [] };
  if (gap < 300) return { underdog: ['Major'], favourite: [] };
  if (gap < 400) return { underdog: ['Major'], favourite: ['Minor'] };
  if (gap < 500) return { underdog: ['Major', 'Minor'], favourite: ['Minor'] };
  return { underdog: ['Major', 'Minor'], favourite: ['Major'] };
}

export interface PartyPlayer { rating: number; bot: boolean }
export interface PartyOptions {
  mode: string;
  players: Record<'p1' | 'p2', PartyPlayer>;
  online: boolean;
  /** The game has a chess clock (Time bank needs one). */
  clock?: boolean;
  /** Secret missions are switched off (Peek and bonus objectives need them). */
  noMissions?: boolean;
}

/** What a game without these removes, on top of the mode (docs/02 s7). */
function removedFor(o: PartyOptions): string[] {
  return [...(MODE_REMOVES[o.mode] ?? []), ...(o.clock ? [] : ['needsClock']), ...(o.noMissions ? ['needsMissions'] : [])];
}

function eligible(def: ModifierDef, o: PartyOptions, who: PartyPlayer): boolean {
  if (!IMPLEMENTED.has(def.id)) return false;
  if (who.bot && (def.humanOnly || def.oneShot)) return false; // bots only get always-on rules
  if (def.botGameOnly && o.online) return false;
  const removed = removedFor(o);
  return !(def.tags ?? []).some((t) => removed.includes(t));
}

function pick<T>(list: T[], rand: () => number): T | undefined {
  return list.length ? list[Math.floor(rand() * list.length)] : undefined;
}

export function pickModifiers(o: PartyOptions, rand: () => number): Record<'p1' | 'p2', string[]> {
  const out: Record<'p1' | 'p2', string[]> = { p1: [], p2: [] };
  const gap = Math.abs(o.players.p1.rating - o.players.p2.rating);
  const underdog: 'p1' | 'p2' = o.players.p1.rating <= o.players.p2.rating ? 'p1' : 'p2';
  const favourite = underdog === 'p1' ? 'p2' : 'p1';
  const slots = slotsForGap(gap);
  // Lopsided modes: one more Minor buff for the weaker player (docs/12).
  const bonus = gap >= MISSION_UNDERDOG_GAP ? UNDERDOG_BONUS_MODES[o.mode] : undefined;
  const underdogSlots = bonus ? [...slots.underdog, bonus] : slots.underdog;
  for (const tier of underdogSlots) {
    const m = pick(MODIFIERS.filter((d) => d.kind === 'buff' && d.tier === tier && !out[underdog].includes(d.id) && eligible(d, o, o.players[underdog])), rand);
    if (m) out[underdog].push(m.id);
  }
  for (const tier of slots.favourite) {
    const m = pick(MODIFIERS.filter((d) => d.kind === 'handicap' && d.tier === tier && eligible(d, o, o.players[favourite])), rand);
    if (m) out[favourite].push(m.id);
  }
  return out;
}

/** docs/02 s5: Medium for both when close; Hard for the favourite when the gap is 200+. Never the same mission twice. */
export function dealMissions(o: PartyOptions, rand: () => number): Record<'p1' | 'p2', string> {
  // Missions follow the same tags as modifiers: no bishop mission in a mode without bishops.
  const removed = MODE_REMOVES[o.mode] ?? [];
  const pool = (cat: 'Medium' | 'Hard') => {
    const all = MISSIONS.filter((m) => m.category === cat && !(o.mode === 'three-check' && m.id === 'MISSION-12'));
    const fits = all.filter((m) => !(m.tags ?? []).some((t) => removed.includes(t)));
    return fits.length >= 2 ? fits : all;
  };
  const gap = Math.abs(o.players.p1.rating - o.players.p2.rating);
  const favourite = o.players.p1.rating > o.players.p2.rating ? 'p1' : 'p2';
  const first = (p: 'p1' | 'p2') => (gap >= 200 && p === favourite ? 'Hard' : 'Medium');
  const a = pick(pool(first('p1')), rand)!.id;
  const b = pick(pool(first('p2')).filter((m) => m.id !== a), rand)!.id;
  return { p1: a, p2: b };
}

export function missionGate(rating: number, opponentRating: number): number {
  return Math.min(rating, opponentRating) < 800 ? 8 : 10;
}

export type PartySetup = NonNullable<GameRecord['setup']['party']>;

export function setupParty(o: PartyOptions, rand: () => number): PartySetup {
  const gate = missionGate(o.players.p1.rating, o.players.p2.rating);
  const setup: PartySetup = { modifiers: pickModifiers(o, rand), missions: dealMissions(o, rand), gate: { p1: gate, p2: gate }, defence: missionDefence(o.players.p1.rating, o.players.p2.rating) };
  const bonus = dealBonus(o, rand);
  return Object.keys(bonus).length ? { ...setup, bonus } : setup;
}

/** Bonus objectives (docs/02 s5): each player has a 1 in 3 chance of one, shown openly. Drawn after everything else, so older setups stay the same. */
export function dealBonus(o: PartyOptions, rand: () => number): Partial<Record<'p1' | 'p2', string>> {
  const out: Partial<Record<'p1' | 'p2', string>> = {};
  const removed = removedFor(o);
  const pool = BONUS_MISSIONS.filter((m) => !(m.tags ?? []).some((t) => removed.includes(t)));
  for (const k of ['p1', 'p2'] as const) {
    const roll = rand();
    const m = pick(pool, rand);
    if (!o.noMissions && roll < BONUS_CHANCE && m) out[k] = m.id;
  }
  return out;
}

/** The weaker player's mission: shown from the start, wins at once. */
export function missionIsOpen(p: PartySetup, player: PlayerId): boolean {
  return p.defence?.[player] === 0;
}

/** Does doing this mission win on the spot? Open missions do, unless the mission is always shown first. */
export function missionWinsAtOnce(p: PartySetup, player: PlayerId, id = p.missions[player]): boolean {
  return missionIsOpen(p, player) && !MISSIONS.find((m) => m.id === id)?.alwaysShown;
}

/** Turns to undo each player's shown mission: fewer against the weaker player's mission when the gap is big enough. */
export function missionDefence(p1: number, p2: number): Record<'p1' | 'p2', number> {
  const out = { p1: MISSION_DEFENCE_TURNS, p2: MISSION_DEFENCE_TURNS };
  if (Math.abs(p1 - p2) >= MISSION_UNDERDOG_GAP) out[p1 < p2 ? 'p1' : 'p2'] = MISSION_DEFENCE_TURNS_VS_UNDERDOG;
  return out;
}

/** Hide the other player's mission (online, and on screen). */
export function redactParty(p: PartySetup, viewer: PlayerId | null, peeked = false): PartySetup {
  const missions: PartySetup['missions'] = {};
  // The weaker player's mission is open (everyone sees it); others are secret, unless you used Peek.
  for (const [k, v] of Object.entries(p.missions)) missions[k as PlayerId] = k === viewer || peeked || missionIsOpen(p, k as PlayerId) ? v : '?';
  return { ...p, missions };
}

/**
 * Referee: call after every action, and again after appending what it
 * returns, until it returns null. Owner rule (2026-11-18): a completed
 * mission is shown ("reveal"), then the other player has
 * MISSION_DEFENCE_TURNS moves to undo it. Undone: it is out of play ("off").
 * Still standing after those moves: the mission's owner wins ("win").
 */
export function refereeMission(states: GameState[], actions: Action[], party: PartySetup): Action | null {
  const now = states[states.length - 1];
  if (!now || now.result) return null;
  // 1. Shown missions: undone, or time is up.
  const ch = missionChallenges(now);
  for (const [owner, c] of Object.entries(ch) as [PlayerId, NonNullable<(typeof ch)[PlayerId]>][]) {
    if (!missionHolds(c.id, now, owner, c.target)) return { t: 'mission', by: owner, id: c.id, stage: 'off' };
  }
  for (const [owner, c] of Object.entries(ch) as [PlayerId, NonNullable<(typeof ch)[PlayerId]>][]) {
    if (c.left <= 0) return { t: 'mission', by: owner, id: c.id, stage: 'win' };
  }
  // 2. Did the move just played complete the mover's mission?
  const ply = actions.length - 1;
  const a = actions[ply];
  if (!a || a.t !== 'move' || states.length !== actions.length + 1) return null;
  const player = states[ply].turn;
  const id = party.missions[player];
  if (!id || id === '?' || ch[player] || missionOff(now, player)) return null;
  const made = movesMade(now, player);
  if (made <= (party.gate[player] ?? 10)) return null;
  const ctx = { states, ply, move: a as MoveAction, player, movesMade: made };
  if (!missionDone(id, ctx)) return null;
  // The weaker player's open mission wins at once.
  if (missionWinsAtOnce(party, player, id)) return { t: 'mission', by: player, id, stage: 'win' };
  const turns = Math.max(party.defence?.[player] ?? MISSION_DEFENCE_TURNS, missionIsOpen(party, player) ? 1 : 0);
  return { t: 'mission', by: player, id, stage: 'reveal', target: missionTarget(id, ctx), turns };
}

/** Run the referee until it has nothing more to add. Returns the new states and actions. */
export function refereeAll(states: GameState[], actions: Action[], party: PartySetup): { states: GameState[]; actions: Action[]; added: Action[] } {
  const added: Action[] = [];
  for (let i = 0; i < 4; i++) {
    const a = refereeMission(states, actions, party);
    if (!a) break;
    added.push(a);
    actions = [...actions, a];
    states = [...states, play(states[states.length - 1], a)];
  }
  return { states, actions, added };
}

/** The player's mission was undone and is out of play. */
export function missionOff(s: GameState, player: PlayerId): boolean {
  return !!(s.modeData?.missionsOff as Record<string, string> | undefined)?.[player];
}

/**
 * Moves that stop the other player's open mission (the weaker player's, which
 * wins at once) from being done on their very next move. Empty when there is
 * nothing to block, when every move is already safe, or when no move is.
 */
export function blockingMoves(states: GameState[], actions: Action[], party: PartySetup, defender: PlayerId): MoveAction[] {
  const s = states[states.length - 1];
  if (!s || s.result || s.turn !== defender) return [];
  const opp = (Object.keys(party.missions) as PlayerId[]).find((k) => k !== defender);
  const id = opp ? party.missions[opp] : undefined;
  if (!opp || !id || id === '?' || !missionIsOpen(party, opp) || missionOff(s, opp)) return [];
  // Missions only count after the gate.
  if (movesMade(s, opp) + 1 <= (party.gate[opp] ?? 10)) return [];
  const mine = legalActions(s);
  const safe = mine.filter((m) => {
    let a: GameState;
    try { a = play(s, m); } catch { return false; }
    if (a.result || a.turn !== opp) return true;
    const st1 = [...states, a];
    const ac1 = [...actions, m];
    for (const r of legalActions(a)) {
      let b: GameState;
      try { b = play(a, r); } catch { continue; }
      const ctx = { states: [...st1, b], ply: ac1.length, move: r, player: opp, movesMade: movesMade(b, opp) };
      if (missionDone(id, ctx)) return false;
    }
    return true;
  });
  return safe.length && safe.length < mine.length ? safe : [];
}

/**
 * Looking further: the other player's two-move plans for their open mission
 * (as if the defender did nothing), and the defender's moves that spoil the
 * most of them. Empty when there is no plan, or nothing helps.
 */
export function blockingMoves2(states: GameState[], party: PartySetup, defender: PlayerId, maxPlans = 24): MoveAction[] {
  const s = states[states.length - 1];
  if (!s || s.result || s.turn !== defender) return [];
  const opp = (Object.keys(party.missions) as PlayerId[]).find((k) => k !== defender);
  const id = opp ? party.missions[opp] : undefined;
  if (!opp || !id || id === '?' || !missionIsOpen(party, opp) || missionOff(s, opp)) return [];
  if (movesMade(s, opp) + 2 <= (party.gate[opp] ?? 10)) return [];
  const history = states.slice(0, -1);
  /** Does the plan r1 then r2 still finish the mission from position `from` (opponent to move twice)? */
  const works = (from: GameState, r1: MoveAction, r2: MoveAction, pre: GameState[]): boolean => {
    const a0 = { ...from, turn: opp };
    if (!legalActions(a0).some((m) => m.piece === r1.piece && m.to === r1.to && m.promo === r1.promo)) return false;
    const a = { ...advance(a0, r1), turn: opp };
    if (a.result) return false;
    if (!legalActions(a).some((m) => m.piece === r2.piece && m.to === r2.to && m.promo === r2.promo)) return false;
    const b = advance(a, r2);
    const arr = [...pre, a0, a, b];
    return missionDone(id, { states: arr, ply: arr.length - 2, move: r2, player: opp, movesMade: movesMade(b, opp) });
  };
  // 1. The plans.
  const plans: [MoveAction, MoveAction][] = [];
  const pass = { ...s, turn: opp };
  for (const r1 of legalActions(pass)) {
    const a = { ...advance(pass, r1), turn: opp };
    if (a.result) continue;
    for (const r2 of legalActions(a)) {
      const b = advance(a, r2);
      const arr = [...history, pass, a, b];
      if (missionDone(id, { states: arr, ply: arr.length - 2, move: r2, player: opp, movesMade: movesMade(b, opp) })) { plans.push([r1, r2]); break; }
    }
    if (plans.length >= maxPlans) break;
  }
  if (!plans.length) return [];
  // 2. My moves that leave the fewest plans working.
  let best = plans.length;
  let out: MoveAction[] = [];
  for (const m of legalActions(s)) {
    let n: GameState;
    try { n = play(s, m); } catch { continue; }
    if (n.result) continue;
    const left = plans.filter(([r1, r2]) => works(n, r1, r2, [...history, s])).length;
    if (left < best) { best = left; out = [m]; } else if (left === best && left < plans.length) out.push(m);
  }
  return best < plans.length ? out : [];
}

/** What a bot should limit itself to: undo a shown mission, else block an open one (next move first, then two moves ahead). Empty: play normally. */
export function defenceMoves(states: GameState[], actions: Action[], party: PartySetup, bot: PlayerId): MoveAction[] {
  const s = states[states.length - 1];
  const undo = undoingMoves(s, bot);
  if (undo.length) return undo;
  const now = blockingMoves(states, actions, party, bot);
  if (now.length) return now;
  // Nothing to stop this move: look two moves ahead, but never walk into a mission done next move.
  const later = blockingMoves2(states, party, bot);
  return later;
}

/** Moves that undo a shown mission of the other player (for bots, and for hints). */
export function undoingMoves(s: GameState, defender: PlayerId): MoveAction[] {
  const ch = missionChallenges(s);
  const owners = (Object.keys(ch) as PlayerId[]).filter((o) => o !== defender);
  if (!owners.length || s.turn !== defender) return [];
  return legalActions(s).filter((m) => {
    try {
      const n = play(s, m);
      return owners.some((o) => !missionHolds(ch[o]!.id, n, o, ch[o]!.target));
    } catch { return false; }
  });
}

/** Missions go live after this many moves (for the "missions are live" banner). */
export function missionsLive(s: GameState, party: PartySetup, player: PlayerId): boolean {
  return movesMade(s, player) >= (party.gate[player] ?? 10);
}
