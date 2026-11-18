/**
 * Card collections (owner, 2026-11-18). Every power card belongs to a piece
 * (its suit). A collection is a set of different pieces: turn in one card of
 * each piece to unlock a skin for good. The cards are used up, so the set has
 * to be collected again to turn it in again.
 *
 *   2 pieces: 15 Common    → a colour version of a skin
 *   3 pieces: 20 Uncommon  → a colour version of a skin
 *   4 pieces: 15 Rare      → a new skin with its own art
 *   5 pieces:  6 Epic      → a new skin with its own art
 *   6 pieces:  1 Legendary → the Chess Chaos Crown army
 *
 * Names chosen with the owner. Art for the new skins: docs/ART-PROMPTS.md.
 */
import { BASE_SKINS, type ColourwayId, type SkinId } from './cosmetics';
import { SUITS, type Suit } from './cards';

export type SetRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface CollectionSet {
  id: string;
  name: string;
  pieces: Suit[];
  rarity: SetRarity;
  skin: SkinId;
}

/** A new skin won with a collection: name, look for the art prompt, and how it looks until the art arrives. */
export interface SetSkin {
  id: SkinId;
  name: string;
  /** One line for the Wardrobe and the base of the art prompt. */
  look: string;
  /** Until its art is in public/skins: this skin and colour version, with sparkles. */
  fallback: { base: (typeof BASE_SKINS)[number]; colourway: ColourwayId };
}

const P = (s: string): Suit[] => [...s].map((c) => ({ P: 'pawn', R: 'rook', N: 'knight', B: 'bishop', Q: 'queen', K: 'king' })[c] as Suit);

/** Pairs and threes: names, in a fixed order (pieces in P R N B Q K order). */
const SMALL: [string, string][] = [
  ['PR', 'Castle Guard'], ['PN', 'Squire & Steed'], ['PB', 'Pilgrim Path'], ['PQ', 'Promotion Dream'], ['PK', 'Royal Shield'],
  ['RN', 'Siege Engine'], ['RB', 'Stone & Glass'], ['RQ', 'Heavy Hitters'], ['RK', 'Castling Crew'], ['NB', 'Minor League'],
  ['NQ', 'Fork Masters'], ['NK', "Knight's Oath"], ['BQ', 'Long Diagonal'], ['BK', 'Court Advisor'], ['QK', 'Royal Couple'],
  ['PRN', 'Village Watch'], ['PRB', 'Fortress Chapel'], ['PRQ', 'Tower Rush'], ['PRK', 'Back Rank'], ['PNB', 'Minor Militia'],
  ['PNQ', 'Fork Brigade'], ['PNK', 'Royal Escort'], ['PBQ', 'Diagonal Dash'], ['PBK', 'Fianchetto'], ['PQK', 'Coronation'],
  ['RNB', 'Siege Workshop'], ['RNQ', 'Cavalry Charge'], ['RNK', 'Castle Keep'], ['RBQ', 'The Battery'], ['RBK', 'Throne Room'],
  ['RQK', 'Iron Crown'], ['NBQ', "Wizard's Council"], ['NBK', 'Round Table'], ['NQK', 'Royal Hunt'], ['BQK', 'Grand Cathedral'],
];

