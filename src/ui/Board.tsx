import { useMemo } from 'react';
import { fileOf, rankOf, isLightSquare } from '../core/board';
import { inCheck } from '../core/movegen';
import type { GameState, MoveAction } from '../core/types';
import { skinFor, type SkinChoice } from '../content/cosmetics';
import { landscapeById, squareDoodle } from './landscapes';
import { Character } from './skins';

/**
 * SVG board. Renders from GameState plus overlays; knows nothing about game
 * flow. Works for any width, height and blocked squares (docs/04 section 9).
 * Squares get a hand-drawn wobble from an SVG filter; pieces stay crisp.
 */
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
}

const SIZE = 100;
const PAD = 26;

export function Board({ state, bottom, selected, targets, lastMove, showCoordinates, landscape, skins, interactive, onSquare }: BoardProps) {
  const b = state.board;
  const land = landscapeById(landscape);
  const flip = bottom === 'p2';
  const W = b.width * SIZE;
  const H = b.height * SIZE;
  const pos = (sq: number) => {
    const f = fileOf(b, sq);
    const r = rankOf(b, sq);
    return { x: (flip ? b.width - 1 - f : f) * SIZE, y: (flip ? r : b.height - 1 - r) * SIZE };
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
  }, [land, flip, b]); // eslint-disable-line react-hooks/exhaustive-deps

  const marks = [];
  for (let sq = 0; sq < b.width * b.height; sq++) {
    if (b.blocked[sq]) continue;
    const { x, y } = pos(sq);
    let fill: string | null = null;
    if (checked.has(sq)) fill = 'rgba(255,40,40,0.55)';
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
  if (showCoordinates) {
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
      <g pointerEvents="none">{coords}</g>
      <g>{marks}</g>
      <g pointerEvents="none">
        {live.map((p) => {
          const { x, y } = pos(p.at);
          const sel = selected === p.at;
          return (
            <g key={p.id} className={`piece ${sel ? 'lifted' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }} data-piece={p.type} data-owner={p.owner}>
              <g className="bob">
                <Character skin={skinFor(skins, p.owner, p.type)} type={p.type} owner={p.owner} seed={p.id + 1} badge={skins.badges && skinFor(skins, p.owner, p.type) !== 'classic'} />
              </g>
            </g>
          );
        })}
      </g>
      <g pointerEvents="none">
        {[...targetSquares.entries()].map(([sq, capture]) => {
          const { x, y } = pos(sq);
          return capture ? (
            <path key={`t${sq}`} d={`M${x + 8} ${y + 8} l14 0 M${x + 8} ${y + 8} l0 14 M${x + 92} ${y + 8} l-14 0 M${x + 92} ${y + 8} l0 14 M${x + 8} ${y + 92} l14 0 M${x + 8} ${y + 92} l0 -14 M${x + 92} ${y + 92} l-14 0 M${x + 92} ${y + 92} l0 -14`} className="target-ring" />
          ) : (
            <circle key={`t${sq}`} cx={x + 50} cy={y + 50} r={13} className="target-dot" />
          );
        })}
      </g>
    </svg>
  );
}
