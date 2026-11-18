import { fileOf, isPromotionSquare, lateral, rankOf, seatOf, step } from './board';
import { inCheck, isAttackedBy, makeMove, nextSeat, pseudoMovesFor } from './movegen';
import { baseType, pieceType } from './pieces';
import type { RuleModule } from './rules';
import type { GameState, MoveAction, Piece, PlayerId } from './types';

/**
 * Party modifiers (docs/03 Buffs and Handicaps) as rule modules. A modifier
 * is attached to a game as the string "ID@player" in GameState.rules, so the
 * whole game stays JSON and replays exactly. Setup-time changes (piece
 * variants, missing pawn, frozen piece) are applied by applySetup().
 * Items that only change what a person sees (hints, touch-move…) live in the UI.
 */


/** How many turns this player has completed in the game. */
export function movesMade(s: GameState, p: PlayerId): number {
  return ((s.modeData?.moveCount as Record<string, number> | undefined) ?? {})[p] ?? 0;
}

function mark(s: GameState, key: string, value: unknown): GameState {
  return { ...s, modeData: { ...(s.modeData ?? {}), [key]: value } };
}

function relRank(s: GameState, p: PlayerId, sq: number): number {
  const seat = seatOf(s, p);
  const b = s.board;
  if (seat.forward[1] > 0) return rankOf(b, sq);
  if (seat.forward[1] < 0) return b.height - 1 - rankOf(b, sq);
  if (seat.forward[0] > 0) return fileOf(b, sq);
  return b.width - 1 - fileOf(b, sq);
}

const isPawn = (p: Piece) => baseType(p.type) === 'pawn';
const mine = (s: GameState, p: PlayerId) => s.pieces.filter((x) => x.at >= 0 && x.owner === p);

/** End the turn after a buff that "uses your move". */
function endTurn(prev: GameState, n: GameState, by: PlayerId, piece: number, from: number, to: number): GameState {
  return { ...n, ply: prev.ply + 1, turn: nextSeat(n, by), enPassant: null, halfmoveClock: prev.halfmoveClock + 1, last: { piece, type: n.pieces[piece].type, by, from, to } };
}

function relocate(s: GameState, id: number, to: number): GameState {
  const pieces = s.pieces.slice();
  const sq = s.sq.slice();
  const p = pieces[id];
  if (p.at >= 0) sq[p.at] = -1;
  if (sq[to] >= 0) pieces[sq[to]] = { ...pieces[sq[to]], at: -1 };
  sq[to] = id;
  pieces[id] = { ...p, at: to, moved: true };
  return { ...s, pieces, sq };
}

function ensureSafe(n: GameState, by: PlayerId) {
  if (inCheck(n, by)) throw new Error('That would leave your king in danger');
}

// ---------- Helpers for timed protections (shield, freeze, home guard) ----------

interface Timed { piece?: number; owner?: PlayerId; until: number }
function timed(s: GameState, key: string): Timed[] {
  return ((s.modeData?.[key] as Timed[] | undefined) ?? []).filter((t) => s.ply < t.until);
}

// ---------- The modules ----------

type Factory = (p: PlayerId) => RuleModule;

