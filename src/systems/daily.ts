/**
 * Daily missions (owner, 2026-11-19): three small goals on the home screen
 * each day, picked from different corners of the app so a player tries a bit
 * of everything. Same three for everyone on the same date. Pure: no storage.
 */
export type DailyKind =
  | 'bot-win' | 'bot-play' | 'puzzle' | 'opening' | 'party' | 'mini'
  | 'lu-play' | 'lu-win' | 'lu-level' | 'lu-brave';

export type DailyGroup = 'play' | 'train' | 'fun' | 'levelup';

export interface DailyMission {
  id: string;
  kind: DailyKind;
  group: DailyGroup;
  need: number;
  coins: number;
  text: string;
  /** Where the home-screen button takes you. */
  go: 'bots' | 'puzzles' | 'openings' | 'party' | 'minis' | 'levelup';
}

export const DAILY_MISSIONS: DailyMission[] = [
  { id: 'D-bot-win', kind: 'bot-win', group: 'play', need: 1, coins: 15, text: 'Beat a bot', go: 'bots' },
  { id: 'D-bot-play', kind: 'bot-play', group: 'play', need: 2, coins: 10, text: 'Play 2 games against bots', go: 'bots' },
  { id: 'D-puzzle', kind: 'puzzle', group: 'train', need: 3, coins: 10, text: 'Solve 3 puzzles', go: 'puzzles' },
  { id: 'D-opening', kind: 'opening', group: 'train', need: 2, coins: 10, text: 'Practise 2 opening lines', go: 'openings' },
  { id: 'D-party', kind: 'party', group: 'fun', need: 1, coins: 15, text: 'Play a party match', go: 'party' },
  { id: 'D-mini', kind: 'mini', group: 'fun', need: 2, coins: 10, text: 'Play 2 mini-games', go: 'minis' },
  { id: 'D-lu-play', kind: 'lu-play', group: 'levelup', need: 1, coins: 10, text: 'Fight a Level-Up battle', go: 'levelup' },
  { id: 'D-lu-win', kind: 'lu-win', group: 'levelup', need: 1, coins: 20, text: 'Win a Level-Up battle', go: 'levelup' },
  { id: 'D-lu-level', kind: 'lu-level', group: 'levelup', need: 3, coins: 15, text: 'Level up 3 pieces in Level-Up Chess', go: 'levelup' },
  { id: 'D-lu-brave', kind: 'lu-brave', group: 'levelup', need: 1, coins: 15, text: 'Win a Level-Up battle against a stronger piece', go: 'levelup' },
];

/** Extra coins for finishing all three. */
export const DAILY_ALL_BONUS = 20;

export const dailyById = (id: string) => DAILY_MISSIONS.find((m) => m.id === id);

/** Local calendar date as YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Three missions from three different groups, the same for a given date. */
export function pickDaily(day: string): string[] {
  let h = hash(`daily:${day}`);
  const next = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = (h ^ (h >>> 13)) >>> 0; return h; };
  const groups: DailyGroup[] = ['play', 'train', 'fun', 'levelup'];
  // Drop one group a day; Level-Up is always in, so the new game gets tried.
  const drop = ['play', 'train', 'fun'][next() % 3];
  return groups.filter((g) => g !== drop).map((g) => {
    const pool = DAILY_MISSIONS.filter((m) => m.group === g);
    return pool[next() % pool.length].id;
  });
}

export interface DailyState {
  date: string;
  ids: string[];
  progress: Record<string, number>;
  claimed: string[];
  bonus?: boolean;
}

/** Today's state, starting fresh when the date has changed. */
export function dailyFor(state: DailyState | undefined, day: string): DailyState {
  if (state && state.date === day) return state;
  return { date: day, ids: pickDaily(day), progress: {}, claimed: [] };
}

/** Count one more of something toward today's missions. */
export function noteKind(state: DailyState, kind: DailyKind, n = 1): DailyState {
  const progress = { ...state.progress };
  let changed = false;
  for (const id of state.ids) {
    const m = dailyById(id);
    if (!m || m.kind !== kind) continue;
    const was = progress[id] ?? 0;
    if (was >= m.need) continue;
    progress[id] = Math.min(m.need, was + n);
    changed = true;
  }
  return changed ? { ...state, progress } : state;
}

export const isDone = (state: DailyState, id: string) => (state.progress[id] ?? 0) >= (dailyById(id)?.need ?? Infinity);

/** Claim one finished mission: the coins to add, and the new state. */
export function claim(state: DailyState, id: string): { state: DailyState; coins: number } {
  const m = dailyById(id);
  if (!m || !state.ids.includes(id) || !isDone(state, id) || state.claimed.includes(id)) return { state, coins: 0 };
  let next: DailyState = { ...state, claimed: [...state.claimed, id] };
  let coins = m.coins;
  if (!next.bonus && next.ids.every((x) => next.claimed.includes(x))) { next = { ...next, bonus: true }; coins += DAILY_ALL_BONUS; }
  return { state: next, coins };
}
