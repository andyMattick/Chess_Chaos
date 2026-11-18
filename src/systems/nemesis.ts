import { parsePGN } from '../chesscom/pgn';
import { positionKey } from '../core/position';
import { play } from '../core/rules';
import { parseSAN } from '../core/san';
import { standardStart } from '../core/setup';
import type { Bot, BookLine } from '../content/bots';
import type { GameRecord } from '../core/record';
import { STANDARD_FEN } from '../core/setup';

/**
 * Nemesis bot (docs/06 CC-04): "play like any player". Built only from that
 * player's public games: their openings become the bot's opening book, their
 * rating sets its strength. No AI service; the middle game is our own engine.
 */
export interface NemesisGame {
  pgn?: string;
  rules: string;
  white: { username: string; result: string };
  black: { username: string; result: string };
}

export interface Nemesis {
  /** Chess.com username, lower case. */
  key: string;
  name: string;
  /** Bot strength used in game and for rating maths (capped). */
  rating: number;
  /** Their real Chess.com rating, shown on the card. */
  ccRating: number | null;
  games: number;
  record: { w: number; l: number; d: number };
  asWhite: BookLine[];
  asBlack: BookLine[];
  topWhite: string[];
  topBlack: string[];
  /** e.g. "e4", their usual first move as White. */
  firstMove: string | null;
  builtAt: number;
  /** The Mirror bot: built from your own games, not a Chess.com player. */
  mirror?: boolean;
  /** Games this bot played against you (it learns from them). */
  vsYou?: { w: number; l: number; d: number };
  /** How many games changed its book. */
  learned?: number;
}

/** How deep the book goes: the player's first 12 moves (docs/06 CC-04 step 2). */
export const BOOK_PLIES = 24;
/** A move needs this many games behind it to go in the book. */
export const MIN_COUNT = 2;
/** The strongest bot setting (src/ai/strength.ts). */
export const MAX_NEMESIS_RATING = 1400;

/** Opening name from Chess.com's PGN headers: ECOUrl ".../openings/Sicilian-Defense-Alapin-Variation-2...c5" → "Sicilian Defense Alapin Variation". */
export function openingName(headers: Record<string, string>): string | null {
  if (headers.Opening) return headers.Opening;
  const url = headers.ECOUrl;
  if (!url) return null;
  const slug = decodeURIComponent(url.split('/').pop() ?? '');
  // Cut at the first move list ("-2...Nc6", "-3.Bb5").
  const name = slug.replace(/-\d+\..*$/, '').replace(/-/g, ' ').trim();
  return name || null;
}

function top(counts: Map<string, number>, n = 3): string[] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

/** Rating to play at: their rating, held between the weakest and strongest bot settings. */
export function nemesisStrength(ccRating: number | null): number {
  return Math.max(400, Math.min(MAX_NEMESIS_RATING, Math.round(ccRating ?? 800)));
}

export function buildNemesis(username: string, games: NemesisGame[], ccRating: number | null, now = Date.now()): Nemesis {
  const key = username.trim().toLowerCase();
  const parsed: { colour: 'w' | 'b'; san: string[]; headers: Record<string, string>; result: string }[] = [];
  for (const g of games) {
    if (g.rules !== 'chess' || !g.pgn) continue;
    const colour = g.white.username.toLowerCase() === key ? 'w' : g.black.username.toLowerCase() === key ? 'b' : null;
    if (!colour) continue;
    const { headers, san } = parsePGN(g.pgn);
    if (headers.SetUp === '1' || (headers.Variant && headers.Variant !== 'Standard')) continue;
    parsed.push({ colour, san, headers, result: colour === 'w' ? g.white.result : g.black.result });
  }

  const { asWhite, asBlack } = bookFrom(parsed);

  const openW = new Map<string, number>(), openB = new Map<string, number>(), first = new Map<string, number>();
  const record = { w: 0, l: 0, d: 0 };
  for (const g of parsed) {
    const name = openingName(g.headers);
    if (name) (g.colour === 'w' ? openW : openB).set(name, ((g.colour === 'w' ? openW : openB).get(name) ?? 0) + 1);
    if (g.colour === 'w' && g.san[0]) first.set(g.san[0], (first.get(g.san[0]) ?? 0) + 1);
    if (g.result === 'win') record.w++;
    else if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(g.result)) record.d++;
    else record.l++;
  }

  return {
    key, name: username.trim(), rating: nemesisStrength(ccRating), ccRating, games: parsed.length, record,
    asWhite, asBlack, topWhite: top(openW), topBlack: top(openB), firstMove: top(first, 1)[0] ?? null, builtAt: now,
  };
}

/**
 * Turn games into a book: each game is a line, cut before the first move the
 * player rarely plays (fewer than MIN_COUNT games). Only the player's own
 * moves are counted.
 */
