import {
  BARRICADE_HP, BEATS, RACE_FACE_UP, CATAPULT_RANGE, CRUSH_MARGIN, FOREST_DENSITY, FOREST_RANKS, GLOBAL_MISSIONS, LU_BACK, LU_FIRST_FILE, LU_PIECES, LU_WIDTH, LU_HEIGHT,
  CATAPULT_MIN, MINER_CARRY, REVIVE_RANGE, REVIVE_TURNS, SCOUT_SIGHT, SECRET_MISSIONS, WIN_GRADES, XP, levelOf, type Base, type LURole, type LUType,
} from '../content/levelup';

/**
 * Level-Up Chess rules (design doc "Level-Up Chess: design notes"). Pure and
 * deterministic: dice come from a seeded generator kept in the state, so a game
 * replays from its seed and actions. Two players for now (p1 at the bottom).
 */
export type Side = 'p1' | 'p2';
export const other = (s: Side): Side => (s === 'p1' ? 'p2' : 'p1');
/** Board width (files) and height (ranks); squares are numbered r * W + f. */
export const W = LU_WIDTH;
export const H = LU_HEIGHT;
/** How many squares. */
export const SQUARES = W * H;
export const fileOf = (sq: number) => sq % W;
export const rankOf = (sq: number) => Math.floor(sq / W);
export const sqAt = (f: number, r: number) => (f < 0 || r < 0 || f >= W || r >= H ? -1 : r * W + f);
export const dist = (a: number, b: number) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
/** The middle 4 x 4 of the board. */
export const isCentre = (sq: number) => Math.abs(fileOf(sq) * 2 + 1 - W) <= 4 && Math.abs(rankOf(sq) * 2 + 1 - H) <= 4;

export interface LUPiece {
  id: number;
  type: LUType;
  owner: Side;
  /** Square, or -1 when fallen. */
  at: number;
  moved: boolean;
  xp: number;
  base: Base;
  /** Sides that have seen what this piece is (it fought, or it was caught by a scout in a fight). */
  known: Side[];
  /** Already earned its "take the centre" point. */
  centre?: boolean;
  /** A scout's job, picked at level 2. */
  role?: LURole;
  /** Bombardier: the pawn crewing it (no crew = it can't move, aim, fire or reload). */
  crew?: number;
  /** Pawn: the bombardier it is crewing (it is off the board while it rides: at = -1). */
  riding?: number;
  /** Bombardier: where it is in its cycle. */
  load?: 'loaded' | 'aimed' | 'empty';
  /** Bombardier: the ply of its last step (one step a turn). */
  stepPly?: number;
  /** Miner: mines carried. */
  carry?: number;
  /** Stunned: this piece can't act until the ply reaches this number (it misses its side's next turn). */
  stunUntil?: number;
}
export interface Fallen { id: number; at: number; ply: number }
export interface Shot { by: Side; catapult: number; at: number; ply: number }
export type LUEvent =
  | { k: 'battle'; att: number; def: number; a: [number, number]; d: [number, number]; outcome: 'win' | 'bounce' | 'crushed'; why: string }
  | { k: 'strike'; att: number; def: number; roll: number; outcome: 'win' | 'bounce' | 'crushed' }
  | { k: 'xp'; piece: number; points: number; why: string }
  | { k: 'levelup'; piece: number; level: number; why: string }
  | { k: 'mission'; side: Side; id: string; kind: 'global' | 'secret' }
  | { k: 'shot'; at: number; by: Side }
  | { k: 'hit'; at: number; piece: number }
  | { k: 'shield'; at: number; rook: number }
  | { k: 'miss'; at: number }
  | { k: 'boom'; at: number; piece: number }
  | { k: 'revive'; piece: number; at: number }
  | { k: 'tree'; at: number; gone: boolean }
  | { k: 'crater'; at: number }
  | { k: 'promote'; piece: number }
  | { k: 'role'; piece: number; role: LURole }
  | { k: 'reload'; piece: number }
  | { k: 'sweep'; at: number; piece: number }
  | { k: 'retrain'; piece: number }
  | { k: 'crew'; piece: number; catapult: number; on: boolean }
  | { k: 'crew-lost'; piece: number; catapult: number }
  | { k: 'defuse'; at: number; piece: number; roll: number; kept: boolean }
  | { k: 'stun'; piece: number }
  | { k: 'wall'; at: number; piece: number }
  | { k: 'check'; side: Side };
export interface LUResult { winner: Side | null; reason: 'checkmate' | 'assassin' | 'stalemate' | 'resign'; grade: string }

export interface LUState {
  seed: number;
  rng: number;
  turn: Side;
  ply: number;
  pieces: LUPiece[];
  /** Piece id per square, -1 if empty. */
  sq: number[];
  /** Barricade hits left per square (0 = none). */
  trees: number[];
  /** Barricades a rook built (walls): clearing one takes two actions, not one. */
  walls?: number[];
  /** Hidden mines (`by` = the miner who laid it, for its points). */
  mines: { at: number; owner: Side; by?: number }[];
  /** Scouts that reached level 2 and must pick a job before anything else happens (their owner picks). */
  choose: number[];
  /** Craters left by level 3 catapult shots: nothing can ever stand on or pass them. */
  craters: number[];
  shots: Shot[];
  fallen: Fallen[];
  result: LUResult | null;
  secret: Record<Side, string>;
  secretDone: Record<Side, boolean>;
  /** Race missions face up (up to three, still open). */
  globals: { id: string; winner: Side | null }[];
  /** Race missions still in the deck, and the ones already claimed. */
  raceDeck: string[];
  raceDone: { id: string; winner: Side }[];
  /** Barricades each side has cleared (for the Clear-cut mission). */
  cleared: Record<Side, number>;
  /** What happened in the last action, for the screen. */
  events: LUEvent[];
  last: { from: number; to: number; by: Side } | null;
}

export type LUAction =
  /** `mine`: a miner drops a mine on the square it leaves. */
  | { t: 'move'; piece: number; to: number; mine?: true }
  | { t: 'attack'; piece: number; to: number }
  | { t: 'strike'; piece: number; to: number }
  | { t: 'castle'; piece: number; to: number; rook: number }
  | { t: 'revive'; piece: number; fallen: number; to: number }
  /** Bombardier steps: free (they don't use up your move), one a turn per bombardier. */
  | { t: 'mark'; piece: number; to: number }
  | { t: 'fire'; piece: number }
  | { t: 'reload'; piece: number }
  /** A pawn climbs onto a bombardier next to it / the crew climbs off (piece = the bombardier). */
  | { t: 'board'; piece: number; catapult: number }
  | { t: 'unboard'; piece: number; to: number }
  /** A scout at level 2 picks its job. */
  | { t: 'role'; piece: number; role: LURole }
  /** A level 3 pawn becomes a level 1 scout. */
  | { t: 'retrain'; piece: number }
  /** A level 3 miner defuses a mine up to 2 squares away without stepping on it. */
  | { t: 'defuse'; piece: number; at: number }
  /** A knight or pawn clears a barricade next to it. */
  | { t: 'clear'; piece: number; at: number }
  /** A level 3 rook builds a wall (a new barricade) next to it. */
  | { t: 'wall'; piece: number; at: number }
  | { t: 'resign'; by: Side };

