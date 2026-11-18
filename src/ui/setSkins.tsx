import type { ReactElement } from 'react';
import type { Palette } from '../content/cosmetics';
import { Eyes, jitter } from './skins';
import { RICH_BODIES, RICH_PALETTES } from './richSkins';

/**
 * The 22 collection skins (content/collections.ts), drawn in code like the
 * other skins: a body in a 100x100 box standing on y=94; the piece's hat is
 * added on top by Character. Each has a light army (p1) and a dark army (p2).
 * Art sheets in public/skins replace them if added later (ui/skinArt.ts).
 */
type Body = (pal: Palette, type: string, seed: number) => ReactElement;
const P = (body: string, shade: string, belly: string, ink: string, eye: string): Palette => ({ body, shade, belly, ink, eye });
const GOLD = '#ffd23f';
const PINK = '#ff8fb8';
// Same outline as the other skins (kept here: skins.tsx imports this file).
const S = { strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const BASE_PALETTES: Record<string, { p1: Palette; p2: Palette }> = {
  'royal-court': { p1: P('#ffd9e8', '#e08fb8', '#fff8ef', '#3a1f33', '#fff'), p2: P('#5a2a6e', '#2e1340', '#f3e6ff', '#14061c', '#fff') },
  'high-council': { p1: P('#e8c99a', '#a87c4a', '#fff4dc', '#2e1d0b', '#fff7c2'), p2: P('#4a4a6e', '#26263f', '#c9c9e6', '#0c0c18', '#ffe14a') },
  'war-council': { p1: P('#ff6a5a', '#c23a2e', '#fff3d6', '#2a0c08', '#fff'), p2: P('#2f4f8f', '#17294f', '#ffe9b0', '#060d1c', '#fff') },
  'kingdom-builders': { p1: P('#d9a066', '#9a6332', '#ffe6c2', '#2e1906', '#fff'), p2: P('#6b4428', '#3d2414', '#d9b38c', '#140a03', '#fff') },
  'back-row-heroes': { p1: P('#ffe066', '#e0a81c', '#ff5a5a', '#2b2208', '#fff'), p2: P('#3b3ba8', '#1f1f66', '#ff8a2a', '#07071f', '#fff') },
  'pawns-promise': { p1: P('#9be36b', '#4fa83a', '#e08a5a', '#16300a', '#fff'), p2: P('#2f7a4a', '#174a2a', '#8a4a2a', '#06180c', '#fff') },
  'knights-tale': { p1: P('#fff6dc', '#e6d4a8', '#ff9a5a', '#33291a', '#33291a'), p2: P('#6e8fb8', '#40597a', '#ffd25a', '#0f1a2a', '#0f1a2a') },
  'small-but-mighty': { p1: P('#d6d0c8', '#a39a8f', '#ffb3c8', '#2a2520', '#fff'), p2: P('#6e5a4a', '#3f3228', '#ff8fb0', '#120d09', '#fff') },
  'tactics-squad': { p1: P('#8be06b', '#4aa83a', '#f2ffcc', '#122a0a', '#fff'), p2: P('#2f6f5a', '#173f33', '#a8e6cc', '#04140e', '#ffe14a') },
  'iron-fortress': { p1: P('#c9c2b6', '#8f877a', '#7fc45a', '#2a2620', '#7fe0ff'), p2: P('#5a5550', '#33302c', '#3f7a2e', '#0c0b0a', '#ff9a3c') },
  'old-castle': { p1: P('#c8b6e6', '#8f7ab8', '#fff1c2', '#241a33', '#fff'), p2: P('#3a2f4f', '#1e1730', '#ffcf5a', '#07040e', '#ffe14a') },
  'long-range-battery': { p1: P('#f4f7fb', '#b8c4d6', '#5ab4ff', '#1b2433', '#fff'), p2: P('#8a96b0', '#4f5a72', '#ff7a3c', '#0c1018', '#fff') },
  'castle-defenders': { p1: P('#d9b08a', '#9a6f4a', '#fff0d9', '#2e1c0c', '#fff'), p2: P('#5a4636', '#33261c', '#e6c9a8', '#100a05', '#fff') },
  'storm-troop': { p1: P('#f2f6ff', '#b9c6e6', '#ffe14a', '#24304d', '#fff'), p2: P('#5a6480', '#333a52', '#ffe14a', '#0b0e18', '#fff') },
  'army-without-a-crown': { p1: P('#ffd6b0', '#e0a070', '#ffffff', '#2e1a0c', '#fff'), p2: P('#c98a5a', '#8a5530', '#2f3a6e', '#1a0c04', '#fff') },
  'nobles-ball': { p1: P('#ffe6f2', '#f0b8d6', '#b98cff', '#3a1630', '#9be36b'), p2: P('#3a3a4a', '#1f1f2a', '#c23a6e', '#000', '#ffe14a') },
  'open-field': { p1: P('#f2d27a', '#c9a23a', '#7fb0e6', '#33280a', '#fff'), p2: P('#8a6a3a', '#5a4220', '#4a5a8a', '#140e04', '#fff') },
  'straight-shooters': { p1: P('#4a5a7a', '#2a3550', '#ffffff', '#0b1020', '#fff'), p2: P('#1c1c28', '#000000', '#e6e9f2', '#000', '#fff') },
  'iron-will': { p1: P('#ffcf6b', '#d0902a', '#ffefc2', '#3a2604', '#fff'), p2: P('#7a8a9a', '#4a5866', '#d0902a', '#0e1216', '#fff') },
  'kings-quest': { p1: P('#7fe08a', '#3fa84f', '#fff2a8', '#0e2a12', '#fff'), p2: P('#c23a3a', '#7a1f1f', '#ffc27a', '#240505', '#fff') },
  'the-rebellion': { p1: P('#c8ccd4', '#8a909c', '#f4f5f8', '#1c1f26', '#fff'), p2: P('#5a5f6b', '#33363e', '#a8adb8', '#07080a', '#fff') },
  'chess-chaos-crown': { p1: P('#ffd84a', '#d49a00', '#fff6c2', '#4a3200', '#fff'), p2: P('#8a4fd8', '#4f2a8f', '#e6c2ff', '#1a0833', '#ffd84a') },
};

/** Where each character's head is, for the piece hat (34 is the usual). */
export const SET_HAT_TOP: Record<string, number> = {
  'high-council': 32, 'pawns-promise': 30, 'iron-fortress': 32, 'long-range-battery': 30, 'storm-troop': 36, 'kings-quest': 36, 'chess-chaos-crown': 32,
};

const smile = (pal: Palette, y = 68, w = 10) => <path d={`M${50 - w} ${y} Q50 ${y + 8} ${50 + w} ${y}`} fill="none" stroke={pal.ink} {...S} />;
const cheeks = (y = 66, c = PINK) => <g><ellipse cx={33} cy={y} rx={4} ry={2.5} fill={c} opacity={0.7} /><ellipse cx={67} cy={y} rx={4} ry={2.5} fill={c} opacity={0.7} /></g>;
const feet = (pal: Palette) => <path d="M38 93 h-6 M62 93 h6" stroke={pal.ink} {...S} strokeWidth={5} />;

const BASE_BODIES: Record<string, Body> = {
  'royal-court': (pal, _t, seed) => (
    <g>
      <path d="M26 94 L34 52 L66 52 L74 94 Z" fill={pal.shade} stroke={pal.ink} {...S} />
      <path d="M34 94 C30 72 36 58 50 58 C64 58 70 72 66 94 Z" fill={pal.body} stroke={pal.ink} {...S} />
      <circle cx={50} cy={46} r={15} fill="#ffe0c2" stroke={pal.ink} {...S} />
      <path d="M32 60 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5" fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <Eyes pal={{ ...pal, eye: '#fff' }} y={44} gap={6} r={3.5} seed={seed} />
      <path d="M45 52 Q50 56 55 52" fill="none" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={50} cy={74} r={3} fill={GOLD} stroke={pal.ink} strokeWidth={1.5} /><circle cx={50} cy={84} r={3} fill={GOLD} stroke={pal.ink} strokeWidth={1.5} />
    </g>
  ),
  'high-council': (pal, type, seed) => (
    <g>
      <path d="M26 94 C18 70 22 40 50 34 C78 40 82 70 74 94 Z" fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M30 40 L26 28 L38 36 M70 40 L74 28 L62 36" fill={pal.shade} stroke={pal.ink} strokeWidth={3} strokeLinejoin="round" />
      <path d="M30 94 C30 76 40 70 50 70 C60 70 70 76 70 94" fill={pal.shade} opacity={0.6} />
      <path d="M40 74 l4 4 M46 74 l4 4 M52 74 l4 4 M42 82 l4 4 M50 82 l4 4" stroke={pal.belly} strokeWidth={2} strokeLinecap="round" />
      <circle cx={40} cy={54} r={10} fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} />
      <circle cx={60} cy={54} r={10} fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} />
      <Eyes pal={pal} y={54} gap={10} r={type === 'pawn' ? 6 : 5} seed={seed} />
      <path d="M30 54 h-4 M70 54 h4 M50 54 h0" stroke={pal.ink} strokeWidth={2} />
      <path d="M46 62 L50 70 L54 62 Z" fill={GOLD} stroke={pal.ink} strokeWidth={2} strokeLinejoin="round" />
    </g>
  ),
  'war-council': (pal, _t, seed) => (
    <g>
      <rect x={36} y={80} width={10} height={14} fill="#2a2a3a" /><rect x={54} y={80} width={10} height={14} fill="#2a2a3a" />
      <rect x={30} y={56} width={40} height={28} rx={6} fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M32 58 L68 82 M68 58 L32 82" stroke={pal.belly} strokeWidth={4} />
      <circle cx={50} cy={64} r={2} fill={GOLD} /><circle cx={50} cy={74} r={2} fill={GOLD} />
      <circle cx={50} cy={44} r={14} fill="#ffe0c2" stroke={pal.ink} {...S} />
      {cheeks(49, '#ff5a5a')}
      <circle cx={44 + jitter(seed, 2)} cy={42} r={2.5} fill={pal.ink} /><circle cx={56 + jitter(seed, 3)} cy={42} r={2.5} fill={pal.ink} />
      <path d="M46 50 h8" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" />
      <ellipse cx={74} cy={70} rx={9} ry={7} fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} />
      <path d="M68 66 L80 74 M68 74 L80 66" stroke={pal.shade} strokeWidth={1.5} />
    </g>
  ),
  'kingdom-builders': (pal, type, seed) => (
    <g>
      <ellipse cx={74} cy={84} rx={10} ry={14} transform="rotate(30 74 84)" fill={pal.shade} stroke={pal.ink} {...S} />
      <path d="M68 76 l10 10 M72 72 l8 8 M66 82 l8 8" stroke={pal.ink} strokeWidth={1.5} opacity={0.6} />
      <ellipse cx={48} cy={66} rx={24} ry={28} fill={pal.body} stroke={pal.ink} {...S} />
      <ellipse cx={48} cy={76} rx={14} ry={14} fill={pal.belly} />
      <circle cx={30} cy={44} r={5} fill={pal.shade} stroke={pal.ink} strokeWidth={2.5} /><circle cx={66} cy={44} r={5} fill={pal.shade} stroke={pal.ink} strokeWidth={2.5} />
      <Eyes pal={pal} y={54} gap={9} r={type === 'pawn' ? 5 : 4.5} seed={seed} />
      <ellipse cx={48} cy={62} rx={4} ry={3} fill={pal.ink} />
      <rect x={44} y={66} width={4} height={6} fill="#fff" stroke={pal.ink} strokeWidth={1.5} /><rect x={48} y={66} width={4} height={6} fill="#fff" stroke={pal.ink} strokeWidth={1.5} />
      <path d="M24 74 l-8 -10 M14 62 l6 -2 l2 6 Z" stroke="#7a5a3a" fill="#9aa4b0" strokeWidth={3} strokeLinejoin="round" />
    </g>
  ),
  'back-row-heroes': (pal, _t, seed) => (
    <g>
      <path d="M30 52 L18 94 L82 94 L70 52 Z" fill={pal.belly} stroke={pal.ink} {...S} />
      <path d="M34 94 C32 72 38 60 50 60 C62 60 68 72 66 94 Z" fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M50 66 l3 6 l6 1 l-5 4 l2 6 l-6 -4 l-6 4 l2 -6 l-5 -4 l6 -1 Z" fill={pal.belly} stroke={pal.ink} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={50} cy={46} r={15} fill="#ffe0c2" stroke={pal.ink} {...S} />
      <path d="M34 42 C40 38 60 38 66 42 L64 50 C58 46 42 46 36 50 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={43 + jitter(seed, 2)} cy={45} r={2.5} fill="#fff" /><circle cx={57 + jitter(seed, 3)} cy={45} r={2.5} fill="#fff" />
      {smile(pal, 52, 6)}
    </g>
  ),
  'pawns-promise': (pal, type, seed) => {
    const tall = type === 'pawn' ? 0 : type === 'king' || type === 'queen' ? 6 : 3;
    return (
      <g>
        <path d="M32 78 L36 94 L64 94 L68 78 Z" fill={pal.belly} stroke={pal.ink} {...S} />
        <rect x={30} y={74} width={40} height={6} rx={2} fill={pal.belly} stroke={pal.ink} strokeWidth={3} />
        <path d={`M50 74 V${64 - tall}`} stroke={pal.shade} strokeWidth={6} strokeLinecap="round" />
        <path d={`M50 ${70 - tall} C40 ${62 - tall} 30 ${66 - tall} 26 ${62 - tall} C32 ${72 - tall} 42 ${74 - tall} 50 ${70 - tall} Z M50 ${68 - tall} C60 ${60 - tall} 70 ${64 - tall} 74 ${58 - tall} C70 ${70 - tall} 60 ${72 - tall} 50 ${68 - tall} Z`} fill={pal.body} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={50} cy={48 - tall} r={16} fill={pal.body} stroke={pal.ink} {...S} />
        <Eyes pal={pal} y={46 - tall} gap={6} r={4} seed={seed} />
        {smile(pal, 53 - tall, 5)}
      </g>
    );
  },
  'knights-tale': (pal, _t, seed) => (
    <g>
      <path d="M30 94 L28 60 L34 44 L50 36 L66 44 L72 60 L70 94 L64 90 L58 94 L52 90 L46 94 L40 90 Z" fill="#ffffff" transform="translate(3 3)" opacity={0.9} />
      <path d="M30 94 L28 60 L34 44 L50 36 L66 44 L72 60 L70 94 L64 90 L58 94 L52 90 L46 94 L40 90 Z" fill={pal.body} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M50 38 V92" stroke={pal.shade} strokeWidth={2} strokeDasharray="3 4" />
      <path d="M36 70 h28" stroke={pal.belly} strokeWidth={6} />
      <circle cx={43} cy={54} r={3} fill={pal.ink} /><circle cx={57 + jitter(seed, 2)} cy={54} r={3} fill={pal.ink} />
      <path d="M45 62 Q50 65 55 62" fill="none" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  ),
  'small-but-mighty': (pal, type, seed) => (
    <g>
      <path d="M70 88 C86 90 90 76 82 70" fill="none" stroke={pal.belly} strokeWidth={3} strokeLinecap="round" />
      <circle cx={32} cy={42} r={11} fill={pal.body} stroke={pal.ink} {...S} /><circle cx={32} cy={42} r={6} fill={pal.belly} />
      <circle cx={68} cy={42} r={11} fill={pal.body} stroke={pal.ink} {...S} /><circle cx={68} cy={42} r={6} fill={pal.belly} />
      <ellipse cx={50} cy={68} rx={24} ry={26} fill={pal.body} stroke={pal.ink} {...S} />
      <ellipse cx={50} cy={78} rx={13} ry={12} fill={pal.belly} opacity={0.6} />
      <Eyes pal={pal} y={58} gap={8} r={type === 'pawn' ? 5 : 4} seed={seed} />
      <circle cx={50} cy={66} r={3} fill={PINK} stroke={pal.ink} strokeWidth={1.5} />
      <path d="M44 66 l-14 -2 M44 68 l-14 3 M56 66 l14 -2 M56 68 l14 3" stroke={pal.ink} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  ),
  'tactics-squad': (pal, type, seed) => (
    <g>
      <path d="M22 92 C16 72 24 52 50 50 C76 52 84 72 78 92 Z" fill={pal.body} stroke={pal.ink} {...S} />
      <circle cx={36} cy={46} r={10} fill={pal.body} stroke={pal.ink} {...S} /><circle cx={64} cy={46} r={10} fill={pal.body} stroke={pal.ink} {...S} />
      <Eyes pal={pal} y={45} gap={14} r={type === 'pawn' ? 6 : 5} seed={seed} />
      <path d="M26 58 H74 V64 H26 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2.5} />
      <path d="M74 60 L86 54 M74 62 L86 66" stroke={pal.shade} strokeWidth={4} strokeLinecap="round" />
      <path d="M34 74 Q50 84 66 74" fill="none" stroke={pal.ink} {...S} />
      <ellipse cx={50} cy={86} rx={14} ry={5} fill={pal.belly} opacity={0.7} />
    </g>
  ),
  'iron-fortress': (pal, _t, seed) => (
    <g>
      <rect x={30} y={78} width={14} height={16} rx={3} fill={pal.shade} stroke={pal.ink} {...S} /><rect x={56} y={78} width={14} height={16} rx={3} fill={pal.shade} stroke={pal.ink} {...S} />
      <path d="M24 82 L22 52 L32 40 L68 40 L78 52 L76 82 Z" fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M40 40 L44 52 L38 60 M66 62 L58 70 L62 80" fill="none" stroke={pal.shade} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M24 52 C30 46 38 48 36 54 C30 56 26 56 24 52 Z M64 42 C70 40 76 44 74 48 C68 48 64 46 64 42 Z" fill={pal.belly} />
      <rect x={38} y={52} width={8} height={5} rx={1} fill={pal.eye} /><rect x={54} y={52 + jitter(seed, 2)} width={8} height={5} rx={1} fill={pal.eye} />
      <path d="M42 68 h16" stroke={pal.ink} {...S} />
    </g>
  ),
  'old-castle': (pal, type, seed) => (
    <g>
      <path d="M32 60 C20 52 10 56 6 66 C12 64 14 70 20 68 C22 74 28 72 32 76 Z M68 60 C80 52 90 56 94 66 C88 64 86 70 80 68 C78 74 72 72 68 76 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <ellipse cx={50} cy={66} rx={20} ry={24} fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M36 46 L34 34 L42 44 M64 46 L66 34 L58 44" fill={pal.body} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <Eyes pal={pal} y={58} gap={8} r={type === 'pawn' ? 5 : 4.5} seed={seed} />
      <path d="M44 68 Q50 72 56 68" fill="none" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M46 69 l1 3 l1 -3 M52 69 l1 3 l1 -3" fill="#fff" stroke={pal.ink} strokeWidth={1} />
      <path d="M40 92 v-6" stroke={pal.ink} strokeWidth={2} />
      <rect x={34} y={84} width={12} height={10} rx={3} fill={pal.belly} stroke={pal.ink} strokeWidth={2} />
      <circle cx={40} cy={89} r={3} fill="#ffb02e" />
    </g>
  ),
  'long-range-battery': (pal, type, seed) => (
    <g>
      <rect x={66} y={58} width={12} height={22} rx={3} fill={pal.shade} stroke={pal.ink} {...S} />
      <path d="M36 92 C32 76 36 64 50 64 C64 64 68 76 64 92 Z" fill={pal.body} stroke={pal.ink} {...S} />
      <rect x={44} y={72} width={12} height={8} rx={2} fill={pal.belly} stroke={pal.ink} strokeWidth={2} />
      <circle cx={50} cy={46} r={18} fill={pal.body} stroke={pal.ink} {...S} />
      <rect x={37} y={38} width={26} height={18} rx={9} fill={pal.ink} />
      <circle cx={44} cy={47} r={type === 'pawn' ? 3.5 : 3} fill={pal.belly} /><circle cx={56 + jitter(seed, 2)} cy={47} r={3} fill={pal.belly} />
      <path d="M41 41 l5 -1" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M38 94 h-4 M62 94 h4" stroke={pal.ink} {...S} strokeWidth={5} />
    </g>
  ),
  'castle-defenders': (pal, type, seed) => (
    <g>
      <path d="M24 86 L16 78 L24 74 L14 66 L24 62 L16 52 L28 52 L24 40 L36 46 L38 32 L46 42 L52 30 L56 42 L64 32 L66 46 L78 40 L74 52 L86 52 L78 62 L88 66 L78 74 L84 82 L74 86 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <ellipse cx={50} cy={68} rx={22} ry={22} fill={pal.belly} stroke={pal.ink} {...S} />
      <Eyes pal={pal} y={60} gap={8} r={type === 'pawn' ? 4.5 : 4} seed={seed} />
      <circle cx={50} cy={68} r={3.5} fill={pal.ink} />
      <circle cx={34} cy={82} r={11} fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M34 72 V92 M24 82 H44" stroke={pal.ink} strokeWidth={2.5} />
      {feet(pal)}
    </g>
  ),
  'storm-troop': (pal, type, seed) => (
    <g>
      <path d="M44 84 L38 94 L46 92 L42 100" fill="none" stroke={pal.belly} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M62 84 l-2 6 M30 84 l-2 6" stroke="#5ab4ff" strokeWidth={3} strokeLinecap="round" />
      <path d="M22 80 C10 80 10 62 22 62 C20 48 38 42 44 50 C48 36 70 38 70 52 C84 50 90 66 80 72 C88 80 80 88 72 84 Z" fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M36 40 L40 34 L38 30 L44 26" fill="none" stroke={pal.belly} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Eyes pal={pal} y={64} gap={10} r={type === 'pawn' ? 5 : 4.5} seed={seed} />
      <path d="M42 74 Q50 70 58 74" fill="none" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  ),
  'army-without-a-crown': (pal, _t, seed) => (
    <g>
      <path d="M32 94 C30 74 38 62 50 62 C62 62 70 74 68 94 Z" fill={pal.belly} stroke={pal.ink} {...S} />
      {[70, 78, 86].map((y) => <path key={y} d={`M34 ${y} H66`} stroke="#e8364b" strokeWidth={4} />)}
      <circle cx={50} cy={46} r={16} fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M36 52 C40 64 60 64 64 52 C58 56 42 56 36 52 Z" fill="#6b3a1f" stroke={pal.ink} strokeWidth={2} />
      <circle cx={57} cy={43} r={5} fill={pal.ink} /><path d="M34 38 L62 46 M52 42 L66 36" stroke={pal.ink} strokeWidth={2} />
      <circle cx={43 + jitter(seed, 2)} cy={44} r={2.5} fill={pal.ink} />
      <path d="M45 55 Q50 58 55 55" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  'nobles-ball': (pal, type, seed) => (
    <g>
      <path d="M24 94 C26 76 36 64 50 64 C64 64 74 76 76 94 Z" fill={pal.belly} stroke={pal.ink} {...S} />
      <path d="M32 94 C36 82 40 74 50 72 C60 74 64 82 68 94" fill="none" stroke="#fff" strokeWidth={2} opacity={0.6} />
      <path d="M32 44 L30 28 L42 38 M68 44 L70 28 L58 38" fill={pal.body} stroke={pal.ink} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={50} cy={50} r={17} fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M32 46 C38 40 46 42 50 46 C54 42 62 40 68 46 C66 54 56 54 50 50 C44 54 34 54 32 46 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2} />
      <circle cx={42} cy={47} r={type === 'pawn' ? 3.5 : 3} fill={pal.eye} /><circle cx={58 + jitter(seed, 2)} cy={47} r={3} fill={pal.eye} />
      <path d="M46 58 l4 3 l4 -3" fill="none" stroke={pal.ink} strokeWidth={2} strokeLinecap="round" />
      <path d="M36 58 h-10 M36 60 l-9 4 M64 58 h10 M64 60 l9 4" stroke={pal.ink} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  ),
  'open-field': (pal, _t, seed) => (
    <g>
      <path d="M50 94 V70 M20 66 H80" stroke="#7a5a3a" strokeWidth={4} strokeLinecap="round" />
      <path d="M18 66 l-6 -3 M18 66 l-6 3 M82 66 l6 -3 M82 66 l6 3" stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" />
      <rect x={34} y={60} width={32} height={26} rx={4} fill={pal.belly} stroke={pal.ink} {...S} />
      <rect x={38} y={64} width={9} height={9} fill="#e8364b" stroke={pal.ink} strokeWidth={1.5} strokeDasharray="2 2" />
      <rect x={52} y={74} width={10} height={8} fill="#6bd36b" stroke={pal.ink} strokeWidth={1.5} strokeDasharray="2 2" />
      <path d="M38 86 l-2 6 M44 86 l0 7 M56 86 l1 7 M62 86 l3 6" stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={50} cy={46} r={15} fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M41 43 l4 4 M45 43 l-4 4 M55 43 l4 4 M59 43 l-4 4" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" transform={`translate(${jitter(seed, 2)} 0)`} />
      <path d="M42 53 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2" fill="none" stroke={pal.ink} strokeWidth={1.8} />
    </g>
  ),
  'straight-shooters': (pal, type, seed) => (
    <g>
      <path d="M36 94 h-6 l4 -4 M64 94 h6 l-4 -4" fill="#ffa53d" stroke="#ffa53d" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 34 C28 34 24 60 26 76 C28 90 38 94 50 94 C62 94 72 90 74 76 C76 60 72 34 50 34 Z" fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M50 46 C36 46 34 66 36 78 C38 88 44 90 50 90 C56 90 62 88 64 78 C66 66 64 46 50 46 Z" fill={pal.belly} />
      <Eyes pal={pal} y={50} gap={7} r={type === 'pawn' ? 4.5 : 4} seed={seed} />
      <path d="M45 57 L55 57 L50 63 Z" fill="#ffa53d" stroke={pal.ink} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M80 50 C88 62 88 78 80 90" fill="none" stroke="#8a5530" strokeWidth={3} strokeLinecap="round" />
      <path d="M80 50 L80 90" stroke={pal.belly} strokeWidth={1} />
    </g>
  ),
  'iron-will': (pal, _t, seed) => (
    <g>
      <path d="M78 64 h8 M86 58 v12 M86 58 c6 -4 10 2 4 6 M86 70 c6 4 10 -2 4 -6" fill="none" stroke={GOLD} strokeWidth={3.5} strokeLinecap="round" />
      <rect x={24} y={40} width={52} height={52} rx={14} fill={pal.body} stroke={pal.ink} {...S} />
      {[[30, 46], [70, 46], [30, 86], [70, 86]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={2} fill={pal.shade} />)}
      <circle cx={50} cy={76} r={9} fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} strokeDasharray="4 2" />
      <circle cx={50} cy={76} r={3} fill={pal.ink} />
      <circle cx={40} cy={56} r={6} fill="#fff" stroke={pal.ink} strokeWidth={2.5} /><circle cx={60} cy={56} r={6} fill="#fff" stroke={pal.ink} strokeWidth={2.5} />
      <circle cx={40 + jitter(seed, 2) * 3} cy={56} r={2.5} fill={pal.ink} /><circle cx={60 + jitter(seed, 3) * 3} cy={56} r={2.5} fill={pal.ink} />
      <path d="M44 66 h12" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  ),
  'kings-quest': (pal, type, seed) => (
    <g>
      <path d="M70 84 C86 88 92 76 86 68 L94 66 L86 62" fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M30 56 L12 46 L18 60 L10 64 L26 66 Z M70 56 L88 46 L82 60 L90 64 L74 66 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <ellipse cx={50} cy={70} rx={22} ry={24} fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M40 66 h20 M38 74 h24 M40 82 h20" stroke={pal.belly} strokeWidth={5} strokeLinecap="round" />
      <path d="M38 42 L34 32 L44 38 M62 42 L66 32 L56 38" fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <ellipse cx={50} cy={50} rx={17} ry={14} fill={pal.body} stroke={pal.ink} {...S} />
      <Eyes pal={pal} y={47} gap={7} r={type === 'pawn' ? 4.5 : 4} seed={seed} />
      <circle cx={46} cy={56} r={1.5} fill={pal.ink} /><circle cx={54} cy={56} r={1.5} fill={pal.ink} />
      {feet(pal)}
    </g>
  ),
  'the-rebellion': (pal, type, seed) => (
    <g>
      <path d="M70 86 C86 84 90 70 84 60" fill="none" stroke={pal.body} strokeWidth={9} strokeLinecap="round" />
      <path d="M78 82 l4 -4 M82 74 l5 -2 M84 66 l5 0" stroke={pal.ink} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={50} cy={72} rx={22} ry={22} fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M32 40 L30 28 L42 36 M68 40 L70 28 L58 36" fill={pal.body} stroke={pal.ink} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={50} cy={50} rx={19} ry={15} fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M31 48 C38 42 46 44 50 48 C54 44 62 42 69 48 C64 56 56 54 50 52 C44 54 36 56 31 48 Z" fill={pal.ink} />
      <Eyes pal={pal} y={48} gap={9} r={type === 'pawn' ? 4 : 3.5} seed={seed} />
      <ellipse cx={50} cy={58} rx={3} ry={2.2} fill={pal.ink} />
      <path d="M32 64 L68 64 L64 70 L50 74 L36 70 Z" fill="#e8364b" stroke={pal.ink} strokeWidth={2} strokeLinejoin="round" />
      <ellipse cx={50} cy={80} rx={11} ry={10} fill={pal.belly} opacity={0.7} />
    </g>
  ),
  'chess-chaos-crown': (pal, _t, seed) => (
    <g>
      <path d="M50 94 L28 74 L32 50 L50 40 L68 50 L72 74 Z" fill={pal.body} stroke={pal.ink} {...S} />
      <path d="M50 40 L50 94 M32 50 L50 62 L68 50 M28 74 L50 62 L72 74" fill="none" stroke={pal.shade} strokeWidth={2} />
      <path d="M36 54 L44 50 L40 60 Z" fill={pal.belly} opacity={0.9} />
      <circle cx={42} cy={66} r={3.5} fill={pal.ink} /><circle cx={58 + jitter(seed, 2)} cy={66} r={3.5} fill={pal.ink} />
      <circle cx={43} cy={65} r={1.2} fill="#fff" /><circle cx={59} cy={65} r={1.2} fill="#fff" />
      <path d="M45 76 Q50 80 55 76" fill="none" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M18 50 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 Z M80 78 l1.5 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 Z" fill="#fff8c2" />
      <path d="M36 44 h28" stroke="#e8364b" strokeWidth={3} strokeLinecap="round" />
      <circle cx={50} cy={44} r={3} fill="#5ab4ff" stroke={pal.ink} strokeWidth={1} />
    </g>
  ),
};

/** The storybook redraws (ui/richSkins.tsx) replace the first versions. */
export const SET_PALETTES: Record<string, { p1: Palette; p2: Palette }> = { ...BASE_PALETTES, ...RICH_PALETTES };
export const SET_BODIES: Record<string, Body> = { ...BASE_BODIES, ...RICH_BODIES };