export function bookFrom(games: { colour: 'w' | 'b'; san: string[] }[]): { asWhite: BookLine[]; asBlack: BookLine[] } {
  // Pass 1: walk each game's opening, counting the player's moves per position.
  const counts = new Map<string, number>();
  const walks: { colour: 'w' | 'b'; plies: { san: string; key: string; mine: boolean }[] }[] = [];
  for (const g of games) {
    let s = standardStart();
    const plies: { san: string; key: string; mine: boolean }[] = [];
    for (const t of g.san.slice(0, BOOK_PLIES)) {
      const m = parseSAN(s, t);
      if (!m) break;
      const mine = (s.turn === 'p1') === (g.colour === 'w');
      const k = `${positionKey(s)}|${m.piece}-${m.to}-${m.promo ?? ''}`;
      if (mine) counts.set(k, (counts.get(k) ?? 0) + 1);
      plies.push({ san: t, key: k, mine });
      s = play(s, m);
      if (s.result) break;
    }
    walks.push({ colour: g.colour, plies });
  }

  // Pass 2: each game becomes a book line.
  const asWhite: BookLine[] = [];
  const asBlack: BookLine[] = [];
  for (const w of walks) {
    const keep: string[] = [];
    let mineKept = 0;
    for (const p of w.plies) {
      if (p.mine && (counts.get(p.key) ?? 0) < MIN_COUNT) break;
      keep.push(p.san);
      if (p.mine) mineKept++;
    }
    if (!mineKept) continue;
    // Drop a trailing opponent move: it adds nothing for the bot.
    if (!w.plies[keep.length - 1]?.mine) keep.pop();
    (w.colour === 'w' ? asWhite : asBlack).push({ line: keep.join(' '), weight: 1 });
  }
  return { asWhite, asBlack };
}

/* ---------------------------------------------------------------------------
 * Learning on the phone (owner request, step 6). No AI service, no server:
 * - The Mirror bot is built from your own classic games, so it plays your openings.
 * - Every nemesis (and the Mirror) learns from games against you: openings
 *   that beat you get picked more, openings you beat get picked less.
 * ------------------------------------------------------------------------- */

/** One of your classic games, kept short: your colour, the first moves, your score. */
export interface MyLine { c: 'w' | 'b'; san: string; r: number }
export const MAX_MY_LINES = 150;
export const MIRROR_KEY = '@me';
/** Weight limits, so a line is never removed for good or picked every time. */
export const MIN_WEIGHT = 0.15;
export const MAX_WEIGHT = 8;

/** Your line from a finished classic game, or null if the game is not one (modes, parties, custom starts). */
export function myLineFrom(san: string[] | undefined, colour: 'w' | 'b', score: number): MyLine | null {
  if (!san || san.length < 4) return null;
  return { c: colour, san: san.slice(0, BOOK_PLIES).join(' '), r: score };
}

export function addMyLine(lines: MyLine[] | undefined, l: MyLine | null): MyLine[] {
  return l ? [l, ...(lines ?? [])].slice(0, MAX_MY_LINES) : lines ?? [];
}

/** Your lines from saved games (for players who played before the Mirror existed). */
export function linesFromRecords(recs: GameRecord[], nickname: string): MyLine[] {
  const out: MyLine[] = [];
  for (const r of recs) {
    if (r.setup.kind !== 'fen' || r.setup.fen !== STANDARD_FEN || r.setup.mode !== 'standard' || r.setup.party || !r.meta.result) continue;
    const seat = r.meta.players.p1 === nickname ? 'p1' : r.meta.players.p2 === nickname ? 'p2' : null;
    if (!seat) continue;
    const w = r.meta.result.winners;
    const l = myLineFrom(r.meta.san, seat === 'p1' ? 'w' : 'b', w.includes(seat) ? 1 : w.length ? 0 : 0.5);
    if (l) out.push(l);
  }
  return out.slice(0, MAX_MY_LINES);
}

/** Keep what a bot learned when its book is rebuilt (same line, same weight). */
function carry(book: BookLine[], old: BookLine[] | undefined): BookLine[] {
  const w = new Map((old ?? []).map((b) => [b.line, b.weight ?? 1]));
  return book.map((b) => ({ ...b, weight: w.get(b.line) ?? b.weight }));
}

