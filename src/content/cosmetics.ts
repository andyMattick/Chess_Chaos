/**
 * Cosmetic choices: piece skins and board landscapes. Pure data so storage and
 * future unlock rules (cards, badges) can use it without importing UI code.
 */
export type SkinId =
  | 'classic' | 'gremlin' | 'robot' | 'ghost' | 'critter' | 'veggie'
  | 'unicorn' | 'fish' | 'dog' | 'wolf' | 'muncher' | 'dino' | 'alien' | 'slime';
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
  return choice.pieces[owner]?.[type] ?? choice.armies[owner] ?? 'classic';
}

/**
 * Shop prices in coins. 0 = free from the start. Coins are earned by playing
 * (see systems/coins.ts) and spent in the Wardrobe. Buying a skin unlocks it
 * for both armies.
 */
export const SKIN_PRICES: Record<SkinId, number> = {
  classic: 0, gremlin: 0, robot: 0, ghost: 0,
  critter: 40, veggie: 40, dog: 60, fish: 60, slime: 80, muncher: 100, wolf: 120, dino: 150, alien: 150, unicorn: 200,
};

export const LANDSCAPE_PRICES: Record<LandscapeId, number> = {
  meadow: 0, beach: 0, glacier: 50, candy: 60, swamp: 70, volcano: 100, space: 150,
};

export const FREE_SKINS = (Object.keys(SKIN_PRICES) as SkinId[]).filter((k) => SKIN_PRICES[k] === 0);
export const FREE_LANDSCAPES = (Object.keys(LANDSCAPE_PRICES) as LandscapeId[]).filter((k) => LANDSCAPE_PRICES[k] === 0);
