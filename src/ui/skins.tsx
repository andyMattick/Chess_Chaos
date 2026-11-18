import type { ReactElement } from 'react';
import { PieceGlyph } from './PieceGlyph';

/**
 * Piece skins. A skin turns a piece into a character. Every character wears
 * the hat of its piece type (crown, tiara, turret, mitre, horse hood) so kids
 * can still read the board, and a small classic badge can be shown as well.
 *
 * Skins can be set per army (all White pieces are robots) and overridden per
 * piece type (but the White knights are ghosts).
 */

import { COLOURWAYS, parseSkin, type BaseSkinId, type Palette, type SkinId } from '../content/cosmetics';
import { setSkinById } from '../content/collections';
import { artReady, useArt } from './skinArt';
export { DEFAULT_SKINS, skinFor, type SkinChoice, type SkinId } from '../content/cosmetics';

type Drawn = Exclude<BaseSkinId, 'classic'>;

/** Each skin has its own colours for each army, so mixed armies stay readable. */
const PALETTES: Record<Drawn, Record<'p1' | 'p2', Palette>> = {
  gremlin: { p1: { body: '#a6e04a', shade: '#6fa82a', belly: '#e3f7a8', ink: '#1d2410', eye: '#fff' }, p2: { body: '#8a4fd8', shade: '#5b2a9e', belly: '#c9a8f5', ink: '#1a0f2e', eye: '#fff36b' } },
  robot: { p1: { body: '#cfe3ea', shade: '#8fb1bd', belly: '#5fe0d0', ink: '#1b2a30', eye: '#5fe0d0' }, p2: { body: '#d0603a', shade: '#8f3a20', belly: '#ffcf4a', ink: '#2a1208', eye: '#ffcf4a' } },
  ghost: { p1: { body: '#fbfbff', shade: '#c8cbe6', belly: '#ffd2e4', ink: '#2b2a40', eye: '#2b2a40' }, p2: { body: '#5a6b8f', shade: '#36425e', belly: '#8fa3cc', ink: '#0f1422', eye: '#c6ff6b' } },
  critter: { p1: { body: '#ffb04a', shade: '#e07a1c', belly: '#ffe3b8', ink: '#2e1a08', eye: '#2e1a08' }, p2: { body: '#2f4f7f', shade: '#1b3054', belly: '#9cc2f0', ink: '#0b1422', eye: '#fff' } },
  unicorn: { p1: { body: '#fff6fb', shade: '#f2c6e0', belly: '#ff8fd0', ink: '#3b1f3a', eye: '#3b1f3a' }, p2: { body: '#7b5cd6', shade: '#4f37a0', belly: '#ffd84a', ink: '#160b2e', eye: '#fff' } },
  fish: { p1: { body: '#ff9b3d', shade: '#e0601c', belly: '#ffe1b8', ink: '#2e1608', eye: '#fff' }, p2: { body: '#2fb3c9', shade: '#1a7488', belly: '#bff3ff', ink: '#08222a', eye: '#fff' } },
  dog: { p1: { body: '#f2d29b', shade: '#b07a3c', belly: '#fff3dc', ink: '#2e1a08', eye: '#2e1a08' }, p2: { body: '#5b4636', shade: '#2e2218', belly: '#c9a882', ink: '#120b05', eye: '#fff' } },
  wolf: { p1: { body: '#cfd6e0', shade: '#8a96a8', belly: '#f4f6fa', ink: '#1b2230', eye: '#ffd23f' }, p2: { body: '#4a4f5c', shade: '#262a33', belly: '#8f96a6', ink: '#0b0d12', eye: '#ff4f4f' } },
  muncher: { p1: { body: '#4ad9b0', shade: '#1f9c7a', belly: '#c33a5a', ink: '#0d2a22', eye: '#fff' }, p2: { body: '#ff6a3d', shade: '#b83a17', belly: '#5a0f22', ink: '#2a0d05', eye: '#fff' } },
  dino: { p1: { body: '#7fd36b', shade: '#3f9a3a', belly: '#f6f0a6', ink: '#13280f', eye: '#fff' }, p2: { body: '#c45ad8', shade: '#7a2a90', belly: '#ffc2f0', ink: '#22082a', eye: '#fff' } },
  alien: { p1: { body: '#b6f25a', shade: '#78b52a', belly: '#e9ffc2', ink: '#1a2a08', eye: '#141414' }, p2: { body: '#7aa8ff', shade: '#3c63c9', belly: '#d6e6ff', ink: '#08142e', eye: '#141414' } },
  slime: { p1: { body: '#9ff0e0', shade: '#4cc4ad', belly: '#e8fffa', ink: '#0d3029', eye: '#0d3029' }, p2: { body: '#ff7ab8', shade: '#c43c7f', belly: '#ffd6ea', ink: '#3a0b22', eye: '#3a0b22' } },
  veggie: { p1: { body: '#ff5d5d', shade: '#c93030', belly: '#ffb0a0', ink: '#3a0d0d', eye: '#fff' }, p2: { body: '#7a4fd0', shade: '#4d2a90', belly: '#b99af0', ink: '#160b2e', eye: '#fff' } },
};