const F: Record<string, Factory> = {
  /** Counts turns per player so other modifiers can say "before your move 10". */
  COUNT: () => ({
    id: 'COUNT@all',
    afterMove: (s, prev) => {
      if (!s.last || s.ply === prev.ply) return s;
      const c = { ...((s.modeData?.moveCount as Record<string, number>) ?? {}) };
      c[prev.turn] = (c[prev.turn] ?? 0) + 1;
      return mark(s, 'moveCount', c);
    },
  }),

  // ---- Buffs ----
  'BUFF-10': (P) => ({
    id: `BUFF-10@${P}`,
    extraMoves: (s) => {
      if (s.turn !== P) return [];
      const used = (s.modeData?.backpedal as number[] | undefined) ?? [];
      const [fx, fy] = seatOf(s, P).forward;
      const out: MoveAction[] = [];
      for (const p of mine(s, P)) {
        if (!isPawn(p) || used.includes(p.id)) continue;
        const to = step(s.board, p.at, -fx, -fy);
        if (to >= 0 && s.sq[to] < 0 && relRank(s, P, to) >= 1) out.push({ t: 'move', piece: p.id, to });
      }
      return out;
    },
    afterMove: (s, prev) => {
      const l = s.last;
      if (!l || l.by !== P || !isPawn(s.pieces[l.piece]) || s.ply === prev.ply) return s;
      if (relRank(s, P, l.to) < relRank(s, P, l.from)) {
        const used = (s.modeData?.backpedal as number[] | undefined) ?? [];
        return mark(s, 'backpedal', [...used, l.piece]);
      }
      return s;
    },
  }),

  'BUFF-06': (P) => ({
    id: `BUFF-06@${P}`,
    afterMove: (s, prev) => {
      if (s.modeData?.secondWindUsed?.toString() === P || !s.last?.captured) return s;
      const victimId = prev.sq[s.last.to];
      if (victimId < 0) return s;
      const v = s.pieces[victimId];
      if (v.owner !== P || v.type === 'king' || baseType(v.type) === 'queen') return s;
      let to = s.sq[v.home] < 0 ? v.home : -1;
      if (to < 0) {
        const back = s.sq.map((_, i) => i).filter((i) => !s.board.blocked[i] && s.sq[i] < 0 && relRank(s, P, i) === 0);
        to = back.sort((a, b) => Math.abs(a - v.home) - Math.abs(b - v.home))[0] ?? -1;
      }
      if (to < 0) return s;
      return mark(relocate(s, victimId, to), 'secondWindUsed', P);
    },
  }),

  'BUFF-02': (P) => ({
    id: `BUFF-02@${P}`,
    applyBuff: (s, a) => {
      const t = s.pieces[a.target ?? -1];
      if (!t || t.at < 0 || t.owner !== P || t.type === 'king') throw new Error('Pick one of your pieces (not the king)');
      return mark(s, 'shield', [...timed(s, 'shield'), { piece: t.id, until: s.ply + 4 }]);
    },
    filterMoves: (s, moves) => {
      if (s.turn === P) return moves;
      const shielded = new Set(timed(s, 'shield').map((x) => x.piece));
      return moves.filter((m) => !(s.sq[m.to] >= 0 && shielded.has(s.sq[m.to])));
    },
  }),

  'BUFF-15': (P) => ({
    id: `BUFF-15@${P}`,
    applyBuff: (s, a) => {
      const t = s.pieces[a.target ?? -1];
      if (!t || t.at < 0 || t.owner === P || t.type === 'king') throw new Error('Pick an enemy piece (not the king)');
      return mark(s, 'frozenRay', [...timed(s, 'frozenRay'), { piece: t.id, until: s.ply + 2 }]);
    },
    filterMoves: (s, moves) => {
      if (s.turn === P) return moves;
      const frozen = new Set(timed(s, 'frozenRay').map((x) => x.piece));
      const kept = moves.filter((m) => !frozen.has(m.piece));
      return kept.length ? kept : moves;
    },
  }),

  'BUFF-21': (P) => ({
    id: `BUFF-21@${P}`,
    applyBuff: (s) => mark(s, 'homeGuard', [...timed(s, 'homeGuard'), { owner: P, until: s.ply + 2 }]),
    filterMoves: (s, moves) => {
      if (s.turn === P || !timed(s, 'homeGuard').length) return moves;
      return moves.filter((m) => {
        const v = s.sq[m.to];
        return !(v >= 0 && s.pieces[v].owner === P && relRank(s, P, m.to) === 0 && s.pieces[v].type !== 'king');
      });
    },
  }),

  'BUFF-11': (P) => ({
    id: `BUFF-11@${P}`,
    applyBuff: (s, a) => {
      const x = s.pieces[a.piece ?? -1], y = s.pieces[a.target ?? -1];
      if (!x || !y || x.id === y.id || x.at < 0 || y.at < 0 || x.owner !== P || y.owner !== P || x.type === 'king' || y.type === 'king') throw new Error('Pick two of your pieces (not the king)');
      const seat = seatOf(s, P);
      for (const [p, to] of [[x, y.at], [y, x.at]] as const) {
        if (isPawn(p) && (relRank(s, P, to) === 0 || isPromotionSquare(s.board, seat, to))) throw new Error('Pawns cannot go to the first or last row');
      }
      const pieces = s.pieces.slice(); const sq = s.sq.slice();
      pieces[x.id] = { ...x, at: y.at, moved: true }; pieces[y.id] = { ...y, at: x.at, moved: true };
      sq[y.at] = x.id; sq[x.at] = y.id;
      const n = { ...s, pieces, sq };
      ensureSafe(n, P);
      return endTurn(s, n, P, x.id, x.at, y.at);
    },
  }),

  'BUFF-17': (P) => ({
    id: `BUFF-17@${P}`,
    applyBuff: (s, a) => {
      const p = s.pieces[a.piece ?? -1];
      if (!p || p.owner !== P || !isPawn(p) || a.to === undefined) throw new Error('Pick one of your pawns');
      const [lx, ly] = lateral(seatOf(s, P));
      const ok = [step(s.board, p.at, lx, ly), step(s.board, p.at, -lx, -ly)].includes(a.to) && s.sq[a.to] < 0;
      if (!ok) throw new Error('Sidestep one square onto an empty square');
      const n = relocate(s, p.id, a.to);
      ensureSafe(n, P);
      return endTurn(s, n, P, p.id, p.at, a.to);
    },
  }),

  'BUFF-18': (P) => ({
    id: `BUFF-18@${P}`,
    applyBuff: (s, a) => {
      const p = s.pieces[a.piece ?? -1];
      if (!p || p.owner !== P || p.type === 'king' || a.to === undefined) throw new Error('Pick one of your pieces (not the king)');
      const jumps = pieceType('knight').moves[0];
      const ok = jumps.kind === 'leap' && jumps.offsets.some(([x, y]) => step(s.board, p.at, x, y) === a.to);
      const v = s.sq[a.to];
      if (!ok || (v >= 0 && (s.pieces[v].owner === P || s.pieces[v].type === 'king'))) throw new Error('That is not a knight jump');
      const n = relocate(s, p.id, a.to);
      ensureSafe(n, P);
      return endTurn(s, n, P, p.id, p.at, a.to);
    },
  }),

  'BUFF-20': (P) => ({
    id: `BUFF-20@${P}`,
    applyBuff: (s, a) => {
      const p = s.pieces[a.piece ?? -1];
      if (!p || p.owner !== P || p.type === 'king' || p.at === p.home || s.sq[p.home] >= 0) throw new Error('Its home square must be empty');
      const n = relocate(s, p.id, p.home);
      ensureSafe(n, P);
      return endTurn(s, n, P, p.id, p.at, p.home);
    },
  }),

  'BUFF-14': (P) => ({
    id: `BUFF-14@${P}`,
    applyBuff: (s, a) => {
      if (a.to === undefined || s.sq[a.to] >= 0 || s.board.blocked[a.to] || relRank(s, P, a.to) !== 1) throw new Error('Pick an empty square on your pawn row');
      const pieces = s.pieces.slice(); const sq = s.sq.slice();
      const id = pieces.length;
      pieces.push({ id, type: 'pawn', owner: P, home: a.to, at: a.to, moved: false });
      sq[a.to] = id;
      const n = { ...s, pieces, sq };
      ensureSafe(n, P);
      return endTurn(s, n, P, id, a.to, a.to);
    },
  }),

  'BUFF-16': (P) => ({
    id: `BUFF-16@${P}`,
    applyBuff: (s, a) => {
      const k = mine(s, P).find((x) => x.type === 'king');
      if (!k || a.to === undefined) throw new Error('No king');
      if (inCheck(s, P)) throw new Error('Not while in check');
      const df = fileOf(s.board, a.to) - fileOf(s.board, k.at), dr = rankOf(s.board, a.to) - rankOf(s.board, k.at);
      const okShape = (Math.abs(df) === 2 || df === 0) && (Math.abs(dr) === 2 || dr === 0) && !(df === 0 && dr === 0);
      const mid = step(s.board, k.at, Math.sign(df), Math.sign(dr));
      if (!okShape || mid < 0 || s.sq[mid] >= 0 || s.sq[a.to] >= 0 || isAttackedBy(s, mid, P)) throw new Error('Two squares in a line, through empty, safe squares');
      const n = relocate(s, k.id, a.to);
      ensureSafe(n, P);
      return endTurn(s, n, P, k.id, k.at, a.to);
    },
  }),

  'BUFF-01': (P) => ({
    id: `BUFF-01@${P}`,
    applyBuff: (s, a) => {
      const p = s.pieces[a.piece ?? -1];
      if (!p || p.owner !== P || a.to === undefined || a.to2 === undefined) throw new Error('Pick a piece and two moves');
      const first = pseudoMovesFor(s, p).find((m) => m.to === a.to);
      if (!first || (s.sq[a.to] >= 0 && s.pieces[s.sq[a.to]].type === 'king')) throw new Error('First move not allowed');
      const mid = makeMove({ ...s, enPassant: null }, { ...first, promo: undefined });
      const midState = { ...mid, turn: P };
      const second = pseudoMovesFor(midState, midState.pieces[p.id]).find((m) => m.to === a.to2);
      if (!second || (midState.sq[a.to2] >= 0 && midState.pieces[midState.sq[a.to2]].type === 'king')) throw new Error('Second move not allowed');
      const end = makeMove(midState, { ...second, promo: second.promo ? 'queen' : undefined });
      ensureSafe(end, P);
      return { ...end, ply: s.ply + 1, turn: nextSeat(end, P) };
    },
  }),

  // ---- Handicaps ----
  'HCAP-02': (P) => ({
    id: `HCAP-02@${P}`,
    filterMoves: (s, moves) => {
      if (s.turn !== P || movesMade(s, P) >= 3) return moves;
      const frozen = s.modeData?.frozenPiece as number | undefined;
      const kept = moves.filter((m) => m.piece !== frozen);
      return kept.length ? kept : moves;
    },
  }),
  'HCAP-06': (P) => ({ id: `HCAP-06@${P}`, filterMoves: (s, moves) => (s.turn === P ? moves.filter((m) => !m.castle) : moves) }),
  'HCAP-09': (P) => ({
    id: `HCAP-09@${P}`,
    filterMoves: (s, moves) => {
      if (s.turn !== P || movesMade(s, P) >= 9) return moves;
      const kept = moves.filter((m) => m.castle || baseType(s.pieces[m.piece].type) !== 'rook');
      return kept.length ? kept : moves;
    },
  }),
  'HCAP-11': (P) => ({
    id: `HCAP-11@${P}`,
    filterMoves: (s, moves) => {
      if (s.turn !== P || !s.last || s.last.by === P || inCheck(s, P)) return moves;
      const want = baseType(s.last.type);
      const same = moves.filter((m) => baseType(s.pieces[m.piece].type) === want);
      return same.length ? same : moves;
    },
  }),
  'HCAP-12': (P) => ({
    id: `HCAP-12@${P}`,
    filterMoves: (s, moves) => (s.turn !== P ? moves : moves.filter((m) => s.pieces[m.piece].type !== 'king' || relRank(s, P, m.to) <= 1)),
  }),
  'HCAP-13': (P) => ({
    id: `HCAP-13@${P}`,
    filterMoves: (s, moves) => {
      if (s.turn !== P) return moves;
      const caps = moves.filter((m) => s.sq[m.to] >= 0 || (isPawn(s.pieces[m.piece]) && s.enPassant?.square === m.to));
      return caps.length ? caps : moves;
    },
  }),
  'HCAP-18': (P) => ({
    id: `HCAP-18@${P}`,
    filterMoves: (s, moves) => {
      if (s.turn !== P) return moves;
      const kept = moves.filter((m) => {
        const p = s.pieces[m.piece];
        if (s.sq[m.to] >= 0 || m.castle || !pieceType(p.type).moves.some((x) => x.kind === 'ride')) return true;
        const df = Math.sign(fileOf(s.board, m.to) - fileOf(s.board, p.at)), dr = Math.sign(rankOf(s.board, m.to) - rankOf(s.board, p.at));
        const beyond = step(s.board, m.to, df, dr);
        // Must slide as far as it can: the next square must be blocked, off the board, or something to capture.
        return beyond < 0 || s.sq[beyond] >= 0;
      });
      return kept.length ? kept : moves;
    },
  }),
  'HCAP-22': (P) => ({
    id: `HCAP-22@${P}`,
    filterMoves: (s, moves) => {
      if (s.turn !== P || (movesMade(s, P) + 1) % 5 !== 0) return moves;
      const kingMoves = moves.filter((m) => s.pieces[m.piece].type === 'king');
      return kingMoves.length ? kingMoves : moves;
    },
  }),
};

