import { useMemo } from 'react';
import { fileOf, triRank, triSector } from '../core/board';
import { inCheck } from '../core/movegen';
import { TRI_HOLE } from '../core/variants';
import { baseType } from '../core/pieces';
import { skinFor } from '../content/cosmetics';
import { landscapeById } from './landscapes';
import { Character } from './skins';
import type { BoardProps } from './Board';

/**
 * The three-player hexagon (owner, 2026-11-18). Six kites meet in the middle;
 * each seat owns two of them (its files a-d and e-h), each cut into 4 x 4
 * cells. Seat 0's back row lies along the bottom edge. The whole board turns
 * so the player's own army is at the bottom; pieces stay upright.
 */
const R = 460;
const H = (R * Math.sqrt(3)) / 2;
type P = [number, number];
const V: P[] = [[-R / 2, H], [R / 2, H], [R, 0], [R / 2, -H], [-R / 2, -H], [-R, 0]];
const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const M: P[] = V.map((v, k) => mid(v, V[(k + 1) % 6]));
const O: P = [0, 0];
const at = (k: number) => ((k % 6) + 6) % 6;

/** A point of seat s's half-board at file f (0-8) and rank r (0-4), as on a bent normal board. */
function point(s: number, f: number, r: number): P {
  const k = 2 * s;
  // Left kite: V_k (0,0), M_k (4,0), O (4,4), M_{k-1} (0,4). Right kite: M_k (4,0), V_{k+1} (8,0), M_{k+1} (8,4), O (4,4).
  const [a, b, c, d] = f <= 4 ? [V[k], M[k], O, M[at(k - 1)]] : [M[k], V[at(k + 1)], M[at(k + 1)], O];
  const u = (f <= 4 ? f : f - 4) / 4, v = r / 4;
  return [
    (1 - u) * (1 - v) * a[0] + u * (1 - v) * b[0] + u * v * c[0] + (1 - u) * v * d[0],
    (1 - u) * (1 - v) * a[1] + u * (1 - v) * b[1] + u * v * c[1] + (1 - u) * v * d[1],
  ];
}

export interface TriCell { sq: number; poly: P[]; c: P; light: boolean }

/** The 96 cells: corners and centre point. */
export function triCells(): TriCell[] {
  const out: TriCell[] = [];
  for (let s = 0; s < 3; s++) for (let r = 0; r < 4; r++) for (let f = 0; f < 8; f++) {
    // Cells never straddle the d/e line: the left kite covers files 0-3, the right 4-7.
    const poly = [point(s, f, r), point(s, f + 1, r), point(s, f + 1, r + 1), point(s, f, r + 1)];
    if (f === 3) { poly[1] = point(s, 4, r); poly[2] = point(s, 4, r + 1); }
    const c: P = [poly.reduce((x, p) => x + p[0], 0) / 4, poly.reduce((x, p) => x + p[1], 0) / 4];
    out.push({ sq: (s * 4 + r) * 8 + f, poly, c, light: (f + r) % 2 === 1 });
  }
  return out;
}
const CELLS = triCells();
const BY_SQ = new Map(CELLS.map((x) => [x.sq, x]));
const pts = (poly: P[]) => poly.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/** Turn so seat `bottom` sits at the bottom (degrees). */
export function triRotation(sector: number): number {
  return [0, 120, -120][sector] ?? 0;
}

