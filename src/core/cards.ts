import { fileOf, isPromotionSquare, rankOf, seatOf, step } from './board';
import { inCheck, nextSeat } from './movegen';
import { baseType } from './pieces';
import type { RuleModule } from './rules';
import type { GameState, Piece, PlayerId } from './types';

/**
 * Power cards (docs/02 s6, docs/03 Cards) as rule modules. A card in a
 * player's hand is attached as "CARD-xx@player" in GameState.rules and played
 * with a `buff` action carrying the card id, so it is used once (then burned)
 * and every game still replays exactly. One card per turn.
 *
 * Upgrade and Summon cards use the player's move; Effect cards do not, unless
 * the catalog says so (Teleporter, Twin).
 */

const UPGRADES: Record<string, { from: string[]; to: string }> = {
  'CARD-01': { from: ['rook'], to: 'chancellor' },
  'CARD-02': { from: ['bishop'], to: 'archbishop' },
  'CARD-03': { from: ['queen'], to: 'amazon' },
  'CARD-04': { from: ['pawn'], to: 'super-pawn' },
  'CARD-05': { from: ['rook'], to: 'jumper-rook' },
  'CARD-06': { from: ['bishop'], to: 'ghost-bishop' },
  'CARD-07': { from: ['knight'], to: 'nightrider' },
  'CARD-09': { from: ['rook'], to: 'cannon' },
  'CARD-13': { from: ['knight'], to: 'camel' },
  'CARD-14': { from: ['pawn'], to: 'grasshopper' },
  'CARD-15': { from: ['rook'], to: 'dragon-rook' },
  'CARD-16': { from: ['bishop'], to: 'dragon-bishop' },
  'CARD-17': { from: ['pawn'], to: 'lance' },
  'CARD-24': { from: ['pawn'], to: 'guard' },
  'CARD-25': { from: ['king'], to: 'knight-king' },
  'CARD-26': { from: ['king'], to: 'long-king' },
  'CARD-27': { from: ['queen'], to: 'ghost-queen' },
  'CARD-28': { from: ['queen'], to: 'leaping-queen' },
  'CARD-29': { from: ['king'], to: 'hop-king' },
  'CARD-30': { from: ['king'], to: 'hill-king' },
};

/** Cards the engine can play. CARD-23 Decoy king needs hidden information and is not built yet. */
export const PLAYABLE_CARDS = new Set([...Object.keys(UPGRADES), 'CARD-08', 'CARD-10', 'CARD-11', 'CARD-12', 'CARD-18', 'CARD-19', 'CARD-20', 'CARD-21', 'CARD-22']);

// ---------- helpers ----------

function data<T>(s: GameState, key: string, fallback: T): T {
  return (s.modeData?.[key] as T | undefined) ?? fallback;
}
function setData(s: GameState, key: string, value: unknown): GameState {
  return { ...s, modeData: { ...(s.modeData ?? {}), [key]: value } };
}

/** Rank counted from the player's own back row (0) forward. */
function relRank(s: GameState, p: PlayerId, sq: number): number {
  const seat = seatOf(s, p);
  const b = s.board;
  if (seat.forward[1] > 0) return rankOf(b, sq);
  if (seat.forward[1] < 0) return b.height - 1 - rankOf(b, sq);
  if (seat.forward[0] > 0) return fileOf(b, sq);
  return b.width - 1 - fileOf(b, sq);
}
function depth(s: GameState, p: PlayerId): number {
  const seat = seatOf(s, p);
  return seat.forward[1] !== 0 ? s.board.height : s.board.width;
}

