import { useMemo } from 'react';
import { fileOf, rankOf, isLightSquare } from '../core/board';
import { inCheck } from '../core/movegen';
import type { GameState, MoveAction } from '../core/types';
import { skinFor, type SkinChoice } from '../content/cosmetics';
import { landscapeById, squareDoodle } from './landscapes';
import { Character } from './skins';
import { FxLayer, type MoveEvents } from './effects';
import { hillSquares } from '../core/modes';
import { baseType, pieceType } from '../core/pieces';

/**
 * SVG board. Renders from GameState plus overlays; knows nothing about game
 * flow. Works for any width, height and blocked squares (docs/04 section 9).
 * Squares get a hand-drawn wobble from an SVG filter; pieces stay crisp.
 */
/** Extra drawing on top of the board, used by training alerts and hints. */
export interface BoardOverlays {
  /** Square tints (danger squares). */
  tint?: Map<number, string>;
  /** Squares with a pulsing glow ring (best piece / best square). */
  glow?: Set<number>;
  /** Pieces on these squares wobble (hanging alarm). */
  wobble?: Set<number>;
  /** Attackers vs defenders chips (count the fight). */
  counts?: Map<number, { att: number; def: number }>;
  arrows?: { from: number; to: number; label?: string; color?: string }[];
  /** Colour per destination square for the selected piece (hot and cold). */
  targetColors?: Map<number, string>;
}

export interface BoardProps {
  state: GameState;
  /** Seat shown at the bottom. */
  bottom: string;
  selected: number | null;
  targets: MoveAction[];
  lastMove?: { from: number; to: number } | null;
  showCoordinates: boolean;
  landscape: string;
  skins: SkinChoice;
  interactive: boolean;
  onSquare: (sq: number) => void;
  overlays?: BoardOverlays;
  /** Comic effects for the move just played. */
  fx?: MoveEvents | null;
}

const SIZE = 100;
const PAD = 26;