export const SKINS: { id: BaseSkinId; name: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic', blurb: 'Plain old chess pieces.' },
  { id: 'gremlin', name: 'Gremlins', blurb: 'Lumpy, toothy, a little bit rude.' },
  { id: 'robot', name: 'Robots', blurb: 'Beep. Boop. Checkmate.' },
  { id: 'ghost', name: 'Ghosts', blurb: 'Spooky sheets that float around.' },
  { id: 'critter', name: 'Critters', blurb: 'Fuzzy round things with ears.' },
  { id: 'veggie', name: 'Angry Veg', blurb: 'Tomatoes and turnips with attitude.' },
  { id: 'dog', name: 'Good Dogs', blurb: 'Floppy ears. Very loyal. Will chew your rook.' },
  { id: 'fish', name: 'Fish', blurb: 'Blub. Blub. Checkmate.' },
  { id: 'slime', name: 'Slimes', blurb: 'Wobbly, drippy, a bit sticky.' },
  { id: 'muncher', name: 'Munchers', blurb: 'All mouth. Eats pieces for breakfast.' },
  { id: 'wolf', name: 'Wolves', blurb: 'Hunt in packs. Howl when they win.' },
  { id: 'dino', name: 'Dinos', blurb: 'Tiny arms, big ideas.' },
  { id: 'alien', name: 'Aliens', blurb: 'Three eyes, to spot every fork.' },
  { id: 'unicorn', name: 'Unicorns', blurb: 'Sparkly, magical, surprisingly ruthless.' },
];

/** Name and one line for any skin: base, colour version or collection skin. */
export function skinInfo(id: SkinId): { name: string; blurb: string } {
  const { base, colourway, set } = parseSkin(id);
  if (set) {
    const d = setSkinById(id);
    return { name: d?.name ?? 'Collection skin', blurb: d ? `${d.look[0].toUpperCase()}${d.look.slice(1)}.` : '' };
  }
  const b = SKINS.find((x) => x.id === base);
  if (!colourway) return { name: b?.name ?? base, blurb: b?.blurb ?? '' };
  const cw = COLOURWAYS.find((c) => c.id === colourway);
  return { name: `${cw?.name} ${b?.name}`, blurb: `${b?.name} in ${cw?.name.toLowerCase()} colours.` };
}

/** Bigger pieces are bigger characters: a pawn is short, the king is tall. */
const SCALE: Record<string, number> = { pawn: 0.74, knight: 0.86, bishop: 0.86, rook: 0.9, queen: 0.96, king: 1 };

/** Small deterministic wobble per piece so the army never looks copy-pasted. */
function jitter(seed: number, i: number) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