/** Modifiers that only swap piece types or board settings at the start. */
const SETUP_TYPES: Record<string, [string, string]> = {
  'BUFF-05': ['pawn', 'pawn-sprint'],
  'BUFF-07': ['knight', 'knight-long'],
  'HCAP-03': ['queen', 'queen-tired'],
  'HCAP-05': ['pawn', 'pawn-slow'],
  'HCAP-17': ['pawn', 'pawn-rusty'],
  'HCAP-19': ['rook', 'rook-file'],
  'HCAP-20': ['bishop', 'bishop-peace'],
};

/** Modifiers handled entirely by the UI (they change what one person sees or can tap). */
export const UI_ONLY = new Set(['BUFF-03', 'BUFF-12', 'BUFF-19', 'BUFF-24', 'HCAP-04', 'HCAP-07', 'HCAP-16']);

/** Every modifier this build can play. */
export const IMPLEMENTED = new Set([...Object.keys(F).filter((k) => k !== 'COUNT'), ...Object.keys(SETUP_TYPES), 'BUFF-08', 'HCAP-14', ...UI_ONLY]);

/** One-shot buffs (a button the player presses once). */
export const ONE_SHOT = new Set(Object.entries(F).filter(([, f]) => !!f('p1').applyBuff).map(([k]) => k));

