import { describe, expect, it } from 'vitest';
import { COLLECTIONS, SET_SKINS, SELL_PRICE } from '../src/content/collections';
import { CARDS, SUITS } from '../src/content/cards';
import { parseSkin } from '../src/content/cosmetics';
import { redeemSet, sellCard, setProgress } from '../src/systems/collections';

describe('collections', () => {
  it('has every group of 2 to 6 different pieces once: 15 + 20 + 15 + 6 + 1', () => {
    expect(COLLECTIONS.length).toBe(57);
    const count = (n: number) => COLLECTIONS.filter((c) => c.pieces.length === n).length;
    expect([2, 3, 4, 5, 6].map(count)).toEqual([15, 20, 15, 6, 1]);
    const keys = COLLECTIONS.map((c) => [...c.pieces].sort().join());
    expect(new Set(keys).size).toBe(57);
    for (const c of COLLECTIONS) expect(new Set(c.pieces).size).toBe(c.pieces.length);
    expect(new Set(COLLECTIONS.map((c) => c.name)).size).toBe(57);
    expect(COLLECTIONS.find((c) => c.pieces.length === 6)!.rarity).toBe('Legendary');
    expect(COLLECTIONS.filter((c) => c.pieces.length === 2).every((c) => c.rarity === 'Common')).toBe(true);
  });
  it('every set unlocks its own skin', () => {
    expect(new Set(COLLECTIONS.map((c) => c.skin)).size).toBe(57);
    for (const c of COLLECTIONS.filter((x) => x.pieces.length <= 3)) expect(parseSkin(c.skin).colourway).toBeTruthy();
    for (const c of COLLECTIONS.filter((x) => x.pieces.length >= 4)) expect(SET_SKINS.some((s) => s.id === c.skin)).toBe(true);
    expect(SET_SKINS.length).toBe(22);
  });
  it('turning in a set uses one card of each piece, so it has to be collected again', () => {
    const set = COLLECTIONS.find((c) => c.name === 'Royal Couple')!; // queen + king
    const queen = CARDS.find((c) => c.suit === 'queen' && !c.notYet)!.id;
    const king = CARDS.find((c) => c.suit === 'king' && !c.notYet)!.id;
    const cards = { [queen]: 2, [king]: 1, 'CARD-04': 3 };
    expect(setProgress(cards, set)).toEqual({ have: ['queen', 'king'], missing: [] });
    const r = redeemSet(cards, set)!;
    expect(r.used.sort()).toEqual([king, queen].sort());
    expect(r.cards).toEqual({ [queen]: 1, 'CARD-04': 3 });
    expect(redeemSet(r.cards, set)).toBeNull(); // no king card left
    expect(setProgress(r.cards, set).missing).toEqual(['king']);
  });
  it('gives up the card you have most copies of', () => {
    const set = COLLECTIONS.find((c) => c.pieces.length === 6)!;
    const cards: Record<string, number> = { 'CARD-04': 1, 'CARD-14': 4, 'CARD-01': 1, 'CARD-07': 1, 'CARD-02': 1, 'CARD-03': 1, 'CARD-08': 1 };
    const r = redeemSet(cards, set)!;
    expect(r.used).toContain('CARD-14');
    expect(r.cards['CARD-04']).toBe(1);
    expect(SUITS.length).toBe(6);
  });
  it('sells a card for coins by rarity', () => {
    const r = sellCard({ 'CARD-03': 1 }, 'CARD-03')!;
    expect(r).toEqual({ cards: {}, coins: SELL_PRICE.Epic });
    expect(sellCard({}, 'CARD-03')).toBeNull();
  });
});

describe('wearing a set you turned in', () => {
  it('puts the skin on just those pieces, in both armies', async () => {
    const { wearSet } = await import('../src/systems/collections');
    const skins = { armies: { p1: 'gremlin', p2: 'robot' }, pieces: { p1: { queen: 'dino' } }, badges: false } as never;
    const out = wearSet(skins, { pieces: ['king', 'rook'], skin: 'set-lava' as never });
    expect(out.pieces.p1).toEqual({ queen: 'dino', king: 'set-lava', rook: 'set-lava' });
    expect(out.pieces.p2).toEqual({ king: 'set-lava', rook: 'set-lava' });
    expect(out.armies).toEqual({ p1: 'gremlin', p2: 'robot' });
  });
});