export function Character({ skin: skinId, type, owner, seed = 0, badge = false }: { skin: SkinId; type: string; owner: string; seed?: number; badge?: boolean }): ReactElement {
  useArt(); // redraw when collection art finishes loading
  const parsed = parseSkin(skinId);
  const side = owner === 'p1' || owner === 'p3' ? 'p1' : 'p2';
  // Collection skins: their art if it is in public/skins, else a sparkly stand-in.
  let sparkle = false;
  let skin: BaseSkinId = parsed.base;
  let cw = parsed.colourway;
  if (parsed.set) {
    const def = setSkinById(skinId);
    if (def && artReady(parsed.set, side)) return <ArtPiece slug={parsed.set} side={side} type={type} owner={owner} badge={badge} />;
    skin = def?.fallback.base ?? 'gremlin';
    cw = def?.fallback.colourway;
    sparkle = true;
  }
  if (skin === 'classic') {
    const tint = owner === 'p3' ? '#ffcf3a' : owner === 'p4' ? '#45c7a8' : undefined;
    return <PieceGlyph type={type} light={owner === 'p1'} tint={tint} />;
  }
  const pal = cw ? COLOURWAYS.find((c) => c.id === cw)![side] : PALETTES[skin][side];
  // Third and fourth armies: same character, shifted colours.
  const hue = owner === 'p3' ? 150 : owner === 'p4' ? 200 : 0;
  const s = SCALE[type] ?? 0.85;
  const tilt = jitter(seed, 1) * 9;
  // Body is drawn in a 100x100 box, standing on y=94, then scaled.
  return (
    <g>
      {hue > 0 && (
        <defs>
          <filter id={`hue-${owner}`}><feColorMatrix type="hueRotate" values={String(hue)} /></filter>
        </defs>
      )}
      <ellipse cx={50} cy={93} rx={26 * s} ry={4} fill="rgba(0,0,0,0.22)" />
      <g transform={`translate(50 94) rotate(${tilt}) scale(${s}) translate(-50 -94)`} filter={hue > 0 ? `url(#hue-${owner})` : undefined}>
        {BODIES[skin](pal, type, seed)}
        <Hat type={type} skin={skin} pal={pal} />
      </g>
      {sparkle && <text x={14} y={30} fontSize={18}>✨</text>}
      {badge && (
        <g transform="translate(70 68) scale(0.3)">
          <circle cx={50} cy={50} r={46} fill="#fff" stroke="#2d2a3e" strokeWidth={8} />
          <g transform="translate(14 12) scale(0.72)"><PieceGlyph type={type} light={owner === 'p1'} /></g>
        </g>
      )}
    </g>
  );
}

