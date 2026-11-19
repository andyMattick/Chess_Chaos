import type { LUType } from '../content/levelup';

/**
 * Level-Up Chess pixel art (our own, in an old-school RPG spirit). Each sprite
 * is 12 x 12. Letters: K outline, A army colour, B army shade, W white,
 * Y gold, R red, G grey, L leaf, D dark leaf, T trunk, '.' see-through.
 */
const SPRITES: Record<LUType | 'mystery' | 'tree' | 'stump' | 'mine', string[]> = {
  pawn: [
    '............',
    '.....KK.....',
    '....KAAK....',
    '....KABK....',
    '.....KK.....',
    '....KAAK....',
    '...KAAABK...',
    '....KABK....',
    '...KAAABK...',
    '..KAAAAABK..',
    '..KKKKKKKK..',
    '............',
  ],
  knight: [
    '............',
    '....KK......',
    '...KAAKK....',
    '..KAAAAAK...',
    '..KAWKAAAK..',
    '..KAAAKAAK..',
    '...KKKAABK..',
    '.....KAABK..',
    '....KAAABK..',
    '...KAAAAABK.',
    '...KKKKKKKK.',
    '............',
  ],
  bishop: [
    '.....KK.....',
    '....KAAK....',
    '....KABK....',
    '...KAAWAK...',
    '...KAWAAK...',
    '...KAAABK...',
    '....KAAK....',
    '....KYYK....',
    '...KAAABK...',
    '..KAAAAABK..',
    '..KKKKKKKK..',
    '............',
  ],
  rook: [
    '............',
    '..KKK..KKK..',
    '..KAKKKKAK..',
    '..KAAAAABK..',
    '...KAAABK...',
    '...KAKKBK...',
    '...KAKKBK...',
    '...KAAABK...',
    '..KAAAAABK..',
    '..KAAAAABK..',
    '..KKKKKKKK..',
    '............',
  ],
  queen: [
    '.Y...Y...Y..',
    '.YK.KYK.KY..',
    '..KAAKAAK...',
    '..KAYAYAK...',
    '...KAAAK....',
    '...KAABK....',
    '...KAAAK....',
    '..KAAAABK...',
    '.KAAAAAABK..',
    '.KKKKKKKKK..',
    '............',
    '............',
  ],
  king: [
    '.....YY.....',
    '....YYYY....',
    '.....YY.....',
    '...KKKKKK...',
    '..KAAAAABK..',
    '..KAYAAYBK..',
    '...KAAABK...',
    '...KAAABK...',
    '...KAAABK...',
    '..KAAAAABK..',
    '..KKKKKKKK..',
    '............',
  ],
  catapult: [
    '.........KK.',
    '........KWWK',
    '.......KAKK.',
    '......KAK...',
    '.....KAK....',
    '....KAK.....',
    '..KKAKKKK...',
    '..KAAAAABK..',
    '..KBBBBBBK..',
    '..KK.KK.KK..',
    '.KGGK..KGGK.',
    '..KK....KK..',
  ],
  medic: [
    '............',
    '...KKKKKK...',
    '..KWWWWWWK..',
    '..KWWRRWWK..',
    '..KWRRRRWK..',
    '..KWWRRWWK..',
    '...KWWWWK...',
    '...KAAABK...',
    '..KAAAAABK..',
    '..KAAAAABK..',
    '..KKKKKKKK..',
    '............',
  ],
  miner: [
    '.......Y....',
    '......Y.R...',
    '.....KK.....',
    '...KKAAKK...',
    '..KAAAAABK..',
    '..KAWAAABK..',
    '..KAAAAABK..',
    '...KAAABK...',
    '....KKKK....',
    '..KGGGGGGK..',
    '..KKKKKKKK..',
    '............',
  ],
  scout: [
    '............',
    '....KKKK....',
    '...KAAABK...',
    '..KAKKKKBK..',
    '..KKWKKWKK..',
    '..KAKKKKBK..',
    '...KAAABK...',
    '....KAAK....',
    '...KAAABK...',
    '..KAAAAABK..',
    '..KKKKKKKK..',
    '............',
  ],
  mystery: [
    '............',
    '....KKKK....',
    '...KGGGGK...',
    '...KGWWGK...',
    '...KGGWGK...',
    '....KWGK....',
    '....KGGK....',
    '...KGWGGK...',
    '..KGGGGGGK..',
    '..KGGGGGGK..',
    '..KKKKKKKK..',
    '............',
  ],
  tree: [
    '.....KK.....',
    '....KLLK....',
    '...KLLDLK...',
    '..KLLLLDLK..',
    '..KLDLLLLK..',
    '.KLLLLDLLLK.',
    '.KLDLLLLLDK.',
    '..KKLLLLKK..',
    '....KTTK....',
    '....KTTK....',
    '...KKTTKK...',
    '............',
  ],
  stump: [
    '............',
    '............',
    '............',
    '............',
    '.....K......',
    '....KLK.K...',
    '...KLDK.KLK.',
    '....KKTKKK..',
    '....KTTK....',
    '....KTTK....',
    '...KKTTKK...',
    '............',
  ],
  mine: [
    '............',
    '............',
    '.....YY.....',
    '....K..K....',
    '...KGGGGK...',
    '..KGRGGRGK..',
    '..KGGGGGGK..',
    '...KGGGGK...',
    '....KKKK....',
    '............',
    '............',
    '............',
  ],
};

export const ARMY_COLOURS: Record<'p1' | 'p2', { A: string; B: string }> = {
  p1: { A: '#dfe9ff', B: '#7f9ee0' },
  p2: { A: '#ff7a6b', B: '#a8323a' },
};
const FIXED: Record<string, string> = { K: '#16122a', W: '#ffffff', Y: '#ffd23f', R: '#e8312f', G: '#8b8a99', L: '#4fb04a', D: '#2f7a34', T: '#7a4a22' };

/** Pixels of a sprite: [x, y, colour]. */
export function spritePixels(name: keyof typeof SPRITES, side: 'p1' | 'p2' = 'p1'): [number, number, string][] {
  const out: [number, number, string][] = [];
  SPRITES[name].forEach((row, y) => {
    for (let x = 0; x < 12; x++) {
      const c = row[x];
      if (!c || c === '.') continue;
      const col = c === 'A' || c === 'B' ? ARMY_COLOURS[side][c] : FIXED[c];
      if (col) out.push([x, y, col]);
    }
  });
  return out;
}

const cache = new Map<string, string>();
/** A sprite as a crisp image URL (drawn once per sprite and side). */
export function spriteUrl(name: keyof typeof SPRITES, side: 'p1' | 'p2' = 'p1'): string {
  const key = `${name}:${side}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // SVG with one rect per pixel: tiny, crisp at any size, no canvas needed.
  const rects = spritePixels(name, side).map(([x, y, c]) => `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`).join('');
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" shape-rendering="crispEdges">${rects}</svg>`)}`;
  cache.set(key, url);
  return url;
}
export type SpriteName = keyof typeof SPRITES;