export function Board({ state, bottom, selected, targets, lastMove, showCoordinates, landscape, skins, interactive, onSquare, overlays, fx }: BoardProps) {
  const b = state.board;
  const land = landscapeById(landscape);
  // Rotate so the bottom seat's pawns march up the screen (works for all four sides).
  const fwd = state.seats.find((x) => x.id === bottom)?.forward ?? [0, 1];
  const flip = fwd[1] < 0;
  const W = b.width * SIZE;
  const H = b.height * SIZE;
  const pos = (sq: number) => {
    const f = fileOf(b, sq);
    const r = rankOf(b, sq);
    let x: number, y: number;
    if (fwd[1] > 0) { x = f; y = b.height - 1 - r; }
    else if (fwd[1] < 0) { x = b.width - 1 - f; y = r; }
    else if (fwd[0] > 0) { x = b.height - 1 - r; y = b.width - 1 - f; }
    else { x = r; y = f; }
    return { x: x * SIZE, y: y * SIZE };
  };
  // Power card marks are public: both players see them (docs/03 Cards notes).
  const md = state.modeData ?? {};
  const cardMarks = {
    phoenix: new Set((md.phoenix as number[] | undefined) ?? []),
    bombs: new Set((md.bombs as number[] | undefined) ?? []),
    guarded: new Set(((md.bodyguard as { piece: number; until: number }[] | undefined) ?? []).filter((g) => state.ply < g.until).map((g) => g.piece)),
  };
  const checked = new Set<number>();
  for (const p of state.pieces) {
    if (p.at >= 0 && p.type === 'king' && p.owner === state.turn && inCheck(state, p.owner)) checked.add(p.at);
  }
  const targetSquares = new Map<number, boolean>();
  for (const m of targets) targetSquares.set(m.to, state.sq[m.to] >= 0 || (!!state.enPassant && state.enPassant.square === m.to && state.pieces[m.piece].type === 'pawn'));

  // The landscape layer only changes with the landscape or orientation.
  const ground = useMemo(() => {
    const out = [];
    for (let sq = 0; sq < b.width * b.height; sq++) {
      if (b.blocked[sq]) continue;
      const { x, y } = pos(sq);
      const light = isLightSquare(b, sq);
      out.push(
        <g key={sq} transform={`translate(${x} ${y})`}>
          <rect width={SIZE + 0.5} height={SIZE + 0.5} fill={light ? land.light : land.dark} />
          {squareDoodle(land, sq, light)}
        </g>,
      );
    }
    return out;
  }, [land, bottom, flip, b]); // eslint-disable-line react-hooks/exhaustive-deps

  const marks = [];
  for (let sq = 0; sq < b.width * b.height; sq++) {
    if (b.blocked[sq]) continue;
    const { x, y } = pos(sq);
    let fill: string | null = null;
    if (checked.has(sq)) fill = 'rgba(255,40,40,0.55)';
    else if (overlays?.tint?.has(sq) && selected !== sq) fill = overlays.tint.get(sq)!;
    else if (selected === sq) fill = 'rgba(80,170,255,0.55)';
    else if (lastMove && (lastMove.from === sq || lastMove.to === sq)) fill = land.last;
    marks.push(
      <rect
        key={`s${sq}`} x={x} y={y} width={SIZE} height={SIZE} data-square={sq}
        fill={fill ?? 'transparent'} opacity={fill === land.last ? 0.55 : 1}
        className="sq" onClick={() => interactive && onSquare(sq)}
      />,
    );
  }

  const coords = [];
  if (showCoordinates && fwd[0] === 0 && state.seats.length === 2) {
    for (let f = 0; f < b.width; f++) {
      const { x } = pos(f);
      coords.push(<text key={`f${f}`} x={x + SIZE / 2} y={H + PAD - 6} className="coord" textAnchor="middle" fill={land.coord}>{String.fromCharCode(97 + f)}</text>);
    }
    for (let r = 0; r < b.height; r++) {
      const { y } = pos(r * b.width);
      coords.push(<text key={`r${r}`} x={-PAD / 2} y={y + SIZE / 2 + 7} className="coord" textAnchor="middle" fill={land.coord}>{r + 1}</text>);
    }
  }

  const live = state.pieces.filter((p) => p.at >= 0);
  return (
    <svg className="board" viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`} role="img" aria-label="Chess board">
      <defs>
        <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={7} />
          <feDisplacementMap in="SourceGraphic" scale={7} />
        </filter>
        <filter id="rough-edge" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves={3} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={10} />
        </filter>
      </defs>
      <rect x={-PAD + 4} y={-PAD + 4} width={W + PAD * 2 - 8} height={H + PAD * 2 - 8} rx={22} fill={land.frame} filter="url(#rough-edge)" />
      <g filter="url(#wobble)">{ground}</g>
      {['koth', 'hill-wars', 'battle-hill'].includes(state.mode) && (
        <g pointerEvents="none">
          {[...hillSquares(state)].map((sq) => {
            const { x, y } = pos(sq);
            return <rect key={`h${sq}`} x={x + 6} y={y + 6} width={88} height={88} rx={14} className="hill-sq" />;
          })}
        </g>
      )}
      <g pointerEvents="none">{coords}</g>
      <g>{marks}</g>
      <g pointerEvents="none">
        {live.map((p) => {
          const { x, y } = pos(p.at);
          const sel = selected === p.at;
          const wob = overlays?.wobble?.has(p.at) || (checked.has(p.at) && !!fx);
          return (
            <g key={p.id} className={`piece ${sel ? 'lifted' : ''} ${wob ? 'wobbly' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }} data-piece={p.type} data-owner={p.owner}>
              {p.type === 'wall' ? <WallBlock seed={p.id} /> : (
                <g className="bob">
                  <Character skin={skinFor(skins, p.owner, baseType(p.type))} type={baseType(p.type)} owner={p.owner} seed={p.id + 1} badge={skins.badges && skinFor(skins, p.owner, baseType(p.type)) !== 'classic'} />
                </g>
              )}
              {pieceType(p.type).card && <text x={18} y={30} fontSize={26} className="card-badge">{pieceType(p.type).card}</text>}
              {cardMarks.phoenix.has(p.id) && <text x={66} y={30} fontSize={24} className="card-badge">🔥</text>}
              {cardMarks.bombs.has(p.id) && <text x={66} y={30} fontSize={24} className="card-badge">🧨</text>}
              {cardMarks.guarded.has(p.id) && <text x={66} y={96} fontSize={20} className="card-badge">💂</text>}
            </g>
          );
        })}
      </g>
      <g pointerEvents="none">
        {[...targetSquares.entries()].map(([sq, capture]) => {
          const { x, y } = pos(sq);
          const hot = overlays?.targetColors?.get(sq);
          if (hot) return <circle key={`t${sq}`} cx={x + 50} cy={y + 50} r={capture ? 40 : 18} className="target-hot" fill={capture ? 'none' : hot} stroke={hot} />;
          return capture ? (
            <path key={`t${sq}`} d={`M${x + 8} ${y + 8} l14 0 M${x + 8} ${y + 8} l0 14 M${x + 92} ${y + 8} l-14 0 M${x + 92} ${y + 8} l0 14 M${x + 8} ${y + 92} l14 0 M${x + 8} ${y + 92} l0 -14 M${x + 92} ${y + 92} l-14 0 M${x + 92} ${y + 92} l0 -14`} className="target-ring" />
          ) : (
            <circle key={`t${sq}`} cx={x + 50} cy={y + 50} r={13} className="target-dot" />
          );
        })}
      </g>
      {overlays && <OverlayLayer overlays={overlays} pos={pos} />}
      {fx && <FxLayer key={fx.ply} ev={fx} pos={pos} width={W} height={H} />}
    </svg>
  );
}