const STROKE = { strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Eyes({ pal, y, gap = 12, r = 7, seed }: { pal: Palette; y: number; gap?: number; r?: number; seed: number }) {
  // Pupils look in slightly different directions. On purpose.
  const lx = jitter(seed, 2) * 4, ly = jitter(seed, 3) * 3;
  const rx = jitter(seed, 4) * 4, ry = jitter(seed, 5) * 3;
  const rr = r * (0.9 + jitter(seed, 6) * 0.3);
  return (
    <g>
      <circle cx={50 - gap} cy={y} r={r} fill={pal.eye} stroke={pal.ink} {...STROKE} strokeWidth={2.5} />
      <circle cx={50 + gap} cy={y - 1} r={rr} fill={pal.eye} stroke={pal.ink} {...STROKE} strokeWidth={2.5} />
      <circle cx={50 - gap + lx} cy={y + ly} r={r * 0.42} fill={pal.ink} />
      <circle cx={50 + gap + rx} cy={y - 1 + ry} r={rr * 0.42} fill={pal.ink} />
    </g>
  );
}

const BODIES: Record<Drawn, (pal: Palette, type: string, seed: number) => ReactElement> = {
  gremlin: (pal, type, seed) => (
    <g>
      <path d="M30 94 l-6 0 M70 94 l6 0" stroke={pal.ink} {...STROKE} />
      <path d="M24 94 C14 76 16 54 26 44 C34 34 44 31 52 32 C64 31 76 38 80 50 C86 64 84 80 76 94 Z" fill={pal.body} stroke={pal.ink} {...STROKE} />
      <path d="M36 94 C34 80 40 70 50 70 C62 70 66 82 64 94" fill={pal.belly} opacity={0.8} />
      <path d="M26 44 L16 34 L30 40 M76 42 L88 32 L80 46" fill={pal.shade} stroke={pal.ink} {...STROKE} strokeWidth={3} />
      <Eyes pal={pal} y={52} seed={seed} r={type === 'pawn' ? 8 : 7} />
      <path d="M38 66 Q50 74 62 64" fill="none" stroke={pal.ink} {...STROKE} />
      <path d="M44 68 l3 5 l3 -4" fill="#fff" stroke={pal.ink} strokeWidth={1.5} />
      <circle cx={30} cy={74} r={2} fill={pal.shade} /><circle cx={70} cy={80} r={2.5} fill={pal.shade} /><circle cx={66} cy={56} r={1.6} fill={pal.shade} />
    </g>
  ),
  robot: (pal, type, seed) => (
    <g>
      <rect x={30} y={84} width={10} height={10} fill={pal.shade} stroke={pal.ink} {...STROKE} />
      <rect x={60} y={84} width={10} height={10} fill={pal.shade} stroke={pal.ink} {...STROKE} />
      <rect x={22} y={36} width={56} height={52} rx={8} fill={pal.body} stroke={pal.ink} {...STROKE} />
      <rect x={29} y={43} width={42} height={24} rx={5} fill={pal.ink} />
      <rect x={34 + jitter(seed, 7) * 3} y={49} width={10} height={type === 'pawn' ? 6 : 10} rx={2} fill={pal.eye} />
      <rect x={56 + jitter(seed, 8) * 3} y={49} width={10} height={10} rx={2} fill={pal.eye} />
      <path d="M32 76 h8 M44 76 h4 M52 76 h16" stroke={pal.ink} {...STROKE} strokeWidth={3} />
      <circle cx={70} cy={82} r={2.5} fill={pal.belly} />
      <path d="M22 54 h-6 v14 M78 58 h6 v12" fill="none" stroke={pal.ink} {...STROKE} />
      {type === 'pawn' && <path d="M50 36 V24" stroke={pal.ink} {...STROKE} />}
      {type === 'pawn' && <circle cx={50} cy={22} r={4} fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} />}
    </g>
  ),
  ghost: (pal, _type, seed) => (
    <g>
      <path d="M24 92 L24 56 C24 28 76 28 76 56 L76 92 L68 84 L60 93 L51 85 L42 93 L33 84 Z" fill={pal.body} stroke={pal.ink} {...STROKE} />
      <path d="M68 50 C70 58 70 70 68 80" fill="none" stroke={pal.shade} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={41} cy={54} rx={5} ry={8} fill={pal.eye} />
      <ellipse cx={58 + jitter(seed, 9) * 2} cy={53} rx={5} ry={7} fill={pal.eye} />
      <ellipse cx={49} cy={70} rx={5} ry={6 + jitter(seed, 10) * 3} fill={pal.ink} />
      <ellipse cx={33} cy={64} rx={4} ry={2.5} fill={pal.belly} opacity={0.8} />
      <ellipse cx={67} cy={64} rx={4} ry={2.5} fill={pal.belly} opacity={0.8} />
    </g>
  ),
  critter: (pal, type, seed) => (
    <g>
      {type !== 'knight' && <path d="M28 46 L24 26 L40 38 Z M72 46 L76 26 L60 38 Z" fill={pal.body} stroke={pal.ink} {...STROKE} />}
      <ellipse cx={50} cy={66} rx={30} ry={28} fill={pal.body} stroke={pal.ink} {...STROKE} />
      <ellipse cx={50} cy={76} rx={17} ry={14} fill={pal.belly} />
      <Eyes pal={pal} y={56} gap={11} r={5} seed={seed} />
      <path d="M46 64 l4 4 l4 -4 z" fill={pal.ink} />
      <path d="M22 64 l-10 -2 M22 68 l-10 2 M78 64 l10 -2 M78 68 l10 2" stroke={pal.ink} strokeWidth={2} strokeLinecap="round" />
      <path d="M36 92 v3 M64 92 v3" stroke={pal.ink} {...STROKE} />
    </g>
  ),
  unicorn: (pal, type, seed) => (
    <g>
      <path d="M32 94 v-4 M66 94 v-4" stroke={pal.ink} {...STROKE} strokeWidth={5} />
      <path d="M26 92 C20 70 24 50 34 42 C42 34 60 32 70 40 C82 50 82 74 74 92 Z" fill={pal.body} stroke={pal.ink} {...STROKE} />
      {/* Rainbow mane down one side */}
      {['#ff5d8f', '#ffb13d', '#ffe14a', '#6bd36b', '#5ab4ff', '#a77bff'].map((c, i) => (
        <path key={c} d={`M${70 + i * 1.5} ${42 + i * 7} q10 4 8 12`} fill="none" stroke={c} strokeWidth={5} strokeLinecap="round" />
      ))}
      <path d="M38 40 L32 18 L46 36 Z" fill="#ffe14a" stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M35 30 l6 -2 M37 24 l4 -1.5" stroke={pal.ink} strokeWidth={1.5} />
      <Eyes pal={pal} y={56} gap={10} r={type === 'pawn' ? 6 : 5} seed={seed} />
      <ellipse cx={50} cy={74} rx={13} ry={8} fill={pal.belly} />
      <circle cx={45} cy={74} r={1.8} fill={pal.ink} /><circle cx={55} cy={74} r={1.8} fill={pal.ink} />
      <path d="M22 60 l-5 -3 M20 66 l-6 0" stroke="#ffe14a" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  ),
  fish: (pal, _type, seed) => (
    <g>
      <path d="M72 66 L92 50 L88 66 L92 84 Z" fill={pal.shade} stroke={pal.ink} {...STROKE} />
      <ellipse cx={46} cy={66} rx={30} ry={24} fill={pal.body} stroke={pal.ink} {...STROKE} />
      <path d="M44 44 C50 34 60 36 62 46" fill={pal.shade} stroke={pal.ink} strokeWidth={3} />
      <path d="M58 54 C62 62 62 72 58 80 M66 56 C70 64 70 72 66 78" fill="none" stroke={pal.shade} strokeWidth={3} strokeLinecap="round" />
      <circle cx={30 + jitter(seed, 13) * 2} cy={60} r={8} fill={pal.eye} stroke={pal.ink} strokeWidth={2.5} />
      <circle cx={31} cy={61} r={3.5} fill={pal.ink} />
      <ellipse cx={20} cy={74} rx={4} ry={3} fill={pal.ink} />
      <ellipse cx={46} cy={80} rx={14} ry={6} fill={pal.belly} opacity={0.8} />
      <circle cx={12} cy={50} r={3} fill="none" stroke="#7fd4ff" strokeWidth={2} />
      <circle cx={8} cy={40} r={2} fill="none" stroke="#7fd4ff" strokeWidth={2} />
    </g>
  ),
  dog: (pal, type, seed) => (
    <g>
      <ellipse cx={50} cy={66} rx={28} ry={27} fill={pal.body} stroke={pal.ink} {...STROKE} />
      <path d="M24 48 C10 50 10 76 20 80 C26 74 28 60 28 52 Z" fill={pal.shade} stroke={pal.ink} {...STROKE} />
      <path d="M76 48 C90 50 90 76 80 80 C74 74 72 60 72 52 Z" fill={pal.shade} stroke={pal.ink} {...STROKE} />
      <circle cx={62} cy={56} r={9} fill={pal.shade} opacity={0.6} />
      <Eyes pal={pal} y={58} gap={11} r={type === 'pawn' ? 5.5 : 5} seed={seed} />
      <ellipse cx={50} cy={74} rx={14} ry={10} fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} />
      <ellipse cx={50} cy={70} rx={5} ry={3.5} fill={pal.ink} />
      <path d="M50 74 v4 M44 79 Q50 84 56 79" fill="none" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M52 81 q3 8 7 2 z" fill="#ff7a9a" stroke={pal.ink} strokeWidth={2} />
    </g>
  ),
  wolf: (pal, type, seed) => (
    <g>
      {type !== 'knight' && <path d="M28 50 L22 22 L42 40 Z M72 50 L78 22 L58 40 Z" fill={pal.body} stroke={pal.ink} {...STROKE} />}
      <path d="M22 60 C22 40 40 34 50 34 C60 34 78 40 78 60 L70 86 L50 94 L30 86 Z" fill={pal.body} stroke={pal.ink} {...STROKE} />
      <path d="M36 70 L50 94 L64 70 C58 66 42 66 36 70 Z" fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      {/* Grumpy brows */}
      <path d={`M32 ${50 + jitter(seed, 14) * 3} L46 56 M68 ${50 + jitter(seed, 15) * 3} L54 56`} stroke={pal.ink} {...STROKE} strokeWidth={4} />
      <ellipse cx={40} cy={60} rx={4.5} ry={3.5} fill={pal.eye} stroke={pal.ink} strokeWidth={2} />
      <ellipse cx={60} cy={60} rx={4.5} ry={3.5} fill={pal.eye} stroke={pal.ink} strokeWidth={2} />
      <ellipse cx={50} cy={74} rx={5} ry={3.5} fill={pal.ink} />
      <path d="M44 82 l2 5 l2 -4 M52 82 l2 5 l2 -4" fill="#fff" stroke={pal.ink} strokeWidth={1.5} />
    </g>
  ),
  muncher: (pal, type, seed) => (
    <g>
      <path d="M38 40 V26 M62 40 V24" stroke={pal.ink} {...STROKE} />
      <circle cx={38} cy={24} r={7} fill={pal.eye} stroke={pal.ink} strokeWidth={2.5} />
      <circle cx={62} cy={22} r={type === 'pawn' ? 9 : 7} fill={pal.eye} stroke={pal.ink} strokeWidth={2.5} />
      <circle cx={39 + jitter(seed, 16) * 3} cy={25} r={3} fill={pal.ink} />
      <circle cx={61 + jitter(seed, 17) * 3} cy={23} r={3} fill={pal.ink} />
      <rect x={18} y={38} width={64} height={56} rx={16} fill={pal.body} stroke={pal.ink} {...STROKE} />
      <rect x={24} y={50} width={52} height={32} rx={10} fill={pal.belly} stroke={pal.ink} strokeWidth={3} />
      <path d="M24 52 l6 8 l6 -8 l6 8 l6 -8 l6 8 l6 -8 l6 8 l4 -8" fill="#fff" stroke={pal.ink} strokeWidth={2} strokeLinejoin="round" />
      <path d="M26 80 l5 -7 l5 7 l5 -7 l5 7 l5 -7 l5 7 l5 -7 l5 7 l4 -7" fill="#fff" stroke={pal.ink} strokeWidth={2} strokeLinejoin="round" />
    </g>
  ),
  dino: (pal, type, seed) => (
    <g>
      <path d="M70 70 C84 72 92 82 96 92 L72 90 Z" fill={pal.body} stroke={pal.ink} {...STROKE} />
      <path d="M30 44 l4 -10 l6 8 l5 -10 l6 9 l6 -9 l4 10 l6 -6 l1 10" fill={pal.shade} stroke={pal.ink} strokeWidth={3} strokeLinejoin="round" />
      <path d="M26 94 C18 74 22 50 36 42 C46 36 62 38 70 46 C80 58 78 80 72 94 Z" fill={pal.body} stroke={pal.ink} {...STROKE} />
      <path d="M38 94 C36 80 42 70 52 70 C62 70 66 82 64 94" fill={pal.belly} />
      <path d="M40 74 l-8 4 M62 74 l8 4" stroke={pal.ink} {...STROKE} strokeWidth={4} />
      <Eyes pal={pal} y={54} gap={10} r={type === 'pawn' ? 6.5 : 5.5} seed={seed} />
      <path d="M40 64 Q50 70 60 63" fill="none" stroke={pal.ink} {...STROKE} />
      <path d="M44 66 l2 4 l2 -3 M53 66 l2 4 l2 -3" fill="#fff" stroke={pal.ink} strokeWidth={1.4} />
    </g>
  ),
  alien: (pal, type, seed) => (
    <g>
      <path d="M30 42 Q20 30 16 20 M70 42 Q80 30 84 20" fill="none" stroke={pal.ink} {...STROKE} />
      <circle cx={16} cy={18} r={5} fill={pal.shade} stroke={pal.ink} strokeWidth={2.5} />
      <circle cx={84} cy={18} r={5} fill={pal.shade} stroke={pal.ink} strokeWidth={2.5} />
      <path d="M36 94 L40 82 L60 82 L64 94 Z" fill={pal.shade} stroke={pal.ink} {...STROKE} />
      <ellipse cx={50} cy={60} rx={32} ry={26} fill={pal.body} stroke={pal.ink} {...STROKE} />
      {[34, 50, 66].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy={i === 1 ? 52 : 58} rx={7} ry={type === 'pawn' && i === 1 ? 10 : 8} fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} />
          <circle cx={x + jitter(seed, 20 + i) * 3} cy={(i === 1 ? 52 : 58) + 2} r={3.5} fill={pal.eye} />
        </g>
      ))}
      <path d="M42 74 Q50 78 58 74" fill="none" stroke={pal.ink} {...STROKE} />
    </g>
  ),
  slime: (pal, type, seed) => (
    <g>
      <path d="M18 92 C14 70 26 40 50 38 C74 40 86 70 82 92 C76 88 72 96 66 92 C60 88 56 96 50 92 C44 88 38 96 32 92 C26 88 22 96 18 92 Z" fill={pal.body} stroke={pal.ink} {...STROKE} opacity={0.92} />
      <path d="M30 56 C32 48 38 44 44 44" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
      <path d={`M70 ${70 + jitter(seed, 18) * 4} q2 10 -2 14`} fill="none" stroke={pal.shade} strokeWidth={5} strokeLinecap="round" />
      <Eyes pal={{ ...pal, eye: '#fff' }} y={62} gap={11} r={type === 'pawn' ? 7 : 6} seed={seed} />
      <path d="M42 76 Q50 82 58 76" fill="none" stroke={pal.ink} {...STROKE} />
      <circle cx={60} cy={48} r={3} fill="#fff" opacity={0.8} />
    </g>
  ),
  veggie: (pal, type, seed) => (
    <g>
      <path d="M50 30 C30 30 20 46 22 64 C24 84 38 94 50 94 C64 94 78 84 78 64 C80 46 70 30 50 30 Z" fill={pal.body} stroke={pal.ink} {...STROKE} />
      <path d="M32 50 C30 60 32 72 38 82" fill="none" stroke={pal.shade} strokeWidth={4} strokeLinecap="round" />
      {type === 'pawn' && <path d="M50 32 C46 22 38 20 34 22 C40 26 44 28 50 32 C54 22 62 18 68 20 C62 24 56 28 50 32" fill="#5bbf3a" stroke={pal.ink} strokeWidth={2.5} />}
      {/* Angry brows. Very angry. */}
      <path d={`M34 ${48 + jitter(seed, 11) * 3} L46 53 M66 ${47 + jitter(seed, 12) * 3} L54 53`} stroke={pal.ink} {...STROKE} strokeWidth={4} />
      <circle cx={41} cy={58} r={4.5} fill={pal.eye} stroke={pal.ink} strokeWidth={2} />
      <circle cx={59} cy={58} r={4.5} fill={pal.eye} stroke={pal.ink} strokeWidth={2} />
      <circle cx={42} cy={59} r={2} fill={pal.ink} /><circle cx={58} cy={59} r={2} fill={pal.ink} />
      <path d="M40 74 Q50 66 60 74" fill="none" stroke={pal.ink} {...STROKE} />
    </g>
  ),
};

