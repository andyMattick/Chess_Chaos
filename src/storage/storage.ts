import type { GameRecord } from '../core/record';
import { START_RATING } from '../systems/rating';
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
  /** This player's chosen look. */
  look: { skins: SkinChoice; landscape: LandscapeId };
}

export interface Settings {
  sound: boolean;
  showCoordinates: boolean;
  landscape: LandscapeId;
  skins: SkinChoice;
  chesscomEnabled: boolean;
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

export const DEFAULT_SETTINGS: Settings = { sound: true, showCoordinates: true, landscape: 'meadow', skins: DEFAULT_SKINS, chesscomEnabled: true };

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

export function load(): SaveData {
  if (memory) return memory;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    memory = migrate(raw ? JSON.parse(raw) : null);
  } catch {
    memory = empty();
  }
  return memory;
}

export function save(next: SaveData) {
  memory = next;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep running from memory.
  }
  listeners.forEach((l) => l());
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
    owned: { skins: [...FREE_SKINS], landscapes: [...FREE_LANDSCAPES] },
    look: { skins: DEFAULT_SKINS, landscape: 'meadow' },
  };
}

/** The active player's look, or the device default when nobody is picked. */
export function lookOf(d: SaveData = load()): { skins: SkinChoice; landscape: LandscapeId } {
  const p = activeProfile(d);
  return p?.look ?? { skins: d.settings.skins, landscape: d.settings.landscape };
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