function own(s: GameState, P: PlayerId, id: number | undefined, what = 'one of your pieces'): Piece {
  const p = id === undefined ? undefined : s.pieces[id];
  if (!p || p.at < 0 || p.owner !== P) throw new Error(`Pick ${what}`);
  return p;
}
function enemy(s: GameState, P: PlayerId, id: number | undefined): Piece {
  const p = id === undefined ? undefined : s.pieces[id];
  if (!p || p.at < 0 || p.owner === P) throw new Error('Pick an enemy piece');
  if (p.type === 'king') throw new Error('Not the king');
  if (p.type === 'wall') throw new Error('Walls cannot be moved');
  return p;
}
function empty(s: GameState, sq: number | undefined): number {
  if (sq === undefined || sq < 0 || s.board.blocked[sq] || s.sq[sq] >= 0) throw new Error('Pick an empty square');
  return sq;
}

function withPieces(s: GameState, fn: (pieces: Piece[], sq: number[]) => void): GameState {
  const pieces = s.pieces.map((p) => ({ ...p }));
  const sq = s.sq.slice();
  fn(pieces, sq);
  return { ...s, pieces, sq };
}
function moveTo(pieces: Piece[], sq: number[], id: number, to: number) {
  const p = pieces[id];
  if (p.at >= 0) sq[p.at] = -1;
  sq[to] = id;
  p.at = to;
  p.moved = true;
}
function remove(pieces: Piece[], sq: number[], id: number) {
  const p = pieces[id];
  if (p.at >= 0) sq[p.at] = -1;
  p.at = -1;
}

function safe(n: GameState, P: PlayerId): GameState {
  if (inCheck(n, P)) throw new Error('That would leave your king in danger');
  return n;
}

/** End the turn for cards that use the move. */
function endTurn(prev: GameState, n: GameState, by: PlayerId, piece: number, from: number, to: number): GameState {
  return { ...n, ply: prev.ply + 1, turn: nextSeat(n, by), enPassant: null, halfmoveClock: prev.halfmoveClock + 1, last: { piece, type: n.pieces[piece].type, by, from, to } };
}

/** One card per turn. */
function oncePerTurn(s: GameState): GameState {
  if (data<number>(s, 'cardPly', -1) === s.ply) throw new Error('Only one card per turn');
  return setData(s, 'cardPly', s.ply);
}

/** How many plies make "N of your turns" (every seat moves once per round). */
function turns(s: GameState, n: number): number {
  return s.seats.filter((x) => x.status === 'active').length * n;
}

interface Timed { piece: number; until: number; owner: PlayerId }
function live(s: GameState, key: string): Timed[] {
  return data<Timed[]>(s, key, []).filter((t) => s.ply < t.until);
}

// ---------- the cards ----------

function upgrade(id: string, P: PlayerId): RuleModule {
  const u = UPGRADES[id];
  return {
    id: `${id}@${P}`,
    applyBuff: (s, a) => {
      const p = own(s, P, a.piece, `your ${u.from.join(' or ')}`);
      if (!u.from.includes(p.type)) throw new Error(`Pick your ${u.from.join(' or ')}`);
      if (inCheck(s, P)) throw new Error('Get out of check first');
      const n = withPieces(oncePerTurn(s), (pieces) => { pieces[p.id].type = u.to; });
      return endTurn(s, safe(n, P), P, p.id, p.at, p.at);
    },
    // CARD-03: the Amazon turns back into a queen after its first capture.
    afterMove: id === 'CARD-03' ? (s, prev) => {
      const l = s.last;
      if (!l || s.ply === prev.ply || l.by !== P || !l.captured || s.pieces[l.piece]?.type !== 'amazon') return s;
      return withPieces(s, (pieces) => { pieces[l.piece].type = 'queen'; });
    } : undefined,
  };
}

