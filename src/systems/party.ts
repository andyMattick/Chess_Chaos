import { MISSIONS, MODIFIERS, type ModifierDef } from '../content/party';
import { IMPLEMENTED } from '../core/modifiers';
import { movesMade } from '../core/modifiers';
import type { GameRecord } from '../core/record';
import type { Action, GameState, MoveAction, PlayerId } from '../core/types';
import { missionDone } from './missions';

/**
 * Party match pipeline (docs/02): draw a mode from the player's mode deck,
 * give buffs/handicaps from the rating gap, deal secret missions, and referee
 * the missions after every move.
 */

/** Modes in the deck. Classic chess appears three times (docs/08 Q6). */
export const PARTY_DECK = [
  'standard', 'standard', 'standard', 'koth', 'three-check', 'capture-race', 'random-piece', 'truce', 'capture-the-flag', 'shuffle', 'hill-wars',
  'atomic', 'giveaway', 'racing-kings', 'wrap', 'lava', 'mini', 'horde', 'monster', 'shrinking', 'progressive', 'drop-in', 'boss', 'mystery-army', 'hidden-queen', 'card-chess',
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
}

function eligible(def: ModifierDef, mode: string, who: PartyPlayer, online: boolean): boolean {
  if (!IMPLEMENTED.has(def.id)) return false;
  if (who.bot && (def.humanOnly || def.oneShot)) return false; // bots only get always-on rules
  if (def.botGameOnly && online) return false;
  const removed = MODE_REMOVES[mode] ?? [];
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
  for (const tier of slots.underdog) {
    const m = pick(MODIFIERS.filter((d) => d.kind === 'buff' && d.tier === tier && !out[underdog].includes(d.id) && eligible(d, o.mode, o.players[underdog], o.online)), rand);
    if (m) out[underdog].push(m.id);
  }
  for (const tier of slots.favourite) {
    const m = pick(MODIFIERS.filter((d) => d.kind === 'handicap' && d.tier === tier && eligible(d, o.mode, o.players[favourite], o.online)), rand);
    if (m) out[favourite].push(m.id);
  }
  return out;
}

/** docs/02 s5: Medium for both when close; Hard for the favourite when the gap is 200+. Never the same mission twice. */
export function dealMissions(o: PartyOptions, rand: () => number): Record<'p1' | 'p2', string> {
  const pool = (cat: 'Medium' | 'Hard') => MISSIONS.filter((m) => m.category === cat && !(o.mode === 'three-check' && m.id === 'MISSION-12'));
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
  return { modifiers: pickModifiers(o, rand), missions: dealMissions(o, rand), gate: { p1: gate, p2: gate } };
}

/** Hide the other player's mission (online, and on screen). */
export function redactParty(p: PartySetup, viewer: PlayerId | null): PartySetup {
  const missions: PartySetup['missions'] = {};
  for (const [k, v] of Object.entries(p.missions)) missions[k as PlayerId] = k === viewer ? v : '?';
  return { ...p, missions };
}

/**
 * Referee: call after every move. If the player who just moved has now
 * completed their secret mission (after the gate), returns the mission action
 * to append; otherwise null.
 */
export function refereeMission(states: GameState[], actions: Action[], party: PartySetup): Action | null {
  const ply = actions.length - 1;
  const a = actions[ply];
  const after = states[ply + 1];
  if (!a || a.t !== 'move' || !after || after.result) return null;
  const player = states[ply].turn;
  const id = party.missions[player];
  if (!id || id === '?') return null;
  const made = movesMade(after, player);
  if (made <= (party.gate[player] ?? 10)) return null;
  return missionDone(id, { states, ply, move: a as MoveAction, player, movesMade: made }) ? { t: 'mission', by: player, id } : null;
}

/** Missions go live after this many moves (for the "missions are live" banner). */
export function missionsLive(s: GameState, party: PartySetup, player: PlayerId): boolean {
  return movesMade(s, player) >= (party.gate[player] ?? 10);
}
