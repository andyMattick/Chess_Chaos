import { fileOf, rankOf, step } from './board';
import { inCheck, legalMoves, makeMove, pseudoMovesFor, royals } from './movegen';
import { baseType, pieceType } from './pieces';
import { addPiece, emptyState, fromFEN } from './setup';
import { positionKey } from './position';
import type { RuleModule } from './rules';
import type { GameState, MoveAction, Piece, PlayerId, Seat } from './types';

/**
 * More game modes (docs/03 Game modes): Atomic, Giveaway, Racing kings,
 * Wrap-around, Lava, Mini board, Horde, Monster, Shrinking board, Progressive,
 * Drop-in, Boss battle, Mystery army, Hidden queen, Draft and Endgame survival.
 * Same shape as modes.ts: rule modules by mode id, plus start-of-game setup.
 * Kept free of imports from rules.ts to avoid a cycle.
 */

/** Setup choices that come from the record (who has the boss, drafted armies…). */
export interface ModeExtra {
  boss?: PlayerId;
  armies?: Partial<Record<PlayerId, string[]>>;
  /** Endgame survival: the start position and the side that must hold. */
  fen?: string;
  survivor?: PlayerId;
}

// ---------- helpers ----------

const data = <T>(s: GameState, key: string, fallback: T): T => (s.modeData?.[key] as T | undefined) ?? fallback;
const setData = (s: GameState, key: string, value: unknown): GameState => ({ ...s, modeData: { ...(s.modeData ?? {}), [key]: value } });
const other = (s: GameState, p: PlayerId) => s.seats.find((x) => x.id !== p)!.id;
const NEAR: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const isPawnType = (t: string) => baseType(t) === 'pawn';

