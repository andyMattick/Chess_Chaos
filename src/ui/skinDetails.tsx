import type { ReactElement } from 'react';
import type { Palette } from '../content/cosmetics';

/**
 * Storybook finish for the skins that were first drawn flat (owner,
 * 2026-11-18: "go full treatment on all you can"):
 *
 * - shadedPalette(): the body colour becomes a soft round gradient (light
 *   top-left, darker rim), so every drawn skin and colour version gets depth.
 * - UNDER / OVER: extra details per skin, drawn behind and on top of the body
 *   (fur, scales, rivets, sparkles, collars…). Same 100x100 box, feet on y = 94.
 */
type Detail = (pal: Palette, type: string, seed: number) => ReactElement;

export function mix(a: string, b: string, t: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(p(a, i) * (1 - t) + p(b, i) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Gradient definitions for a palette, and the palette that uses them. */
export function shadedPalette(pal: Palette): { defs: ReactElement; pal: Palette } {
  const id = `sh-${pal.body.slice(1)}-${pal.shade.slice(1)}`;
  const defs = (
    <defs>
      <radialGradient id={id} cx="36%" cy="30%" r="78%">
        <stop offset="0%" stopColor={mix(pal.body, '#ffffff', 0.38)} />
        <stop offset="52%" stopColor={pal.body} />
        <stop offset="100%" stopColor={mix(pal.body, '#000000', 0.28)} />
      </radialGradient>
    </defs>
  );
  return { defs, pal: { ...pal, body: `url(#${id})` } };
}

const GOLD = '#f2c230';
const GOLD_D = '#a8780e';
const sparkle = (x: number, y: number, s: number, c: string) => (
  <path key={`${x}-${y}`} d={`M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`} fill={c} />
);
const gloss = (d: string, o = 0.55) => <path d={d} fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" opacity={o} />;

/** Drawn behind the body. */
export const UNDER: Record<string, Detail> = {
  ghost: () => <ellipse cx={50} cy={62} rx={34} ry={34} fill="#dff4ff" opacity={0.35} />,
  unicorn: () => <g>{sparkle(14, 40, 4, '#ffe14a')}{sparkle(86, 30, 3.5, '#ff8fd0')}{sparkle(88, 78, 3, '#8fd9ff')}</g>,
  'storm-troop': () => <ellipse cx={50} cy={66} rx={40} ry={26} fill="#ffe14a" opacity={0.15} />,
  'chess-chaos-crown': () => <circle cx={50} cy={66} r={34} fill="#fff6c2" opacity={0.35} />,
};

/** Drawn on top of the body, before the hat. */
export const OVER: Record<string, Detail> = {
  // ---- The original skins ----
  gremlin: (pal) => <g>{gloss('M32 50 C34 44 40 40 46 40')}<path d="M30 92 l-3 3 M34 93 l-1 3 M66 93 l1 3 M70 92 l3 3" stroke={pal.ink} strokeWidth={1.8} strokeLinecap="round" /><circle cx={58} cy={80} r={1.6} fill={pal.shade} /><circle cx={40} cy={86} r={1.2} fill={pal.shade} /></g>,
  robot: (pal) => (
    <g>
      {[[26, 40], [74, 40], [26, 84], [74, 84]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.6} fill={pal.ink} opacity={0.6} />)}
      <path d="M32 46 L40 46" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
      <circle cx={70} cy={82} r={5} fill={pal.belly} opacity={0.35} />
      {gloss('M26 44 V56', 0.4)}
    </g>
  ),
  ghost: () => <g>{gloss('M32 48 C34 40 40 36 46 35', 0.8)}{sparkle(80, 44, 3, '#fff')}{sparkle(20, 78, 2.5, '#fff')}</g>,
  critter: (pal) => (
    <g>
      <path d="M30 42 L32 36 M28 40 l3 -2" stroke={pal.ink} strokeWidth={1.2} opacity={0.5} />
      <path d="M42 40 l2 -6 l2 5 l3 -6 l2 6 l2 -5 l2 6" fill="none" stroke={pal.ink} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M26 66 l-2 2 M27 72 l-2 1 M74 66 l2 2 M73 72 l2 1" stroke={pal.ink} strokeWidth={1.2} opacity={0.5} />
      <ellipse cx={36} cy={66} rx={4} ry={2.3} fill="#ff8fb0" opacity={0.6} /><ellipse cx={64} cy={66} rx={4} ry={2.3} fill="#ff8fb0" opacity={0.6} />
    </g>
  ),
  veggie: (pal, type) => (
    <g>
      {type !== 'pawn' && <path d="M50 32 C47 26 42 25 40 26 C43 28 46 30 50 32" fill="#5bbf3a" stroke={pal.ink} strokeWidth={1.8} />}
      {gloss('M62 40 C68 44 72 50 72 56', 0.6)}
      <circle cx={30} cy={70} r={1.3} fill={pal.shade} /><circle cx={68} cy={76} r={1.3} fill={pal.shade} /><circle cx={62} cy={84} r={1.1} fill={pal.shade} />
    </g>
  ),
  dog: (pal) => (
    <g>
      <path d="M32 84 Q50 92 68 84" fill="none" stroke="#d0383a" strokeWidth={4} strokeLinecap="round" />
      <circle cx={50} cy={89} r={3.5} fill={GOLD} stroke={GOLD_D} strokeWidth={1.2} />
      <circle cx={36} cy={50} r={3} fill={pal.shade} opacity={0.5} />
      {gloss('M38 44 C42 41 48 40 52 40', 0.5)}
    </g>
  ),
  fish: (pal) => (
    <g>
      {[[42, 58], [50, 64], [42, 70], [50, 52], [34, 66]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y} q3 -3 6 0`} fill="none" stroke={pal.shade} strokeWidth={1.4} />)}
      <path d="M76 60 L88 54 M76 66 L88 66 M76 72 L88 78" stroke={pal.ink} strokeWidth={1} opacity={0.5} />
      {gloss('M26 50 C30 46 36 44 42 44', 0.6)}
    </g>
  ),
  slime: (pal) => (
    <g>
      <circle cx={36} cy={80} r={3} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.7} />
      <circle cx={64} cy={70} r={2} fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.7} />
      <circle cx={56} cy={84} r={2.5} fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.6} />
      <path d="M28 92 q1 6 -1 8" stroke={pal.shade} strokeWidth={3.5} strokeLinecap="round" />
    </g>
  ),
  muncher: () => (
    <g>
      <path d="M36 70 C40 64 60 64 64 70 C58 78 42 78 36 70 Z" fill="#ff6a8a" opacity={0.85} />
      {gloss('M24 44 C30 40 40 40 46 40', 0.45)}
    </g>
  ),
  wolf: (pal) => (
    <g>
      <path d="M22 62 l-4 4 l5 1 l-4 4 l6 0 M78 62 l4 4 l-5 1 l4 4 l-6 0" fill="none" stroke={pal.ink} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M30 44 L28 32 L36 40 M70 44 L72 32 L64 40" fill="#ff9ab0" opacity={0.5} />
      {gloss('M34 42 C40 38 46 37 50 37', 0.4)}
    </g>
  ),
  dino: (pal) => (
    <g>
      {[[34, 50], [66, 56], [30, 64], [70, 70]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={2.4} fill={pal.shade} opacity={0.7} />)}
      <path d="M30 92 l-2 3 M34 93 l0 3 M66 93 l0 3 M70 92 l2 3" stroke={pal.ink} strokeWidth={1.8} strokeLinecap="round" />
      {gloss('M38 44 C44 40 52 40 58 42', 0.5)}
    </g>
  ),
  alien: (pal) => (
    <g>
      <circle cx={16} cy={18} r={8} fill={pal.shade} opacity={0.25} /><circle cx={84} cy={18} r={8} fill={pal.shade} opacity={0.25} />
      <path d="M40 86 H60" stroke={GOLD} strokeWidth={2.5} />
      {gloss('M28 50 C32 42 40 38 48 37', 0.5)}
    </g>
  ),
  unicorn: () => <g>{gloss('M34 50 C38 44 44 41 50 41', 0.6)}{sparkle(28, 82, 2.5, '#ff8fd0')}{sparkle(64, 86, 2, '#ffe14a')}</g>,

  // ---- Collection skins still in their first style ----
  'long-range-battery': (pal) => (
    <g>
      <path d="M40 40 C44 37 50 37 54 38" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
      <path d="M36 66 H64" stroke={pal.shade} strokeWidth={1.5} />
      <rect x={46} y={74} width={3} height={4} fill="#ff5a5a" /><rect x={51} y={74} width={3} height={4} fill="#5bd17a" />
      <path d="M68 62 v14" stroke={pal.ink} strokeWidth={1} opacity={0.5} />
      <circle cx={84} cy={30} r={1.5} fill="#fff" /><circle cx={14} cy={52} r={1.2} fill="#fff" />
      {sparkle(86, 46, 2.5, '#ffe14a')}
    </g>
  ),
  'castle-defenders': (pal) => (
    <g>
      <path d="M30 80 a4 4 0 1 1 8 0 a4 4 0 1 1 -8 0" fill={GOLD} stroke={GOLD_D} strokeWidth={1} />
      <path d="M40 62 l-6 -1 M60 62 l6 -1" stroke={pal.ink} strokeWidth={1} opacity={0.6} />
      <ellipse cx={42} cy={70} rx={3.5} ry={2} fill="#ff8fb0" opacity={0.6} /><ellipse cx={58} cy={70} rx={3.5} ry={2} fill="#ff8fb0" opacity={0.6} />
      {gloss('M40 52 C44 49 50 48 54 49', 0.5)}
    </g>
  ),
  'storm-troop': () => <g>{gloss('M20 70 C20 64 24 60 28 60', 0.7)}{gloss('M46 46 C50 42 56 41 60 42', 0.7)}<path d="M66 88 l-2 5 M24 88 l-2 5" stroke="#5ab4ff" strokeWidth={2.5} strokeLinecap="round" /></g>,
  'army-without-a-crown': (pal) => (
    <g>
      <path d="M34 56 C36 52 40 50 44 50" stroke={pal.ink} strokeWidth={1} opacity={0.4} />
      <circle cx={66} cy={50} r={2.6} fill={GOLD} stroke={GOLD_D} strokeWidth={0.8} />
      <path d="M40 92 H60" stroke="#6b3a1f" strokeWidth={4} /><rect x={47} y={89.5} width={6} height={5} fill={GOLD} stroke={GOLD_D} strokeWidth={0.8} />
    </g>
  ),
  'nobles-ball': (pal) => (
    <g>
      {[[34, 84], [44, 90], [58, 88], [66, 82], [50, 80]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.4} fill="#fff" opacity={0.8} />)}
      <path d="M40 66 Q50 70 60 66" fill="none" stroke={GOLD} strokeWidth={2} />
      <circle cx={50} cy={69} r={2.4} fill="#5ab4ff" stroke={GOLD_D} strokeWidth={0.8} />
      <path d="M66 42 l6 -6 l1 4 l4 1 Z" fill={pal.belly} stroke={pal.ink} strokeWidth={1} />
    </g>
  ),
  'open-field': (pal) => (
    <g>
      <path d="M36 60 l-2 -4 M40 58 l-1 -5 M60 58 l1 -5 M64 60 l2 -4" stroke={GOLD} strokeWidth={2} strokeLinecap="round" />
      <path d="M58 64 h6 M58 66 h6" stroke={pal.ink} strokeWidth={0.8} opacity={0.5} />
      <circle cx={70} cy={58} r={2.5} fill="#2a2a2a" /><path d="M70 56 l2 -3" stroke="#2a2a2a" strokeWidth={1} />
      {gloss('M40 40 C44 37 50 36 54 37', 0.4)}
    </g>
  ),
  'straight-shooters': (pal) => (
    <g>
      <path d="M36 64 C34 72 34 80 38 86 M64 64 C66 72 66 80 62 86" fill="none" stroke={pal.ink} strokeWidth={1} opacity={0.3} />
      <path d="M78 46 L84 42 L83 47 Z" fill="#d0383a" />
      <ellipse cx={44} cy={58} rx={3} ry={1.6} fill="#ff8fb0" opacity={0.6} /><ellipse cx={56} cy={58} rx={3} ry={1.6} fill="#ff8fb0" opacity={0.6} />
      {gloss('M36 42 C40 38 46 36 52 36', 0.5)}
    </g>
  ),
  'iron-will': (pal) => (
    <g>
      <path d="M30 44 C34 42 40 41 46 41" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      <path d="M24 64 H76" stroke={pal.shade} strokeWidth={1.5} />
      {[34, 42, 58, 66].map((x) => <circle key={x} cx={x} cy={64} r={1.2} fill={pal.ink} opacity={0.6} />)}
    </g>
  ),
  'the-rebellion': (pal) => (
    <g>
      <path d="M36 70 l3 -3 M64 70 l-3 -3" stroke={pal.ink} strokeWidth={1} opacity={0.4} />
      <circle cx={66} cy={66} r={1.5} fill="#fff" opacity={0.7} /><circle cx={40} cy={68} r={1.2} fill="#fff" opacity={0.7} />
      {gloss('M36 42 C40 38 46 37 52 37', 0.4)}
    </g>
  ),
  'chess-chaos-crown': () => <g>{sparkle(72, 46, 3, '#fff')}{sparkle(30, 84, 2.5, '#fff')}{gloss('M36 54 L44 50', 0.8)}</g>,
};
