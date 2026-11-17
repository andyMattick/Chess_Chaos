import { fileOf, rankOf, isLightSquare } from '../core/board';
import { inCheck } from '../core/movegen';
import type { GameState, MoveAction } from '../core/types';
import { PieceGlyph } from './PieceGlyph';

/**
 * SVG board. Renders from GameState plus overlays; knows nothing about game
 * flow. Works for any width, height and blocked squares (docs/04 section 9).
 */
export interface BoardProps {
  state: GameState;
  /** Seat shown at the bottom. */
  bottom: string;
  selected: number | null;
  targets: MoveAction[];
  lastMove?: { from: number; to: number } | null;
  showCoordinates: boolean;
  theme: string;
  interactive: boolean;
  onSquare: (sq: number) => void;
}

const SIZE = 100;

export function Board({ state, bottom, selected, targets, lastMove, showCoordinates, theme, interactive, onSquare }: BoardProps) {
  const b = state.board;
  const flip = bottom === 'p2';
  const W = b.width * SIZE;
  const H = b.height * SIZE;
  const pos = (sq: number) => {
    const f = fileOf(b, sq);
    const r = rankOf(b, sq);
    return { x: (flip ? b.width - 1 - f : f) * SIZE, y: (flip ? r : b.height - 1 - r) * SIZE };
  };
  const checked = new Set<number>();
  if (!state.result || state.result.reason === 'checkmate') {
    for (const p of state.pieces) {
      if (p.at >= 0 && p.type === 'king' && p.owner === state.turn && inCheck(state, p.owner)) checked.add(p.at);
    }
  }
  const targetSquares = new Map<number, boolean>();
  for (const m of targets) targetSquares.set(m.to, state.sq[m.to] >= 0 || (!!state.enPassant && state.enPassant.square === m.to && state.pieces[m.piece].type === 'pawn'));

  const squares = [];
  for (let sq = 0; sq < b.width * b.height; sq++) {
    if (b.blocked[sq]) continue;
    const { x, y } = pos(sq);
    const light = isLightSquare(b, sq);
    const cls = ['sq', light ? 'light' : 'dark'];
    if (lastMove && (lastMove.from === sq || lastMove.to === sq)) cls.push('last');
    if (selected === sq) cls.push('selected');
    if (checked.has(sq)) cls.push('check');
    squares.push(
      <rect key={`s${sq}`} x={x} y={y} width={SIZE} height={SIZE} className={cls.join(' ')} data-square={sq} onClick={() => interactive && onSquare(sq)} />,
    );
  }

  const coords = [];
  if (showCoordinates) {
    for (let f = 0; f < b.width; f++) {
      const sq = f;
      const { x } = pos(sq);
      coords.push(
        <text key={`f${f}`} x={x + SIZE - 8} y={H - 7} className="coord" textAnchor="end">
          {String.fromCharCode(97 + f)}
        </text>,
      );
    }
    for (let r = 0; r < b.height; r++) {
      const { y } = pos(r * b.width);
      coords.push(
        <text key={`r${r}`} x={6} y={y + 22} className="coord">
          {r + 1}
        </text>,
      );
    }
  }

  const live = state.pieces.filter((p) => p.at >= 0);
  return (
    <svg className={`board theme-${theme}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chess board">
      <g>{squares}</g>
      <g pointerEvents="none">{coords}</g>
      <g pointerEvents="none">
        {live.map((p) => {
          const { x, y } = pos(p.at);
          return (
            <g key={p.id} className="piece" style={{ transform: `translate(${x}px, ${y}px)` }} data-piece={p.type} data-owner={p.owner}>
              <PieceGlyph type={p.type} light={p.owner === 'p1'} />
            </g>
          );
        })}
      </g>
      <g pointerEvents="none">
        {[...targetSquares.entries()].map(([sq, capture]) => {
          const { x, y } = pos(sq);
          return capture ? (
            <circle key={`t${sq}`} cx={x + 50} cy={y + 50} r={44} className="target-ring" />
          ) : (
            <circle key={`t${sq}`} cx={x + 50} cy={y + 50} r={15} className="target-dot" />
          );
        })}
      </g>
    </svg>
  );
}
