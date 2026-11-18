import type { ReactElement } from 'react';

/**
 * Board landscapes. Each one paints the squares, scatters little doodles on
 * them (grass, rocks, stars...), and sets the scene around the board.
 * Doodles are placed by a hash of the square, so they stay put between moves.
 */

import type { LandscapeId } from '../content/cosmetics';
export type { LandscapeId };

export interface Landscape {
  id: LandscapeId;
  name: string;
  emoji: string;
  light: string;
  dark: string;
  /** Highlight colours that read well on this landscape. */
  last: string;
  frame: string;
  /** CSS background for the page while playing. */
  scene: string;
  coord: string;
  doodle: (light: boolean, r: (i: number) => number) => ReactElement | null;
}

function rnd(sq: number, salt: number) {
  return (i: number) => {
    const x = Math.sin((sq + 1) * 91.17 + salt * 13.7 + i * 47.3) * 10000;
    return x - Math.floor(x);
  };
}

const tuft = (x: number, y: number, c: string) => <path d={`M${x} ${y} l-4 -10 M${x} ${y} l0 -13 M${x} ${y} l5 -10`} stroke={c} strokeWidth={3} strokeLinecap="round" />;
const flower = (x: number, y: number, c: string) => (
  <g>
    {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * 4.5} cy={y + Math.sin((a * Math.PI) / 180) * 4.5} r={3.5} fill={c} />)}
    <circle cx={x} cy={y} r={2.5} fill="#ffd23f" />
  </g>
);

