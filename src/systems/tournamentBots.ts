import { BOTS, botById, type Bot, type BookLine } from '../content/bots';
import type { TournamentBot } from '../net/world';
import { NEMESIS_PREFIX, nemesisBot, type Nemesis } from './nemesis';

/**
 * Bots for empty tournament seats (owner, 2026-11-18): your Mirror first, then
 * your nemesis bots, then a mix of path bots around your rating (some a bit
 * weaker, some a bit stronger).
 */
const LINES = 30;
const book = (l: BookLine[]) => [...l].sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1)).slice(0, LINES).map((x) => ({ line: x.line, weight: x.weight ?? 1 }));
const USERNAME = /^[A-Za-z0-9_-]{1,25}$/;

export function tournamentBots(p: { rating: number; mirror?: Nemesis; nemeses?: Nemesis[] }, count: number): TournamentBot[] {
  const out: TournamentBot[] = [];
  if (count <= 0) return out;
  if (p.mirror && (p.mirror.asWhite.length || p.mirror.asBlack.length)) {
    out.push({ kind: 'mirror', rating: p.mirror.rating, asWhite: book(p.mirror.asWhite), asBlack: book(p.mirror.asBlack) });
  }
  for (const n of p.nemeses ?? []) {
    const name = USERNAME.test(n.name) ? n.name : n.key;
    if (out.length >= count || !USERNAME.test(name)) continue;
    out.push({ kind: 'nemesis', name, rating: n.rating, asWhite: book(n.asWhite), asBlack: book(n.asBlack) });
  }
  // A mix: nearest first, taking turns a little weaker and a little stronger, one per rating step.
  const weaker = BOTS.filter((b) => b.rating <= p.rating).sort((a, b) => b.rating - a.rating);
  const stronger = BOTS.filter((b) => b.rating > p.rating).sort((a, b) => a.rating - b.rating);
  const seen = new Set<number>();
  const order: Bot[] = [];
  for (let i = 0; i < BOTS.length; i++) {
    for (const b of [stronger[i], weaker[i]]) if (b && !seen.has(b.rating)) { seen.add(b.rating); order.push(b); }
  }
  for (const b of BOTS) if (!order.includes(b)) order.push(b);
  for (const b of order) {
    if (out.length >= count) break;
    out.push({ kind: 'bot', botId: b.id, rating: b.rating });
  }
  return out.slice(0, count);
}

/** A tournament bot as a playable bot. `organizer` is how this phone names the organizer (for "Mirror of ..."). */
export function botForSeat(tid: string, seat: string, tb: TournamentBot, organizer: string): Bot | undefined {
  if (tb.kind === 'bot') return tb.botId ? botById(tb.botId) : undefined;
  const n: Nemesis = {
    key: tb.kind === 'mirror' ? `mirror-${organizer}` : (tb.name ?? 'bot').toLowerCase(),
    name: tb.kind === 'mirror' ? organizer : tb.name ?? 'Nemesis', mirror: tb.kind === 'mirror',
    rating: tb.rating, ccRating: null, games: 0, record: { w: 0, l: 0, d: 0 },
    asWhite: tb.asWhite ?? [], asBlack: tb.asBlack ?? [], topWhite: [], topBlack: [], firstMove: tb.asWhite?.[0]?.line.split(' ')[0] ?? null, builtAt: 0,
  };
  const b = nemesisBot(n);
  // Its own id per tournament seat, so the AI never mixes up two books.
  return { ...b, id: `${NEMESIS_PREFIX}t-${tid}-${seat}` as Bot['id'], name: tb.kind === 'mirror' ? (organizer === 'You' ? 'Your Mirror' : `Mirror of ${organizer}`) : b.name };
}

/** Short name with face, for brackets and lists. */
export function seatBotLabel(tb: TournamentBot, organizer: string): string {
  if (tb.kind === 'mirror') return organizer === 'You' ? '🪞 Your Mirror' : `🪞 Mirror of ${organizer}`;
  if (tb.kind === 'nemesis') return `😈 ${tb.name}`;
  const b = tb.botId ? botById(tb.botId) : undefined;
  return b ? `${b.emoji} ${b.name}` : '🤖 Bot';
}