/** Fours, fives and all six: the pieces left out, the name, and the new skin. */
const BIG: { without: string; name: string; slug: string; look: string }[] = [
  { without: 'PR', name: 'Royal Court', slug: 'royal-court', look: 'cheerful courtiers in velvet capes and lace collars' },
  { without: 'PN', name: 'High Council', slug: 'high-council', look: 'wise owls in long robes with tiny spectacles' },
  { without: 'PB', name: 'War Council', slug: 'war-council', look: 'wind-up toy soldiers with painted cheeks and drums' },
  { without: 'PQ', name: 'Kingdom Builders', slug: 'kingdom-builders', look: 'busy beavers in hard hats with little tools' },
  { without: 'PK', name: 'Back Row Heroes', slug: 'back-row-heroes', look: 'kid superheroes in capes and masks' },
  { without: 'RN', name: "Pawn's Promise", slug: 'pawns-promise', look: 'sprouting plant people, seedlings to tall trees' },
  { without: 'RB', name: "Knight's Tale", slug: 'knights-tale', look: 'storybook paper cut-out characters' },
  { without: 'RQ', name: 'Small but Mighty', slug: 'small-but-mighty', look: 'brave mice in acorn-cap helmets' },
  { without: 'RK', name: 'Tactics Squad', slug: 'tactics-squad', look: 'ninja frogs with headbands' },
  { without: 'NB', name: 'Iron Fortress', slug: 'iron-fortress', look: 'friendly stone golems with mossy shoulders' },
  { without: 'NQ', name: 'Old Castle', slug: 'old-castle', look: 'cute bats carrying glowing lanterns' },
  { without: 'NK', name: 'Long-Range Battery', slug: 'long-range-battery', look: 'little astronauts and rocket ships' },
  { without: 'BQ', name: 'Castle Defenders', slug: 'castle-defenders', look: 'hedgehogs with round shields' },
  { without: 'BK', name: 'Storm Troop', slug: 'storm-troop', look: 'puffy storm clouds with lightning hair' },
  { without: 'QK', name: 'Army Without a Crown', slug: 'army-without-a-crown', look: 'friendly cartoon pirates with eye patches' },
  { without: 'P', name: "Nobles' Ball", slug: 'nobles-ball', look: 'cats in masquerade masks and ball gowns' },
  { without: 'R', name: 'Open Field', slug: 'open-field', look: 'patchwork scarecrows with straw hair' },
  { without: 'N', name: 'Straight Shooters', slug: 'straight-shooters', look: 'penguin archers with feathered caps' },
  { without: 'B', name: 'Iron Will', slug: 'iron-will', look: 'clockwork wind-up toys with brass keys' },
  { without: 'Q', name: "King's Quest", slug: 'kings-quest', look: 'small friendly dragons' },
  { without: 'K', name: 'The Rebellion', slug: 'the-rebellion', look: 'raccoon rebels in bandanas' },
  { without: '', name: 'Chess Chaos Crown', slug: 'chess-chaos-crown', look: 'a shining golden crystal army, every piece wearing a jewelled crown' },
];

function rarityFor(n: number): SetRarity {
  return n === 2 ? 'Common' : n === 3 ? 'Uncommon' : n === 4 ? 'Rare' : n === 5 ? 'Epic' : 'Legendary';
}

/** Colour versions for the small sets: commons get Lava and Ice, uncommons Gold, Shadow, Neon and Candy. Never the same twice. */
function colourwayRewards(): SkinId[] {
  const used = new Set<string>();
  const out: SkinId[] = [];
  SMALL.forEach(([pieces], i) => {
    const cws: ColourwayId[] = pieces.length === 2 ? ['lava', 'ice'] : ['gold', 'shadow', 'neon', 'candy'];
    for (let k = 0; ; k++) {
      const id = `${BASE_SKINS[(i + k) % BASE_SKINS.length]}~${cws[(i + Math.floor((i + k) / BASE_SKINS.length)) % cws.length]}` as SkinId;
      if (!used.has(id)) { used.add(id); out.push(id); break; }
    }
  });
  return out;
}

const SMALL_SKINS = colourwayRewards();

export const SET_SKINS: SetSkin[] = BIG.map((b, i) => ({
  id: `set-${b.slug}` as SkinId,
  name: b.name,
  look: b.look,
  fallback: { base: BASE_SKINS[(i * 5 + 3) % BASE_SKINS.length], colourway: (['gold', 'neon', 'shadow', 'candy', 'ice', 'lava'] as ColourwayId[])[i % 6] },
}));

export const COLLECTIONS: CollectionSet[] = [
  ...SMALL.map(([pieces, name], i) => ({ id: `SET-${pieces}`, name, pieces: P(pieces), rarity: rarityFor(pieces.length), skin: SMALL_SKINS[i] })),
  ...BIG.map((b) => {
    const pieces = SUITS.filter((s) => !P(b.without).includes(s));
    const code = pieces.map((s) => ({ pawn: 'P', rook: 'R', knight: 'N', bishop: 'B', queen: 'Q', king: 'K' })[s]).join('');
    return { id: `SET-${code}`, name: b.name, pieces, rarity: rarityFor(pieces.length), skin: `set-${b.slug}` as SkinId };
  }),
];

/** Coins for selling one card back. */
export const SELL_PRICE: Record<'Common' | 'Rare' | 'Epic', number> = { Common: 5, Rare: 15, Epic: 40 };
/** Colour versions can also be bought with coins; the new skins only come from collections. */
export const SET_SKIN_PRICE: Partial<Record<SetRarity, number>> = { Common: 150, Uncommon: 250 };

export function setForSkin(id: SkinId): CollectionSet | undefined {
  return COLLECTIONS.find((c) => c.skin === id);
}
export function setSkinById(id: SkinId): SetSkin | undefined {
  return SET_SKINS.find((s) => s.id === id);
}