export const LANDSCAPES: Landscape[] = [
  {
    id: 'meadow', name: 'Meadow', emoji: '🌼', light: '#efe6c4', dark: '#7cb15a', last: '#ffe066', frame: '#5b3a1e', coord: 'rgba(60,40,10,0.55)',
    scene: 'radial-gradient(circle at 15% 10%, #fff7c2 0, transparent 35%), linear-gradient(#bfe6ff, #dff3c8 60%, #a8d67c)',
    doodle: (light, r) => {
      const v = r(0);
      if (light) return v < 0.25 ? <circle cx={20 + r(1) * 60} cy={20 + r(2) * 60} r={2 + r(3) * 3} fill="#d8c99a" /> : null;
      if (v < 0.45) return <g>{tuft(18 + r(1) * 60, 40 + r(2) * 50, '#5d9440')}{tuft(30 + r(3) * 50, 30 + r(4) * 50, '#5d9440')}</g>;
      if (v < 0.6) return flower(18 + r(1) * 64, 18 + r(2) * 64, ['#ff6fb5', '#ffffff', '#a77bff'][Math.floor(r(5) * 3)]);
      return null;
    },
  },
  {
    id: 'volcano', name: 'Volcano', emoji: '🌋', light: '#8a7a70', dark: '#3a2a2a', last: '#ff8a3d', frame: '#1a0f0f', coord: 'rgba(255,200,160,0.6)',
    scene: 'radial-gradient(circle at 80% 100%, #ff6a00 0, transparent 40%), radial-gradient(circle at 10% 90%, #ff3d00 0, transparent 30%), linear-gradient(#2a0e0e, #5a1a10)',
    doodle: (light, r) => {
      const v = r(0);
      if (!light && v < 0.5) {
        const x = 15 + r(1) * 50, y = 15 + r(2) * 50;
        return <path d={`M${x} ${y} l${8 + r(3) * 10} ${6 + r(4) * 8} l${-4 + r(5) * 12} ${10 + r(6) * 10} l${6 + r(7) * 8} ${4}`} fill="none" stroke="#ff7a1a" strokeWidth={3} strokeLinecap="round" opacity={0.9} />;
      }
      if (light && v < 0.3) return <path d={`M${20 + r(1) * 50} ${60 + r(2) * 25} l8 -9 l9 3 l5 8 z`} fill="#5f534c" />;
      return null;
    },
  },
  {
    id: 'glacier', name: 'Glacier', emoji: '🧊', light: '#f4fbff', dark: '#8fc8e8', last: '#fff27a', frame: '#2a5577', coord: 'rgba(30,70,110,0.55)',
    scene: 'radial-gradient(circle at 70% 0%, #ffffff 0, transparent 40%), linear-gradient(#bfe2ff, #eaf6ff 60%, #ffffff)',
    doodle: (light, r) => {
      const v = r(0);
      if (!light && v < 0.4) return <path d={`M${10 + r(1) * 30} ${10 + r(2) * 30} l${20 + r(3) * 20} ${15 + r(4) * 20} m-10 -8 l12 -6`} stroke="#ffffff" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.8} />;
      if (light && v < 0.25) {
        const x = 20 + r(1) * 60, y = 20 + r(2) * 60;
        return <path d={`M${x - 6} ${y} h12 M${x} ${y - 6} v12 M${x - 4} ${y - 4} l8 8 M${x + 4} ${y - 4} l-8 8`} stroke="#9cc9e6" strokeWidth={2} strokeLinecap="round" />;
      }
      return null;
    },
  },
  {
    id: 'beach', name: 'Beach', emoji: '🏖️', light: '#fbe7b5', dark: '#e2bb78', last: '#7fe0ff', frame: '#2a8fb8', coord: 'rgba(120,80,20,0.55)',
    scene: 'linear-gradient(#7fd8ff 0, #c4f0ff 35%, #3fb8e0 36%, #1f8fc0 55%, #fbe7b5 56%)',
    doodle: (light, r) => {
      const v = r(0);
      if (v < 0.12) {
        const x = 20 + r(1) * 55, y = 25 + r(2) * 50;
        return <path d={`M${x} ${y} q10 -14 20 0 z M${x + 4} ${y} l6 -10 M${x + 10} ${y} v-11 M${x + 16} ${y} l-6 -10`} fill="#ffb3a7" stroke="#c76b5a" strokeWidth={1.8} />;
      }
      if (!light && v < 0.4) return <path d={`M${10 + r(1) * 40} ${30 + r(2) * 40} q10 -6 20 0 t20 0`} fill="none" stroke="#c99b55" strokeWidth={2.5} strokeLinecap="round" />;
      if (light && v < 0.3) return <g>{[0, 1, 2, 3].map((i) => <circle key={i} cx={15 + r(i + 3) * 70} cy={15 + r(i + 8) * 70} r={1.4} fill="#c99b55" />)}</g>;
      return null;
    },
  },
  {
    id: 'space', name: 'Outer Space', emoji: '🪐', light: '#5d5a7a', dark: '#1d1b33', last: '#b06bff', frame: '#05040c', coord: 'rgba(220,210,255,0.6)',
    scene: 'radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 60%, #fff, transparent), radial-gradient(1px 1px at 40% 80%, #fff, transparent), radial-gradient(2px 2px at 85% 15%, #ffe9a8, transparent), radial-gradient(circle at 90% 90%, #5a2a8a 0, transparent 40%), #0b0a1a',
    doodle: (light, r) => {
      const v = r(0);
      if (!light) return v < 0.7 ? <g>{[0, 1, 2].map((i) => <circle key={i} cx={10 + r(i + 1) * 80} cy={10 + r(i + 5) * 80} r={0.8 + r(i + 9) * 1.6} fill="#fff" opacity={0.5 + r(i + 12) * 0.5} />)}</g> : null;
      if (v < 0.35) return <circle cx={20 + r(1) * 60} cy={20 + r(2) * 60} r={4 + r(3) * 6} fill="#4b4866" stroke="#3d3a57" strokeWidth={2} />;
      return null;
    },
  },
  {
    id: 'candy', name: 'Candy Land', emoji: '🍭', light: '#fff0f6', dark: '#ff9cc8', last: '#9af7d5', frame: '#c2337a', coord: 'rgba(140,30,90,0.55)',
    scene: 'repeating-linear-gradient(45deg, #ffe0ef 0 22px, #fff6fb 22px 44px)',
    doodle: (light, r) => {
      if (r(0) > 0.55) return null;
      const colours = ['#4ad9b0', '#ffd23f', '#7a8cff', '#ff6f6f', '#ffffff'];
      return (
        <g>
          {[0, 1, 2, 3].map((i) => {
            const x = 12 + r(i + 1) * 76, y = 12 + r(i + 6) * 76, a = r(i + 11) * 180;
            return <rect key={i} x={x} y={y} width={9} height={3.5} rx={1.75} fill={colours[Math.floor(r(i + 16) * colours.length)]} transform={`rotate(${a} ${x + 4} ${y + 2})`} opacity={light ? 0.9 : 1} />;
          })}
        </g>
      );
    },
  },
  {
    id: 'swamp', name: 'Swamp', emoji: '🐸', light: '#b8b48a', dark: '#4f6b3a', last: '#e6ff5c', frame: '#2a2414', coord: 'rgba(40,40,10,0.6)',
    scene: 'radial-gradient(circle at 30% 20%, #6f8a4a 0, transparent 40%), linear-gradient(#384a2a, #1f2a16)',
    doodle: (light, r) => {
      const v = r(0);
      if (!light && v < 0.3) {
        const x = 20 + r(1) * 55, y = 20 + r(2) * 55;
        return <path d={`M${x} ${y} m-12 0 a12 9 0 1 0 24 0 a12 9 0 1 0 -24 0 M${x} ${y} l12 -3`} fill="#6fae4a" stroke="#355a22" strokeWidth={2} />;
      }
      if (!light && v < 0.55) return <g><circle cx={30 + r(1) * 40} cy={30 + r(2) * 40} r={3} fill="none" stroke="#a8c28a" strokeWidth={1.5} /><circle cx={40 + r(3) * 30} cy={40 + r(4) * 30} r={2} fill="none" stroke="#a8c28a" strokeWidth={1.5} /></g>;
      if (light && v < 0.25) return tuft(20 + r(1) * 60, 60 + r(2) * 30, '#6b6a3a');
      return null;
    },
  },
];

export function landscapeById(id: string): Landscape {
  return LANDSCAPES.find((l) => l.id === id) ?? LANDSCAPES[0];
}

export function squareDoodle(l: Landscape, sq: number, light: boolean) {
  return l.doodle(light, rnd(sq, l.id.length));
}