const GOLD = '#ffcf3a';
const GOLD_DARK = '#b8860b';

/** The hat says what piece it is. Drawn in body space, sitting on the head (top near y=32). */
function Hat({ type, skin, pal }: { type: string; skin: Drawn; pal: Palette }) {
  const top = skin === 'robot' || skin === 'muncher' ? 38 : skin === 'critter' || skin === 'dog' ? 42 : skin === 'fish' ? 44 : skin === 'alien' ? 36 : 34;
  const t = (y: number) => y - 34 + top;
  switch (type) {
    case 'king':
      return (
        <g>
          <path d={`M30 ${t(36)} L28 ${t(16)} L39 ${t(26)} L50 ${t(10)} L61 ${t(26)} L72 ${t(16)} L70 ${t(36)} Z`} fill={GOLD} stroke={GOLD_DARK} {...STROKE} />
          <path d={`M50 ${t(10)} V${t(-6)} M43 ${t(0)} H57`} stroke={GOLD_DARK} {...STROKE} strokeWidth={4.5} />
          <circle cx={50} cy={t(28)} r={3} fill="#e8364b" />
        </g>
      );
    case 'queen':
      return (
        <g>
          <path d={`M30 ${t(36)} L26 ${t(18)} L37 ${t(28)} L43 ${t(14)} L50 ${t(26)} L57 ${t(14)} L63 ${t(28)} L74 ${t(18)} L70 ${t(36)} Z`} fill={GOLD} stroke={GOLD_DARK} {...STROKE} />
          {[26, 43, 57, 74].map((x, i) => <circle key={i} cx={x} cy={t(i % 3 === 0 ? 16 : 12)} r={3.5} fill="#ff6fb5" stroke={GOLD_DARK} strokeWidth={1.5} />)}
        </g>
      );
    case 'rook':
      return (
        <g>
          <path d={`M33 ${t(38)} V${t(14)} H40 V${t(20)} H46 V${t(14)} H54 V${t(20)} H60 V${t(14)} H67 V${t(38)} Z`} fill="#b9b2a6" stroke="#4a4438" {...STROKE} />
          <path d={`M45 ${t(38)} V${t(30)} Q50 ${t(24)} 55 ${t(30)} V${t(38)}`} fill="#4a4438" />
        </g>
      );
    case 'bishop':
      return (
        <g>
          <path d={`M38 ${t(38)} C34 ${t(22)} 44 ${t(8)} 50 ${t(2)} C56 ${t(8)} 66 ${t(22)} 62 ${t(38)} Z`} fill="#f4f0ff" stroke="#5a4e8a" {...STROKE} />
          <path d={`M54 ${t(14)} L46 ${t(28)}`} stroke="#5a4e8a" {...STROKE} strokeWidth={4} />
          <circle cx={50} cy={t(0)} r={3.5} fill={GOLD} stroke={GOLD_DARK} strokeWidth={2} />
        </g>
      );
    case 'knight':
      // A horse-head hood. The ears give it away.
      return (
        <g>
          <path d={`M34 ${t(40)} C30 ${t(24)} 36 ${t(12)} 48 ${t(8)} L50 ${t(-2)} L55 ${t(8)} L60 ${t(0)} L62 ${t(10)} C74 ${t(16)} 80 ${t(26)} 76 ${t(34)} L66 ${t(32)} L66 ${t(40)} Z`} fill="#c98b5a" stroke="#4a2c14" {...STROKE} />
          <path d={`M44 ${t(12)} C40 ${t(20)} 38 ${t(30)} 40 ${t(40)}`} fill="none" stroke="#4a2c14" strokeWidth={5} strokeLinecap="round" />
          <circle cx={64} cy={t(18)} r={2.5} fill="#4a2c14" />
          <circle cx={74} cy={t(30)} r={1.5} fill="#4a2c14" />
        </g>
      );
    default:
      void pal;
      return null;
  }
}

