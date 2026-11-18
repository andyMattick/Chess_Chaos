/**
 * Cosmetic choices: piece skins and board landscapes. Pure data so storage and
 * future unlock rules (cards, badges) can use it without importing UI code.
 */
export type SkinId = 'classic' | 'gremlin' | 'robot' | 'ghost' | 'critter' | 'veggie';
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
