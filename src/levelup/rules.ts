import {
  BARRICADE_HP, BEATS, RACE_FACE_UP, CATAPULT_RANGE, CRUSH_MARGIN, FOREST_DENSITY, FOREST_RANKS, GLOBAL_MISSIONS, LU_BACK, LU_FIRST_FILE, LU_PIECES, LU_SIZE,
  MINE_LIMIT, REVIVE_RANGE, REVIVE_TURNS, SCOUT_SIGHT, SECRET_MISSIONS, WIN_GRADES, XP, levelOf, type Base, type LUType,
} from '../content/levelup';

/**
 * Level-Up Chess rules (design doc "Level-Up Chess: design notes"). Pure and
 * deterministic: dice come from a seeded generator kept in the state, so a game
 * replays from its seed and actions. Two players for now (p1 at the bottom).
 */
export type Side = 'p1' | 'p2';
export const other = (s: Side): Side => (s === 'p1' ? 'p2' : 'p1');
export const N = LU_SIZE;
export const fileOf = (sq: number) => sq % N;
export const rankOf = (sq: number) => Math.floor(sq / N);
export const sqAt = (f: number, r: number) => (f < 0 || r < 0 || f >= N || r >= N ? -1 : r * N + f);
export const dist = (a: number, b: number) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
export const isCentre = (sq: number) => fileOf(sq) >= 6 && fileOf(sq) <= 9 && rankOf(sq) >= 6 && rankOf(sq) <= 9;

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
  mines: { at: number; owner: Side }[];
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
  | { t: 'move'; piece: number; to: number }
  | { t: 'attack'; piece: number; to: number }
  | { t: 'strike'; piece: number; to: number }
  | { t: 'castle'; piece: number; to: number; rook: number }
  | { t: 'fire'; piece: number; to: number }
  | { t: 'revive'; piece: number; fallen: number; to: number }
  | { t: 'mine'; piece: number; to: number }
  | { t: 'resign'; by: Side };

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
    seed, rng: seed | 0, turn: 'p1', ply: 0, pieces: [], sq: Array(N * N).fill(-1), trees: Array(N * N).fill(0), mines: [], craters: [], shots: [], fallen: [], result: null,
    secret: { p1: '', p2: '' }, secretDone: { p1: false, p2: false }, globals: [], raceDeck: [], raceDone: [], cleared: { p1: 0, p2: 0 }, events: [], last: null,
  };
  const bases: Base[] = ['triangle', 'square', 'circle'];
  const add = (type: LUType, owner: Side, at: number) => {
    const p: LUPiece = { id: s.pieces.length, type, owner, at, moved: false, xp: 0, base: bases[Math.floor(nextRand(s) * 3)], known: [owner] };
    s.pieces.push(p);
    s.sq[at] = p.id;
  };
  for (const owner of ['p1', 'p2'] as Side[]) {
    const back = owner === 'p1' ? 0 : N - 1, front = owner === 'p1' ? 1 : N - 2;
    LU_BACK.forEach((t, i) => add(t, owner, sqAt(LU_FIRST_FILE + i, back)));
    for (let i = 0; i < LU_BACK.length; i++) add('pawn', owner, sqAt(LU_FIRST_FILE + i, front));
  }
  // The forest: the same for both sides (turned half a turn), so neither side gets an easier path.
  for (let r = FOREST_RANKS[0]; r <= (FOREST_RANKS[0] + FOREST_RANKS[1]) / 2; r++) {
    for (let f = 0; f < N; f++) {
      if (nextRand(s) >= FOREST_DENSITY) continue;
      s.trees[sqAt(f, r)] = BARRICADE_HP;
      s.trees[sqAt(N - 1 - f, FOREST_RANKS[0] + FOREST_RANKS[1] - r)] = BARRICADE_HP;
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
  const slide = (dirs: [number, number][], max = N) => {
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
      const fw = forward(p.owner);
      if (lv >= 3) jump(ALL);
      else jump([[1, fw], [-1, fw]]);
      if (lv >= 2) for (const df of [2, -2]) { const mid = step(p.at, df / 2, fw); const t = step(p.at, df, 2 * fw); if (open(s, mid) && s.sq[mid] < 0 && open(s, t)) out.push(t); }
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
const minesOf = (s: LUState, side: Side) => s.mines.filter((m) => m.owner === side);
const mineAt = (s: LUState, sq: number) => s.mines.find((m) => m.at === sq);

/** Every action this piece could take, before the "don't leave your king in check" rule. */
export function pieceActions(s: LUState, p: LUPiece): LUAction[] {
  const out: LUAction[] = [];
  if (p.at < 0 || s.result) return out;
  const lv = level(p);
  const enemy = (sq: number) => { const q = pieceAt(s, sq); return q && q.owner !== p.owner ? q : undefined; };
  // Your own mines are walls to you; the enemy's look like empty ground.
  const free = (sq: number) => open(s, sq) && s.sq[sq] < 0 && !s.mines.some((m) => m.at === sq && m.owner === p.owner);
  const goOrHit = (sq: number) => {
    if (sq < 0 || !open(s, sq)) return;
    const e = enemy(sq);
    if (e) { if (e.type !== 'king') out.push({ t: 'attack', piece: p.id, to: sq }); }
    else if (free(sq)) out.push({ t: 'move', piece: p.id, to: sq });
  };
  const steps = (dirs: [number, number][]) => { for (const [df, dr] of dirs) goOrHit(step(p.at, df, dr)); };
  switch (p.type) {
    case 'pawn': {
      const fw = forward(p.owner);
      const one = step(p.at, 0, fw);
      if (free(one)) {
        out.push({ t: 'move', piece: p.id, to: one });
        const two = step(one, 0, fw);
        if (!p.moved && free(two)) out.push({ t: 'move', piece: p.id, to: two });
      }
      // Level 3 walks and fights one square any way; every level attacks the squares it threatens.
      if (lv >= 3) steps(ALL);
      for (const t of threats(s, p)) { const e = enemy(t); if (e && e.type !== 'king') out.push({ t: 'attack', piece: p.id, to: t }); }
      break;
    }
    case 'knight': case 'bishop': case 'rook': case 'queen':
      for (const t of threats(s, p)) goOrHit(t);
      break;
    case 'king':
      for (const t of threats(s, p)) goOrHit(t);
      out.push(...castles(s, p));
      break;
    case 'catapult': {
      for (const [df, dr] of ALL) { const t = step(p.at, df, dr); if (free(t)) out.push({ t: 'move', piece: p.id, to: t }); }
      const range = CATAPULT_RANGE[lv - 1];
      for (let sq = 0; sq < N * N; sq++) {
        const d = dist(sq, p.at);
        if (d < 2 || d > range) continue;
        const q = pieceAt(s, sq);
        if (q && q.owner === p.owner) continue;
        if (s.shots.some((x) => x.at === sq && x.by === p.owner)) continue;
        if (s.craters.includes(sq)) continue;
        out.push({ t: 'fire', piece: p.id, to: sq });
      }
      break;
    }
    case 'medic': {
      // Up to 3 steps through open, empty ground.
      const seen = new Map<number, number>([[p.at, 0]]);
      const queue = [p.at];
      while (queue.length) {
        const at = queue.shift()!;
        const d = seen.get(at)!;
        if (d === 3) continue;
        for (const [df, dr] of ALL) {
          const t = step(at, df, dr);
          if (t < 0 || seen.has(t) || !open(s, t) || s.sq[t] >= 0 || s.mines.some((m) => m.at === t && m.owner === p.owner)) continue;
          seen.set(t, d + 1);
          queue.push(t);
          out.push({ t: 'move', piece: p.id, to: t });
        }
      }
      out.push(...revives(s, p));
      break;
    }
    case 'miner': {
      for (const [df, dr] of ALL) { const t = step(p.at, df, dr); if (free(t)) out.push({ t: 'move', piece: p.id, to: t }); }
      if (minesOf(s, p.owner).length < MINE_LIMIT[lv - 1]) {
        const reach = lv >= 3 ? 2 : 1;
        for (let df = -reach; df <= reach; df++) for (let dr = -reach; dr <= reach; dr++) {
          const t = step(p.at, df, dr);
          if (t >= 0 && t !== p.at && open(s, t) && s.sq[t] < 0 && !mineAt(s, t)) out.push({ t: 'mine', piece: p.id, to: t });
        }
      }
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
  // One of each (a level 3 pawn can reach a square two ways).
  const seen = new Set<string>();
  return out.filter((a) => { const k = JSON.stringify(a); if (seen.has(k)) return false; seen.add(k); return true; });
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
  if (a.t === 'resign' || a.t === 'fire' || a.t === 'mine') return s;
  const n = { ...s, sq: s.sq.slice(), pieces: s.pieces.map((p) => ({ ...p })) };
  const p = n.pieces[a.piece];
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
export function legalActions(s: LUState, side: Side = s.turn): LUAction[] {
  if (s.result) return [];
  const out: LUAction[] = [];
  for (const p of s.pieces) {
    if (p.at < 0 || p.owner !== side) continue;
    for (const a of pieceActions(s, p)) {
      // An assassin that takes the king wins at once.
      if (a.t === 'strike' && pieceAt(s, a.to)?.type === 'king') { out.push(a); continue; }
      if (!inCheck(hopeful(s, a), side)) out.push(a);
    }
  }
  return out;
}

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
export function battleOdds(s: LUState, a: LUPiece, d: LUPiece): { win: number; bounce: number; crushed: number } {
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
    ...s, pieces: s.pieces.map((p) => ({ ...p, known: [...p.known] })), sq: s.sq.slice(), trees: s.trees.slice(), mines: s.mines.map((m) => ({ ...m })), craters: [...(s.craters ?? [])],
    shots: s.shots.map((x) => ({ ...x })), fallen: s.fallen.map((f) => ({ ...f })), globals: s.globals.map((g) => ({ ...g })),
    raceDeck: [...s.raceDeck], raceDone: s.raceDone.map((g) => ({ ...g })),
    secretDone: { ...s.secretDone }, cleared: { ...s.cleared }, secret: { ...s.secret }, events: [],
  };
}

function fall(s: LUState, p: LUPiece) {
  if (p.at < 0) return;
  s.fallen.push({ id: p.id, at: p.at, ply: s.ply });
  s.sq[p.at] = -1;
  p.at = -1;
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
  if (!p || p.at < 0) return;
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

/** Moving onto ground: an enemy mine there blows up (a king just clears it). */
function land(s: LUState, p: LUPiece, to: number) {
  s.sq[p.at] = -1;
  p.at = to;
  s.sq[to] = p.id;
  p.moved = true;
  const m = mineAt(s, to);
  if (m && m.owner !== p.owner) {
    s.mines = s.mines.filter((x) => x !== m);
    s.events.push({ k: 'boom', at: to, piece: p.id });
    if (p.type !== 'king') { fall(s, p); noteSecret(s, m.owner, 'S-trap', -1); }
    shake(s, to, m.owner);
  }
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
  let moved: LUPiece | undefined = p;
  switch (a.t) {
    case 'move': land(s, p, a.to); break;
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
      const d = pieceAt(s, a.to)!;
      const ad = d6(s), dd = d6(s);
      const r = battleOutcome(s, p, d, ad, dd);
      reveal(p, d);
      s.events.push({ k: 'battle', att: p.id, def: d.id, a: [ad, r.at], d: [dd, r.dt], outcome: r.outcome, why: r.why });
      if (r.outcome === 'win') {
        const big = LU_PIECES[d.type].value >= 3, brave = LU_PIECES[p.type].value < LU_PIECES[d.type].value;
        fall(s, d);
        land(s, p, a.to);
        award(s, p, 'kill');
        if (big) award(s, p, 'kill-big');
        if (brave) award(s, p, 'brave');
        noteGlobal(s, me, 'G-kill', p.id);
        if (p.type === 'pawn') { noteGlobal(s, me, 'G-pawnkill', p.id); if (d.type === 'queen' || d.type === 'rook') noteSecret(s, me, 'S-giant', p.id); }
        shake(s, a.to, me);
      } else if (r.outcome === 'crushed') {
        fall(s, p);
        moved = undefined;
      }
      break;
    }
    case 'strike': {
      const d = pieceAt(s, a.to)!;
      const roll = d6(s);
      const outcome = strikeOutcome(p, roll);
      reveal(p, d);
      s.events.push({ k: 'strike', att: p.id, def: d.id, roll, outcome });
      if (outcome === 'win') {
        const wasKing = d.type === 'king';
        fall(s, d);
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
    case 'fire':
      s.shots.push({ by: me, catapult: p.id, at: a.to, ply: s.ply });
      s.events.push({ k: 'shot', at: a.to, by: me });
      break;
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
    case 'mine':
      s.mines.push({ at: a.to, owner: me });
      noteGlobal(s, me, 'G-mine', p.id);
      break;
  }
  // Things the moved piece earned by where it stands now.
  if (moved && moved.at >= 0 && (a.t === 'move' || a.t === 'attack' || a.t === 'castle')) {
    if (moved.type === 'pawn' && rankOf(moved.at) === (me === 'p1' ? N - 1 : 0)) {
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
  // The other side's catapult shots land now: they had a turn to get away.
  for (const shot of s.shots.filter((x) => x.by !== me)) resolveShot(s, shot);
  s.shots = s.shots.filter((x) => x.by === me);
  s.last = { from, to: a.t === 'revive' ? a.to : a.to, by: me };
  s.turn = other(me);
  s.ply++;
  // Is the next player stuck?
  if (!kingOf(s, s.turn)) s.result = { winner: me, reason: 'assassin', grade: WIN_GRADES.sneak };
  else if (!legalActions(s).length) {
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
    if (lv >= 3 && dist(r.at, at) === 1) return r;
    if (lv >= 2 && between.includes(r.at)) return r;
  }
  return undefined;
}

/** One square of a shot: an enemy there falls unless a rook shields it. Kings are never hit. */
function hitSquare(s: LUState, shot: Shot, cat: LUPiece, from: number, at: number, main: boolean): boolean {
  const q = pieceAt(s, at);
  if (!q || q.type === 'king' || (!main && q.owner === shot.by)) return false;
  const shield = shieldOf(s, at, q.owner, from);
  if (shield) { s.events.push({ k: 'shield', at, rook: shield.id }); return false; }
  reveal(q);
  fall(s, q);
  s.events.push({ k: 'hit', at, piece: q.id });
  if (q.owner !== shot.by) {
    award(s, cat, 'hit');
    if (LU_PIECES[q.type].value >= 3) award(s, cat, 'kill-big');
    noteGlobal(s, shot.by, 'G-shot', cat.id);
    noteSecret(s, shot.by, 'S-bullseye', cat.id);
  }
  return true;
}

function resolveShot(s: LUState, shot: Shot) {
  const cat = s.pieces[shot.catapult];
  const from = cat.at >= 0 ? cat.at : shot.at;
  const big = cat.at >= 0 && level(cat) >= 3;
  const before = pieceAt(s, shot.at);
  const hit = hitSquare(s, shot, cat, from, shot.at, true);
  if (!hit && !before) s.events.push({ k: 'miss', at: shot.at });
  if (hit) shake(s, shot.at, shot.by);
  if (!big) return;
  // Level 3 (owner, 2026-11-19): the blast also hits the four diagonal squares around the target,
  // and the landing square becomes a crater for the rest of the game.
  for (const [df, dr] of DIAG) { const t = step(shot.at, df, dr); if (t >= 0) hitSquare(s, shot, cat, from, t, false); }
  if (s.sq[shot.at] < 0) {
    if (s.trees[shot.at] > 0) { s.trees[shot.at] = 0; s.cleared[shot.by]++; noteGlobal(s, shot.by, 'G-tree', cat.id); }
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
}
export function viewOf(s: LUState, side: Side): View {
  const seen = new Set<number>();
  const scouted = new Set<number>();
  for (const p of s.pieces) {
    if (p.at < 0 || p.owner !== side) continue;
    seen.add(p.at);
    for (const [df, dr] of ALL) { const t = step(p.at, df, dr); if (t >= 0) seen.add(t); }
    for (const t of threats(s, p)) seen.add(t);
    for (const a of pieceActions(s, p)) if ('to' in a && a.t !== 'fire') seen.add(a.to);
    if (p.type === 'scout') {
      const r = SCOUT_SIGHT[level(p) - 1];
      for (let df = -r; df <= r; df++) for (let dr = -r; dr <= r; dr++) { const t = step(p.at, df, dr); if (t >= 0) { seen.add(t); scouted.add(t); } }
    }
  }
  // Your own shots' targets and incoming warnings are always shown.
  for (const x of s.shots) seen.add(x.at);
  return { seen, scouted };
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
export function put(s: LUState, type: LUType, owner: Side, at: number, opts: { xp?: number; base?: Base; moved?: boolean } = {}): LUPiece {
  const p: LUPiece = { id: s.pieces.length, type, owner, at, moved: opts.moved ?? false, xp: opts.xp ?? 0, base: opts.base ?? 'square', known: [owner] };
  s.pieces.push(p);
  s.sq[at] = p.id;
  return p;
}
