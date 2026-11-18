/**
 * Cosmetic choices: piece skins and board landscapes. Pure data so storage and
 * future unlock rules (cards, badges) can use it without importing UI code.
 */
export type BaseSkinId =
  | 'classic' | 'gremlin' | 'robot' | 'ghost' | 'critter' | 'veggie'
  | 'unicorn' | 'fish' | 'dog' | 'wolf' | 'muncher' | 'dino' | 'alien' | 'slime';
/** Colour versions of the character skins (owner, 2026-11-18): won with collections. */
export type ColourwayId = 'lava' | 'ice' | 'gold' | 'shadow' | 'neon' | 'candy';
/**
 * A skin: a base skin, a base skin in a colour version ("gremlin~lava"), or a
 * collection skin with its own art ("set-royal-court", see content/collections.ts).
 */
export type SkinId = BaseSkinId | `${Exclude<BaseSkinId, 'classic'>}~${ColourwayId}` | `set-${string}`;

/** Character colours (one per army side). */
export interface Palette { body: string; shade: string; belly: string; ink: string; eye: string }

export const COLOURWAYS: { id: ColourwayId; name: string; p1: Palette; p2: Palette }[] = [
  { id: 'lava', name: 'Lava', p1: { body: '#ff7a2b', shade: '#c2410c', belly: '#ffd25a', ink: '#2a0a02', eye: '#fff36b' }, p2: { body: '#3a2a2e', shade: '#1c1215', belly: '#ff5a1f', ink: '#0a0405', eye: '#ffb02e' } },
  { id: 'ice', name: 'Ice', p1: { body: '#d9f3ff', shade: '#8fcbe6', belly: '#ffffff', ink: '#12324a', eye: '#2fa8e0' }, p2: { body: '#2c6fb0', shade: '#17406e', belly: '#a8dcff', ink: '#06182c', eye: '#e8fbff' } },
  { id: 'gold', name: 'Gold', p1: { body: '#ffd84a', shade: '#c9971a', belly: '#fff3b8', ink: '#3a2a04', eye: '#3a2a04' }, p2: { body: '#9a9fb0', shade: '#5f6475', belly: '#e6e9f2', ink: '#14161c', eye: '#ffd84a' } },
  { id: 'shadow', name: 'Shadow', p1: { body: '#6b6f80', shade: '#3e4150', belly: '#b8bccc', ink: '#0d0e14', eye: '#ffe14a' }, p2: { body: '#24212e', shade: '#100e16', belly: '#5a4f7a', ink: '#000000', eye: '#ff4fd8' } },
  { id: 'neon', name: 'Neon', p1: { body: '#39ff88', shade: '#14b85a', belly: '#e6fff0', ink: '#03200f', eye: '#ff2fd2' }, p2: { body: '#ff2fd2', shade: '#a3108a', belly: '#ffd6f6', ink: '#25031f', eye: '#39ff88' } },
  { id: 'candy', name: 'Candy', p1: { body: '#ffc2e2', shade: '#f08cbf', belly: '#fff4fa', ink: '#4a1032', eye: '#4a1032' }, p2: { body: '#8fd9ff', shade: '#4aa9e0', belly: '#fffbd0', ink: '#0b2a40', eye: '#ff5fa8' } },
];

export const BASE_SKINS: Exclude<BaseSkinId, 'classic'>[] = ['gremlin', 'robot', 'ghost', 'critter', 'veggie', 'dog', 'fish', 'slime', 'muncher', 'wolf', 'dino', 'alien', 'unicorn'];

/** Split "gremlin~lava" into its base skin and colour version. */
export function parseSkin(id: SkinId): { base: BaseSkinId; colourway?: ColourwayId; set?: string } {
  if (id.startsWith('set-')) return { base: 'classic', set: id.slice(4) };
  const [base, cw] = id.split('~') as [BaseSkinId, ColourwayId | undefined];
  return { base, colourway: cw };
}
export type LandscapeId = 'meadow' | 'volcano' | 'glacier' | 'beach' | 'space' | 'candy' | 'swamp';

export interface SkinChoice {
  /** Skin for a whole army, by seat. */
  armies: Record<string, SkinId>;
  /** Per-piece overrides, by seat then piece type. */
  pieces: Record<string, Partial<Record<string, SkinId>>>;
  /** Show a small classic piece badge on each character. */
  badges: boolean;
}

export const DEFAULT_SKINS: SkinChoice = {
  armies: { p1: 'gremlin', p2: 'robot' },
  pieces: { p1: {}, p2: {} },
  badges: true,
};

export function skinFor(choice: SkinChoice, owner: string, type: string): SkinId {
  // Extra armies in 3/4 player games borrow White's and Black's looks (recoloured).
  const base = owner === 'p3' ? 'p1' : owner === 'p4' ? 'p2' : owner;
  return choice.pieces[owner]?.[type] ?? choice.armies[owner] ?? choice.pieces[base]?.[type] ?? choice.armies[base] ?? 'classic';
}

/**
 * Shop prices in coins. 0 = free from the start. Coins are earned by playing
 * (see systems/coins.ts) and spent in the Wardrobe. Buying a skin unlocks it
 * for both armies.
 */
export const SKIN_PRICES: Record<BaseSkinId, number> = {
  classic: 0, gremlin: 0, robot: 0, ghost: 0,
  critter: 40, veggie: 40, dog: 60, fish: 60, slime: 80, muncher: 100, wolf: 120, dino: 150, alien: 150, unicorn: 200,
};

export const LANDSCAPE_PRICES: Record<LandscapeId, number> = {
  meadow: 0, beach: 0, glacier: 50, candy: 60, swamp: 70, volcano: 100, space: 150,
};

export const FREE_SKINS = (Object.keys(SKIN_PRICES) as BaseSkinId[]).filter((k) => SKIN_PRICES[k] === 0) as SkinId[];
export const FREE_LANDSCAPES = (Object.keys(LANDSCAPE_PRICES) as LandscapeId[]).filter((k) => LANDSCAPE_PRICES[k] === 0);
