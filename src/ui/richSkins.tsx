import type { ReactElement } from 'react';
import type { Palette } from '../content/cosmetics';
import { jitter } from './skins';

/**
 * Storybook versions of twelve collection skins (owner, 2026-11-18: "use them
 * for inspiration and redraw"): soft shading, texture and trim, still drawn in
 * code so they stay sharp, still wearing the piece hats. Same 100x100 box,
 * standing on y = 94, as every other skin.
 */
type Body = (pal: Palette, type: string, seed: number) => ReactElement;
const S = { strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const GOLD = '#f2c230';
const GOLD_D = '#a8780e';

/** Mix two #rrggbb colours (t = 0 gives a, 1 gives b). */
function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map((i) => Math.round(p(a, i) * (1 - t) + p(b, i) * t).toString(16).padStart(2, '0'));
  return `#${c.join('')}`;
}

/** A soft round shading for a colour: light top-left, the colour, darker rim. */
function Shade({ id, c }: { id: string; c: string }) {
  return (
    <radialGradient id={id} cx="38%" cy="32%" r="75%">
      <stop offset="0%" stopColor={mix(c, '#ffffff', 0.35)} />
      <stop offset="55%" stopColor={c} />
      <stop offset="100%" stopColor={mix(c, '#000000', 0.3)} />
    </radialGradient>
  );
}
const gid = (name: string, c: string) => `rs-${name}-${c.slice(1)}`;

/** Round eyes with a shine: the storybook look. */
function Eyes2({ y, gap = 8, r = 4.5, iris, ink, seed, lid }: { y: number; gap?: number; r?: number; iris: string; ink: string; seed: number; lid?: string }) {
  const dx = jitter(seed, 2) * 1.5;
  return (
    <g>
      {[-1, 1].map((d) => (
        <g key={d}>
          <circle cx={50 + d * gap} cy={y} r={r} fill="#fff" stroke={ink} strokeWidth={1.8} />
          <circle cx={50 + d * gap + dx} cy={y + 0.5} r={r * 0.62} fill={iris} />
          <circle cx={50 + d * gap + dx} cy={y + 0.5} r={r * 0.32} fill={ink} />
          <circle cx={50 + d * gap + dx - r * 0.25} cy={y - r * 0.25} r={r * 0.18} fill="#fff" />
          {lid && <path d={`M${50 + d * gap - r} ${y - r * 0.2} Q${50 + d * gap} ${y - r * 1.2} ${50 + d * gap + r} ${y - r * 0.2}`} fill={lid} stroke={ink} strokeWidth={1.2} />}
        </g>
      ))}
    </g>
  );
}

const blush = (y: number, gap = 15) => (
  <g opacity={0.55}><ellipse cx={50 - gap} cy={y} rx={3.5} ry={2} fill="#ff7a9a" /><ellipse cx={50 + gap} cy={y} rx={3.5} ry={2} fill="#ff7a9a" /></g>
);