const F: Record<string, (P: PlayerId) => RuleModule> = {
  // CARD-08 Bodyguard: for your next 5 turns, your pieces next to it cannot be captured.
  'CARD-08': (P) => ({
    id: `CARD-08@${P}`,
    applyBuff: (s, a) => {
      const p = own(s, P, a.piece, 'your knight or bishop');
      if (p.type !== 'knight' && p.type !== 'bishop') throw new Error('Pick your knight or bishop');
      if (inCheck(s, P)) throw new Error('Get out of check first');
      let n = oncePerTurn(s);
      n = setData(n, 'bodyguard', [...live(s, 'bodyguard'), { piece: p.id, until: s.ply + turns(s, 5), owner: P }]);
      return endTurn(s, n, P, p.id, p.at, p.at);
    },
    filterMoves: (s, moves) => {
      if (s.turn === P) return moves;
      const guards = live(s, 'bodyguard').filter((g) => g.owner === P && s.pieces[g.piece].at >= 0);
      if (!guards.length) return moves;
      const safeSq = new Set<number>();
      for (const g of guards) {
        const at = s.pieces[g.piece].at;
        for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const t = step(s.board, at, x, y);
          if (t >= 0) safeSq.add(t);
        }
      }
      return moves.filter((m) => !(safeSq.has(m.to) && s.sq[m.to] >= 0 && s.pieces[s.sq[m.to]].owner === P && s.pieces[s.sq[m.to]].type !== 'king'));
    },
  }),

  // CARD-10 Wall: a blocker on an empty square in your half, gone after 3 of your turns.
  'CARD-10': (P) => ({
    id: `CARD-10@${P}`,
    applyBuff: (s, a) => {
      const to = empty(s, a.to);
      if (relRank(s, P, to) >= depth(s, P) / 2) throw new Error('Walls go in your half of the board');
      const id = s.pieces.length;
      let n = withPieces(oncePerTurn(s), (pieces, sq) => {
        pieces.push({ id, type: 'wall', owner: P, home: to, at: to, moved: true });
        sq[to] = id;
      });
      n = setData(n, 'walls', [...data<Timed[]>(s, 'walls', []), { piece: id, until: s.ply + turns(s, 3), owner: P }]);
      return endTurn(s, safe(n, P), P, id, to, to);
    },
    filterMoves: (s, moves) => moves.filter((m) => !(s.sq[m.to] >= 0 && s.pieces[s.sq[m.to]].type === 'wall')),
    afterMove: (s) => {
      const walls = data<Timed[]>(s, 'walls', []);
      const gone = walls.filter((w) => w.owner === P && s.ply >= w.until && s.pieces[w.piece].at >= 0);
      if (!gone.length) return s;
      const n = withPieces(s, (pieces, sq) => gone.forEach((w) => remove(pieces, sq, w.piece)));
      return setData(n, 'walls', walls.filter((w) => !gone.includes(w)));
    },
  }),

  // CARD-11 Teleporter: move a piece to any empty square. No check. Uses your move.
  'CARD-11': (P) => ({
    id: `CARD-11@${P}`,
    applyBuff: (s, a) => {
      const p = own(s, P, a.piece, 'one of your pieces (not the king)');
      if (p.type === 'king' || p.type === 'wall') throw new Error('Not the king');
      const to = empty(s, a.to);
      if (baseType(p.type) === 'pawn' && (relRank(s, P, to) === 0 || isPromotionSquare(s.board, seatOf(s, P), to))) throw new Error('Pawns cannot go to the first or last row');
      const n = safe(withPieces(oncePerTurn(s), (pieces, sq) => moveTo(pieces, sq, p.id, to)), P);
      for (const seat of n.seats) if (seat.id !== P && seat.status === 'active' && inCheck(n, seat.id)) throw new Error('A teleport cannot give check');
      return endTurn(s, n, P, p.id, p.at, to);
    },
  }),

  // CARD-12 Twin: rook → two knights, or two knights → one rook. Uses your move.
  'CARD-12': (P) => ({
    id: `CARD-12@${P}`,
    applyBuff: (s, a) => {
      const p = own(s, P, a.piece, 'your rook or a knight');
      if (inCheck(s, P)) throw new Error('Get out of check first');
      if (p.type === 'rook') {
        const to = empty(s, a.to);
        const df = Math.abs(fileOf(s.board, to) - fileOf(s.board, p.at)), dr = Math.abs(rankOf(s.board, to) - rankOf(s.board, p.at));
        if (df > 1 || dr > 1) throw new Error('The second knight goes on an empty square next to the rook');
        const id = s.pieces.length;
        const n = withPieces(oncePerTurn(s), (pieces, sq) => {
          pieces[p.id].type = 'knight';
          pieces.push({ id, type: 'knight', owner: P, home: to, at: to, moved: true });
          sq[to] = id;
        });
        return endTurn(s, safe(n, P), P, p.id, p.at, p.at);
      }
      if (p.type === 'knight') {
        const other = own(s, P, a.target, 'your other knight');
        if (other.type !== 'knight' || other.id === p.id) throw new Error('Pick your other knight');
        const n = withPieces(oncePerTurn(s), (pieces, sq) => {
          pieces[p.id].type = 'rook';
          pieces[p.id].moved = true;
          remove(pieces, sq, other.id);
        });
        return endTurn(s, safe(n, P), P, p.id, p.at, p.at);
      }
      throw new Error('Pick your rook or a knight');
    },
  }),

  // CARD-18 Phoenix: the first time the marked piece is captured, it returns home (if empty).
  'CARD-18': (P) => ({
    id: `CARD-18@${P}`,
    applyBuff: (s, a) => {
      const p = own(s, P, a.piece, 'one of your pieces (not the king)');
      if (p.type === 'king' || p.type === 'wall') throw new Error('Not the king');
      return setData(oncePerTurn(s), 'phoenix', [...data<number[]>(s, 'phoenix', []), p.id]);
    },
    afterMove: (s, prev) => {
      const marks = data<number[]>(s, 'phoenix', []);
      const hit = marks.find((id) => s.pieces[id]?.owner === P && prev.pieces[id]?.at >= 0 && s.pieces[id].at < 0);
      if (hit === undefined) return s;
      const home = s.pieces[hit].home;
      let n = setData(s, 'phoenix', marks.filter((id) => id !== hit));
      if (s.sq[home] < 0 && !s.board.blocked[home]) n = withPieces(n, (pieces, sq) => { moveTo(pieces, sq, hit, home); });
      return n;
    },
  }),

  // CARD-19 Bomb pawn: when the marked pawn is captured, the capturer goes too (not a king).
  'CARD-19': (P) => ({
    id: `CARD-19@${P}`,
    applyBuff: (s, a) => {
      const p = own(s, P, a.piece, 'one of your pawns');
      if (baseType(p.type) !== 'pawn') throw new Error('Pick one of your pawns');
      return setData(oncePerTurn(s), 'bombs', [...data<number[]>(s, 'bombs', []), p.id]);
    },
    afterMove: (s, prev) => {
      const bombs = data<number[]>(s, 'bombs', []);
      const hit = bombs.find((id) => s.pieces[id]?.owner === P && prev.pieces[id]?.at >= 0 && s.pieces[id].at < 0);
      if (hit === undefined) return s;
      let n = setData(s, 'bombs', bombs.filter((id) => id !== hit));
      const l = s.last;
      if (l && l.to === prev.pieces[hit].at && n.pieces[l.piece]?.type !== 'king') {
        n = withPieces(n, (pieces, sq) => remove(pieces, sq, l.piece));
        n = setData(n, 'boom', { at: l.to, ply: s.ply });
      }
      return n;
    },
  }),

  // CARD-20 Magnet: pull an enemy piece one square closer along a clear line.
  'CARD-20': (P) => ({
    id: `CARD-20@${P}`,
    applyBuff: (s, a) => {
      const me = own(s, P, a.piece);
      const t = enemy(s, P, a.target);
      const df = fileOf(s.board, me.at) - fileOf(s.board, t.at), dr = rankOf(s.board, me.at) - rankOf(s.board, t.at);
      if (!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) throw new Error('They must be on the same row, column or diagonal');
      const x = Math.sign(df), y = Math.sign(dr);
      let sq = step(s.board, t.at, x, y);
      const first = sq;
      while (sq >= 0 && sq !== me.at) {
        if (s.sq[sq] >= 0) throw new Error('The line between them must be empty');
        sq = step(s.board, sq, x, y);
      }
      if (first === me.at) throw new Error('It is already next to your piece');
      const n = withPieces(oncePerTurn(s), (pieces, sqs) => moveTo(pieces, sqs, t.id, first));
      return safe(n, P);
    },
  }),

  // CARD-21 Battering ram: push an enemy piece next to your rook one square away.
  'CARD-21': (P) => ({
    id: `CARD-21@${P}`,
    applyBuff: (s, a) => {
      const r = own(s, P, a.piece, 'your rook');
      if (baseType(r.type) !== 'rook') throw new Error('Pick your rook');
      const t = enemy(s, P, a.target);
      const df = fileOf(s.board, t.at) - fileOf(s.board, r.at), dr = rankOf(s.board, t.at) - rankOf(s.board, r.at);
      if (Math.abs(df) + Math.abs(dr) !== 1) throw new Error('The enemy must be right next to your rook (not diagonal)');
      const to = step(s.board, t.at, df, dr);
      if (to < 0 || s.sq[to] >= 0) throw new Error('There is no room to push it');
      const n = withPieces(oncePerTurn(s), (pieces, sq) => moveTo(pieces, sq, t.id, to));
      return safe(n, P);
    },
  }),

  // CARD-22 Medic: bring back one of your captured pawns next to a bishop.
  'CARD-22': (P) => ({
    id: `CARD-22@${P}`,
    applyBuff: (s, a) => {
      const b = own(s, P, a.piece, 'your bishop');
      if (baseType(b.type) !== 'bishop') throw new Error('Pick your bishop');
      const to = empty(s, a.to);
      const df = Math.abs(fileOf(s.board, to) - fileOf(s.board, b.at)), dr = Math.abs(rankOf(s.board, to) - rankOf(s.board, b.at));
      if (df > 1 || dr > 1) throw new Error('Pick an empty square next to the bishop');
      if (relRank(s, P, to) === 0 || isPromotionSquare(s.board, seatOf(s, P), to)) throw new Error('Not on the first or last row');
      const pawn = s.pieces.find((p) => p.owner === P && p.at < 0 && p.type === 'pawn');
      if (!pawn) throw new Error('None of your pawns have been captured');
      const n = withPieces(oncePerTurn(s), (pieces, sq) => moveTo(pieces, sq, pawn.id, to));
      return safe(n, P);
    },
  }),
};

/** The rule module for "CARD-xx@player", or undefined when it is not a card. */
export function cardModule(rule: string): RuleModule | undefined {
  const [id, who] = rule.split('@');
  const m = UPGRADES[id] ? upgrade(id, who as PlayerId) : F[id]?.(who as PlayerId);
  if (!m?.applyBuff) return m;
  const apply = m.applyBuff;
  // Say "one card per turn" before any other complaint.
  return { ...m, applyBuff: (s, a) => { if (data<number>(s, 'cardPly', -1) === s.ply) throw new Error('Only one card per turn'); return apply(s, a); } };
}

/** Attach each player's hand to a game. */
export function cardRules(hands: Partial<Record<PlayerId, string[]>>): string[] {
  const out: string[] = [];
  for (const [P, ids] of Object.entries(hands)) for (const id of ids ?? []) if (PLAYABLE_CARDS.has(id)) out.push(`${id}@${P}`);
  return out;
}

/** Cards a player has already played this game. */
export function playedCards(s: GameState, P: PlayerId): string[] {
  return (data<Record<string, string[]>>(s, 'usedBuffs', {})[P] ?? []).filter((id) => id.startsWith('CARD-'));
}
