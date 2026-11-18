import { CARDS, type CardDef, type Suit } from '../content/cards';
import { SELL_PRICE, type CollectionSet } from '../content/collections';

/**
 * Turning in collections and selling cards (owner, 2026-11-18). `cards` is the
 * player's collection: card id → copies.
 */

const RARITY_ORDER = { Common: 0, Rare: 1, Epic: 2 } as const;

/** The card to give up for one piece of a set: the one you have most copies of, then the least rare. */
export function cardForSuit(cards: Record<string, number>, suit: Suit, skip: Record<string, number> = {}): CardDef | undefined {
  return CARDS.filter((c) => c.suit === suit && (cards[c.id] ?? 0) - (skip[c.id] ?? 0) > 0)
    .sort((a, b) => (cards[b.id] ?? 0) - (cards[a.id] ?? 0) || RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity])[0];
}

/** Which pieces of the set you have a card for. */
export function setProgress(cards: Record<string, number>, set: CollectionSet): { have: Suit[]; missing: Suit[] } {
  const have = set.pieces.filter((s) => !!cardForSuit(cards, s));
  return { have, missing: set.pieces.filter((s) => !have.includes(s)) };
}

/** Turn in a set: one card of each piece is used up. Returns the new collection and the cards used, or null if a piece is missing. */
export function redeemSet(cards: Record<string, number>, set: CollectionSet): { cards: Record<string, number>; used: string[] } | null {
  const used: string[] = [];
  const taken: Record<string, number> = {};
  for (const suit of set.pieces) {
    const c = cardForSuit(cards, suit, taken);
    if (!c) return null;
    used.push(c.id);
    taken[c.id] = (taken[c.id] ?? 0) + 1;
  }
  const next = { ...cards };
  for (const id of used) {
    next[id] = (next[id] ?? 0) - 1;
    if (next[id] <= 0) delete next[id];
  }
  return { cards: next, used };
}

/** Sell one copy of a card for coins. */
export function sellCard(cards: Record<string, number>, id: string): { cards: Record<string, number>; coins: number } | null {
  const def = CARDS.find((c) => c.id === id);
  if (!def || !(cards[id] > 0)) return null;
  const next = { ...cards, [id]: cards[id] - 1 };
  if (next[id] <= 0) delete next[id];
  return { cards: next, coins: SELL_PRICE[def.rarity] };
}
