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

export interface SeatInfo {
  name: string;
  rating: number;
  connected: boolean;
  /** A bot is playing this seat because its player left. */
  botControlled: boolean;
}

export type ClientMsg =
  | { t: 'create'; name: string; rating: number; colour: 'p1' | 'p2' | 'random' }
  | { t: 'join'; code: string; name: string; rating: number }
  | { t: 'rejoin'; code: string; token: string }
  | { t: 'action'; action: Action }
  | { t: 'emote'; id: EmoteId }
  | { t: 'rematch' }
  | { t: 'leave' };

export type ServerMsg =
  | { t: 'joined'; code: string; seat: PlayerId; token: string }
  | { t: 'room'; code: string; record: GameRecord; seats: Partial<Record<PlayerId, SeatInfo>>; rematchVotes: PlayerId[] }
  | { t: 'emote'; from: PlayerId; id: EmoteId }
  | { t: 'error'; message: string };

const NAME_BLOCK = /(fuck|shit|bitch|cunt|dick|nigg|fag|slut|whore|rape|nazi|porn|sex)/i;

/** Nicknames: short, letters/numbers/spaces, and passed through a block list. */
export function cleanName(raw: string): string {
  const s = String(raw ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16);
  if (!s || NAME_BLOCK.test(s.replace(/[\s_-]/g, ''))) return 'Player';
  return s;
}
