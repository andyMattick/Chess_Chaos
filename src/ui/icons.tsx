import type { ReactElement } from 'react';

/**
 * Our own icons (design review, 2026-11-25): emoji look different on every
 * phone and clash with the hand-drawn creatures, so the map places and the
 * main game buttons use these instead. Drawn on a 24 × 24 grid with the same
 * thick ink outline as the pieces and one or two flat colours each.
 * Kept behind this module like the rest of the art, so an artist's set can
 * replace it later.
 */

const INK = '#241f33';
const S = { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const F = (fill: string) => ({ ...S, fill });

const ICONS: Record<string, () => ReactElement> = {
  // ---- Map places ----
  robot: () => (
    <>
      <path d="M12 6.5V3.8" {...S} /><circle cx={12} cy={3.2} r={1.4} {...F('#ff5a3c')} />
      <rect x={4.5} y={6.5} width={15} height={12.5} rx={3.5} {...F('#ff9f43')} />
      <circle cx={9.2} cy={11.8} r={1.7} {...F('#fff')} /><circle cx={14.8} cy={11.8} r={1.7} {...F('#fff')} />
      <path d="M9 15.8h6" {...S} /><path d="M2.8 11v4M21.2 11v4" {...S} />
    </>
  ),
  pine: () => (
    <>
      <path d="M12 2.8 18.5 11H15.2L19.5 17.2H4.5L8.8 11H5.5Z" {...F('#5fb34a')} />
      <path d="M12 17.2V21" {...S} strokeWidth={2.6} />
      <path d="M10 9.5l2-2 2 2" {...S} stroke="#fff" />
    </>
  ),
  swords: () => (
    <>
      <path d="M5 4l10.5 10.5M19 4 8.5 14.5" {...S} strokeWidth={2.6} />
      <path d="M4.5 4.5 4 4 6 4.8M19.5 4.5 20 4 18 4.8" {...S} />
      <path d="M13 17l4-4M11 17l-4-4" {...S} stroke="#ffcb2b" strokeWidth={3} />
      <path d="M16.5 17.5l2.5 2.5M7.5 17.5 5 20" {...S} strokeWidth={2.6} />
    </>
  ),
  balloon: () => (
    <>
      <ellipse cx={12} cy={9} rx={5.6} ry={6.4} {...F('#ff4f9a')} />
      <path d="M11 15.3h2l-1 1.6z" {...F(INK)} />
      <path d="M12 16.9c-2 1.5 1.8 2.6 0 4.6" {...S} />
      <path d="M9.4 6.6c.6-1 1.4-1.5 2.3-1.7" {...S} stroke="#fff" />
    </>
  ),
  puzzle: () => (
    <path d="M5 8h3.5a2.3 2.3 0 1 1 4.6 0H16.5v3.4a2.3 2.3 0 1 1 0 4.6V19.5H13a2.3 2.3 0 1 0-4.6 0H5v-3.4a2.3 2.3 0 1 0 0-4.6Z" {...F('#9be04a')} />
  ),
  board: () => (
    <>
      <rect x={4} y={4.5} width={16} height={15.5} rx={2} {...F('#c98b4b')} />
      <rect x={6.5} y={7} width={4.5} height={4.5} {...F('#fff')} /><rect x={13} y={7.5} width={4.5} height={3.5} {...F('#ffcb2b')} />
      <rect x={7.5} y={13.5} width={9} height={4} {...F('#fff')} />
      <path d="M9 8.2l.8.8 1.5-1.6" {...S} strokeWidth={1.4} />
    </>
  ),
  tent: () => (
    <>
      <path d="M3.5 19.5 12 6.5l8.5 13Z" {...F('#ff5a3c')} />
      <path d="M12 6.5 9.5 19.5M12 6.5l2.5 13" {...S} stroke="#fff" strokeWidth={2.2} />
      <path d="M3.5 19.5 12 6.5l8.5 13Z" {...S} />
      <path d="M12 6.5V2.5l3.5 1.2L12 5" {...F('#ffcb2b')} />
    </>
  ),
  maze: () => (
    <>
      <rect x={4} y={4} width={16} height={16} rx={2.5} {...F('#fff')} />
      <path d="M8 4v8h4M16 20v-8h-4M8 16h4M4 8h0M16 8h4" {...S} />
      <circle cx={12} cy={12} r={1.6} {...F('#ff4f9a')} />
    </>
  ),
  cap: () => (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14Z" {...F('#2f9bff')} />
      <path d="M6.5 11.5v4.5c3 2.2 8 2.2 11 0v-4.5" {...F('#2f9bff')} />
      <path d="M20 10.3v5.2" {...S} /><circle cx={20} cy={16.6} r={1.2} {...F('#ffcb2b')} />
    </>
  ),
  letter: () => (
    <>
      <rect x={3} y={6} width={18} height={13} rx={2} {...F('#fff')} />
      <path d="M3.5 7 12 13.5 20.5 7" {...S} />
      <rect x={15} y={8.5} width={3.5} height={3.5} {...F('#ff5a3c')} strokeWidth={1.4} />
    </>
  ),
  book: () => (
    <>
      <path d="M12 6.5C9.5 4.8 6.5 4.5 3 5v13.5c3.5-.5 6.5-.2 9 1.5 2.5-1.7 5.5-2 9-1.5V5c-3.5-.5-6.5-.2-9 1.5Z" {...F('#fff')} />
      <path d="M12 6.5V20" {...S} />
      <path d="M6 9h3.2M6 12h3.2M14.8 9H18M14.8 12H18" {...S} strokeWidth={1.5} />
    </>
  ),
  replay: () => (
    <>
      <circle cx={12} cy={12.5} r={7.5} {...F('#ffcb2b')} />
      <path d="M12 8.5v4.3l2.8 1.8" {...S} />
      <path d="M3.2 7.5l1.6 3.4 3.4-1.6" {...S} />
    </>
  ),
  shirt: () => (
    <path d="M8.5 4 4 6.5 2.5 11l3.2 1.2L6.5 10v10h11V10l.8 2.2 3.2-1.2L20 6.5 15.5 4c-.6 1.6-1.9 2.5-3.5 2.5S9.1 5.6 8.5 4Z" {...F('#8a5cff')} />
  ),
  cards: () => (
    <>
      <rect x={3.5} y={6} width={10} height={14} rx={2} transform="rotate(-12 8.5 13)" {...F('#fff')} />
      <rect x={10} y={4.5} width={10} height={14} rx={2} transform="rotate(10 15 11.5)" {...F('#ffcb2b')} />
      <path d="M15 9.2l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3Z" {...F('#ff5a3c')} strokeWidth={1.2} />
    </>
  ),
  trophy: () => (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0Z" {...F('#ffcb2b')} />
      <path d="M7 6H4.5c0 3 1.2 4.5 3 4.6M17 6h2.5c0 3-1.2 4.5-3 4.6" {...S} />
      <path d="M12 14v3.5M8.5 20.5h7l-.8-3h-5.4Z" {...F('#ffcb2b')} />
    </>
  ),
  boat: () => (
    <>
      <path d="M11.5 3v12.5H4.5Z" {...F('#fff')} />
      <path d="M13 6.5l5.5 9H13Z" {...F('#ff5a3c')} />
      <path d="M3 17.5h18l-2.5 3h-13Z" {...F('#c98b4b')} />
    </>
  ),
  pawn: () => (
    <>
      <circle cx={12} cy={6.5} r={3} {...F('#fff')} />
      <path d="M9.2 10.3h5.6l-.8 1.2c.6 2.4 1.6 4.4 3 5.7H7c1.4-1.3 2.4-3.3 3-5.7Z" {...F('#fff')} />
      <rect x={5.5} y={17.2} width={13} height={3.3} rx={1.2} {...F('#fff')} />
    </>
  ),
  // ---- Game buttons ----
  undo: () => <path d="M9 7 4.5 11.5 9 16M5 11.5h9.5a5 5 0 0 1 0 10H12" {...S} strokeWidth={2.4} />,
  flip: () => <path d="M8 20V5M4.5 8.5 8 5l3.5 3.5M16 4v15M12.5 15.5 16 19l3.5-3.5" {...S} strokeWidth={2.4} />,
  flag: () => (
    <>
      <path d="M5.5 21V4" {...S} strokeWidth={2.4} />
      <path d="M5.5 4.5h12l-2.5 4 2.5 4h-12" {...F('#fff')} />
    </>
  ),
  soundOn: () => (
    <>
      <path d="M3.5 9.5h3.5L12 5v14l-5-4.5H3.5Z" {...F('#fff')} />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" {...S} />
    </>
  ),
  soundOff: () => (
    <>
      <path d="M3.5 9.5h3.5L12 5v14l-5-4.5H3.5Z" {...F('#fff')} />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" {...S} />
    </>
  ),
  shake: () => (
    <>
      <rect x={8} y={3.5} width={8} height={17} rx={2} {...F('#fff')} />
      <path d="M11 17.5h2M4.5 8.5l-1 3.5 1 3.5M19.5 8.5l1 3.5-1 3.5" {...S} />
    </>
  ),
  home: () => (
    <>
      <path d="M3.5 11.5 12 4l8.5 7.5" {...S} strokeWidth={2.4} />
      <path d="M6 10v10h12V10" {...F('#fff')} />
      <path d="M10 20v-5h4v5" {...F('#ffcb2b')} />
    </>
  ),
};

/** Which icon each World map place uses (place ids from content/world.ts). */
export const PLACE_ICON: Record<string, string> = {
  tower: 'robot', woods: 'pine', ring: 'swords', arena: 'balloon', cave: 'puzzle', quests: 'board', carnival: 'tent',
  park: 'maze', school: 'cap', post: 'letter', library: 'book', memory: 'replay', tailor: 'shirt', cards: 'cards',
  fame: 'trophy', harbour: 'boat', signpost: 'pawn',
};

export function hasIcon(name: string): boolean {
  return name in ICONS;
}

/** The icon's shapes on its 24 × 24 grid, for drawing inside another SVG (the map). */
export function IconShapes({ name, x = 0, y = 0, size = 24 }: { name: string; x?: number; y?: number; size?: number }) {
  const draw = ICONS[name];
  if (!draw) return null;
  return <g transform={`translate(${x} ${y}) scale(${size / 24})`}>{draw()}</g>;
}

/** A stand-alone icon, sized to the text around it. Decorative: the button or label carries the words. */
export function Icon({ name, className = 'icon' }: { name: string; className?: string }) {
  const draw = ICONS[name];
  if (!draw) return null;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {draw()}
    </svg>
  );
}

/** A place's picture: our icon when there is one, else its emoji. */
export function PlaceIcon({ id, emoji, className }: { id: string; emoji: string; className?: string }) {
  const name = PLACE_ICON[id];
  return name ? <Icon name={name} className={className} /> : <span className={className}>{emoji}</span>;
}
