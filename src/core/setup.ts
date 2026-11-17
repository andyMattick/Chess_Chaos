import { fileOf, parseSquare, rankOf, rectBoard, square, squareName } from './board';
import { pieceType, typeFromLetter } from './pieces';
import type { GameState, Piece, PlayerId, Seat } from './types';
import { positionKey } from './position';

export const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function standardSeats(): Seat[] {
  return [
    { id: 'p1', name: 'White', forward: [0, 1], promo: { axis: 'r', value: 7 }, status: 'active' },
    { id: 'p2', name: 'Black', forward: [0, -1], promo: { axis: 'r', value: 0 }, status: 'active' },
  ];
}

export function emptyState(width: number, height: number, seats: Seat[], seed = 1): GameState {
  return {
    board: rectBoard(width, height),
    seats,
    pieces: [],
    sq: new Array(width * height).fill(-1),
    turn: seats[0].id,
    ply: 0,
    halfmoveClock: 0,
    enPassant: null,
    positionCounts: {},
    mode: 'standard',
    rng: seed,
    result: null,
  };
}

export function addPiece(s: GameState, type: string, owner: PlayerId, at: number, moved = false): Piece {
  const p: Piece = { id: s.pieces.length, type, owner, home: at, at, moved };
  s.pieces.push(p);
  s.sq[at] = p.id;
  return p;
}

/** Load a standard two-player FEN onto an 8x8 board. */
export function fromFEN(fen: string, seed = 1): GameState {
  const [placement, turn, castling = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const s = emptyState(8, 8, standardSeats(), seed);
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error(`Bad FEN: ${fen}`);
  rows.forEach((row, i) => {
    const r = 7 - i;
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += parseInt(ch, 10); continue; }
      const type = typeFromLetter(ch);
      if (!type) throw new Error(`Bad FEN piece ${ch}`);
      const owner: PlayerId = ch === ch.toUpperCase() ? 'p1' : 'p2';
      const sqi = square(s.board, f, r);
      // A piece not on its usual starting rank counts as having moved (matters for pawns).
      const homeRank = owner === 'p1' ? (type === 'pawn' ? 1 : 0) : (type === 'pawn' ? 6 : 7);
      addPiece(s, type, owner, sqi, r !== homeRank);
      f++;
    }
  });
  // Castling rights become "moved" flags on kings and rooks.
  const rights = castling === '-' ? '' : castling;
  for (const p of s.pieces) {
    if (p.type === 'king') p.moved = !(p.owner === 'p1' ? /[KQ]/.test(rights) : /[kq]/.test(rights));
    if (p.type === 'rook') {
      const f = fileOf(s.board, p.at);
      const r = rankOf(s.board, p.at);
      const flag = p.owner === 'p1' ? (f === 7 && r === 0 ? 'K' : f === 0 && r === 0 ? 'Q' : '') : (f === 7 && r === 7 ? 'k' : f === 0 && r === 7 ? 'q' : '');
      p.moved = !(flag && rights.includes(flag));
    }
  }
  s.turn = turn === 'b' ? 'p2' : 'p1';
  if (ep !== '-') {
    const epSq = parseSquare(s.board, ep);
    const victim = s.turn === 'p1' ? epSq - 8 : epSq + 8;
    s.enPassant = { square: epSq, victim, by: s.turn === 'p1' ? 'p2' : 'p1' };
  }
  s.halfmoveClock = parseInt(half, 10) || 0;
  s.ply = (Math.max(1, parseInt(full, 10) || 1) - 1) * 2 + (s.turn === 'p2' ? 1 : 0);
  s.positionCounts = { [positionKey(s)]: 1 };
  return s;
}

export function standardStart(seed = 1): GameState {
  return fromFEN(STANDARD_FEN, seed);
}

/** Export a two-player 8x8 state as FEN. */
export function toFEN(s: GameState): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const id = s.sq[square(s.board, f, r)];
      if (id < 0) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      const p = s.pieces[id];
      const l = pieceType(p.type).letter;
      row += p.owner === 'p1' ? l : l.toLowerCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  let rights = '';
  const rookAt = (owner: PlayerId, f: number, r: number) => {
    const id = s.sq[square(s.board, f, r)];
    return id >= 0 && s.pieces[id].type === 'rook' && s.pieces[id].owner === owner && !s.pieces[id].moved;
  };
  const kingHome = (owner: PlayerId) => s.pieces.some((p) => p.at >= 0 && p.type === 'king' && p.owner === owner && !p.moved);
  if (kingHome('p1')) { if (rookAt('p1', 7, 0)) rights += 'K'; if (rookAt('p1', 0, 0)) rights += 'Q'; }
  if (kingHome('p2')) { if (rookAt('p2', 7, 7)) rights += 'k'; if (rookAt('p2', 0, 7)) rights += 'q'; }
  const ep = s.enPassant ? squareName(s.board, s.enPassant.square) : '-';
  return `${rows.join('/')} ${s.turn === 'p1' ? 'w' : 'b'} ${rights || '-'} ${ep} ${s.halfmoveClock} ${Math.floor(s.ply / 2) + 1}`;
}