export function extraModule(rule: string): RuleModule | undefined {
  const [id, who] = rule.split('@');
  const f = F[id];
  return f ? f(who as PlayerId) : undefined;
}

/** Apply start-of-game changes and attach rule modules. `pick` gives deterministic random numbers. */
export function applySetup(s: GameState, mods: Partial<Record<PlayerId, string[]>>, pick: (n: number) => number): GameState {
  let n: GameState = { ...s, pieces: s.pieces.map((p) => ({ ...p })), sq: s.sq.slice(), seats: s.seats.map((x) => ({ ...x, promo: { ...x.promo } })) };
  const rules = ['COUNT@all', ...(s.rules ?? [])];
  for (const [P, ids] of Object.entries(mods) as [PlayerId, string[]][]) {
    for (const id of ids) {
      const swap = SETUP_TYPES[id];
      if (swap) for (const p of n.pieces) if (p.owner === P && p.type === swap[0]) p.type = swap[1];
      if (id === 'BUFF-08') {
        const seat = n.seats.find((x) => x.id === P)!;
        seat.promo = { ...seat.promo, value: seat.forward[1] > 0 ? seat.promo.value - 1 : seat.promo.value + 1 };
      }
      if (id === 'HCAP-14') {
        const pawns = n.pieces.filter((p) => p.owner === P && isPawn(p) && p.at >= 0);
        if (pawns.length) {
          const victim = pawns[pick(pawns.length)];
          n.sq[victim.at] = -1;
          victim.at = -1;
        }
      }
      if (id === 'HCAP-02') {
        const cands = n.pieces.filter((p) => p.owner === P && p.at >= 0 && p.type !== 'king' && !isPawn(p));
        if (cands.length) n = mark(n, 'frozenPiece', cands[pick(cands.length)].id);
      }
      if (F[id]) rules.push(`${id}@${P}`);
    }
  }
  return { ...n, rules };
}