export function TriBoard({ state, bottom, selected, targets, lastMove, landscape, skins, interactive, onSquare, overlays }: BoardProps) {
  const land = landscapeById(landscape);
  const sector = Math.max(0, state.seats.findIndex((x) => x.id === bottom));
  const rot = triRotation(sector);
  const checked = new Set<number>();
  for (const p of state.pieces) if (p.at >= 0 && p.type === 'king' && p.owner === state.turn && inCheck(state, p.owner)) checked.add(p.at);
  const targetSquares = new Map<number, boolean>();
  for (const m of targets) targetSquares.set(m.to, state.sq[m.to] >= 0);

  const blocked = state.board.blocked;
  const holeKey = TRI_HOLE.map((sq) => (blocked[sq] ? 1 : 0)).join('');
  const ground = useMemo(() => CELLS.map((x) => (blocked[x.sq]
    ? <polygon key={x.sq} points={pts(x.poly)} fill={land.frame} stroke="#241f33" strokeWidth={2} />
    : <polygon key={x.sq} points={pts(x.poly)} fill={x.light ? land.light : land.dark} stroke={land.dark} strokeWidth={1} />
  )), [land, holeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const PIECE = 68;
  const upright = (c: P) => `translate(${c[0]} ${c[1]}) rotate(${-rot}) translate(${-PIECE / 2} ${-PIECE / 2}) scale(${PIECE / 100})`;
  const pad = 40;
  return (
    <svg className="board tri-board" viewBox={`${-R - pad} ${-R - pad} ${2 * (R + pad)} ${2 * (R + pad)}`} role="img" aria-label="Three-player hexagon chess board">
      <g transform={`rotate(${rot})`}>
        <polygon points={pts(V)} fill={land.frame} stroke="#241f33" strokeWidth={14} strokeLinejoin="round" />
        <g>{ground}</g>
        {/* Each player's own edge, in their colour. */}
        {[0, 1, 2].map((s) => <line key={s} x1={V[2 * s][0]} y1={V[2 * s][1]} x2={V[2 * s + 1][0]} y2={V[2 * s + 1][1]} stroke={['#f4efe2', '#3a3550', '#ffcf3a'][s]} strokeWidth={12} strokeLinecap="round" />)}
        <g>
          {CELLS.filter((x) => !blocked[x.sq]).map((x) => {
            let fill = 'transparent';
            if (checked.has(x.sq)) fill = 'rgba(255,40,40,0.55)';
            else if (overlays?.tint?.has(x.sq) && selected !== x.sq) fill = overlays.tint.get(x.sq)!;
            else if (selected === x.sq) fill = 'rgba(80,170,255,0.55)';
            else if (lastMove && (lastMove.from === x.sq || lastMove.to === x.sq)) fill = land.last;
            return <polygon key={`m${x.sq}`} points={pts(x.poly)} data-square={x.sq} fill={fill} opacity={fill === land.last ? 0.55 : 1} className="sq" onClick={() => interactive && onSquare(x.sq)} />;
          })}
        </g>
        {overlays?.glow && [...overlays.glow].map((sq) => BY_SQ.get(sq) && <polygon key={`g${sq}`} points={pts(BY_SQ.get(sq)!.poly)} className="glow-ring" fill="none" pointerEvents="none" />)}
        <g pointerEvents="none">
          {state.pieces.filter((p) => p.at >= 0 && !overlays?.fog?.has(p.at)).map((p) => {
            const cell = BY_SQ.get(p.at);
            if (!cell) return null;
            const skin = skinFor(skins, p.owner, baseType(p.type));
            return (
              <g key={p.id} transform={upright(cell.c)} className={selected === p.at ? 'lifted' : ''} data-piece={p.type} data-owner={p.owner}>
                <Character skin={skin} type={baseType(p.type)} owner={p.owner} seed={p.id + 1} badge={skins.badges && skin !== 'classic'} />
              </g>
            );
          })}
        </g>
        <g pointerEvents="none">
          {[...targetSquares.entries()].map(([sq, capture]) => {
            const cell = BY_SQ.get(sq);
            if (!cell) return null;
            return capture
              ? <polygon key={`t${sq}`} points={pts(cell.poly)} className="target-ring" fill="none" />
              : <circle key={`t${sq}`} cx={cell.c[0]} cy={cell.c[1]} r={9} className="target-dot" />;
          })}
        </g>
        {overlays?.arrows?.map((a, i) => {
          const f = BY_SQ.get(a.from)?.c, t = BY_SQ.get(a.to)?.c;
          return f && t ? <line key={`a${i}`} x1={f[0]} y1={f[1]} x2={t[0]} y2={t[1]} stroke={a.color ?? '#ff4f9a'} strokeWidth={10} strokeLinecap="round" opacity={0.8} pointerEvents="none" /> : null;
        })}
      </g>
    </svg>
  );
}

/** Seat and local square of a hexagon square, for tests and names. */
export function triWhere(sq: number, b: { width: number; height: number; blocked: boolean[]; wrapFiles: boolean; topology?: 'tri' }) {
  return { sector: triSector(b, sq), file: fileOf(b, sq), rank: triRank(b, sq) };
}
