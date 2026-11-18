import { parsePGN } from '../chesscom/pgn';
import { positionKey } from '../core/position';
import { play } from '../core/rules';
import { parseSAN } from '../core/san';
import { standardStart } from '../core/setup';
import type { Bot, BookLine } from '../content/bots';

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

  // Pass 1: walk each game's opening, counting the player's moves per position.
  const counts = new Map<string, number>();
  const walks: { colour: 'w' | 'b'; plies: { san: string; key: string; mine: boolean }[] }[] = [];
  for (const g of parsed) {
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

  // Pass 2: each game becomes a book line, cut before the first move they rarely play.
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

export const NEMESIS_PREFIX = 'NEM:';

/** A nemesis as a playable bot (same shape as the path bots). */
export function nemesisBot(n: Nemesis): Bot {
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