/** Bombardier steps and job picks don't end the turn. */
export const isFree = (a: LUAction) => a.t === 'mark' || a.t === 'fire' || a.t === 'reload' || a.t === 'role';

/* ---- Dice ---------------------------------------------------------------- */
function nextRand(s: LUState): number {
  // mulberry32
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const d6 = (s: LUState) => 1 + Math.floor(nextRand(s) * 6);

/* ---- Setup --------------------------------------------------------------- */
export function newGame(seed: number): LUState {
  const s: LUState = {
    seed, rng: seed | 0, turn: 'p1', ply: 0, pieces: [], sq: Array(SQUARES).fill(-1), trees: Array(SQUARES).fill(0), mines: [], choose: [], craters: [], shots: [], fallen: [], result: null,
    secret: { p1: '', p2: '' }, secretDone: { p1: false, p2: false }, globals: [], raceDeck: [], raceDone: [], cleared: { p1: 0, p2: 0 }, events: [], last: null,
  };
  const bases: Base[] = ['triangle', 'square', 'circle'];
  const add = (type: LUType, owner: Side, at: number) => {
    const p: LUPiece = { id: s.pieces.length, type, owner, at, moved: false, xp: 0, base: bases[Math.floor(nextRand(s) * 3)], known: [owner] };
    s.pieces.push(p);
    s.sq[at] = p.id;
  };
  for (const owner of ['p1', 'p2'] as Side[]) {
    const back = owner === 'p1' ? 0 : H - 1, front = owner === 'p1' ? 1 : H - 2;
    LU_BACK.forEach((t, i) => add(t, owner, sqAt(LU_FIRST_FILE + i, back)));
    for (let i = 0; i < LU_BACK.length; i++) add('pawn', owner, sqAt(LU_FIRST_FILE + i, front));
  }
  // Every bombardier starts loaded, with a pawn crew on it (owner, 2026-11-19).
  for (const c of s.pieces.filter((p) => p.type === 'catapult')) crewUp(s, c, bases[Math.floor(nextRand(s) * 3)]);
  // The forest: the same for both sides (turned half a turn), so neither side gets an easier path.
  for (let r = FOREST_RANKS[0]; r <= (FOREST_RANKS[0] + FOREST_RANKS[1]) / 2; r++) {
    for (let f = 0; f < W; f++) {
      if (nextRand(s) >= FOREST_DENSITY) continue;
      s.trees[sqAt(f, r)] = BARRICADE_HP;
      s.trees[sqAt(W - 1 - f, FOREST_RANKS[0] + FOREST_RANKS[1] - r)] = BARRICADE_HP;
    }
  }
  const pick = <T,>(xs: T[]) => xs.splice(Math.floor(nextRand(s) * xs.length), 1)[0];
  // The race deck, shuffled: three face up.
  const g = [...GLOBAL_MISSIONS];
  const deck: string[] = [];
  while (g.length) deck.push(pick(g).id);
  s.globals = deck.splice(0, RACE_FACE_UP).map((id) => ({ id, winner: null }));
  s.raceDeck = deck;
  const sm = [...SECRET_MISSIONS];
  s.secret = { p1: pick(sm).id, p2: pick(sm).id };
  return s;
}

/** Put a new pawn crew on a bombardier (setup and tests). */
function crewUp(s: LUState, c: LUPiece, base: Base) {
  const p: LUPiece = { id: s.pieces.length, type: 'pawn', owner: c.owner, at: -1, moved: false, xp: 0, base, known: [c.owner], riding: c.id };
  s.pieces.push(p);
  c.crew = p.id;
  c.load = 'loaded';
}

/* ---- Looking at the board ------------------------------------------------ */
export const level = (p: LUPiece) => levelOf(p.xp);
export const pieceAt = (s: LUState, sq: number) => (sq >= 0 && s.sq[sq] >= 0 ? s.pieces[s.sq[sq]] : undefined);
const forward = (side: Side) => (side === 'p1' ? 1 : -1);
const step = (sq: number, df: number, dr: number) => sqAt(fileOf(sq) + df, rankOf(sq) + dr);
const ORTH: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL = [...ORTH, ...DIAG];
const KNIGHT: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KNIGHT2: [number, number][] = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
const open = (s: LUState, sq: number) => sq >= 0 && s.trees[sq] === 0 && !s.craters.includes(sq);

/**
 * Squares a piece threatens with an ordinary attack (used for check, forks
 * and pins). Catapults, medics, mine layers and scouts never threaten this way.
 */
export function threats(s: LUState, p: LUPiece): number[] {
  const out: number[] = [];
  const lv = level(p);
  const slide = (dirs: [number, number][], max = H) => {
    for (const [df, dr] of dirs) {
      let at = p.at;
      for (let i = 0; i < max; i++) {
        at = step(at, df, dr);
        if (!open(s, at)) break;
        out.push(at);
        if (s.sq[at] >= 0) break;
      }
    }
  };
  const jump = (offs: [number, number][]) => { for (const [df, dr] of offs) { const t = step(p.at, df, dr); if (open(s, t)) out.push(t); } };
  switch (p.type) {
    case 'pawn': {
      // Level 2 and up: attacks diagonally in every direction (owner, 2026-11-19).
      const fw = forward(p.owner);
      if (lv >= 2) jump(DIAG);
      else jump([[1, fw], [-1, fw]]);
      break;
    }
    case 'knight': jump(KNIGHT); if (lv >= 2) jump(KNIGHT2); break;
    case 'bishop': slide(DIAG); if (lv >= 2) slide([[0, forward(p.owner)]], 2); break;
    case 'rook': slide(ORTH); break;
    case 'queen': slide(ALL); if (lv >= 3) jump(KNIGHT); break;
    case 'king': jump(ALL); if (lv >= 2) for (const [df, dr] of ALL) { const mid = step(p.at, df, dr); const t = step(p.at, 2 * df, 2 * dr); if (open(s, mid) && s.sq[mid] < 0 && open(s, t)) out.push(t); } break;
    default: break;
  }
  return out;
}

export function attacked(s: LUState, sq: number, by: Side): boolean {
  for (const p of s.pieces) if (p.at >= 0 && p.owner === by && threats(s, p).includes(sq)) return true;
  return false;
}
export const kingOf = (s: LUState, side: Side) => s.pieces.find((p) => p.type === 'king' && p.owner === side && p.at >= 0);
export function inCheck(s: LUState, side: Side): boolean {
  const k = kingOf(s, side);
  return !!k && attacked(s, k.at, other(side));
}
const mineAt = (s: LUState, sq: number) => s.mines.find((m) => m.at === sq);

/** Can this piece act this turn? (Stunned pieces sit out a turn.) */
export const stunned = (s: LUState, p: LUPiece) => p.stunUntil !== undefined && s.ply < p.stunUntil;

/** Every action this piece could take, before the "don't leave your king in check" rule. */
export function pieceActions(s: LUState, p: LUPiece): LUAction[] {
  const out: LUAction[] = [];
  if (p.at < 0 || s.result || stunned(s, p)) return out;
  const lv = level(p);
  // A bombardier with no crew can't be attacked (it can't be destroyed); with a crew, you fight the crew.
  const enemy = (sq: number) => { const q = pieceAt(s, sq); return q && q.owner !== p.owner && (q.type !== 'catapult' || q.crew !== undefined) ? q : undefined; };
  // Your own mines are walls to you (your miner may step on them); the enemy's look like empty ground.
  const free = (sq: number) => open(s, sq) && s.sq[sq] < 0 && !s.mines.some((m) => m.at === sq && m.owner === p.owner);
  const goOrHit = (sq: number) => {
    if (sq < 0 || !open(s, sq)) return;
    const e = enemy(sq);
    if (e) { if (e.type !== 'king') out.push({ t: 'attack', piece: p.id, to: sq }); }
    else if (free(sq)) out.push({ t: 'move', piece: p.id, to: sq });
  };
  switch (p.type) {
    case 'pawn': {
      const fw = forward(p.owner);
      const one = step(p.at, 0, fw);
      if (free(one)) {
        out.push({ t: 'move', piece: p.id, to: one });
        const two = step(one, 0, fw);
        if (!p.moved && free(two)) out.push({ t: 'move', piece: p.id, to: two });
      }
      // Level 2 and up: steps one square any way.
      if (lv >= 2) for (const [df, dr] of ALL) { const t = step(p.at, df, dr); if (free(t)) out.push({ t: 'move', piece: p.id, to: t }); }
      for (const t of threats(s, p)) { const e = enemy(t); if (e && e.type !== 'king') out.push({ t: 'attack', piece: p.id, to: t }); }
      // Climb onto an empty bombardier next to it.
      for (const c of s.pieces) if (c.type === 'catapult' && c.owner === p.owner && c.at >= 0 && c.crew === undefined && dist(c.at, p.at) === 1) out.push({ t: 'board', piece: p.id, catapult: c.id });
      if (lv >= 3) out.push({ t: 'retrain', piece: p.id });
      out.push(...clears(s, p));
      break;
    }
    case 'knight':
      for (const t of threats(s, p)) goOrHit(t);
      out.push(...clears(s, p));
      break;
    case 'rook':
      for (const t of threats(s, p)) goOrHit(t);
      // Level 3 builds walls on empty ground next to it (owner, 2026-11-19).
      if (lv >= 3) for (const [df, dr] of ALL) { const t = step(p.at, df, dr); if (t >= 0 && open(s, t) && s.sq[t] < 0 && !s.mines.some((m) => m.at === t && m.owner === p.owner)) out.push({ t: 'wall', piece: p.id, at: t }); }
      break;
    case 'bishop': case 'queen':
      for (const t of threats(s, p)) goOrHit(t);
      break;
    case 'king':
      for (const t of threats(s, p)) goOrHit(t);
      out.push(...castles(s, p));
      break;
    case 'catapult': {
      if (p.crew === undefined) break;
      // One free step a turn: mark a target, fire at it (on a later turn), or reload.
      // A bombardier that took its step can't also move that turn (owner, 2026-11-19).
      if (p.stepPly === s.ply) break;
      for (const [df, dr] of ALL) { const t = step(p.at, df, dr); if (free(t)) out.push({ t: 'move', piece: p.id, to: t }); }
      // The crew never climbs off (owner, 2026-11-19): it stays until it is killed. (`unboard` is kept only so older games replay.)
      if (p.load === 'loaded') {
        const range = CATAPULT_RANGE[lv - 1];
        for (let sq = 0; sq < SQUARES; sq++) {
          const d = dist(sq, p.at);
          if (d < CATAPULT_MIN || d > range || s.craters.includes(sq)) continue;
          const q = pieceAt(s, sq);
          if (q && q.owner === p.owner) continue;
          out.push({ t: 'mark', piece: p.id, to: sq });
        }
      } else if (p.load === 'aimed') {
        if (s.shots.some((x) => x.catapult === p.id && x.ply < s.ply)) out.push({ t: 'fire', piece: p.id });
      } else out.push({ t: 'reload', piece: p.id });
      break;
    }
    case 'medic': {
      // Up to 3 steps through open, empty ground.
      for (const t of walk(s, p, 3)) out.push({ t: 'move', piece: p.id, to: t });
      out.push(...revives(s, p));
      break;
    }
    case 'miner': {
      // Up to 2 steps; never attacks. It may step onto any mine to defuse it, and drop its own mine on the square it leaves.
      for (const t of walk(s, p, 2, true)) {
        out.push({ t: 'move', piece: p.id, to: t });
        if ((p.carry ?? 0) > 0 && !mineAt(s, p.at)) out.push({ t: 'move', piece: p.id, to: t, mine: true });
      }
      if (lv >= 3) for (const m of s.mines) if (dist(m.at, p.at) <= 2 && m.at !== p.at && s.sq[m.at] < 0) out.push({ t: 'defuse', piece: p.id, at: m.at });
      break;
    }
    case 'scout': {
      for (const [df, dr] of ALL) {
        let at = p.at;
        for (let i = 0; i < 4; i++) {
          at = step(at, df, dr);
          if (!free(at)) break;
          out.push({ t: 'move', piece: p.id, to: at });
        }
        const t = step(p.at, df, dr);
        const e = t >= 0 ? enemy(t) : undefined;
        if (e && (e.type !== 'king' || lv >= 3)) out.push({ t: 'strike', piece: p.id, to: t });
      }
      break;
    }
  }
  if (p.type === 'bishop' && lv >= 3) out.push(...revives(s, p));
  // One of each (a piece can reach a square two ways).
  const seen = new Set<string>();
  return out.filter((a) => { const k = JSON.stringify(a); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Is there a rook-built wall (still standing) on this square? */
export const isWall = (s: LUState, sq: number) => s.trees[sq] > 0 && (s.walls ?? []).includes(sq);

/** A knight or pawn can clear a barricade on any square next to it (owner, 2026-11-19). */
function clears(s: LUState, p: LUPiece): LUAction[] {
  const out: LUAction[] = [];
  for (const [df, dr] of ALL) { const t = step(p.at, df, dr); if (t >= 0 && s.trees[t] > 0) out.push({ t: 'clear', piece: p.id, at: t }); }
  return out;
}

/** Squares reachable in up to `n` king steps over open, empty ground (a miner may also end on any mine). */
function walk(s: LUState, p: LUPiece, n: number, miner = false): number[] {
  const seen = new Map<number, number>([[p.at, 0]]);
  const queue = [p.at];
  const out: number[] = [];
  while (queue.length) {
    const at = queue.shift()!;
    const d = seen.get(at)!;
    if (d === n) continue;
    for (const [df, dr] of ALL) {
      const t = step(at, df, dr);
      if (t < 0 || seen.has(t) || !open(s, t) || s.sq[t] >= 0) continue;
      const own = s.mines.some((m) => m.at === t && m.owner === p.owner);
      if (own && !miner) continue;
      seen.set(t, d + 1);
      out.push(t);
      // Only the square you end on matters (walking past a hidden mine gives nothing away).
      queue.push(t);
    }
  }
  return out;
}

function castles(s: LUState, k: LUPiece): LUAction[] {
  if (k.moved || inCheck(s, k.owner)) return [];
  const out: LUAction[] = [];
  for (const dir of [1, -1]) {
    let at = k.at;
    let rook: LUPiece | undefined;
    for (;;) {
      at = step(at, dir, 0);
      if (at < 0) break;
      const q = pieceAt(s, at);
      if (q) { if (q.type === 'rook' && q.owner === k.owner && !q.moved) rook = q; break; }
    }
    if (!rook) continue;
    const pass = step(k.at, dir, 0), land = step(k.at, 2 * dir, 0);
    if (attacked(s, pass, other(k.owner)) || attacked(s, land, other(k.owner))) continue;
    out.push({ t: 'castle', piece: k.id, to: land, rook: rook.id });
  }
  return out;
}

/** Where a revived piece appears: where it fell, or the nearest open square around it. */
function reviveSquare(s: LUState, near: number, owner: Side): number {
  const ok = (sq: number) => sq >= 0 && open(s, sq) && s.sq[sq] < 0 && !s.mines.some((m) => m.at === sq && m.owner !== owner);
  if (ok(near)) return near;
  for (const [df, dr] of ALL) { const t = step(near, df, dr); if (ok(t)) return t; }
  return -1;
}

function revives(s: LUState, p: LUPiece): LUAction[] {
  const out: LUAction[] = [];
  const lv = level(p);
  for (const f of s.fallen) {
    const q = s.pieces[f.id];
    if (q.owner !== p.owner || q.type === 'king') continue;
    if (p.type === 'medic') {
      // Turns count in the owner's own turns: 2 plies each.
      if (s.ply - f.ply > REVIVE_TURNS[lv - 1] * 2 || dist(p.at, f.at) > REVIVE_RANGE[lv - 1]) continue;
      const to = reviveSquare(s, f.at, p.owner);
      if (to >= 0) out.push({ t: 'revive', piece: p.id, fallen: f.id, to });
    } else {
      // A level 3 bishop: from anywhere, any time, next to itself.
      const to = reviveSquare(s, p.at, p.owner);
      if (to >= 0 && to !== p.at) out.push({ t: 'revive', piece: p.id, fallen: f.id, to });
    }
  }
  return out;
}

/** What a successful action would leave behind (used to keep your king out of check). */
function hopeful(s: LUState, a: LUAction): LUState {
  if (a.t === 'resign' || isFree(a) || a.t === 'retrain' || a.t === 'defuse' || a.t === 'clear') return s;
  // A new wall can block a line onto your king.
  if (a.t === 'wall') { const n = { ...s, trees: s.trees.slice() }; n.trees[a.at] = BARRICADE_HP; return n; }
  const n = { ...s, sq: s.sq.slice(), pieces: s.pieces.map((p) => ({ ...p })) };
  const p = n.pieces[a.piece];
  if (a.t === 'board') { n.sq[p.at] = -1; p.at = -1; return n; }
  if (a.t === 'unboard') { const c = n.pieces[p.crew!]; c.at = a.to; n.sq[a.to] = c.id; return n; }
  // Beating a bombardier's crew leaves the bombardier where it is.
  if (a.t === 'attack' && pieceAt(n, a.to)?.type === 'catapult') return n;
  if (a.t === 'strike') { const q = pieceAt(n, a.to); if (q) { n.sq[q.at] = -1; q.at = -1; } return n; }
  if (a.t === 'revive') { const q = n.pieces[a.fallen]; q.at = a.to; n.sq[a.to] = q.id; return n; }
  if (a.t === 'attack') { const q = pieceAt(n, a.to); if (q) q.at = -1; }
  if (a.t === 'castle') {
    const r = n.pieces[a.rook];
    n.sq[r.at] = -1;
    r.at = step(a.to, fileOf(p.at) < fileOf(a.to) ? -1 : 1, 0);
    n.sq[r.at] = r.id;
  }
  n.sq[p.at] = -1;
  p.at = a.to;
  n.sq[a.to] = p.id;
  return n;
}

/** All legal actions for the side to move. In check, an action must (if it works) get the king out of check. */
export function legalActions(s: LUState, side: Side = actor(s)): LUAction[] {
  if (s.result) return [];
  // A scout that just reached level 2 picks its job before anything else.
  if (s.choose?.length) {
    const p = s.pieces[s.choose[0]];
    return p.owner === side ? (['medic', 'miner', 'spy'] as LURole[]).map((role) => ({ t: 'role', piece: p.id, role })) : [];
  }
  if (side !== s.turn) return [];
  return movesFor(s, side);
}
function movesFor(s: LUState, side: Side): LUAction[] {
  const out: LUAction[] = [];
  for (const p of s.pieces) {
    if (p.at < 0 || p.owner !== side) continue;
    for (const a of pieceActions(s, p)) {
      // An assassin that takes the king wins at once. Free steps don't move anything.
      if ((a.t === 'strike' && pieceAt(s, a.to)?.type === 'king') || isFree(a)) { out.push(a); continue; }
      if (!inCheck(hopeful(s, a), side)) out.push(a);
    }
  }
  return out;
}
/** Who acts next: the side to move, or a side picking a scout's job. */
export const actor = (s: LUState): Side => (s.choose?.length ? s.pieces[s.choose[0]].owner : s.turn);
/** Actions that end the turn (free steps don't count when looking for checkmate). */
const turnActions = (s: LUState) => movesFor(s, s.turn).filter((a) => !isFree(a));

/* ---- Battles ------------------------------------------------------------- */
/** Bonuses in a battle the attacker starts. */
function attackBonus(_s: LUState, a: LUPiece): number {
  const lv = level(a);
  return (a.type === 'queen' && lv >= 2 ? 1 : 0) + (a.type === 'knight' && lv >= 3 ? 1 : 0);
}
function defenceBonus(s: LUState, d: LUPiece): number {
  // A level 3 king guards the friends next to him.
  return s.pieces.some((k) => k.type === 'king' && k.owner === d.owner && k.at >= 0 && k.id !== d.id && level(k) >= 3 && dist(k.at, d.at) === 1) ? 1 : 0;
}
/** Friends next to the target square (other than the attacker): a combined attack wins ties. */
export function combined(s: LUState, a: LUPiece, target: number): boolean {
  if (a.type === 'knight' && level(a) >= 3) return true;
  return s.pieces.some((q) => q.at >= 0 && q.owner === a.owner && q.id !== a.id && dist(q.at, target) === 1);
}

/** The battle result for given dice: 'win' (defender falls), 'bounce', or 'crushed' (attacker falls). */
export function battleOutcome(s: LUState, a: LUPiece, d: LUPiece, ad: number, dd: number): { outcome: 'win' | 'bounce' | 'crushed'; why: string; at: number; dt: number } {
  const at = ad + LU_PIECES[a.type].value + attackBonus(s, a);
  const dt = dd + LU_PIECES[d.type].value + defenceBonus(s, d);
  if (at > dt) return { outcome: 'win', why: 'Higher roll', at, dt };
  if (at < dt) return dt - at >= CRUSH_MARGIN ? { outcome: 'crushed', why: 'Crushed!', at, dt } : { outcome: 'bounce', why: 'Bounced off', at, dt };
  if (combined(s, a, d.at)) return { outcome: 'win', why: 'Tie: combined attack wins', at, dt };
  if (BEATS[a.base] === d.base) return { outcome: 'win', why: `Tie: ${a.base} beats ${d.base}`, at, dt };
  return { outcome: 'bounce', why: BEATS[d.base] === a.base ? `Tie: ${d.base} beats ${a.base}` : 'Tie: same base, bounced off', at, dt };
}

/** Chance of each battle result (all 36 rolls), for the screen and the bot. */
export function battleOdds(s: LUState, a: LUPiece, target: LUPiece): { win: number; bounce: number; crushed: number } {
  const d = target.type === 'catapult' && target.crew !== undefined ? { ...s.pieces[target.crew], at: target.at } : target;
  const c = { win: 0, bounce: 0, crushed: 0 };
  for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) c[battleOutcome(s, a, d, x, y).outcome]++;
  return { win: c.win / 36, bounce: c.bounce / 36, crushed: c.crushed / 36 };
}
/** A scout's strike: 1 it falls, 2-3 bounces, 4-6 (5-6 at +1) the target falls. */
export function strikeOutcome(scout: LUPiece, roll: number): 'win' | 'bounce' | 'crushed' {
  const r = roll + (level(scout) >= 3 ? 1 : 0);
  return roll === 1 ? 'crushed' : r >= 4 ? 'win' : 'bounce';
}
export const strikeOdds = (scout: LUPiece) => ({ win: [1, 2, 3, 4, 5, 6].filter((r) => strikeOutcome(scout, r) === 'win').length / 6, crushed: 1 / 6 });

/* ---- Playing an action --------------------------------------------------- */
function clone(s: LUState): LUState {
  return {
    ...s, pieces: s.pieces.map((p) => ({ ...p, known: [...p.known] })), sq: s.sq.slice(), trees: s.trees.slice(), walls: [...(s.walls ?? [])], mines: s.mines.map((m) => ({ ...m })), craters: [...(s.craters ?? [])],
    choose: [...(s.choose ?? [])],
    shots: s.shots.map((x) => ({ ...x })), fallen: s.fallen.map((f) => ({ ...f })), globals: s.globals.map((g) => ({ ...g })),
    raceDeck: [...s.raceDeck], raceDone: s.raceDone.map((g) => ({ ...g })),
    secretDone: { ...s.secretDone }, cleared: { ...s.cleared }, secret: { ...s.secret }, events: [],
  };
}

function fall(s: LUState, p: LUPiece) {
  if (p.at < 0) return;
  // Bombardiers can't be destroyed: only their crew falls.
  if (p.type === 'catapult') { loseCrew(s, p); return; }
  s.fallen.push({ id: p.id, at: p.at, ply: s.ply });
  s.sq[p.at] = -1;
  p.at = -1;
  p.stunUntil = undefined;
}
/** A bombardier's crew falls; the bombardier stays, empty. */
function loseCrew(s: LUState, c: LUPiece) {
  if (c.crew === undefined) return;
  const p = s.pieces[c.crew];
  s.fallen.push({ id: p.id, at: c.at, ply: s.ply });
  p.riding = undefined;
  c.crew = undefined;
  s.events.push({ k: 'crew-lost', piece: p.id, catapult: c.id });
}
/** The defender in a fight: a bombardier is defended by its crew. */
function defender(s: LUState, q: LUPiece): LUPiece {
  return q.type === 'catapult' && q.crew !== undefined ? { ...s.pieces[q.crew], at: q.at } : q;
}

/** Everything next to `at` misses its side's next turn (kings shrug it off). */
function stunAround(s: LUState, at: number) {
  for (const [df, dr] of ALL) {
    const q = pieceAt(s, step(at, df, dr));
    if (!q || q.type === 'king') continue;
    // The owner's next turn starts at this ply (or the one after, if it is their turn now).
    const next = s.ply + (q.owner === s.turn ? 2 : 1);
    q.stunUntil = Math.max(q.stunUntil ?? 0, next + 1);
    s.events.push({ k: 'stun', piece: q.id });
  }
}

/** A battle won here (or a shot that hit) shakes the barricades around it. */
function shake(s: LUState, at: number, by: Side, radius = 1) {
  for (let df = -radius; df <= radius; df++) for (let dr = -radius; dr <= radius; dr++) {
    const t = step(at, df, dr);
    if (t < 0 || s.trees[t] === 0) continue;
    s.trees[t]--;
    s.events.push({ k: 'tree', at: t, gone: s.trees[t] === 0 });
    if (s.trees[t] === 0) { s.cleared[by]++; noteGlobal(s, by, 'G-tree', -1); if (s.cleared[by] >= 3) noteSecret(s, by, 'S-trees', -1); }
  }
}

function award(s: LUState, p: LUPiece | undefined, id: string, extra = 0) {
  if (!p || (p.at < 0 && p.riding === undefined)) return;
  const r = XP[id];
  const points = r.points + extra;
  const before = level(p);
  p.xp += points;
  s.events.push({ k: 'xp', piece: p.id, points, why: r.label });
  const after = level(p);
  if (after > before) {
    s.events.push({ k: 'levelup', piece: p.id, level: after, why: r.label });
    noteGlobal(s, p.owner, 'G-level', p.id);
    if (after === 3) { noteSecret(s, p.owner, 'S-max', p.id); noteGlobal(s, p.owner, 'G-max', p.id); }
    // A scout picks its job at level 2 (owner, 2026-11-19).
    if (p.type === 'scout' && !p.role && after >= 2 && !s.choose.includes(p.id)) s.choose.push(p.id);
    if (p.type === 'miner') p.carry = Math.max(p.carry ?? 0, 0);
  }
}
/** First to do a face-up race mission claims it (points to the piece that did it, if any); the next card is drawn. */
function noteGlobal(s: LUState, side: Side, id: string, piece: number) {
  const i = s.globals.findIndex((x) => x.id === id && !x.winner);
  if (i < 0) return;
  s.raceDone.push({ id, winner: side });
  const next = s.raceDeck.shift();
  if (next) s.globals[i] = { id: next, winner: null };
  else s.globals.splice(i, 1);
  s.events.push({ k: 'mission', side, id, kind: 'global' });
  if (piece >= 0) award(s, s.pieces[piece], 'global');
}
function noteSecret(s: LUState, side: Side, id: string, piece: number) {
  if (s.secret[side] !== id || s.secretDone[side]) return;
  s.secretDone[side] = true;
  s.events.push({ k: 'mission', side, id, kind: 'secret' });
  if (piece >= 0) award(s, s.pieces[piece], 'secret');
}

function reveal(...ps: LUPiece[]) {
  for (const p of ps) for (const side of ['p1', 'p2'] as Side[]) if (!p.known.includes(side)) p.known.push(side);
}

/** A mine goes off at `at`: whoever stands there falls (not a king), everything next to it is stunned. */
function explode(s: LUState, m: { at: number; owner: Side; by?: number }, victim: LUPiece | undefined) {
  s.mines = s.mines.filter((x) => x !== m);
  s.events.push({ k: 'boom', at: m.at, piece: victim?.id ?? -1 });
  if (victim && victim.type !== 'king') {
    fall(s, victim);
    if (victim.owner !== m.owner) {
      noteSecret(s, m.owner, 'S-trap', -1);
      if (m.by !== undefined && s.pieces[m.by].at >= 0) award(s, s.pieces[m.by], 'trap');
    }
  }
  stunAround(s, m.at);
  shake(s, m.at, m.owner);
}

/** A miner tries to defuse a mine: 1 it blows up, 2-6 it is safe, 6 the miner keeps it. */
function defuse(s: LUState, miner: LUPiece, m: { at: number; owner: Side; by?: number }, onIt: boolean) {
  const roll = d6(s);
  if (roll === 1) { s.events.push({ k: 'defuse', at: m.at, piece: miner.id, roll, kept: false }); explode(s, m, onIt ? miner : undefined); return; }
  s.mines = s.mines.filter((x) => x !== m);
  const room = MINER_CARRY[level(miner) - 1] - (miner.carry ?? 0);
  const kept = roll === 6 && room > 0;
  if (kept) miner.carry = (miner.carry ?? 0) + 1;
  s.events.push({ k: 'defuse', at: m.at, piece: miner.id, roll, kept });
  if (m.owner !== miner.owner) award(s, miner, 'sweep');
}

/** Moving onto ground: a mine there goes off (a miner tries to defuse it instead). */
function land(s: LUState, p: LUPiece, to: number) {
  if (p.at >= 0) s.sq[p.at] = -1;
  p.at = to;
  s.sq[to] = p.id;
  p.moved = true;
  const m = mineAt(s, to);
  if (!m) return;
  if (p.type === 'miner') defuse(s, p, m, true);
  else explode(s, m, p);
}

/** Play an action. Returns a new state; the old one is unchanged. */
export function play(prev: LUState, a: LUAction, check = true): LUState {
  if (prev.result) throw new Error('Game over');
  const s = clone(prev);
  const me = s.turn;
  if (a.t === 'resign') {
    s.result = { winner: other(a.by), reason: 'resign', grade: WIN_GRADES.plain };
    return s;
  }
  // `check` off only for moves already checked once (a stored game being replayed).
  if (check && !legalActions(prev).some((x) => JSON.stringify(x) === JSON.stringify(a))) throw new Error('Not a legal action');
  const p = s.pieces[a.piece];
  const from = p.at;
  // Free actions: a job pick, or one bombardier step. The turn goes on.
  if (a.t === 'role') {
    s.choose = s.choose.filter((x) => x !== p.id);
    p.role = a.role;
    if (a.role === 'medic') p.type = 'medic';
    if (a.role === 'miner') { p.type = 'miner'; p.carry = MINER_CARRY[level(p) - 1]; }
    s.events.push({ k: 'role', piece: p.id, role: a.role });
    return s;
  }
  if (a.t === 'mark' || a.t === 'fire' || a.t === 'reload') {
    p.stepPly = s.ply;
    if (a.t === 'mark') {
      s.shots = s.shots.filter((x) => x.catapult !== p.id);
      s.shots.push({ by: me, catapult: p.id, at: a.to, ply: s.ply });
      s.events.push({ k: 'shot', at: a.to, by: me });
      p.load = 'aimed';
    } else if (a.t === 'fire') {
      const shot = s.shots.find((x) => x.catapult === p.id)!;
      s.shots = s.shots.filter((x) => x !== shot);
      resolveShot(s, shot);
      p.load = 'empty';
    } else {
      p.load = 'loaded';
      s.events.push({ k: 'reload', piece: p.id });
    }
    return s;
  }
  let moved: LUPiece | undefined = p;
  switch (a.t) {
    case 'move': {
      land(s, p, a.to);
      if (a.mine) {
        s.mines.push({ at: from, owner: me, by: p.id });
        p.carry = (p.carry ?? 1) - 1;
        noteGlobal(s, me, 'G-mine', p.id);
      }
      // A miner that ends next to one of its bombardiers gets new mines.
      if (p.type === 'miner' && p.at >= 0 && s.pieces.some((c) => c.type === 'catapult' && c.owner === me && c.at >= 0 && dist(c.at, p.at) === 1)) {
        p.carry = MINER_CARRY[level(p) - 1];
      }
      if (p.at < 0) moved = undefined;
      break;
    }
    case 'castle': {
      const r = s.pieces[a.rook];
      land(s, p, a.to);
      s.sq[r.at] = -1;
      r.at = step(a.to, fileOf(from) < fileOf(a.to) ? -1 : 1, 0);
      s.sq[r.at] = r.id;
      r.moved = true;
      award(s, p, 'castle');
      noteGlobal(s, me, 'G-castle', p.id);
      break;
    }
    case 'attack': {
      const target = pieceAt(s, a.to)!;
      const d = defender(s, target);
      const ad = d6(s), dd = d6(s);
      const r = battleOutcome(s, p, d, ad, dd);
      reveal(p, target);
      if (target.type === 'catapult') reveal(s.pieces[d.id]);
      s.events.push({ k: 'battle', att: p.id, def: d.id, a: [ad, r.at], d: [dd, r.dt], outcome: r.outcome, why: r.why });
      if (r.outcome === 'win') {
        const big = LU_PIECES[d.type].value >= 3, brave = LU_PIECES[p.type].value < LU_PIECES[d.type].value;
        fall(s, target);
        // You can't move onto a bombardier: beating its crew leaves you where you were.
        if (target.type !== 'catapult') land(s, p, a.to);
        if (p.at >= 0) {
          award(s, p, 'kill');
          if (big) award(s, p, 'kill-big');
          if (brave) award(s, p, 'brave');
          noteGlobal(s, me, 'G-kill', p.id);
          if (p.type === 'pawn') { noteGlobal(s, me, 'G-pawnkill', p.id); if (d.type === 'queen' || d.type === 'rook') noteSecret(s, me, 'S-giant', p.id); }
        } else moved = undefined;
        shake(s, a.to, me);
      } else if (r.outcome === 'crushed') {
        fall(s, p);
        moved = undefined;
      }
      break;
    }
    case 'strike': {
      const target = pieceAt(s, a.to)!;
      const d = defender(s, target);
      const roll = d6(s);
      const outcome = strikeOutcome(p, roll);
      reveal(p, target);
      s.events.push({ k: 'strike', att: p.id, def: d.id, roll, outcome });
      if (outcome === 'win') {
        const wasKing = target.type === 'king';
        fall(s, target);
        award(s, p, 'kill');
        if (LU_PIECES[d.type].value >= 3) award(s, p, 'kill-big');
        if (LU_PIECES[p.type].value < LU_PIECES[d.type].value) award(s, p, 'brave');
        noteGlobal(s, me, 'G-kill', p.id);
        noteGlobal(s, me, 'G-strike', p.id);
        shake(s, a.to, me);
        if (wasKing) {
          s.result = { winner: me, reason: 'assassin', grade: WIN_GRADES.sneak };
          s.last = { from, to: a.to, by: me };
          return s;
        }
      } else if (outcome === 'crushed') { fall(s, p); moved = undefined; }
      break;
    }
    case 'revive': {
      const q = s.pieces[a.fallen];
      s.fallen = s.fallen.filter((f) => f.id !== q.id);
      q.at = a.to;
      s.sq[a.to] = q.id;
      s.events.push({ k: 'revive', piece: q.id, at: a.to });
      award(s, p, 'revive');
      noteSecret(s, me, 'S-life', p.id);
      noteGlobal(s, me, 'G-revive', p.id);
      break;
    }
    case 'board': {
      const c = s.pieces[a.catapult];
      s.sq[p.at] = -1;
      p.at = -1;
      p.riding = c.id;
      c.crew = p.id;
      if (!c.load) c.load = 'empty';
      s.events.push({ k: 'crew', piece: p.id, catapult: c.id, on: true });
      moved = undefined;
      break;
    }
    case 'unboard': {
      const q = s.pieces[p.crew!];
      p.crew = undefined;
      q.riding = undefined;
      s.events.push({ k: 'crew', piece: q.id, catapult: p.id, on: false });
      land(s, q, a.to);
      moved = q.at >= 0 ? q : undefined;
      break;
    }
    case 'retrain':
      p.type = 'scout';
      p.xp = 0;
      p.role = undefined;
      s.events.push({ k: 'retrain', piece: p.id });
      moved = undefined;
      break;
    case 'defuse': {
      const m = mineAt(s, a.at)!;
      defuse(s, p, m, false);
      moved = undefined;
      break;
    }
    case 'clear': {
      // A tree goes in one action; a rook's wall takes two (owner, 2026-11-19).
      const wall = isWall(s, a.at);
      s.trees[a.at] = wall ? s.trees[a.at] - 1 : 0;
      const gone = s.trees[a.at] === 0;
      s.events.push({ k: 'tree', at: a.at, gone });
      if (gone) {
        s.walls = (s.walls ?? []).filter((x) => x !== a.at);
        s.cleared[me]++;
        noteGlobal(s, me, 'G-tree', p.id);
        if (s.cleared[me] >= 3) noteSecret(s, me, 'S-trees', p.id);
      }
      moved = undefined;
      break;
    }
    case 'wall':
      s.trees[a.at] = BARRICADE_HP;
      s.walls = [...(s.walls ?? []).filter((x) => x !== a.at), a.at];
      s.events.push({ k: 'wall', at: a.at, piece: p.id });
      moved = undefined;
      break;
  }
  // Things the moved piece earned by where it stands now.
  if (moved && moved.at >= 0 && (a.t === 'move' || a.t === 'attack' || a.t === 'castle' || a.t === 'unboard')) {
    if (moved.type === 'pawn' && rankOf(moved.at) === (me === 'p1' ? H - 1 : 0)) {
      moved.type = 'queen';
      s.events.push({ k: 'promote', piece: moved.id });
      noteGlobal(s, me, 'G-promote', moved.id);
    }
    if (!moved.centre && isCentre(moved.at)) { moved.centre = true; award(s, moved, 'centre'); noteGlobal(s, me, 'G-centre', moved.id); }
    const hit = threats(s, moved).map((t) => pieceAt(s, t)).filter((q): q is LUPiece => !!q && q.owner !== me);
    if (hit.some((q) => q.type === 'king')) { award(s, moved, 'check'); noteGlobal(s, me, 'G-check', moved.id); if (moved.type === 'knight') noteSecret(s, me, 'S-knightcheck', moved.id); }
    if (hit.filter((q) => q.type === 'king' || LU_PIECES[q.type].value >= 3).length >= 2) { award(s, moved, 'fork'); noteGlobal(s, me, 'G-fork', moved.id); }
    if (pins(s, moved)) award(s, moved, 'pin');
  }
  s.last = { from, to: 'to' in a ? a.to : 'at' in a ? a.at : from, by: me };
  s.turn = other(me);
  s.ply++;
  // Is the next player stuck?
  if (!kingOf(s, s.turn)) s.result = { winner: me, reason: 'assassin', grade: WIN_GRADES.sneak };
  else if (!turnActions(s).length) {
    s.result = inCheck(s, s.turn)
      ? { winner: me, reason: 'checkmate', grade: s.secretDone[me] ? WIN_GRADES.complete : WIN_GRADES.plain }
      : { winner: null, reason: 'stalemate', grade: 'Draw' };
  } else if (inCheck(s, s.turn)) s.events.push({ k: 'check', side: s.turn });
  return s;
}

/** Does this slider line up on an enemy with a bigger enemy (or the king) right behind it? */
function pins(s: LUState, p: LUPiece): boolean {
  const dirs = p.type === 'rook' ? ORTH : p.type === 'bishop' ? DIAG : p.type === 'queen' ? ALL : [];
  for (const [df, dr] of dirs) {
    let at = p.at;
    let first: LUPiece | undefined;
    for (;;) {
      at = step(at, df, dr);
      if (!open(s, at)) break;
      const q = pieceAt(s, at);
      if (!q) continue;
      if (q.owner === p.owner) break;
      if (!first) { first = q; continue; }
      if (q.type === 'king' || LU_PIECES[q.type].value > LU_PIECES[first.type].value) return true;
      break;
    }
  }
  return false;
}

/** Does a friendly rook keep this square safe from a shot coming from `from`? */
function shieldOf(s: LUState, at: number, owner: Side, from: number): LUPiece | undefined {
  const sx = Math.sign(fileOf(from) - fileOf(at)), sy = Math.sign(rankOf(from) - rankOf(at));
  const between = [step(at, sx, 0), step(at, 0, sy), step(at, sx, sy)].filter((x) => x >= 0 && x !== at);
  for (const r of s.pieces) {
    if (r.type !== 'rook' || r.owner !== owner || r.at < 0) continue;
    const lv = level(r);
    // Level 2 and up (owner, 2026-11-19): shields the pieces next to it, and the piece right behind it.
    if (lv >= 2 && (dist(r.at, at) === 1 || between.includes(r.at))) return r;
  }
  return undefined;
}

/** One square of a shot: an enemy there falls unless a rook shields it. Kings are never hit; a bombardier loses its crew. */
function hitSquare(s: LUState, shot: Shot, cat: LUPiece, from: number, at: number, main: boolean): boolean {
  const q = pieceAt(s, at);
  if (!q || q.type === 'king' || (!main && q.owner === shot.by)) return false;
  if (q.type === 'catapult' && q.crew === undefined) return false;
  const shield = shieldOf(s, at, q.owner, from);
  if (shield) { s.events.push({ k: 'shield', at, rook: shield.id }); return false; }
  const d = defender(s, q);
  reveal(q);
  fall(s, q);
  s.events.push({ k: 'hit', at, piece: d.id });
  if (q.owner !== shot.by) {
    award(s, cat, 'hit');
    if (LU_PIECES[d.type].value >= 3) award(s, cat, 'kill-big');
    noteGlobal(s, shot.by, 'G-shot', cat.id);
    noteSecret(s, shot.by, 'S-bullseye', cat.id);
  }
  return true;
}

function resolveShot(s: LUState, shot: Shot) {
  const cat = s.pieces[shot.catapult];
  const from = cat.at;
  const big = level(cat) >= 3;
  const before = pieceAt(s, shot.at);
  const hit = hitSquare(s, shot, cat, from, shot.at, true);
  // A shot on a barricade (tree or wall) blows it up (owner, 2026-11-19); the stun below catches whoever is around it.
  const blown = s.trees[shot.at] > 0;
  if (blown) {
    s.trees[shot.at] = 0;
    s.walls = (s.walls ?? []).filter((x) => x !== shot.at);
    s.events.push({ k: 'tree', at: shot.at, gone: true });
    s.cleared[shot.by]++;
    noteGlobal(s, shot.by, 'G-tree', cat.id);
    if (s.cleared[shot.by] >= 3) noteSecret(s, shot.by, 'S-trees', cat.id);
  }
  if (!hit && !before && !blown) s.events.push({ k: 'miss', at: shot.at });
  if (hit) shake(s, shot.at, shot.by);
  // Level 3 (owner, 2026-11-19): the blast also hits the four diagonal squares around the target.
  if (big) for (const [df, dr] of DIAG) { const t = step(shot.at, df, dr); if (t >= 0) hitSquare(s, shot, cat, from, t, false); }
  // Everything next to the target (still standing) is stunned (owner, 2026-11-19).
  stunAround(s, shot.at);
  // A level 3 shot leaves a crater for the rest of the game.
  if (big && s.sq[shot.at] < 0) {
    s.mines = s.mines.filter((m) => m.at !== shot.at);
    s.craters.push(shot.at);
    s.events.push({ k: 'crater', at: shot.at });
    if (!hit) shake(s, shot.at, shot.by);
  }
}

/* ---- What each side can see (fog of war) --------------------------------- */
export interface View {
  /** Squares this side can see. */
  seen: Set<number>;
  /** Squares inside its scouts' sight: identities, bases, invisible spies and mines show there. */
  scouted: Set<number>;
  /** Mines this side can see: its own, any in its scouts' sight, any next to its miners. */
  mines: Set<number>;
}
export function viewOf(s: LUState, side: Side): View {
  const seen = new Set<number>();
  const scouted = new Set<number>();
  for (const p of s.pieces) {
    if (p.at < 0 || p.owner !== side) continue;
    seen.add(p.at);
    for (const [df, dr] of ALL) { const t = step(p.at, df, dr); if (t >= 0) seen.add(t); }
    for (const t of threats(s, p)) seen.add(t);
    for (const a of pieceActions(s, p)) if ('to' in a && a.t !== 'mark') seen.add(a.to);
    // Scouts, and the medics and miners they grow into, see further and see what things are.
    if (p.type === 'scout' || p.type === 'medic' || p.type === 'miner') {
      const r = SCOUT_SIGHT[level(p) - 1];
      for (let df = -r; df <= r; df++) for (let dr = -r; dr <= r; dr++) { const t = step(p.at, df, dr); if (t >= 0) { seen.add(t); scouted.add(t); } }
    }
  }
  // Your own shots' targets and incoming warnings are always shown.
  for (const x of s.shots) seen.add(x.at);
  const mines = new Set<number>();
  const miners = s.pieces.filter((p) => p.type === 'miner' && p.owner === side && p.at >= 0);
  for (const m of s.mines) if (m.owner === side || scouted.has(m.at) || miners.some((p) => dist(p.at, m.at) <= 1)) mines.add(m.at);
  return { seen, scouted, mines };
}
/** Can `side` see this enemy piece at all? (A level 2+ scout is invisible except to scouts.) */
export function visible(_s: LUState, v: View, side: Side, p: LUPiece): boolean {
  if (p.at < 0) return false;
  if (p.owner === side) return true;
  if (p.type === 'scout' && level(p) >= 2) return v.scouted.has(p.at);
  return v.seen.has(p.at);
}
/** Does `side` know what this piece is (and its base)? */
export const identified = (v: View, side: Side, p: LUPiece) => p.owner === side || p.known.includes(side) || v.scouted.has(p.at);

/* ---- Building positions (tests, tutorials) ------------------------------- */
export function blankGame(seed = 1): LUState {
  const s = newGame(seed);
  s.pieces = [];
  s.sq.fill(-1);
  s.trees.fill(0);
  // No missions: a test or tutorial adds what it needs.
  s.globals = [];
  s.raceDeck = [];
  s.secret = { p1: '', p2: '' };
  return s;
}
/** Put a piece down (tests, tutorials). Bombardiers come crewed and loaded unless `crew: false`; miners carry one mine. */
export function put(s: LUState, type: LUType, owner: Side, at: number, opts: { xp?: number; base?: Base; moved?: boolean; crew?: boolean; role?: LURole } = {}): LUPiece {
  const p: LUPiece = { id: s.pieces.length, type, owner, at, moved: opts.moved ?? false, xp: opts.xp ?? 0, base: opts.base ?? 'square', known: [owner] };
  if (opts.role) p.role = opts.role;
  if (type === 'scout' && levelOf(p.xp) >= 2 && !p.role) p.role = 'spy';
  if (type === 'miner') { p.role = 'miner'; p.carry = MINER_CARRY[Math.max(1, levelOf(p.xp)) - 1] || 1; }
  if (type === 'medic') p.role = 'medic';
  s.pieces.push(p);
  s.sq[at] = p.id;
  if (type === 'catapult') { if (opts.crew === false) p.load = 'loaded'; else crewUp(s, p, 'square'); }
  return p;
}