/** Deterministic random number in [0, n) from the game seed and the move number. */
function roll(s: GameState, n: number, salt = 0): number {
  let h = (s.rng ^ Math.imul(s.ply + 1 + salt * 977, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % n;
}

function withPieces(s: GameState, fn: (pieces: Piece[], sq: number[]) => void): GameState {
  const pieces = s.pieces.map((p) => ({ ...p }));
  const sq = s.sq.slice();
  fn(pieces, sq);
  return { ...s, pieces, sq };
}

function fresh(s: GameState): GameState {
  return { ...s, positionCounts: { [positionKey(s)]: 1 } };
}

/** A new position from a FEN, keeping the game's seed and mode. */
function fromFenKeep(s: GameState, fen: string): GameState {
  return fresh({ ...fromFEN(fen, s.rng), mode: s.mode, rules: s.rules, modeData: s.modeData });
}

/** Rank counted from this player's side (0 = their back row). */
function relRank(s: GameState, p: PlayerId, sq: number): number {
  const seat = s.seats.find((x) => x.id === p)!;
  return seat.forward[1] > 0 ? rankOf(s.board, sq) : s.board.height - 1 - rankOf(s.board, sq);
}

// ---------- MODE-13 Atomic ----------

function blast(s: GameState, at: number): number[] {
  const out = [at];
  for (const [x, y] of NEAR) { const t = step(s.board, at, x, y); if (t >= 0) out.push(t); }
  return out;
}

const atomic: RuleModule = {
  id: 'atomic',
  noMaterialDraw: true,
  // Kings are blown up, not checkmated.
  checkEnforced: () => false,
  filterMoves: (s, moves) => moves.filter((m) => {
    const p = s.pieces[m.piece];
    const capture = s.sq[m.to] >= 0 || (isPawnType(p.type) && s.enPassant?.square === m.to);
    if (!capture) return true;
    if (p.type === 'king') return false; // kings cannot capture
    // You may not blow up your own king.
    return !blast(s, m.to).some((t) => { const id = s.sq[t]; return id >= 0 && s.pieces[id].owner === p.owner && s.pieces[id].type === 'king'; });
  }),
  afterMove: (s, prev) => {
    const l = s.last;
    if (!l?.captured || s.ply === prev.ply) return s;
    const n = withPieces(s, (pieces, sq) => {
      for (const t of blast(s, l.to)) {
        const id = sq[t];
        if (id < 0) continue;
        if (t !== l.to && isPawnType(pieces[id].type)) continue; // pawns next to the blast survive
        pieces[id].at = -1;
        sq[t] = -1;
      }
    });
    return setData(n, 'boom', { at: l.to, ply: s.ply });
  },
  checkEnd: (s) => {
    const alive = s.seats.filter((x) => royals(s, x.id).length > 0).map((x) => x.id);
    if (alive.length === 1) return { reason: 'mode-win', winners: alive };
    if (alive.length === 0) return { reason: 'mode-win', winners: [] };
    return undefined;
  },
};

// ---------- MODE-15 Giveaway ----------

const giveaway: RuleModule = {
  id: 'giveaway',
  noMaterialDraw: true,
  checkEnforced: () => false,
  filterMoves: (s, moves) => {
    const plain = moves.filter((m) => !m.castle);
    const caps = plain.filter((m) => s.sq[m.to] >= 0 || (isPawnType(s.pieces[m.piece].type) && s.enPassant?.square === m.to));
    return caps.length ? caps : plain;
  },
  // Run out of pieces (or moves) and you win.
  checkEnd: (s) => {
    for (const seat of s.seats) {
      if (!s.pieces.some((p) => p.at >= 0 && p.owner === seat.id)) return { reason: 'mode-win', winners: [seat.id] };
    }
    if (legalMoves(s, false).length === 0) return { reason: 'mode-win', winners: [s.turn] };
    return undefined;
  },
};

// ---------- MODE-16 Racing kings ----------

const RACING_FEN = '8/8/8/8/8/8/krbnNBRK/qrbnNBRQ w - - 0 1';
const onGoal = (s: GameState, p: PlayerId) => royals(s, p).some((k) => rankOf(s.board, k.at) === s.board.height - 1);
const givesCheck = (s: GameState, m: MoveAction) => {
  const n = makeMove(s, m);
  return inCheck(n, other(s, s.pieces[m.piece].owner));
};

/**
 * Racing kings (owner rule, 2026-11-18): reaching the top row is not a win yet. The other side
 * gets one turn to chase you off it, and on that turn (only) they may give check. If your king is
 * still on the top row and not in check after their turn, you win. Both kings up there: a draw.
 */
const racingKings: RuleModule = {
  id: 'racing-kings',
  noMaterialDraw: true,
  // No checks, except to chase a king that is sitting on the top row.
  filterMoves: (s, moves) => (onGoal(s, other(s, s.turn)) ? moves : moves.filter((m) => !givesCheck(s, m))),
  checkEnd: (s, prev) => {
    if (s.ply === prev.ply) return undefined;
    const mover = prev.turn;
    const waiting = s.turn; // the side that may have arrived earlier
    if (waiting === mover) return undefined;
    // The chaser had their turn: is the waiting king still up there and safe?
    if (onGoal(prev, waiting) && onGoal(s, waiting) && !inCheck(s, waiting)) {
      return { reason: 'mode-win', winners: onGoal(s, mover) ? [] : [waiting] };
    }
    return undefined;
  },
};

// ---------- MODE-18 Wrap-around ----------

const wrap: RuleModule = { id: 'wrap', filterMoves: (_s, moves) => moves.filter((m) => !m.castle) };

// ---------- MODE-21 Lava squares ----------

export interface Lava { squares: number[]; until: number }
export function lavaNow(s: GameState): number[] {
  const l = data<Lava | null>(s, 'lava', null);
  return l && s.ply < l.until ? l.squares : [];
}

/** Squares a straight-line move passes over (none for jumps). */
function between(s: GameState, from: number, to: number): number[] {
  const df = fileOf(s.board, to) - fileOf(s.board, from), dr = rankOf(s.board, to) - rankOf(s.board, from);
  if (!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return [];
  const n = Math.max(Math.abs(df), Math.abs(dr));
  const out: number[] = [];
  for (let i = 1; i < n; i++) out.push(step(s.board, from, (df / n) * i, (dr / n) * i));
  return out;
}

const lava: RuleModule = {
  id: 'lava',
  filterMoves: (s, moves) => {
    const hot = new Set(lavaNow(s));
    if (!hot.size) return moves;
    const kept = moves.filter((m) => {
      if (hot.has(m.to)) return false;
      const p = s.pieces[m.piece];
      const jumper = pieceType(p.type).moves.every((x) => x.kind === 'leap') && baseType(p.type) !== 'king';
      return jumper || !between(s, p.at, m.to).some((t) => hot.has(t));
    });
    return kept.length ? kept : moves;
  },
  // Every 5 full moves, 3 empty squares turn to lava for the next 5 full moves.
  afterMove: (s, prev) => {
    if (s.ply === prev.ply || s.ply % 10 !== 0) return s;
    const empty = s.sq.map((id, i) => (id < 0 && !s.board.blocked[i] ? i : -1)).filter((i) => i >= 0);
    const squares: number[] = [];
    for (let k = 0; k < 3 && empty.length; k++) squares.push(empty.splice(roll(s, empty.length, k), 1)[0]);
    return setData(s, 'lava', { squares, until: s.ply + 10 });
  },
};

// ---------- MODE-04 Horde ----------

const HORDE_FEN = 'rnbqkbnr/pppppppp/8/1PP2PP1/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1';
const horde: RuleModule = {
  id: 'horde',
  noMaterialDraw: true,
  // Black wins by capturing every White piece; White wins by checkmate.
  checkEnd: (s) => (s.pieces.some((p) => p.at >= 0 && p.owner === 'p1') ? undefined : { reason: 'mode-win', winners: ['p2'] }),
};

// ---------- MODE-24 Monster ----------

const MONSTER_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/4K3 w kq - 0 1';
const monster: RuleModule = {
  id: 'monster',
  noMaterialDraw: true,
  noRepetitionDraw: true,
  // White never captures the king between its two moves.
  filterMoves: (s, moves) => (s.turn !== 'p1' ? moves : moves.filter((m) => !(s.sq[m.to] >= 0 && s.pieces[s.sq[m.to]].type === 'king'))),
  afterMove: (s, prev) => {
    if (s.ply === prev.ply || prev.turn !== 'p1') return s;
    const second = data<boolean>(prev, 'monsterSecond', false);
    if (second) return setData(s, 'monsterSecond', false);
    return setData({ ...s, turn: 'p1' }, 'monsterSecond', true);
  },
};

// ---------- MODE-09 Shrinking board ----------

/** Plies until the next ring falls (or null when the board is as small as it gets). */
/** Plies between falls: every 15 full moves. */
export const SHRINK_EVERY = 30;
export function shrinkIn(s: GameState): number | null {
  const rings = data<number>(s, 'rings', 0);
  if (s.board.width !== 8 || rings >= 2) return null;
  return (rings + 1) * SHRINK_EVERY - s.ply;
}
export function ringSquares(s: GameState, ring: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.board.width * s.board.height; i++) {
    const f = fileOf(s.board, i), r = rankOf(s.board, i);
    if (Math.min(f, r, s.board.width - 1 - f, s.board.height - 1 - r) === ring) out.push(i);
  }
  return out;
}

const shrinking: RuleModule = {
  id: 'shrinking',
  afterMove: (s, prev) => {
    if (s.ply === prev.ply) return s;
    const rings = data<number>(s, 'rings', 0);
    if (rings >= 2 || s.ply !== (rings + 1) * SHRINK_EVERY) return s;
    const gone = ringSquares(s, rings);
    const goneSet = new Set(gone);
    const blocked = s.board.blocked.slice();
    const lostKings: PlayerId[] = [];
    let n = withPieces(s, (pieces, sq) => {
      for (const t of gone) blocked[t] = true;
      for (const t of gone) {
        const id = sq[t];
        if (id < 0) continue;
        sq[t] = -1;
        if (pieces[id].type === 'king') {
          // Kings jump to the nearest free square inside (owner rule from playtesting: no instant losses).
          const inside = sq.map((x, i) => (x < 0 && !blocked[i] && !goneSet.has(i) ? i : -1)).filter((i) => i >= 0);
          const d = (i: number) => Math.max(Math.abs(fileOf(s.board, i) - fileOf(s.board, t)), Math.abs(rankOf(s.board, i) - rankOf(s.board, t)));
          const to = inside.sort((a, b) => d(a) - d(b))[0];
          if (to !== undefined) { pieces[id].at = to; sq[to] = id; continue; }
          lostKings.push(pieces[id].owner);
        }
        pieces[id].at = -1;
      }
    });
    // Pawns now promote on the new edge.
    const seats: Seat[] = n.seats.map((x) => ({ ...x, promo: { ...x.promo, value: x.forward[1] > 0 ? 6 - rings : 1 + rings } }));
    n = { ...n, board: { ...n.board, blocked }, seats, enPassant: null };
    n = setData(n, 'rings', rings + 1);
    return lostKings.length ? setData(n, 'shrinkLost', lostKings) : n;
  },
  checkEnd: (s) => {
    const lost = data<PlayerId[]>(s, 'shrinkLost', []);
    if (!lost.length) return undefined;
    const winners = s.seats.map((x) => x.id).filter((id) => !lost.includes(id));
    return { reason: 'mode-win', winners: winners.length === 1 ? winners : [] };
  },
};

// ---------- MODE-17 Progressive ----------

export interface Progress { quota: number; left: number }
export function progressOf(s: GameState): Progress {
  return data<Progress>(s, 'prog', { quota: 1, left: 1 });
}
/** Owner rule: runs grow 1, 2, 3… up to 5 moves, and you may stop early. */
export const PROG_CAP = 5;
const nextQuota = (q: number) => Math.min(PROG_CAP, q + 1);

const progressive: RuleModule = {
  id: 'progressive',
  noRepetitionDraw: true,
  afterMove: (s, prev) => {
    // Only real moves count (ending your run early is not a move).
    if (s.ply === prev.ply || !s.last || s.last === prev.last) return s;
    const mover = prev.turn;
    const p = progressOf(prev);
    const left = p.left - 1;
    // Giving check ends the run at once.
    if (left > 0 && !inCheck(s, other(s, mover))) return setData({ ...s, turn: mover, enPassant: null }, 'prog', { quota: p.quota, left });
    const q = nextQuota(p.quota);
    return setData(s, 'prog', { quota: q, left: q });
  },
};

/** "That's enough": end your run before using every move (at least one move first). */
function progressiveStop(P: PlayerId): RuleModule {
  return {
    id: `STOP@${P}`,
    repeatable: true,
    applyBuff: (s) => {
      const p = progressOf(s);
      if (s.turn !== P) throw new Error('Not your turn');
      if (p.left >= p.quota) throw new Error('Make at least one move first');
      const q = nextQuota(p.quota);
      return setData({ ...s, ply: s.ply + 1, turn: other(s, P), enPassant: null, halfmoveClock: s.halfmoveClock + 1 }, 'prog', { quota: q, left: q });
    },
  };
}

// ---------- MODE-14 Drop-in ----------

/** Pieces waiting in a player's reserve (captured enemy pieces, now theirs). */
export function reserveOf(s: GameState, p: PlayerId): Piece[] {
  const ids = data<number[]>(s, 'reserve', []);
  return ids.map((id) => s.pieces[id]).filter((x) => x && x.owner === p && x.at < 0);
}

const dropIn: RuleModule = {
  id: 'drop-in',
  extraMoves: (s) => {
    const out: MoveAction[] = [];
    const seen = new Set<string>();
    for (const p of reserveOf(s, s.turn)) {
      if (seen.has(p.type)) continue; // one of each kind is enough
      seen.add(p.type);
      for (let i = 0; i < s.sq.length; i++) {
        if (s.sq[i] >= 0 || s.board.blocked[i]) continue;
        if (isPawnType(p.type) && (relRank(s, p.owner, i) === 0 || relRank(s, p.owner, i) === s.board.height - 1)) continue;
        out.push({ t: 'move', piece: p.id, to: i });
      }
    }
    return out;
  },
  afterMove: (s, prev) => {
    const l = s.last;
    if (!l || s.ply === prev.ply) return s;
    let n = s;
    const reserve = data<number[]>(s, 'reserve', []).filter((id) => id !== l.piece || s.pieces[id].at < 0);
    const promoted = new Set(data<number[]>(s, 'promoted', []));
    if (prev.pieces[l.piece].type !== s.pieces[l.piece].type && isPawnType(prev.pieces[l.piece].type)) promoted.add(l.piece);
    // Whatever was captured joins the capturer's reserve (promoted pieces go back to pawns).
    const victims = s.pieces.filter((p) => p.at < 0 && prev.pieces[p.id]?.at >= 0 && p.owner !== l.by);
    if (victims.length) {
      n = withPieces(s, (pieces) => {
        for (const v of victims) {
          pieces[v.id].owner = l.by;
          pieces[v.id].type = promoted.has(v.id) ? 'pawn' : baseType(v.type) === 'king' ? v.type : baseType(v.type);
          pieces[v.id].moved = true;
          promoted.delete(v.id);
          reserve.push(v.id);
        }
      });
    }
    n = setData(n, 'promoted', [...promoted]);
    return setData(n, 'reserve', reserve.filter((id) => n.pieces[id].at < 0));
  },
};

// ---------- MODE-08 Boss battle ----------

export function bossLives(s: GameState): number {
  return data<number>(s, 'bossLives', 3);
}
const bossBattle: RuleModule = {
  id: 'boss',
  afterMove: (s, prev) => {
    const boss = s.pieces.find((p) => p.type === 'boss');
    if (!boss || boss.at >= 0 || prev.pieces[boss.id]?.at < 0) return s;
    const lives = bossLives(s) - 1;
    if (lives <= 0) return setData(s, 'bossLives', 0);
    // Back to its home square, or the nearest empty square.
    let to = s.sq[boss.home] < 0 ? boss.home : -1;
    if (to < 0) {
      const empty = s.sq.map((id, i) => (id < 0 && !s.board.blocked[i] ? i : -1)).filter((i) => i >= 0);
      const d = (i: number) => Math.max(Math.abs(fileOf(s.board, i) - fileOf(s.board, boss.home)), Math.abs(rankOf(s.board, i) - rankOf(s.board, boss.home)));
      to = empty.sort((a, b) => d(a) - d(b))[0] ?? -1;
    }
    let n = setData(s, 'bossLives', lives);
    if (to >= 0) n = withPieces(n, (pieces, sq) => { pieces[boss.id].at = to; sq[to] = boss.id; });
    return n;
  },
  checkEnd: (s) => {
    const boss = s.pieces.find((p) => p.type === 'boss');
    if (boss && bossLives(s) <= 0) return { reason: 'mode-win', winners: [other(s, boss.owner)] };
    return undefined;
  },
};

// ---------- MODE-19 Hidden queen ----------

/** Each player's secret queen: a piece id, 'hidden' (someone else's, not shown to you) or 'revealed'. */
export function hiddenQueens(s: GameState): Partial<Record<PlayerId, number | 'hidden' | 'revealed'>> {
  return data(s, 'hiddenQueen', {});
}
const QUEEN_DIRS: [number, number][] = NEAR;

function hiddenQueen(P: PlayerId): RuleModule {
  return {
    id: `MODE-19@${P}`,
    // Mark a pawn before your first move. Free action. Online, the other player only learns "a pawn was marked".
    applyBuff: (s, a) => {
      if (hiddenQueens(s)[P] !== undefined) throw new Error('You already picked your secret queen');
      if (a.piece === undefined) return setData(s, 'hiddenQueen', { ...hiddenQueens(s), [P]: 'hidden' });
      const p = s.pieces[a.piece];
      if (!p || p.at < 0 || p.owner !== P || p.type !== 'pawn') throw new Error('Pick one of your pawns');
      return setData(s, 'hiddenQueen', { ...hiddenQueens(s), [P]: p.id });
    },
    extraMoves: (s) => {
      const mark = hiddenQueens(s)[P];
      if (s.turn !== P || mark === undefined || mark === 'revealed') return [];
      const pawns = mark === 'hidden' ? s.pieces.filter((p) => p.at >= 0 && p.owner === P && p.type === 'pawn') : [s.pieces[mark]].filter((p) => p && p.at >= 0 && p.type === 'pawn');
      const out: MoveAction[] = [];
      for (const p of pawns) {
        const normal = new Set(pseudoMovesFor(s, p).map((m) => m.to));
        for (const [x, y] of QUEEN_DIRS) {
          let t = p.at;
          for (;;) {
            t = step(s.board, t, x, y);
            if (t < 0) break;
            const id = s.sq[t];
            if (id >= 0 && (s.pieces[id].owner === P || s.pieces[id].type === 'king')) break;
            if (!normal.has(t)) out.push({ t: 'move', piece: p.id, to: t });
            if (id >= 0) break;
          }
        }
      }
      return out;
    },
    // Moving as a queen reveals it: from then on it is a real queen.
    afterMove: (s, prev) => {
      const l = s.last;
      if (!l || l.by !== P || s.ply === prev.ply) return s;
      const mark = hiddenQueens(prev)[P];
      if (mark === undefined || mark === 'revealed' || prev.pieces[l.piece].type !== 'pawn') return s;
      const normal = pseudoMovesFor(prev, prev.pieces[l.piece]).some((m) => m.to === l.to);
      if (normal) return s;
      const n = withPieces(s, (pieces) => { pieces[l.piece].type = 'queen'; });
      return setData(n, 'hiddenQueen', { ...hiddenQueens(s), [P]: 'revealed' });
    },
  };
}

// ---------- MODE-12 Endgame survival ----------

const survival: RuleModule = {
  id: 'survival',
  noMaterialDraw: false,
  // Hold out for 20 of your moves (a draw counts as holding out too).
  checkEnd: (s) => {
    const who = data<PlayerId | null>(s, 'survivor', null);
    const start = data<number>(s, 'surviveFrom', 0);
    if (who && s.ply - start >= 40) return { reason: 'mode-win', winners: [who] };
    return undefined;
  },
};

// ---------- Setups ----------

/** Draft and Mystery army: put a list of pieces on a player's first two rows. */
const VALUE: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9 };
export const DRAFT_BUDGET = 30;
export function armyCost(types: string[]): number {
  return types.reduce((a, t) => a + (VALUE[t] ?? 99), 0);
}
/** Back row centre-out, pawns on the second row centre-out; spill-over goes to the other row. */
function placeArmy(s: GameState, owner: PlayerId, types: string[]) {
  const back = owner === 'p1' ? 0 : 7;
  const front = owner === 'p1' ? 1 : 6;
  const files = [3, 5, 2, 6, 1, 7, 0];
  const pawnFiles = [4, 3, 5, 2, 6, 1, 7, 0];
  const free = (r: number, f: number) => s.sq[r * 8 + f] < 0;
  addPiece(s, 'king', owner, back * 8 + 4, true);
  const sorted = [...types].sort((a, b) => (VALUE[b] ?? 0) - (VALUE[a] ?? 0));
  for (const t of sorted) {
    const rows = t === 'pawn' ? [front, back] : [back, front];
    let placed = false;
    for (const r of rows) {
      for (const f of t === 'pawn' ? pawnFiles : files) {
        if (free(r, f)) { addPiece(s, t, owner, r * 8 + f, t !== 'pawn' || r !== front); placed = true; break; }
      }
      if (placed) break;
    }
  }
}

/** A random army worth `budget` points (no more than 15 pieces besides the king). */
export function randomArmy(budget: number, pick: (n: number) => number, minPawns = 0): string[] {
  // A few pawns first, so the king has a wall (playtesting: armies with no pawns lost in 2 moves).
  const out: string[] = Array(Math.min(minPawns, budget)).fill('pawn');
  let left = budget - out.length;
  const kinds = ['queen', 'rook', 'bishop', 'knight', 'pawn'];
  while (left > 0 && out.length < 15) {
    const ok = kinds.filter((k) => VALUE[k] <= left && !(k === 'queen' && out.filter((x) => x === 'queen').length >= 2));
    const k = ok[pick(ok.length)];
    out.push(k);
    left -= VALUE[k];
  }
  return out;
}

function armies(s: GameState, a: Partial<Record<PlayerId, string[]>>): GameState {
  const n = emptyState(8, 8, s.seats.map((x) => ({ ...x })), s.rng);
  placeArmy(n, 'p1', a.p1 ?? []);
  placeArmy(n, 'p2', a.p2 ?? []);
  return fresh({ ...n, mode: s.mode, rules: s.rules, modeData: s.modeData });
}

export const MODE_SETUP_2: Record<string, (s: GameState, pick: (n: number) => number, extra: ModeExtra) => GameState> = {
  'racing-kings': (s) => fromFenKeep(s, RACING_FEN),
  horde: (s) => fromFenKeep(s, HORDE_FEN),
  monster: (s) => fromFenKeep(s, MONSTER_FEN),
  wrap: (s) => fresh({ ...s, board: { ...s.board, wrapFiles: true }, pieces: s.pieces.map((p) => (p.type === 'king' || p.type === 'rook' ? { ...p, moved: true } : p)) }),
  giveaway: (s) => fresh({ ...s, pieces: s.pieces.map((p) => (p.type === 'king' ? { ...p, type: 'commoner' } : p)) }),
  mini: (s) => {
    const seats: Seat[] = s.seats.map((x) => ({ ...x, promo: { ...x.promo, value: x.forward[1] > 0 ? 4 : 0 } }));
    const n = emptyState(5, 5, seats, s.rng);
    ['rook', 'knight', 'bishop', 'queen', 'king'].forEach((t, f) => {
      addPiece(n, t, 'p1', f, true);
      addPiece(n, t, 'p2', 4 * 5 + f, true);
    });
    for (let f = 0; f < 5; f++) { addPiece(n, 'pawn-slow', 'p1', 5 + f); addPiece(n, 'pawn-slow', 'p2', 3 * 5 + f); }
    return fresh({ ...n, mode: s.mode, rules: s.rules, modeData: s.modeData });
  },
  boss: (s, _pick, extra) => {
    // The boss side keeps its king, its pawns and the Boss (on the queen's square).
    // (Playtesting: a king and a Boss alone won 2 games in 21.)
    const side = extra.boss ?? 'p2';
    const n = withPieces(s, (pieces, sq) => {
      for (const p of pieces) {
        if (p.owner !== side || p.type === 'king' || p.type === 'pawn' || p.at < 0) continue;
        if (p.type === 'queen') { p.type = 'boss'; continue; }
        sq[p.at] = -1;
        p.at = -1;
      }
    });
    return fresh(setData(n, 'bossLives', 3));
  },
  'mystery-army': (s, pick) => {
    const army = randomArmy(39, pick, 5);
    return armies(s, { p1: army, p2: army });
  },
  draft: (s, pick, extra) => armies(s, { p1: extra.armies?.p1 ?? randomArmy(DRAFT_BUDGET, pick), p2: extra.armies?.p2 ?? randomArmy(DRAFT_BUDGET, pick) }),
  survival: (s, _pick, extra) => {
    const n = extra.fen ? fromFenKeep(s, extra.fen) : s;
    return setData(setData(n, 'survivor', extra.survivor ?? n.turn), 'surviveFrom', n.ply);
  },
};

export const MODE_MODULES_2: Record<string, RuleModule[]> = {
  atomic: [atomic],
  giveaway: [giveaway],
  'racing-kings': [racingKings],
  wrap: [wrap],
  lava: [lava],
  mini: [],
  horde: [horde],
  monster: [monster],
  shrinking: [shrinking],
  progressive: [progressive, progressiveStop('p1'), progressiveStop('p2')],
  'drop-in': [dropIn],
  boss: [bossBattle],
  'mystery-army': [],
  draft: [],
  'hidden-queen': [hiddenQueen('p1'), hiddenQueen('p2')],
  survival: [survival],
};


// ---------- Card chess (owner's mode): draw 3, move a piece that matches a card ----------

/** Card chess state: each player's hand (piece kinds) and draw pile. Hands are public. */
export interface CardChess { hands: Record<string, string[]>; decks: Record<string, string[]>; bonus: boolean }
export const CC_HAND = 3;
const CARD_KINDS = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

export function cardChessOf(s: GameState): CardChess {
  return data<CardChess>(s, 'cc', { hands: {}, decks: {}, bonus: false });
}

/** A fresh deck with one card per piece you still have (8 pawns → 8 pawn cards), shuffled from the seed. */
function newDeck(s: GameState, p: PlayerId, salt: number): string[] {
  const cards = s.pieces.filter((x) => x.at >= 0 && x.owner === p).map((x) => baseType(x.type)).filter((t) => CARD_KINDS.includes(t));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = roll(s, i + 1, salt * 31 + i);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function drawUp(s: GameState, cc: CardChess, p: PlayerId): CardChess {
  const hand = [...(cc.hands[p] ?? [])];
  let deck = [...(cc.decks[p] ?? [])];
  let salt = 1;
  while (hand.length < CC_HAND) {
    if (!deck.length) deck = newDeck(s, p, salt++ + hand.length * 7 + (p === 'p1' ? 0 : 50));
    if (!deck.length) break;
    hand.push(deck.shift()!);
  }
  return { ...cc, hands: { ...cc.hands, [p]: hand }, decks: { ...cc.decks, [p]: deck } };
}

/** Three of the same card: your move with that kind earns a second move straight away. */
export function hasTriple(hand: string[]): string | null {
  for (const k of CARD_KINDS) if (hand.filter((c) => c === k).length >= 3) return k;
  return null;
}

/** Moves your cards allow (any move when in check, or when no card can move). */
export function cardMoves(s: GameState, moves: MoveAction[], p: PlayerId): MoveAction[] {
  if (inCheck(s, p)) return moves;
  const hand = new Set(cardChessOf(s).hands[p] ?? []);
  const ok = moves.filter((m) => hand.has(baseType(s.pieces[m.piece].type)));
  return ok.length ? ok : moves;
}

function cardChess(P: PlayerId): RuleModule {
  return {
    id: `DRAW@${P}`,
    repeatable: true,
    filterMoves: (s, moves) => (s.turn === P ? cardMoves(s, moves, P) : moves),
    // Discard one card instead of moving (it uses your turn), then draw back up to 3.
    applyBuff: (s, a) => {
      const cc = cardChessOf(s);
      const hand = [...(cc.hands[P] ?? [])];
      const i = a.target ?? -1;
      if (i < 0 || i >= hand.length) throw new Error('Pick a card to throw away');
      if (inCheck(s, P)) throw new Error('You are in check: you must move');
      hand.splice(i, 1);
      const next = drawUp(s, { ...cc, hands: { ...cc.hands, [P]: hand }, bonus: false }, P);
      const n = setData(s, 'cc', next);
      return { ...n, ply: s.ply + 1, turn: other(s, P), enPassant: null, halfmoveClock: s.halfmoveClock + 1 };
    },
    afterMove: (s, prev) => {
      const l = s.last;
      if (!l || l.by !== P || s.ply === prev.ply || prev.turn !== P) return s;
      const cc = cardChessOf(prev);
      const hand = [...(cc.hands[P] ?? [])];
      const kind = baseType(prev.pieces[l.piece].type);
      const triple = hasTriple(hand);
      const i = hand.indexOf(kind);
      if (i >= 0) hand.splice(i, 1);
      // Three of a kind, played: move again before drawing (once per turn, and not out of a check you just gave).
      if (triple === kind && !cc.bonus && !s.result && !inCheck(s, other(s, P))) {
        return setData({ ...s, turn: P, enPassant: null }, 'cc', { ...cc, hands: { ...cc.hands, [P]: hand }, bonus: true });
      }
      return setData(s, 'cc', drawUp(s, { ...cc, hands: { ...cc.hands, [P]: hand }, bonus: false }, P));
    },
  };
}

MODE_MODULES_2['card-chess'] = [cardChess('p1'), cardChess('p2')];
MODE_SETUP_2['card-chess'] = (s) => {
  let cc: CardChess = { hands: {}, decks: {}, bonus: false };
  cc = drawUp(s, cc, 'p1');
  cc = drawUp(s, cc, 'p2');
  return setData(s, 'cc', cc);
};

// ---------- MODE-30 Paint the board (2 to 4 players) ----------

/** Owner of each painted square ('' = not painted). */
export function paintOf(s: GameState): string[] {
  return data<string[]>(s, 'paint', []);
}
export const PAINT_ROUNDS = 30;
/** Squares painted per player. */
export function paintScores(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const seat of s.seats) out[seat.id] = 0;
  for (const p of paintOf(s)) if (p && out[p] !== undefined) out[p]++;
  return out;
}
/** Rounds played so far (a round = everyone still in the game moved once). */
export function paintRound(s: GameState): number {
  const n = data<number>(s, 'paintPlayers', s.seats.length);
  return Math.floor(s.ply / n);
}

const paint: RuleModule = {
  id: 'paint',
  afterMove: (s, prev) => {
    const l = s.last;
    if (!l || s.ply === prev.ply || l === prev.last) return s;
    const board = paintOf(s).slice();
    board[l.to] = l.by;
    // A knocked-out army's colour washes off the board.
    const out = new Set(s.seats.filter((x) => x.status === 'eliminated').map((x) => x.id));
    for (let i = 0; i < board.length; i++) if (board[i] && out.has(board[i] as PlayerId)) board[i] = '';
    let n = setData(s, 'paint', board);
    if (prev.modeData?.paintPlayers === undefined) n = setData(n, 'paintPlayers', s.seats.length);
    return n;
  },
  checkEnd: (s) => {
    if (paintRound(s) < PAINT_ROUNDS) return undefined;
    const scores = paintScores(s);
    const alive = s.seats.filter((x) => x.status !== 'eliminated').map((x) => x.id);
    const best = Math.max(...alive.map((k) => scores[k] ?? 0));
    const winners = alive.filter((k) => scores[k] === best);
    return { reason: 'mode-win', winners: winners.length === 1 ? winners : [] };
  },
};

// ---------- MINI-01 Pawn wars ----------

const PAWN_WARS_FEN = '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1';
/** Pawns only (and kings, so the usual rules still hold): the first pawn to reach the far row wins. */
const pawnWars: RuleModule = {
  id: 'pawn-wars',
  noMaterialDraw: true,
  checkEnd: (s, prev) => {
    const l = s.last;
    if (!l || s.ply === prev.ply) return undefined;
    if (prev.pieces[l.piece]?.type === 'pawn' && s.pieces[l.piece].type !== 'pawn') return { reason: 'mode-win', winners: [l.by] };
    // Out of pawns with no way to promote: the side with pawns left wins.
    const pawns = (p: PlayerId) => s.pieces.some((x) => x.at >= 0 && x.owner === p && x.type === 'pawn');
    if (!pawns('p1') && pawns('p2')) return { reason: 'mode-win', winners: ['p2'] };
    if (!pawns('p2') && pawns('p1')) return { reason: 'mode-win', winners: ['p1'] };
    return undefined;
  },
};

MODE_MODULES_2.paint = [paint];
MODE_MODULES_2['battle-paint'] = [paint];
MODE_MODULES_2['pawn-wars'] = [pawnWars];
MODE_SETUP_2['pawn-wars'] = (s) => fromFenKeep(s, PAWN_WARS_FEN);
