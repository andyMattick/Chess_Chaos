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

import type { SkinId } from '../content/cosmetics';
export { DEFAULT_SKINS, skinFor, type SkinChoice, type SkinId } from '../content/cosmetics';

interface Palette { body: string; shade: string; belly: string; ink: string; eye: string }

/** Each skin has its own colours for each army, so mixed armies stay readable. */
const PALETTES: Record<Exclude<SkinId, 'classic'>, Record<'p1' | 'p2', Palette>> = {
  gremlin: { p1: { body: '#a6e04a', shade: '#6fa82a', belly: '#e3f7a8', ink: '#1d2410', eye: '#fff' }, p2: { body: '#8a4fd8', shade: '#5b2a9e', belly: '#c9a8f5', ink: '#1a0f2e', eye: '#fff36b' } },
  robot: { p1: { body: '#cfe3ea', shade: '#8fb1bd', belly: '#5fe0d0', ink: '#1b2a30', eye: '#5fe0d0' }, p2: { body: '#d0603a', shade: '#8f3a20', belly: '#ffcf4a', ink: '#2a1208', eye: '#ffcf4a' } },
  ghost: { p1: { body: '#fbfbff', shade: '#c8cbe6', belly: '#ffd2e4', ink: '#2b2a40', eye: '#2b2a40' }, p2: { body: '#5a6b8f', shade: '#36425e', belly: '#8fa3cc', ink: '#0f1422', eye: '#c6ff6b' } },
  critter: { p1: { body: '#ffb04a', shade: '#e07a1c', belly: '#ffe3b8', ink: '#2e1a08', eye: '#2e1a08' }, p2: { body: '#2f4f7f', shade: '#1b3054', belly: '#9cc2f0', ink: '#0b1422', eye: '#fff' } },
  veggie: { p1: { body: '#ff5d5d', shade: '#c93030', belly: '#ffb0a0', ink: '#3a0d0d', eye: '#fff' }, p2: { body: '#7a4fd0', shade: '#4d2a90', belly: '#b99af0', ink: '#160b2e', eye: '#fff' } },
};

export const SKINS: { id: SkinId; name: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic', blurb: 'Plain old chess pieces.' },
  { id: 'gremlin', name: 'Gremlins', blurb: 'Lumpy, toothy, a little bit rude.' },
  { id: 'robot', name: 'Robots', blurb: 'Beep. Boop. Checkmate.' },
  { id: 'ghost', name: 'Ghosts', blurb: 'Spooky sheets that float around.' },
  { id: 'critter', name: 'Critters', blurb: 'Fuzzy round things with ears.' },
  { id: 'veggie', name: 'Angry Veg', blurb: 'Tomatoes and turnips with attitude.' },
];

/** Bigger pieces are bigger characters: a pawn is short, the king is tall. */
const SCALE: Record<string, number> = { pawn: 0.74, knight: 0.86, bishop: 0.86, rook: 0.9, queen: 0.96, king: 1 };

/** Small deterministic wobble per piece so the army never looks copy-pasted. */
function jitter(seed: number, i: number) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

export function Character({ skin, type, owner, seed = 0, badge = false }: { skin: SkinId; type: string; owner: string; seed?: number; badge?: boolean }): ReactElement {
  if (skin === 'classic') return <PieceGlyph type={type} light={owner === 'p1'} />;
  const pal = PALETTES[skin][owner === 'p1' ? 'p1' : 'p2'];
  const s = SCALE[type] ?? 0.85;
  const tilt = jitter(seed, 1) * 9;
  // Body is drawn in a 100x100 box, standing on y=94, then scaled.
  return (
    <g>
      <ellipse cx={50} cy={93} rx={26 * s} ry={4} fill="rgba(0,0,0,0.22)" />
      <g transform={`translate(50 94) rotate(${tilt}) scale(${s}) translate(-50 -94)`}>
        {BODIES[skin](pal, type, seed)}
        <Hat type={type} skin={skin} pal={pal} />
      </g>
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

const BODIES: Record<Exclude<SkinId, 'classic'>, (pal: Palette, type: string, seed: number) => ReactElement> = {
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
function Hat({ type, skin, pal }: { type: string; skin: SkinId; pal: Palette }) {
  const top = skin === 'robot' ? 38 : skin === 'critter' ? 42 : 34;
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