export const RICH_BODIES: Record<string, Body> = {
  /* Courtiers: velvet gown, ermine cape with black spots, gold buttons. */
  'royal-court': (pal, _t, seed) => {
    const g = gid('rc', pal.body);
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        <path d="M24 94 C24 74 30 58 50 56 C70 58 76 74 76 94 Z" fill="#f7f3ea" stroke={pal.ink} {...S} />
        {[[30, 80], [40, 88], [62, 86], [70, 76], [34, 68], [66, 66]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y} l1 -3 l1 3 Z`} fill="#22202a" />)}
        <path d="M36 94 C36 76 40 64 50 62 C60 64 64 76 64 94 Z" fill={`url(#${g})`} stroke={pal.ink} {...S} />
        <path d="M50 64 V94" stroke={mix(pal.body, '#000', 0.3)} strokeWidth={1.5} />
        {[70, 78, 86].map((y) => <circle key={y} cx={50} cy={y} r={2.2} fill={GOLD} stroke={GOLD_D} strokeWidth={0.8} />)}
        <path d="M34 60 Q50 70 66 60 L64 56 Q50 64 36 56 Z" fill="#fff" stroke={pal.ink} strokeWidth={1.5} />
        <circle cx={50} cy={44} r={14} fill="#ffdcc0" stroke={pal.ink} {...S} />
        <path d="M36 42 C36 30 64 30 64 42 C60 36 54 34 50 38 C46 34 40 36 36 42 Z" fill="#8a4a2a" stroke={pal.ink} strokeWidth={1.5} />
        <Eyes2 y={45} gap={6} r={3.6} iris="#5a7ad0" ink={pal.ink} seed={seed} />
        {blush(51, 9)}
        <path d="M46 52 Q50 55 54 52" fill="none" stroke="#c23a4a" strokeWidth={2} strokeLinecap="round" />
      </g>
    );
  },

  /* Owls: feathered chest, layered face discs, a cloak with gold trim. */
  'high-council': (pal, type, seed) => {
    const g = gid('hc', pal.body);
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        <path d="M24 94 C16 72 20 40 50 34 C80 40 84 72 76 94 Z" fill={`url(#${g})`} stroke={pal.ink} {...S} />
        <path d="M24 94 C22 80 26 70 32 64 L36 94 Z M76 94 C78 80 74 70 68 64 L64 94 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2} />
        <path d="M32 64 L36 94 M68 64 L64 94" stroke={GOLD} strokeWidth={2} />
        <path d="M38 94 C36 80 42 68 50 68 C58 68 64 80 62 94 Z" fill={pal.belly} />
        {[72, 79, 86].map((y, r) => [0, 1, 2].map((k) => <path key={`${y}${k}`} d={`M${40 + k * 7 + (r % 2) * 3} ${y} q3 4 6 0`} fill="none" stroke={pal.shade} strokeWidth={1.5} strokeLinecap="round" />))}
        <path d="M30 40 L24 26 L38 36 Z M70 40 L76 26 L62 36 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2} strokeLinejoin="round" />
        {[-1, 1].map((d) => <g key={d}><circle cx={50 + d * 10} cy={52} r={10.5} fill={pal.belly} stroke={pal.ink} strokeWidth={1.8} /><circle cx={50 + d * 10} cy={52} r={8} fill="none" stroke={pal.shade} strokeWidth={1.2} strokeDasharray="2 2" /></g>)}
        <Eyes2 y={52} gap={10} r={type === 'pawn' ? 5.5 : 5} iris={pal.eye === '#fff' ? '#f2a830' : pal.eye} ink={pal.ink} seed={seed} />
        <path d="M46.5 60 L50 68 L53.5 60 Z" fill="#f2a830" stroke={pal.ink} strokeWidth={1.5} strokeLinejoin="round" />
      </g>
    );
  },

  /* Soldiers in armour: helmet, chain mail, a tabard with a cross. */
  'war-council': (pal, _t, seed) => {
    const steel = gid('wc', '#b8c0cc');
    return (
      <g>
        <defs><Shade id={steel} c="#b8c0cc" /></defs>
        <rect x={36} y={84} width={10} height={10} rx={2} fill="#7a828e" stroke={pal.ink} strokeWidth={2} /><rect x={54} y={84} width={10} height={10} rx={2} fill="#7a828e" stroke={pal.ink} strokeWidth={2} />
        <path d="M28 88 C26 70 34 58 50 58 C66 58 74 70 72 88 Z" fill={`url(#${steel})`} stroke={pal.ink} {...S} />
        {[64, 70, 76, 82].map((y) => <path key={y} d={`M30 ${y} ${Array.from({ length: 7 }, () => 'q3 3 6 0').join(' ')}`} fill="none" stroke="#7a828e" strokeWidth={1} transform={`translate(${y % 12 ? 0 : 3} 0)`} />)}
        <path d="M38 60 L62 60 L60 90 L40 90 Z" fill={pal.body} stroke={pal.ink} strokeWidth={2} />
        <path d="M50 64 V86 M42 72 H58" stroke={pal.belly} strokeWidth={4} />
        <path d="M34 50 C34 32 66 32 66 50 L66 56 L34 56 Z" fill={`url(#${steel})`} stroke={pal.ink} {...S} />
        <path d="M38 44 H62 V52 H38 Z" fill="#ffdcc0" stroke={pal.ink} strokeWidth={1.8} />
        <Eyes2 y={48} gap={6} r={2.8} iris="#4a6ac0" ink={pal.ink} seed={seed} />
        <path d="M50 34 V44" stroke="#7a828e" strokeWidth={2.5} />
        <circle cx={80} cy={72} r={11} fill={pal.body} stroke={pal.ink} strokeWidth={2.5} />
        <circle cx={80} cy={72} r={6} fill="none" stroke={GOLD} strokeWidth={2} />
      </g>
    );
  },

  /* Beavers: fur texture, a robe with gold trim, a striped tail. */
  'kingdom-builders': (pal, type, seed) => {
    const g = gid('kb', pal.body);
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        <ellipse cx={76} cy={84} rx={9} ry={13} transform="rotate(35 76 84)" fill={mix(pal.shade, '#000', 0.2)} stroke={pal.ink} strokeWidth={2.5} />
        <path d="M70 78 l10 10 M74 74 l8 8 M68 84 l8 8" stroke="#000" strokeWidth={1.2} opacity={0.35} />
        <ellipse cx={48} cy={64} rx={24} ry={28} fill={`url(#${g})`} stroke={pal.ink} {...S} />
        {[[36, 48], [58, 46], [32, 60], [64, 58]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y} l2 3 M${x + 3} ${y - 1} l2 3`} stroke={pal.shade} strokeWidth={1.2} strokeLinecap="round" />)}
        <path d="M28 94 C28 80 36 72 48 72 C60 72 68 80 68 94 Z" fill="#7a3fa0" stroke={pal.ink} strokeWidth={2.5} />
        <path d="M48 72 V94" stroke={GOLD} strokeWidth={2.5} /><path d="M30 92 C36 86 60 86 66 92" fill="none" stroke={GOLD} strokeWidth={2} />
        <circle cx={30} cy={42} r={5} fill={pal.shade} stroke={pal.ink} strokeWidth={2} /><circle cx={66} cy={42} r={5} fill={pal.shade} stroke={pal.ink} strokeWidth={2} />
        <ellipse cx={48} cy={60} rx={11} ry={8} fill={pal.belly} />
        <Eyes2 y={50} gap={8} r={type === 'pawn' ? 4.2 : 3.8} iris="#6b3a1f" ink={pal.ink} seed={seed} />
        <ellipse cx={48} cy={57} rx={3.5} ry={2.5} fill={pal.ink} />
        <path d="M44 62 h8 v5 h-8 Z M48 62 v5" fill="#fff" stroke={pal.ink} strokeWidth={1.3} />
      </g>
    );
  },

  /* Heroes: a long cape with gold trim, a shining star, a mask. */
  'back-row-heroes': (pal, _t, seed) => {
    const g = gid('bh', pal.body);
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        <path d="M30 52 L16 94 L84 94 L70 52 Z" fill={pal.belly} stroke={pal.ink} {...S} />
        <path d="M18 92 L30 54 M82 92 L70 54" stroke={GOLD} strokeWidth={2.5} />
        <path d="M34 94 C32 72 38 60 50 60 C62 60 68 72 66 94 Z" fill={`url(#${g})`} stroke={pal.ink} {...S} />
        <path d="M36 80 H64" stroke={GOLD} strokeWidth={3} />
        <path d="M50 64 l3.5 7 l7.5 1 l-5.5 5 l1.5 7.5 l-7 -4 l-7 4 l1.5 -7.5 l-5.5 -5 l7.5 -1 Z" fill={GOLD} stroke={GOLD_D} strokeWidth={1.3} strokeLinejoin="round" />
        <circle cx={50} cy={45} r={14} fill="#ffdcc0" stroke={pal.ink} {...S} />
        <path d="M36 40 C38 30 62 30 64 40 C58 34 44 34 36 40 Z" fill="#5a3a20" />
        <path d="M35 42 C42 38 58 38 65 42 L63 50 C56 46 44 46 37 50 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={1.8} strokeLinejoin="round" />
        <Eyes2 y={45} gap={6.5} r={3} iris="#3a7ad0" ink={pal.ink} seed={seed} />
        <path d="M45 53 Q50 57 55 53" fill="none" stroke={pal.ink} strokeWidth={2} strokeLinecap="round" />
      </g>
    );
  },

  /* Plant people: terracotta pot with a rim, leaves with veins, a bud face. */
  'pawns-promise': (pal, type, seed) => {
    const pot = gid('pp', pal.belly);
    const leaf = gid('pl', pal.body);
    const tall = type === 'pawn' ? 0 : type === 'king' || type === 'queen' ? 6 : 3;
    return (
      <g>
        <defs><Shade id={pot} c={pal.belly} /><Shade id={leaf} c={pal.body} /></defs>
        <path d="M33 80 L37 94 L63 94 L67 80 Z" fill={`url(#${pot})`} stroke={pal.ink} {...S} />
        <rect x={30} y={74} width={40} height={7} rx={2.5} fill={pal.belly} stroke={pal.ink} strokeWidth={2.5} />
        <path d="M38 86 h24" stroke={mix(pal.belly, '#000', 0.25)} strokeWidth={1.5} />
        <ellipse cx={50} cy={75} rx={17} ry={2.5} fill="#5a3a20" />
        <path d={`M50 74 V${62 - tall}`} stroke={pal.shade} strokeWidth={5} strokeLinecap="round" />
        {[-1, 1].map((d) => (
          <g key={d}>
            <path d={`M50 ${68 - tall} C${50 + d * 10} ${58 - tall} ${50 + d * 22} ${60 - tall} ${50 + d * 26} ${56 - tall} C${50 + d * 22} ${70 - tall} ${50 + d * 10} ${72 - tall} 50 ${68 - tall} Z`} fill={`url(#${leaf})`} stroke={pal.ink} strokeWidth={2} strokeLinejoin="round" />
            <path d={`M50 ${68 - tall} Q${50 + d * 14} ${62 - tall} ${50 + d * 24} ${58 - tall}`} fill="none" stroke={pal.shade} strokeWidth={1.2} />
          </g>
        ))}
        <circle cx={50} cy={47 - tall} r={15} fill={`url(#${leaf})`} stroke={pal.ink} {...S} />
        <Eyes2 y={46 - tall} gap={6} r={3.6} iris="#3a2a10" ink={pal.ink} seed={seed} />
        {blush(51 - tall, 10)}
        <path d={`M45 ${52 - tall} Q50 ${56 - tall} 55 ${52 - tall}`} fill="none" stroke={pal.ink} strokeWidth={2} strokeLinecap="round" />
      </g>
    );
  },

  /* Storybook paper: a glowing cut-out with a page edge and ink sparkles. */
  'knights-tale': (pal, _t, seed) => {
    const g = gid('kt', pal.body);
    const shape = 'M28 92 C26 70 28 50 34 42 C40 34 60 34 66 42 C72 50 74 70 72 92 L66 87 L60 93 L54 87 L48 93 L42 87 L36 93 Z';
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        <path d={shape} fill="#ffffff" opacity={0.5} transform="translate(2.5 2.5)" />
        <path d={shape} fill={`url(#${g})`} stroke={pal.ink} strokeWidth={2.2} strokeLinejoin="round" />
        {[56, 64, 72, 80].map((y) => <path key={y} d={`M34 ${y} H66`} stroke={pal.shade} strokeWidth={0.8} opacity={0.7} />)}
        <path d="M36 70 h28" stroke={pal.belly} strokeWidth={5} strokeLinecap="round" />
        <circle cx={43} cy={54} r={3} fill={pal.ink} /><circle cx={57 + jitter(seed, 2)} cy={54} r={3} fill={pal.ink} />
        <circle cx={42} cy={53} r={0.9} fill="#fff" /><circle cx={56} cy={53} r={0.9} fill="#fff" />
        <path d="M45 61 Q50 64 55 61" fill="none" stroke={pal.ink} strokeWidth={2} strokeLinecap="round" />
        {blush(60, 12)}
        <path d="M22 50 l1.5 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 Z M76 62 l1 -3 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 Z" fill={pal.belly} />
      </g>
    );
  },

  /* Mice: soft fur, round pink ears, a little leather vest. */
  'small-but-mighty': (pal, type, seed) => {
    const g = gid('sm', pal.body);
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        <path d="M70 88 C86 92 92 76 82 70" fill="none" stroke={pal.belly} strokeWidth={3} strokeLinecap="round" />
        {[-1, 1].map((d) => <g key={d}><circle cx={50 + d * 18} cy={42} r={11} fill={`url(#${g})`} stroke={pal.ink} strokeWidth={2.5} /><circle cx={50 + d * 18} cy={43} r={6.5} fill={pal.belly} /></g>)}
        <ellipse cx={50} cy={68} rx={24} ry={26} fill={`url(#${g})`} stroke={pal.ink} {...S} />
        <path d="M32 76 C32 70 40 66 50 66 C60 66 68 70 68 76 L66 92 L34 92 Z" fill="#8a5a30" stroke={pal.ink} strokeWidth={2} />
        <path d="M50 66 V92" stroke="#5a3a1a" strokeWidth={1.5} /><circle cx={46} cy={74} r={1.5} fill={GOLD} /><circle cx={46} cy={82} r={1.5} fill={GOLD} />
        <path d="M36 50 l2 2 M62 50 l-2 2 M40 44 l1 2 M60 44 l-1 2" stroke={pal.shade} strokeWidth={1.2} strokeLinecap="round" />
        <Eyes2 y={55} gap={8} r={type === 'pawn' ? 4.5 : 4} iris="#3a2a20" ink={pal.ink} seed={seed} />
        <circle cx={50} cy={63} r={2.8} fill="#ff7aa0" stroke={pal.ink} strokeWidth={1.2} />
        <path d="M45 63 l-13 -2 M45 65 l-13 3 M55 63 l13 -2 M55 65 l13 3" stroke={pal.ink} strokeWidth={1.1} strokeLinecap="round" />
      </g>
    );
  },

  /* Frogs: spotted skin, round goggles, a belt with a buckle. */
  'tactics-squad': (pal, type, seed) => {
    const g = gid('ts', pal.body);
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        <path d="M24 94 l-6 -2 l4 -4 M76 94 l6 -2 l-4 -4" fill="none" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 92 C16 72 24 52 50 50 C76 52 84 72 78 92 Z" fill={`url(#${g})`} stroke={pal.ink} {...S} />
        {[[30, 70], [70, 74], [36, 84], [64, 86], [58, 62]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={2.2} fill={pal.shade} opacity={0.8} />)}
        <ellipse cx={50} cy={82} rx={15} ry={9} fill={pal.belly} opacity={0.8} />
        <path d="M26 74 H74" stroke="#6b4a2a" strokeWidth={4} /><rect x={46} y={71} width={8} height={6} rx={1.5} fill={GOLD} stroke={GOLD_D} strokeWidth={1} />
        {[-1, 1].map((d) => <circle key={d} cx={50 + d * 13} cy={46} r={10} fill={`url(#${g})`} stroke={pal.ink} strokeWidth={2.5} />)}
        {[-1, 1].map((d) => <circle key={`r${d}`} cx={50 + d * 13} cy={46} r={7.5} fill="#cfe8ff" stroke="#6b4a2a" strokeWidth={2.5} opacity={0.9} />)}
        <path d="M43 46 H57" stroke="#6b4a2a" strokeWidth={2} />
        <Eyes2 y={46} gap={13} r={type === 'pawn' ? 5 : 4.5} iris="#c98a1a" ink={pal.ink} seed={seed} />
        <path d="M36 62 Q50 70 64 62" fill="none" stroke={pal.ink} strokeWidth={2.2} strokeLinecap="round" />
      </g>
    );
  },

  /* Stone golems: blocks with cracks, moss tufts, glowing eyes. */
  'iron-fortress': (pal, _t, seed) => {
    const g = gid('if', pal.body);
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        <rect x={30} y={80} width={14} height={14} rx={3} fill={`url(#${g})`} stroke={pal.ink} strokeWidth={2.5} /><rect x={56} y={80} width={14} height={14} rx={3} fill={`url(#${g})`} stroke={pal.ink} strokeWidth={2.5} />
        <path d="M24 84 L22 52 L32 40 L68 40 L78 52 L76 84 Z" fill={`url(#${g})`} stroke={pal.ink} {...S} />
        <path d="M24 66 H76 M50 66 V84 M38 52 V66 M62 52 V66" stroke={mix(pal.body, '#000', 0.3)} strokeWidth={1.5} />
        <path d="M44 72 L48 76 L45 80 M66 44 L62 50" fill="none" stroke={mix(pal.body, '#000', 0.45)} strokeWidth={1.3} strokeLinecap="round" />
        <path d="M22 52 C28 44 38 46 36 54 C30 57 25 57 22 52 Z M64 40 C70 36 78 42 76 48 C70 48 65 45 64 40 Z M50 84 C56 80 62 82 62 86 C56 87 52 86 50 84 Z" fill={pal.belly} />
        <path d="M26 52 l1 -3 M30 50 l0 -3 M68 40 l1 -3 M72 42 l1 -3" stroke={mix(pal.belly, '#fff', 0.3)} strokeWidth={1} strokeLinecap="round" />
        <rect x={37} y={52} width={9} height={5} rx={1.5} fill={pal.eye} /><rect x={54} y={52 + jitter(seed, 2)} width={9} height={5} rx={1.5} fill={pal.eye} />
        <rect x={37} y={52} width={9} height={5} rx={1.5} fill={pal.eye} opacity={0.4} transform="scale(1.06) translate(-2.5 -3)" />
        <path d="M42 62 h16" stroke={pal.ink} strokeWidth={2.5} strokeLinecap="round" />
      </g>
    );
  },

  /* Bats: fluffy chest, wings with ribs, tiny fangs, a lantern. */
  'old-castle': (pal, type, seed) => {
    const g = gid('oc', pal.body);
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        {[-1, 1].map((d) => (
          <g key={d} transform={d < 0 ? undefined : 'translate(100 0) scale(-1 1)'}>
            <path d="M32 58 C20 46 8 50 4 62 C10 60 12 66 18 64 C20 70 26 68 30 74 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2.2} strokeLinejoin="round" />
            <path d="M30 60 L10 58 M30 64 L16 64 M30 68 L22 69" stroke={pal.ink} strokeWidth={1} opacity={0.6} />
          </g>
        ))}
        <ellipse cx={50} cy={66} rx={20} ry={24} fill={`url(#${g})`} stroke={pal.ink} {...S} />
        <path d="M38 72 q4 3 8 0 q4 3 8 0 q4 3 8 0 M40 80 q4 3 8 0 q4 3 8 0" fill="none" stroke={pal.shade} strokeWidth={1.2} />
        <path d="M37 46 L34 32 L43 43 M63 46 L66 32 L57 43" fill={`url(#${g})`} stroke={pal.ink} strokeWidth={2.2} strokeLinejoin="round" />
        <Eyes2 y={56} gap={8} r={type === 'pawn' ? 5 : 4.5} iris={pal.eye === '#fff' ? '#7a4ad0' : pal.eye} ink={pal.ink} seed={seed} />
        <path d="M44 66 Q50 70 56 66" fill="none" stroke={pal.ink} strokeWidth={2} strokeLinecap="round" />
        <path d="M46 67 l1 3 l1 -3 M52 67 l1 3 l1 -3" fill="#fff" stroke={pal.ink} strokeWidth={0.8} />
        <path d="M36 82 v6" stroke={pal.ink} strokeWidth={1.5} />
        <rect x={31} y={86} width={10} height={8} rx={2} fill={pal.belly} stroke={pal.ink} strokeWidth={1.5} />
        <circle cx={36} cy={90} r={4.5} fill="#ffb02e" opacity={0.45} /><circle cx={36} cy={90} r={2} fill="#ffe14a" />
      </g>
    );
  },

  /* Dragons: scales, belly plates, ribbed wings, little horns. */
  'kings-quest': (pal, type, seed) => {
    const g = gid('kq', pal.body);
    return (
      <g>
        <defs><Shade id={g} c={pal.body} /></defs>
        <path d="M70 84 C86 90 94 76 86 68 L95 65 L85 61" fill={`url(#${g})`} stroke={pal.ink} strokeWidth={2.5} strokeLinejoin="round" />
        {[-1, 1].map((d) => (
          <g key={d} transform={d < 0 ? undefined : 'translate(100 0) scale(-1 1)'}>
            <path d="M32 58 L10 44 L16 58 L8 62 L18 66 L12 72 L28 68 Z" fill={pal.shade} stroke={pal.ink} strokeWidth={2} strokeLinejoin="round" />
            <path d="M30 60 L14 50 M30 64 L12 63 M28 67 L16 70" stroke={pal.ink} strokeWidth={0.9} opacity={0.55} />
          </g>
        ))}
        <ellipse cx={50} cy={70} rx={22} ry={24} fill={`url(#${g})`} stroke={pal.ink} {...S} />
        {[[34, 62], [64, 60], [32, 76], [68, 78], [40, 88], [60, 88]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x - 3} ${y} q3 -3 6 0`} fill="none" stroke={pal.shade} strokeWidth={1.3} />)}
        <path d="M40 62 h20 M38 70 h24 M38 78 h24 M40 86 h20" stroke={pal.belly} strokeWidth={5} strokeLinecap="round" />
        <path d="M40 62 h20 M38 70 h24 M38 78 h24" stroke={mix(pal.belly, '#000', 0.2)} strokeWidth={0.8} transform="translate(0 2.6)" />
        <path d="M38 41 L34 30 L44 37 M62 41 L66 30 L56 37" fill={pal.belly} stroke={pal.ink} strokeWidth={2} strokeLinejoin="round" />
        <ellipse cx={50} cy={49} rx={17} ry={14} fill={`url(#${g})`} stroke={pal.ink} {...S} />
        <Eyes2 y={46} gap={7} r={type === 'pawn' ? 4.5 : 4} iris={pal.eye === '#fff' ? '#e0a020' : pal.eye} ink={pal.ink} seed={seed} />
        <circle cx={46} cy={55} r={1.4} fill={pal.ink} /><circle cx={54} cy={55} r={1.4} fill={pal.ink} />
        <path d="M44 59 Q50 62 56 59" fill="none" stroke={pal.ink} strokeWidth={1.8} strokeLinecap="round" />
        <path d="M38 93 h-6 M62 93 h6" stroke={pal.ink} strokeWidth={4.5} strokeLinecap="round" />
      </g>
    );
  },
};

/** Colours closer to the reference pictures. */
export const RICH_PALETTES: Record<string, { p1: Palette; p2: Palette }> = {
  'royal-court': { p1: { body: '#e8467a', shade: '#a81f4f', belly: '#fff', ink: '#3a1f33', eye: '#fff' }, p2: { body: '#6b2fa0', shade: '#3a1560', belly: '#fff', ink: '#14061c', eye: '#fff' } },
  'high-council': { p1: { body: '#c99a64', shade: '#7a4f2a', belly: '#fff0d6', ink: '#2e1d0b', eye: '#fff' }, p2: { body: '#4a5478', shade: '#262c48', belly: '#c9cfe6', ink: '#0c0c18', eye: '#ffd23f' } },
  'war-council': { p1: { body: '#d0383a', shade: '#8a1f20', belly: '#ffe9b0', ink: '#2a0c08', eye: '#fff' }, p2: { body: '#4a2a8a', shade: '#2a1556', belly: '#ffd23f', ink: '#060d1c', eye: '#fff' } },
  'kingdom-builders': { p1: { body: '#c98a4a', shade: '#8a5428', belly: '#ffe6c2', ink: '#2e1906', eye: '#fff' }, p2: { body: '#5a3a24', shade: '#2e1d10', belly: '#c9a882', ink: '#140a03', eye: '#fff' } },
  'iron-fortress': { p1: { body: '#bdb5a6', shade: '#857c6c', belly: '#6fae4a', ink: '#2a2620', eye: '#6fe0ff' }, p2: { body: '#5a5550', shade: '#33302c', belly: '#3f7a2e', ink: '#0c0b0a', eye: '#ff9a3c' } },
  'kings-quest': { p1: { body: '#7fcf6a', shade: '#3f8a3f', belly: '#f6e6a0', ink: '#0e2a12', eye: '#fff' }, p2: { body: '#2a2a33', shade: '#141418', belly: '#d4a020', ink: '#000', eye: '#ffd23f' } },
};
