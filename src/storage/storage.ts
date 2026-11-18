import type { GameRecord } from '../core/record';
import { START_RATING } from '../systems/rating';
import type { PuzzleProgress } from '../systems/puzzle';
import type { MyLine, Nemesis } from '../systems/nemesis';
import { DEFAULT_SKINS, FREE_LANDSCAPES, FREE_SKINS, type LandscapeId, type SkinChoice, type SkinId } from '../content/cosmetics';

/**
 * Local persistence (docs/04 section 7). Everything lives in localStorage under
 * one versioned key. Reads and writes are wrapped so a blocked or full storage
 * never breaks the app; the app then runs with in-memory data.
 */

export interface Profile {
  id: string;
  nickname: string;
  colour: string;
  rating: number;
  gamesPlayed: number;
  ratingHistory: { at: number; rating: number }[];
  botRecords: Record<string, { w: number; l: number; d: number }>;
  // Used from phase 2 onward; present now so the schema stays stable.
  collection: Record<string, number>;
  cardProgress: Record<string, number>;
  modeDeck: string[];
  partyMatches: number;
  missMap: Record<string, { missed: number; found: number }>;
  badges: Record<string, number>;
  missionsCompleted: number;
  lastAlert?: string;
  /** Coins earned by playing, spent in the Wardrobe. */
  coins: number;
  owned: { skins: SkinId[]; landscapes: LandscapeId[] };
  /** Everyone this player has played (bots and online players), for the leaderboard. */
  opponents: Record<string, Opponent>;
  /** This player's chosen look. */
  look: { skins: SkinChoice; landscape: LandscapeId };
  /** Puzzle streak and solves (systems/puzzle.ts). */
  puzzles: PuzzleProgress;
  /** Nemesis bots built from Chess.com players (newest first, at most 6). */
  nemeses: Nemesis[];
  /** Your own classic-game openings (newest first), for the Mirror bot. */
  myLines?: MyLine[];
  /** The Mirror bot: plays your openings and learns from games against you. */
  mirror?: Nemesis;
  /** Power cards picked for the next party match (only cards still in the collection count). */
  partyHand?: string[];
  /** How often each mode should come up in Party matches, 0 (never) to 3 (favourite). */
  modePrefs?: Record<string, number>;
}

export interface Opponent {
  name: string;
  kind: 'bot' | 'online';
  /** Their rating the last time you played them. */
  rating: number;
  w: number;
  l: number;
  d: number;
  last: number;
}

export interface Settings {
  sound: boolean;
  showCoordinates: boolean;
  landscape: LandscapeId;
  skins: SkinChoice;
  chesscomEnabled: boolean;
  /** Board shake, nudges and phone buzz. */
  shake: boolean;
}

export interface SaveData {
  version: 1;
  profiles: Profile[];
  activeProfileId: string | null;
  games: Record<string, GameRecord[]>;
  settings: Settings;
}

const KEY = 'chess-chaos:save';
const MAX_GAMES = 50;

export const DEFAULT_SETTINGS: Settings = { sound: true, showCoordinates: true, landscape: 'meadow', skins: DEFAULT_SKINS, chesscomEnabled: true, shake: true };

function empty(): SaveData {
  return { version: 1, profiles: [], activeProfileId: null, games: {}, settings: { ...DEFAULT_SETTINGS } };
}

/** One migration function per version. Version 1 is the first. */
function migrate(raw: unknown): SaveData {
  const d = raw as Partial<SaveData> | null;
  if (!d || typeof d !== 'object' || d.version !== 1) return empty();
  return {
    ...empty(),
    ...d,
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}), skins: { ...DEFAULT_SKINS, ...(d.settings?.skins ?? {}) } },
    profiles: (d.profiles ?? []).map((p) => {
      const fresh = newProfile(p.nickname ?? 'Player', p.colour ?? '#4a90d9');
      const merged = { ...fresh, ...p };
      // Profiles from before the shop keep whatever look the device had.
      if (!p.look) merged.look = { skins: { ...DEFAULT_SKINS, ...(d.settings?.skins ?? {}) }, landscape: d.settings?.landscape ?? 'meadow' };
      return merged;
    }),
  } as SaveData;
}

let memory: SaveData | null = null;
const listeners = new Set<() => void>();

const BACKUP_KEY = `${KEY}:backup`;
const RESCUE_PREFIX = `${KEY}:rescue:`;

/** Keep a copy of anything we could not read, so a bug can never wipe a save for good. */
function rescue(raw: string) {
  try { globalThis.localStorage?.setItem(`${RESCUE_PREFIX}${Date.now()}`, raw); } catch { /* full */ }
}

export function load(): SaveData {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(KEY) ?? null;
    const parsed = raw ? JSON.parse(raw) : null;
    memory = migrate(parsed);
    if (raw && !memory.profiles.length && (parsed as Partial<SaveData> | null)?.profiles?.length) rescue(raw);
  } catch {
    if (raw) rescue(raw);
    memory = empty();
  }
  return memory;
}

export function save(next: SaveData) {
  memory = next;
  try {
    const json = JSON.stringify(next);
    globalThis.localStorage?.setItem(KEY, json);
    // A second copy, only ever written while there are players, so it survives an accidental wipe.
    if (next.profiles.length) globalThis.localStorage?.setItem(BACKUP_KEY, json);
  } catch {
    // Storage full: drop the oldest saved games and try once more, rather than losing progress.
    try {
      const slim = { ...next, games: Object.fromEntries(Object.entries(next.games).map(([k, g]) => [k, g.slice(-30)])) };
      globalThis.localStorage?.setItem(KEY, JSON.stringify(slim));
    } catch { /* blocked: keep running from memory */ }
  }
  listeners.forEach((l) => l());
}

