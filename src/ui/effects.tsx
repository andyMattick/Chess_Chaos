import type { ReactElement } from 'react';
import { inCheck } from '../core/movegen';
import { pieceType } from '../core/pieces';
import type { Action, GameState } from '../core/types';

/**
 * Comic-book effects for captures, checks, mates, promotions and castling.
 * Pure SVG + CSS animations, keyed by ply so each one plays exactly once.
 */
export interface MoveEvents {
  ply: number;
  capture?: { sq: number; type: string; big: boolean };
  check?: { sq: number };
  mate?: { sq: number };
  promo?: { sq: number };
  castle?: { sq: number };
  to?: number;
}

const POW = ['POW!', 'BAM!', 'KAPOW!', 'WHACK!', 'BONK!', 'SPLAT!', 'ZAP!', 'CRUNCH!', 'BOOM!', 'YOINK!'];
const BIG = ['KA-BOOM!', 'OBLITERATED!', 'MEGA BONK!', 'DESTROYED!', 'GONE!!'];
const CHECK = ['CHECK!', 'CHECK!!', 'WATCH OUT!', 'CHECK!'];

export function moveEvents(before: GameState, after: GameState, a: Action | undefined, ply: number): MoveEvents | null {
  if (!a || a.t !== 'move') return null;
  const ev: MoveEvents = { ply, to: a.to };
  const victimId = before.sq[a.to];
  const ep = before.pieces[a.piece].type === 'pawn' && before.enPassant?.square === a.to && victimId < 0;
  if (victimId >= 0 || ep) {
    const type = victimId >= 0 ? before.pieces[victimId].type : 'pawn';
    ev.capture = { sq: a.to, type, big: pieceType(type).value >= 5 };
  }
  if (a.promo) ev.promo = { sq: a.to };
  if (a.castle) ev.castle = { sq: a.to };
  const king = after.pieces.find((p) => p.at >= 0 && p.owner === after.turn && p.type === 'king');
  if (king && inCheck(after, after.turn)) {
    if (after.result?.reason === 'checkmate') ev.mate = { sq: king.at };
    else ev.check = { sq: king.at };
  }
  return ev;
}

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(Math.floor(Math.sin(seed * 9.13) * 1000)) % list.length];
}

