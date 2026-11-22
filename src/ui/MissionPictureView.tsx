import { useMemo } from 'react';
import { missionPicture } from '../content/missionPictures';
import { pictureLine, sqIndex } from '../systems/missionPictures';
import { PieceGlyph } from './PieceGlyph';

/**
 * A little example board for a secret mission (content/missionPictures.ts):
 * the move that does it as a blue arrow, red arrows for what is attacked,
 * green for what guards, rings and shaded squares, and a one-line caption.
 * Plain piece shapes, so the picture is easy to read at any size.
 */
const S = 40;
/** Piece glyph scale: the glyphs leave room inside their 100 box, so draw them a bit larger than a square. */
const K = 0.52;
const COL = { move: '#2f7fe0', hit: '#e8413c', guard: '#23a455' };

export function MissionPictureView({ id, size = 220 }: { id: string; size?: number }) {
  const pic = missionPicture(id);
  const line = useMemo(() => (pic ? pictureLine(pic) : null), [pic]);
  if (!pic || !line) return null;
  const xy = (sq: number) => ({ x: (sq % 8) * S, y: (7 - Math.floor(sq / 8)) * S });
  const mid = (sq: number) => { const p = xy(sq); return { x: p.x + S / 2, y: p.y + S / 2 }; };
  const arrow = (from: number, to: number, kind: keyof typeof COL, key: string) => {
    const a = mid(from), b = mid(to);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const ex = b.x - ux * 12, ey = b.y - uy * 12;
    return (
      <g key={key} opacity={0.88}>
        <line x1={a.x} y1={a.y} x2={ex} y2={ey} stroke={COL[kind]} strokeWidth={7} strokeLinecap="round" strokeDasharray={kind === 'move' ? undefined : '10 6'} />
        <polygon points={`${b.x},${b.y} ${ex - uy * 9},${ey + ux * 9} ${ex + uy * 9},${ey - ux * 9}`} fill={COL[kind]} />
      </g>
    );
  };
  const zones = new Set((pic.zones ?? []).map(sqIndex));
  return (
    <figure className="mission-picture">
      <svg viewBox={`0 0 ${S * 8} ${S * 8}`} width={size} height={size} role="img" aria-label={`Example: ${pic.caption}`}>
        {Array.from({ length: 64 }, (_, sq) => {
          const { x, y } = xy(sq);
          const light = (Math.floor(sq / 8) + (sq % 8)) % 2 === 1;
          return <rect key={sq} x={x} y={y} width={S} height={S} fill={zones.has(sq) ? (light ? '#ffe58a' : '#f2c94c') : light ? '#f3e7c9' : '#9cc47a'} />;
        })}
        {(() => { const a = xy(line.arrow.from), b = xy(line.arrow.to); return <><rect x={a.x} y={a.y} width={S} height={S} fill="rgba(47,127,224,0.25)" /><rect x={b.x} y={b.y} width={S} height={S} fill="rgba(47,127,224,0.25)" /></>; })()}
        {line.shown.pieces.filter((p) => p.at >= 0).map((p) => {
          const { x, y } = xy(p.at);
          return <g key={p.id} transform={`translate(${x + S / 2 - 50 * K} ${y + S / 2 - 50 * K}) scale(${K})`}><PieceGlyph type={p.type} light={p.owner === 'p1'} /></g>;
        })}
        {(pic.rings ?? []).map((r) => { const c = mid(sqIndex(r)); return <circle key={`r${r}`} cx={c.x} cy={c.y} r={S / 2 - 3} fill="none" stroke="#ff8a00" strokeWidth={4} />; })}
        {arrow(line.arrow.from, line.arrow.to, 'move', 'move')}
        {(pic.arrows ?? []).map((a, i) => arrow(sqIndex(a.from), sqIndex(a.to), a.kind, `a${i}`))}
      </svg>
      <figcaption>{pic.caption}</figcaption>
    </figure>
  );
}
