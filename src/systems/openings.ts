import type { BookLine } from '../content/bots';
import { play, sameMove } from '../core/rules';
import { parseSAN } from '../core/san';
import { standardStart } from '../core/setup';
import type { GameState, MoveAction } from '../core/types';

/**
 * Opening trainer (docs/07 phase 8, docs/05 "learn this opening"): a bot
 * quizzes you on its own opening lines. You play your side's moves, the bot
 * plays the other side's. Spaced repetition, Leitner style: a line you play
 * without a slip comes back later and later; a slip sends it back to the start.
 * Pure: the UI keeps the cards in the profile.
 */
export interface OpeningCard {
  /** Leitner box, 0 (new or slipped) to 5. */
  box: number;
  /** When it is due again (ms). */
  due: number;
  /** Times played, and times played with no slip. */
  seen: number;
  clean: number;
}

/** Days until a line comes back, by box. */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
export const DAY = 24 * 3600 * 1000;
/** Plies of a line the trainer uses (the first 8 moves each). */
export const TRAINER_PLIES = 16;
/** Lines per session. */
export const SESSION_LINES = 5;

export type Colour = 'w' | 'b';

export function cardKey(botId: string, colour: Colour, line: string): string {
  return `${botId}|${colour}|${line}`;
}

/** A book's lines for one colour, cut to the trainer length, legal and without repeats. */
export function trainerLines(book: { asWhite: BookLine[]; asBlack: BookLine[] }, colour: Colour): string[] {
  const out: string[] = [];
  for (const l of colour === 'w' ? book.asWhite : book.asBlack) {
    const moves = l.line.split(' ').filter(Boolean).slice(0, TRAINER_PLIES);
    // The line must have at least one move for you.
    if (moves.length < (colour === 'w' ? 1 : 2)) continue;
    const text = moves.join(' ');
    if (!out.includes(text) && lineMoves(text)) out.push(text);
  }
  return out;
}

/** The line as moves from the start, or null if one is not legal. */
export function lineMoves(line: string): { states: GameState[]; moves: MoveAction[] } | null {
  let s = standardStart();
  const states = [s];
  const moves: MoveAction[] = [];
  for (const san of line.split(' ')) {
    const m = parseSAN(s, san);
    if (!m) return null;
    moves.push(m);
    s = play(s, m);
    states.push(s);
  }
  return { states, moves };
}

/** Is this the line's move at this ply? */
export function isLineMove(line: { moves: MoveAction[] }, ply: number, m: MoveAction): boolean {
  const want = line.moves[ply];
  return !!want && sameMove(want, m);
}

/** After playing a line: no slips, up a box; any slip, back to box 0 (due now). */
export function grade(card: OpeningCard | undefined, slips: number, now: number): OpeningCard {
  const c = card ?? { box: 0, due: now, seen: 0, clean: 0 };
  const box = slips === 0 ? Math.min(INTERVAL_DAYS.length - 1, c.box + 1) : 0;
  return { box, due: now + INTERVAL_DAYS[box] * DAY, seen: c.seen + 1, clean: c.clean + (slips === 0 ? 1 : 0) };
}

/** Lines to play now: due ones first (oldest first), then new ones, up to `max`. */
export function sessionLines(lines: string[], cards: Record<string, OpeningCard>, key: (line: string) => string, now: number, max = SESSION_LINES): string[] {
  const due = lines.filter((l) => cards[key(l)] && cards[key(l)].due <= now).sort((a, b) => cards[key(a)].due - cards[key(b)].due);
  const fresh = lines.filter((l) => !cards[key(l)]);
  return [...due, ...fresh].slice(0, max);
}

/** How a bot's lines stand for you: learned (box 3+), due now, new. */
export function trainerStats(lines: string[], cards: Record<string, OpeningCard>, key: (line: string) => string, now: number) {
  let learned = 0, due = 0, fresh = 0;
  for (const l of lines) {
    const c = cards[key(l)];
    if (!c) fresh++;
    else {
      if (c.box >= 3) learned++;
      if (c.due <= now) due++;
    }
  }
  return { total: lines.length, learned, due, fresh };
}

/** Lines you have played that are due again (for the Home tile). */
export function dueCount(cards: Record<string, OpeningCard> | undefined, now = Date.now()): number {
  return Object.values(cards ?? {}).filter((c) => c.due <= now && c.seen > 0).length;
}