function burstPath(r1: number, r2: number, n: number, seed: number) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n;
    const r = i % 2 ? r1 * (0.8 + 0.4 * Math.abs(Math.sin(seed + i))) : r2;
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)} `;
  }
  return `${d}Z`;
}

export function FxLayer({ ev, pos, width, height }: { ev: MoveEvents; pos: (sq: number) => { x: number; y: number }; width: number; height: number }) {
  const out: ReactElement[] = [];
  const c = (sq: number) => {
    const { x, y } = pos(sq);
    return { x: x + 50, y: y + 50 };
  };
  const seed = ev.ply + 1;

  if (ev.capture && !ev.mate) {
    const p = c(ev.capture.sq);
    const word = ev.capture.big ? pick(BIG, seed) : pick(POW, seed);
    const rot = (Math.sin(seed) * 18).toFixed(0);
    out.push(
      <g key="cap" transform={`translate(${p.x} ${p.y})`}>
        <g className="fx-burst">
          <path d={burstPath(ev.capture.big ? 95 : 70, ev.capture.big ? 45 : 32, 11, seed)} fill={ev.capture.big ? '#ff3b3b' : '#ffcb2b'} stroke="#241f33" strokeWidth={5} strokeLinejoin="round" />
        </g>
        {Array.from({ length: ev.capture.big ? 12 : 7 }, (_, i) => {
          const ang = (i / (ev.capture!.big ? 12 : 7)) * Math.PI * 2 + seed;
          const dist = 90 + (i % 3) * 30;
          return (
            <g key={i} className="fx-debris" style={{ ['--dx' as string]: `${Math.cos(ang) * dist}px`, ['--dy' as string]: `${Math.sin(ang) * dist}px` }}>
              <path d="M0 -9 L3 -3 L9 -3 L4 2 L6 9 L0 5 L-6 9 L-4 2 L-9 -3 L-3 -3 Z" fill={['#ff4f9a', '#2f9bff', '#9be04a', '#fff'][i % 4]} stroke="#241f33" strokeWidth={2} />
            </g>
          );
        })}
        <g className="fx-word" style={{ ['--r' as string]: `${rot}deg` }}>
          <text textAnchor="middle" y={12} fontSize={ev.capture.big ? 46 : 36} className="fx-text">{word}</text>
        </g>
      </g>,
    );
  }

  if (ev.castle) {
    const p = c(ev.castle.sq);
    out.push(
      <g key="castle" transform={`translate(${p.x} ${p.y})`}>
        <path className="fx-swirl" d="M-60 0 C-60 -40 40 -50 50 -10 C58 20 10 30 0 10 C-8 -6 14 -14 20 -4" fill="none" stroke="#2f9bff" strokeWidth={8} strokeLinecap="round" />
        <g className="fx-word" style={{ ['--r' as string]: '-8deg' }}><text textAnchor="middle" y={-40} fontSize={34} className="fx-text">WHOOSH!</text></g>
      </g>,
    );
  }

  if (ev.promo) {
    const p = c(ev.promo.sq);
    out.push(
      <g key="promo" transform={`translate(${p.x} ${p.y})`}>
        {Array.from({ length: 10 }, (_, i) => {
          const ang = (i / 10) * Math.PI * 2;
          return <circle key={i} className="fx-debris" r={7} fill="#ffe14a" stroke="#241f33" strokeWidth={2} style={{ ['--dx' as string]: `${Math.cos(ang) * 110}px`, ['--dy' as string]: `${Math.sin(ang) * 110}px` }} />;
        })}
        <g className="fx-word" style={{ ['--r' as string]: '6deg' }}><text textAnchor="middle" y={-50} fontSize={38} className="fx-text">LEVEL UP!</text></g>
      </g>,
    );
  }

  if (ev.check) {
    const p = c(ev.check.sq);
    out.push(
      <g key="check" transform={`translate(${p.x} ${p.y})`}>
        <circle className="fx-ring" r={60} fill="none" stroke="#ff2d2d" strokeWidth={10} />
        <g className="fx-stamp" style={{ ['--r' as string]: `${(Math.sin(seed * 3) * 14).toFixed(0)}deg` }}>
          <rect x={-90} y={-112} width={180} height={50} rx={10} fill="#ff2d2d" stroke="#241f33" strokeWidth={5} />
          <text textAnchor="middle" y={-75} fontSize={34} className="fx-text light">{pick(CHECK, seed)}</text>
        </g>
      </g>,
    );
  }

  if (ev.mate) {
    out.push(
      <g key="mate">
        {Array.from({ length: 70 }, (_, i) => {
          const x = ((i * 137.5) % width);
          const colors = ['#ff4f9a', '#2f9bff', '#9be04a', '#ffcb2b', '#8a5cff', '#ff5a3c'];
          return <rect key={i} className="fx-confetti" x={x} y={-30} width={14} height={22} rx={3} fill={colors[i % colors.length]} style={{ animationDelay: `${(i % 14) * 0.07}s`, ['--fall' as string]: `${height + 80}px`, ['--spin' as string]: `${(i % 2 ? 1 : -1) * (360 + i * 20)}deg` }} />;
        })}
        <g transform={`translate(${width / 2} ${height / 2})`}>
          <g className="fx-mate">
            <path d={burstPath(330, 200, 16, seed)} fill="#ffcb2b" stroke="#241f33" strokeWidth={8} strokeLinejoin="round" />
            <text textAnchor="middle" y={26} fontSize={84} className="fx-text">CHECKMATE!</text>
          </g>
        </g>
      </g>,
    );
  }
  return <g pointerEvents="none" className="fx-layer">{out}</g>;
}

/** How hard the board should shake for this move. */
export function shakeFor(ev: MoveEvents | null): '' | 'shake' | 'shake-big' {
  if (!ev) return '';
  if (ev.mate || ev.capture?.big) return 'shake-big';
  if (ev.capture || ev.check) return 'shake';
  return '';
}