/** The Mirror: a bot that plays your own openings at about your strength. */
export function buildMirror(lines: MyLine[], nickname: string, rating: number, old?: Nemesis, now = Date.now()): Nemesis {
  const { asWhite, asBlack } = bookFrom(lines.map((l) => ({ colour: l.c, san: l.san.split(' ') })));
  const firsts = new Map<string, number>();
  for (const l of lines) if (l.c === 'w') { const f = l.san.split(' ')[0]; firsts.set(f, (firsts.get(f) ?? 0) + 1); }
  const record = { w: 0, l: 0, d: 0 };
  for (const l of lines) { if (l.r === 1) record.w++; else if (l.r === 0) record.l++; else record.d++; }
  return {
    key: MIRROR_KEY, name: nickname, mirror: true, rating: nemesisStrength(rating), ccRating: null, games: lines.length, record,
    asWhite: carry(asWhite, old?.asWhite), asBlack: carry(asBlack, old?.asBlack), topWhite: [], topBlack: [],
    firstMove: top(firsts, 1)[0] ?? null, builtAt: now, vsYou: old?.vsYou, learned: old?.learned,
  };
}

/** How many of a line's moves the game followed from the start. */
function sharedPlies(line: string, san: string[]): number {
  const moves = line.split(' ');
  let i = 0;
  while (i < moves.length && i < san.length && moves[i] === san[i]) i++;
  return i;
}

/**
 * After a game against you: the book lines the bot actually played get
 * picked more if it won and less if it lost. botScore is 1, 0.5 or 0.
 */
export function learnFromGame(n: Nemesis, san: string[], botColour: 'w' | 'b', botScore: number): Nemesis {
  const vs = n.vsYou ?? { w: 0, l: 0, d: 0 };
  const vsYou = { w: vs.w + (botScore === 1 ? 1 : 0), l: vs.l + (botScore === 0 ? 1 : 0), d: vs.d + (botScore === 0.5 ? 1 : 0) };
  const book = botColour === 'w' ? n.asWhite : n.asBlack;
  // A line counts once the bot played at least one of its moves from it.
  const need = botColour === 'w' ? 1 : 2;
  const best = Math.max(0, ...book.map((b) => sharedPlies(b.line, san)));
  if (best < need || botScore === 0.5) return { ...n, vsYou };
  const factor = botScore === 1 ? 1.5 : 0.5;
  const next = book.map((b) => (sharedPlies(b.line, san) === best ? { ...b, weight: Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, (b.weight ?? 1) * factor)) } : b));
  return { ...n, vsYou, learned: (n.learned ?? 0) + 1, ...(botColour === 'w' ? { asWhite: next } : { asBlack: next }) };
}

/** The opening the bot now likes best against you (its heaviest line), as a few moves. */
export function favouriteLine(n: Nemesis, colour: 'w' | 'b'): string | null {
  const book = colour === 'w' ? n.asWhite : n.asBlack;
  if (!book.length) return null;
  const b = [...book].sort((x, y) => (y.weight ?? 1) - (x.weight ?? 1))[0];
  if ((b.weight ?? 1) <= 1) return null;
  return b.line.split(' ').slice(0, 6).join(' ');
}

export const NEMESIS_PREFIX = 'NEM:';

/** A nemesis as a playable bot (same shape as the path bots). */
export function nemesisBot(n: Nemesis): Bot {
  if (n.mirror) return {
    id: `${NEMESIS_PREFIX}${n.key}` as Bot['id'],
    name: `Mirror ${n.name}`,
    rating: n.rating,
    opening: 'your own openings',
    tip: n.firstMove ? `It starts with ${n.firstMove} as White, just like you!` : 'It plays the moves you play. Can you beat yourself?',
    personality: `Plays the openings you play, at about ★ ${n.rating} strength.`,
    colour: '#3fa7fc',
    emoji: '🪞',
    lines: {
      greet: ['I play just like you. Ready?', 'Can you beat yourself?'],
      capture: ['I learned that from you!', 'Got one!', 'Yoink!'],
      win: ['Mirror wins! I learned that from you.', 'Rematch? I will remember this.'],
      lose: ['You beat your own moves!', 'Okay, you are better than you. Rematch?'],
    },
    asWhite: n.asWhite,
    asBlack: n.asBlack,
  };
  const opening = n.topWhite[0] ?? n.topBlack[0] ?? 'their own openings';
  return {
    id: `${NEMESIS_PREFIX}${n.key}` as Bot['id'],
    name: n.name,
    rating: n.rating,
    opening,
    tip: n.firstMove ? `As White they usually start with ${n.firstMove}. Get ready for it!` : 'Watch their favourite openings, then think for yourself.',
    personality: `Plays the openings of ${n.name}, at about ★ ${n.rating} strength.`,
    colour: '#8a3ffc',
    emoji: '😈',
    lines: {
      greet: [`I play like ${n.name}. Ready?`, 'Let\'s see if you know my openings!'],
      capture: ['Mine now!', 'Gotcha!', 'Yoink!'],
      win: ['Nemesis wins this time!', 'Come back for a rematch!'],
      lose: ['Nooo! You beat my openings!', 'Okay, you got me. Rematch?'],
    },
    asWhite: n.asWhite,
    asBlack: n.asBlack,
  };
}
