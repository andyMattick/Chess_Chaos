import type { GameRecord } from '../core/record';
import type { Action, PlayerId } from '../core/types';

/**
 * Online room protocol (docs/09 section 2). The server is authoritative: it
 * runs the same engine, validates every action and sends each seat the state
 * it is allowed to see. No free-text chat: emotes are picked from a fixed list.
 */

export const EMOTES = [
  { id: 'nice', text: '👍 Nice move!' },
  { id: 'oops', text: '😬 Oops' },
  { id: 'wow', text: '😮 Whoa' },
  { id: 'laugh', text: '😂' },
  { id: 'think', text: '🤔 Hmm…' },
  { id: 'gg', text: '🤝 Good game' },
  { id: 'again', text: '🔁 Rematch?' },
] as const;
export type EmoteId = (typeof EMOTES)[number]['id'];

/** How a player's army looks (their Wardrobe choice), shown to everyone in the room. */
export interface ArmyLook {
  army: string;
  pieces: Record<string, string>;
}

const SKIN_ID = /^[a-z]{2,12}$/;
const PIECE_ID = /^(king|queen|rook|bishop|knight|pawn)$/;
export function cleanLook(raw: unknown): ArmyLook | undefined {
  const l = raw as ArmyLook | undefined;
  if (!l || typeof l.army !== 'string' || !SKIN_ID.test(l.army)) return undefined;
  const pieces: Record<string, string> = {};
  for (const [k, v] of Object.entries(l.pieces ?? {})) if (PIECE_ID.test(k) && typeof v === 'string' && SKIN_ID.test(v)) pieces[k] = v;
  return { army: l.army, pieces };
}

export interface SeatInfo {
  look?: ArmyLook;
  name: string;
  rating: number;
  connected: boolean;
  /** A bot is playing this seat because its player left. */
  botControlled: boolean;
  /** Training wheels: this player has danger alerts and hints on (2-player games only). */
  wheels?: boolean;
}

/** Minutes per player plus seconds added after each move. null = no clock. */
export interface ClockSetting { minutes: number; increment: number }

export const CLOCK_CHOICES: { label: string; setting: ClockSetting | null }[] = [
  { label: '⚡ 3 min', setting: { minutes: 3, increment: 2 } },
  { label: '⏱ 5 min', setting: { minutes: 5, increment: 3 } },
  { label: '🐢 10 min', setting: { minutes: 10, increment: 5 } },
  { label: '😌 No clock', setting: null },
];

export interface ClockState {
  /** Milliseconds left per seat at the moment the message was sent. */
  left: Partial<Record<PlayerId, number>>;
  running: PlayerId | null;
  increment: number;
}

/** What kind of game a room plays. */
export type RoomGame = 'standard' | 'party' | 'koth' | 'hill-wars' | 'three-check' | 'capture-race' | 'random-piece' | 'truce' | 'capture-the-flag' | 'shuffle' | 'battle-3' | 'battle-4' | 'battle-teams' | 'battle-hill-4';

export const ROOM_GAMES: { id: RoomGame; label: string; seats: number; blurb: string }[] = [
  { id: 'standard', label: '♟️ Classic', seats: 2, blurb: 'Normal chess, 1 vs 1.' },
  { id: 'party', label: '🎉 Party match', seats: 2, blurb: 'Surprise mode, secret missions, and buffs or handicaps from your ratings.' },
  { id: 'koth', label: '⛰️ King of the hill', seats: 2, blurb: 'Get your king to the middle 4 squares to win.' },
  { id: 'hill-wars', label: '🚩 Hill wars', seats: 2, blurb: 'Hold the middle squares to score. First to 20.' },
  { id: 'three-check', label: '✔️ Three-check', seats: 2, blurb: 'Give check three times to win. Or checkmate.' },
  { id: 'capture-race', label: '🏁 Capture race', seats: 2, blurb: 'First to capture 15 points of pieces wins.' },
  { id: 'random-piece', label: '🎲 Dice chess', seats: 2, blurb: 'The dice picks which kind of piece you must move.' },
  { id: 'truce', label: '🕊️ Truce', seats: 2, blurb: 'No captures for the first 10 moves each. Then BOOM.' },
  { id: 'capture-the-flag', label: '🏳️ Capture the flag', seats: 2, blurb: 'Land a piece on the enemy flag and survive one turn.' },
  { id: 'shuffle', label: '🔀 Shuffle start', seats: 2, blurb: 'The back row is shuffled, the same for both sides.' },
  { id: 'battle-3', label: '⚔️ 3-way battle', seats: 3, blurb: 'Three armies, one winner. Capture kings to knock players out.' },
  { id: 'battle-4', label: '⚔️ 4-way battle', seats: 4, blurb: 'Four armies, every one for themselves.' },
  { id: 'battle-teams', label: '🤝 2 vs 2 teams', seats: 4, blurb: 'Partners sit opposite. Knock out both enemy kings.' },
  { id: 'battle-hill-4', label: '🚩 4-way Hill wars', seats: 4, blurb: 'Four armies fight over a big hill. First to 30.' },
];

export type ClientMsg =
  | { t: 'create'; name: string; rating: number; colour: 'p1' | 'p2' | 'random'; clock?: ClockSetting | null; game?: RoomGame; look?: ArmyLook; wheels?: boolean }
  | { t: 'fill-bots' }
  | { t: 'join'; code: string; name: string; rating: number; look?: ArmyLook; wheels?: boolean }
  | { t: 'rejoin'; code: string; token: string }
  | { t: 'action'; action: Action }
  | { t: 'emote'; id: EmoteId }
  | { t: 'wheels'; on: boolean }
  /** After a game: my new rating, so everyone's leaderboard shows it. */
  | { t: 'rating'; rating: number }
  | { t: 'rematch' }
  | { t: 'leave' };

export type ServerMsg =
  | { t: 'joined'; code: string; seat: PlayerId; token: string }
  | { t: 'room'; code: string; record: GameRecord; seats: Partial<Record<PlayerId, SeatInfo>>; seatIds: PlayerId[]; game: RoomGame; host: PlayerId | null; rematchVotes: PlayerId[]; clock: ClockState | null; score?: Partial<Record<PlayerId, number>>; gamesPlayed?: number }
  | { t: 'emote'; from: PlayerId; id: EmoteId }
  | { t: 'error'; message: string };

const NAME_BLOCK = /(fuck|shit|bitch|cunt|dick|nigg|fag|slut|whore|rape|nazi|porn|sex)/i;

/** Nicknames: short, letters/numbers/spaces, and passed through a block list. */
export function cleanName(raw: string): string {
  const s = String(raw ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16);
  if (!s || NAME_BLOCK.test(s.replace(/[\s_-]/g, ''))) return 'Player';
  return s;
}
