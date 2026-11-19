import { hdUrl } from './luArtHD';
import { spriteUrl, type SpriteName } from './luSprites';

/**
 * Level-Up Chess looks (owner, 2026-11-19): the 8-bit pixel set or the smooth
 * Storybook set. Everything the board draws goes through here, so an artist's
 * set can replace either one later.
 */
export type LUArt = '8bit' | 'storybook';
export const LU_ARTS: { id: LUArt; label: string }[] = [
  { id: '8bit', label: '👾 8-bit' },
  { id: 'storybook', label: '🎨 Storybook' },
];

export function luSprite(art: LUArt, name: SpriteName, side: 'p1' | 'p2' = 'p1'): string {
  return art === 'storybook' ? hdUrl(name, side) : spriteUrl(name, side);
}

/** Grass for square (file, rank): 8-bit is a plain check; Storybook varies the greens a little, like a real lawn. */
export function luGrass(art: LUArt, f: number, r: number): string {
  const light = (f + r) % 2 === 0;
  if (art === '8bit') return light ? '#6bb34f' : '#5aa045';
  const n = ((f * 73856093) ^ (r * 19349663)) >>> 0;
  const l = (light ? 52 : 46) + (n % 5) - 2;
  return `hsl(${96 + (n % 7) - 3} 42% ${l}%)`;
}