function OverlayLayer({ overlays, pos }: { overlays: BoardOverlays; pos: (sq: number) => { x: number; y: number } }) {
  const centre = (sq: number) => {
    const { x, y } = pos(sq);
    return { x: x + 50, y: y + 50 };
  };
  return (
    <g pointerEvents="none">
      <defs>
        <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
          <path d="M0 0 L4 2 L0 4 z" fill="#ff4f9a" />
        </marker>
      </defs>
      {[...(overlays.glow ?? [])].map((sq) => {
        const { x, y } = pos(sq);
        return <rect key={`g${sq}`} x={x + 5} y={y + 5} width={90} height={90} rx={18} className="glow-ring" />;
      })}
      {(overlays.arrows ?? []).map((a, i) => {
        const f = centre(a.from), t = centre(a.to);
        const dx = t.x - f.x, dy = t.y - f.y, len = Math.hypot(dx, dy) || 1;
        const ex = t.x - (dx / len) * 24, ey = t.y - (dy / len) * 24;
        // A little bend so it looks hand-drawn.
        const mx = (f.x + ex) / 2 - (dy / len) * 14, my = (f.y + ey) / 2 + (dx / len) * 14;
        return (
          <g key={`a${i}`}>
            <path d={`M${f.x} ${f.y} Q${mx} ${my} ${ex} ${ey}`} fill="none" stroke="#ff4f9a" strokeWidth={11} strokeLinecap="round" markerEnd="url(#arrowhead)" opacity={0.85} />
            {a.label && (
              <g transform={`translate(${mx} ${my})`}>
                <circle r={17} fill="#fffdf6" stroke="#241f33" strokeWidth={4} />
                <text y={8} textAnchor="middle" fontSize={22} fontWeight={900} fill="#241f33">{a.label}</text>
              </g>
            )}
          </g>
        );
      })}
      {[...(overlays.counts ?? [])].map(([sq, c]) => {
        const { x, y } = pos(sq);
        const bad = c.att > c.def;
        return (
          <g key={`c${sq}`} transform={`translate(${x + 4} ${y + 4})`}>
            <rect width={58} height={24} rx={10} fill={bad ? '#ff5a3c' : '#fffdf6'} stroke="#241f33" strokeWidth={3} />
            <text x={29} y={18} textAnchor="middle" fontSize={16} fontWeight={900} fill={bad ? '#fff' : '#241f33'}>⚔{c.att} 🛡{c.def}</text>
          </g>
        );
      })}
    </g>
  );
}

/** CARD-10: a scrappy brick wall. */
function WallBlock({ seed }: { seed: number }) {
  const tilt = ((seed * 37) % 7) - 3;
  return (
    <g transform={`rotate(${tilt} 50 50)`}>
      <rect x={10} y={22} width={80} height={68} rx={6} fill="#c8553d" stroke="#2d2a3e" strokeWidth={4} />
      {[40, 58, 76].map((y) => <path key={y} d={`M12 ${y} H88`} stroke="#2d2a3e" strokeWidth={3} />)}
      {[[36, 22, 40], [64, 22, 40], [26, 40, 58], [54, 40, 58], [74, 40, 58], [40, 58, 76], [66, 58, 76], [30, 76, 90], [58, 76, 90]].map(([x, a, b], i) => <path key={i} d={`M${x} ${a} V${b}`} stroke="#2d2a3e" strokeWidth={3} />)}
    </g>
  );
}