/** Cell of each piece in an art sheet: 3 columns by 2 rows (docs/ART-PROMPTS.md). */
const ART_CELL: Record<string, [number, number]> = { king: [0, 0], queen: [1, 0], rook: [2, 0], bishop: [0, 1], knight: [1, 1], pawn: [2, 1] };

/** A piece drawn from a collection skin's art sheet. */
function ArtPiece({ slug, side, type, owner, badge }: { slug: string; side: 'p1' | 'p2'; type: string; owner: string; badge: boolean }) {
  const [col, row] = ART_CELL[type] ?? ART_CELL.pawn;
  const s = SCALE[type] ?? 0.85;
  const hue = owner === 'p3' ? 150 : owner === 'p4' ? 200 : 0;
  const size = 100 * s;
  return (
    <g>
      {hue > 0 && <defs><filter id={`hue-art-${owner}`}><feColorMatrix type="hueRotate" values={String(hue)} /></filter></defs>}
      <ellipse cx={50} cy={93} rx={26 * s} ry={4} fill="rgba(0,0,0,0.22)" />
      <svg x={50 - size / 2} y={94 - size} width={size} height={size} viewBox={`${col} ${row} 1 1`} filter={hue > 0 ? `url(#hue-art-${owner})` : undefined}>
        <image href={`/skins/${slug}-${side === 'p1' ? 'light' : 'dark'}.png`} width={3} height={2} preserveAspectRatio="none" />
      </svg>
      {badge && (
        <g transform="translate(70 68) scale(0.3)">
          <circle cx={50} cy={50} r={46} fill="#fff" stroke="#2d2a3e" strokeWidth={8} />
          <g transform="translate(14 12) scale(0.72)"><PieceGlyph type={type} light={owner === 'p1'} /></g>
        </g>
      )}
    </g>
  );
}