/** A save with players found in the backup or a rescue copy, when the main save has none. */
export function findLostSave(): SaveData | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const keys = [BACKUP_KEY, ...Object.keys(ls).filter((k) => k.startsWith(RESCUE_PREFIX)).sort().reverse()];
    for (const k of keys) {
      const raw = ls.getItem(k);
      if (!raw) continue;
      try {
        const d = migrate(JSON.parse(raw));
        if (d.profiles.length) return d;
      } catch { /* try the next one */ }
    }
  } catch { /* storage blocked */ }
  return null;
}

/** Ask the browser not to clear our storage when space runs low (best effort). */
export function askToKeepStorage() {
  try { void globalThis.navigator?.storage?.persist?.(); } catch { /* not supported */ }
}

/** The whole save as text, for a backup file. */
export function exportSave(): string {
  return JSON.stringify({ app: 'chess-chaos', exportedAt: new Date().toISOString(), save: load() });
}

/** Load a backup file. Players already on this device are kept; same players are replaced by the backup. */
export function importSave(text: string): { players: number } {
  const parsed = JSON.parse(text) as { app?: string; save?: unknown };
  const incoming = migrate(parsed?.app === 'chess-chaos' ? parsed.save : parsed);
  if (!incoming.profiles.length) throw new Error('That file has no players in it.');
  update((d) => {
    const ids = new Set(incoming.profiles.map((p) => p.id));
    return {
      ...d,
      profiles: [...d.profiles.filter((p) => !ids.has(p.id)), ...incoming.profiles],
      games: { ...d.games, ...incoming.games },
      activeProfileId: d.activeProfileId ?? incoming.activeProfileId ?? incoming.profiles[0].id,
      settings: d.profiles.length ? d.settings : incoming.settings,
    };
  });
  return { players: incoming.profiles.length };
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function update(fn: (d: SaveData) => SaveData) {
  save(fn(load()));
}

export function newProfile(nickname: string, colour: string): Profile {
  return {
    id: `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    nickname,
    colour,
    rating: START_RATING,
    gamesPlayed: 0,
    ratingHistory: [{ at: Date.now(), rating: START_RATING }],
    botRecords: {},
    collection: {},
    cardProgress: {},
    modeDeck: [],
    partyMatches: 0,
    missMap: {},
    badges: {},
    missionsCompleted: 0,
    coins: 20,
    opponents: {},
    owned: { skins: [...FREE_SKINS], landscapes: [...FREE_LANDSCAPES] },
    look: { skins: DEFAULT_SKINS, landscape: 'meadow' },
    puzzles: { streak: 0, best: 0, lastDaily: '', solved: 0, paid: [] },
    nemeses: [],
  };
}

/** The active player's look, or the device default when nobody is picked. */
export function lookOf(d: SaveData = load()): { skins: SkinChoice; landscape: LandscapeId } {
  const p = activeProfile(d);
  return p?.look ?? { skins: d.settings.skins, landscape: d.settings.landscape };
}

/** Record a finished game against someone, for the leaderboard. */
export function noteOpponent(p: Profile, o: { key: string; name: string; kind: 'bot' | 'online'; rating: number; score: number }): Profile {
  const prev = p.opponents?.[o.key] ?? { name: o.name, kind: o.kind, rating: o.rating, w: 0, l: 0, d: 0, last: 0 };
  const next: Opponent = {
    ...prev, name: o.name, rating: o.rating, last: Date.now(),
    w: prev.w + (o.score === 1 ? 1 : 0), l: prev.l + (o.score === 0 ? 1 : 0), d: prev.d + (o.score === 0.5 ? 1 : 0),
  };
  return { ...p, opponents: { ...(p.opponents ?? {}), [o.key]: next } };
}

/** An online opponent's rating changed (they finished a game): keep the leaderboard current. */
export function refreshOpponentRating(key: string, rating: number) {
  updateProfile((p) => {
    const o = p.opponents?.[key];
    return o && o.rating !== rating ? { ...p, opponents: { ...p.opponents, [key]: { ...o, rating } } } : p;
  });
}

/** Change the active player's profile in one step. */
export function updateProfile(fn: (p: Profile) => Profile) {
  update((d) => {
    const p = activeProfile(d);
    return p ? upsertProfile(d, fn(p)) : d;
  });
}

export function activeProfile(d: SaveData = load()): Profile | undefined {
  return d.profiles.find((p) => p.id === d.activeProfileId);
}

export function upsertProfile(d: SaveData, p: Profile): SaveData {
  const exists = d.profiles.some((x) => x.id === p.id);
  return { ...d, profiles: exists ? d.profiles.map((x) => (x.id === p.id ? p : x)) : [...d.profiles, p] };
}

export function addGame(d: SaveData, profileId: string, rec: GameRecord): SaveData {
  const list = (d.games[profileId] ?? []).filter((g) => g.id !== rec.id);
  return { ...d, games: { ...d.games, [profileId]: [rec, ...list].slice(0, MAX_GAMES) } };
}

/** For tests. */
export function resetMemory() {
  memory = null;
}

/** Tests only: forget the in-memory copy so the next load reads storage again. */
export function resetMemoryForTests() {
  memory = null;
}
