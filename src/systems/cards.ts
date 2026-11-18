import { CARDS } from '../content/cards';
import { fileOf, rankOf, seatOf } from '../core/board';
import { baseType, pieceType } from '../core/pieces';
import type { GameRecord } from '../core/record';
import type { Action, GameState, MoveAction, PlayerId } from '../core/types';
import { hanging } from '../tactics/attacks';
import { isDiscovered, isFork, isPin, isSkewer } from '../tactics/detectors';
import { missionDone } from './missions';

/**
 * Earning power cards (docs/02 s6, s8). After each finished 1 vs 1 game the
 * player's moves are checked against every card's earn condition. Meeting a
 * condition adds one copy (at most one copy of a card per game). Some
 * conditions count across games ("in 3 games"): progress lives in
 * profile.cardProgress. Players under 800 get a random Common every third game.
 */
export interface EarnInput {
  record: GameRecord;
  states: GameState[];
  me: PlayerId;
  /** Rated game (bot, online or party; not training). */
  rated: boolean;
  /** Missions completed so far, including this game. */
  missionsCompleted: number;
  rating: number;
  /** Games finished so far, including this one. */
  gamesPlayed: number;
}

export interface EarnResult {
  cards: string[];
  progress: Record<string, number>;
}

const rel = (s: GameState, p: PlayerId, sq: number) => {
  const f = seatOf(s, p).forward;
  return f[1] > 0 ? rankOf(s.board, sq) : f[1] < 0 ? s.board.height - 1 - rankOf(s.board, sq) : f[0] > 0 ? fileOf(s.board, sq) : s.board.width - 1 - fileOf(s.board, sq);
};
const mine = (s: GameState, p: PlayerId, type: string) => s.pieces.filter((x) => x.at >= 0 && x.owner === p && baseType(x.type) === type);
const material = (s: GameState, p: PlayerId) => s.pieces.filter((x) => x.at >= 0 && x.owner === p && x.type !== 'king').reduce((a, x) => a + Math.floor(pieceType(baseType(x.type)).value), 0);

/** Two rooks on the same rank (or file) with nothing between them. */
function connected(s: GameState, p: PlayerId, sameFileOnly = false): boolean {
  const rooks = mine(s, p, 'rook');
  if (rooks.length < 2) return false;
  const [a, b] = rooks;
  const fa = fileOf(s.board, a.at), fb = fileOf(s.board, b.at), ra = rankOf(s.board, a.at), rb = rankOf(s.board, b.at);
  if (fa === fb) {
    for (let r = Math.min(ra, rb) + 1; r < Math.max(ra, rb); r++) if (s.sq[r * s.board.width + fa] >= 0) return false;
    if (!sameFileOnly) return true;
    // Open file: no pawns on it at all.
    for (let r = 0; r < s.board.height; r++) { const id = s.sq[r * s.board.width + fa]; if (id >= 0 && baseType(s.pieces[id].type) === 'pawn') return false; }
    return true;
  }
  if (sameFileOnly || ra !== rb) return false;
  for (let f = Math.min(fa, fb) + 1; f < Math.max(fa, fb); f++) if (s.sq[ra * s.board.width + f] >= 0) return false;
  return true;
}

function passedPawn(s: GameState, p: PlayerId): boolean {
  const enemyPawns = s.pieces.filter((x) => x.at >= 0 && x.owner !== p && baseType(x.type) === 'pawn');
  return mine(s, p, 'pawn').some((pw) => {
    const f = fileOf(s.board, pw.at), r = rel(s, p, pw.at);
    return !enemyPawns.some((e) => Math.abs(fileOf(s.board, e.at) - f) <= 1 && rel(s, p, e.at) > r);
  });
}

export function cardsEarned(i: EarnInput, progress: Record<string, number>): EarnResult {
  const { states, me, record } = i;
  const end = states[states.length - 1];
  const result = end.result;
  const out = new Set<string>();
  const prog = { ...progress };
  if (!result || end.seats.length !== 2) return { cards: [], progress: prog };
  const won = result.winners.includes(me);
  const drew = result.winners.length === 0;
  const other = end.seats.find((x) => x.id !== me)!.id;
  const actions = record.actions;
  // My moves, with the position before each.
  const myMoves: { s: GameState; after: GameState; m: MoveAction; n: number }[] = [];
  let count = 0;
  actions.forEach((a: Action, k) => {
    if (a.t === 'move' && states[k].turn === me) myMoves.push({ s: states[k], after: states[k + 1], m: a, n: ++count });
  });
  const everyState = (fn: (s: GameState) => boolean) => states.some(fn);

  if (won && everyState((s) => mine(s, me, 'rook').some((r) => rel(s, me, r.at) === s.board.height - 2))) out.add('CARD-01');
  if (won && end.pieces.filter((x) => x.at >= 0 && x.owner === me && x.type === 'bishop').length >= 2) out.add('CARD-02');
  if (i.rated) {
    prog.winStreak = won ? (prog.winStreak ?? 0) + 1 : 0;
    if (won && prog.winStreak > 0 && prog.winStreak % 3 === 0) out.add('CARD-03');
  }
  if (myMoves.some((x) => !!x.m.promo)) out.add('CARD-04');
  const counter = (key: string, hit: boolean, need: number, card: string) => {
    if (!hit) return;
    prog[key] = (prog[key] ?? 0) + 1;
    if (prog[key] % need === 0) out.add(card);
  };
  counter('rooksConnected', myMoves.some((x) => x.n <= 12 && connected(x.after, me)), 3, 'CARD-05');
  // Detectors look at a handful of moves only, to stay quick on phones.
  for (const x of myMoves) {
    if (x.after.result) continue;
    if (!out.has('CARD-06') && isPin(x.s, x.m)) out.add('CARD-06');
    if (!out.has('CARD-07') && baseType(x.s.pieces[x.m.piece].type) === 'knight' && isFork(x.s, x.m)) out.add('CARD-07');
    if (!out.has('CARD-09') && isDiscovered(x.s, x.m)) out.add('CARD-09');
    if (!out.has('CARD-20') && isSkewer(x.s, x.m)) out.add('CARD-20');
  }
  let calm = 0;
  for (const x of myMoves) {
    calm = hanging(x.after, me, 1).length ? 0 : calm + 1;
    if (calm >= 10) { out.add('CARD-08'); break; }
  }
  if ((won || drew) && everyState((s) => material(s, other) - material(s, me) >= 3)) out.add('CARD-10');
  if (won && myMoves.some((x) => baseType(x.s.pieces[x.m.piece].type) === 'knight' && x.s.sq[x.m.to] >= 0 && ['rook', 'queen'].includes(baseType(x.s.pieces[x.s.sq[x.m.to]].type)))) out.add('CARD-11');
  if (won && end.mode === 'random-piece') out.add('CARD-13');
  if (won && result.reason === 'checkmate' && end.last && baseType(end.pieces[end.last.piece].type) === 'rook') out.add('CARD-15');
  if (myMoves.some((x, k) => missionDone('MISSION-10', { states, ply: states.indexOf(x.s), move: x.m, player: me, movesMade: k + 1 }))) out.add('CARD-16');
  counter('passedPawn', states.some((s) => passedPawn(s, me)), 3, 'CARD-17');
  const queens = (s: GameState) => mine(s, me, 'queen').length;
  if (won && queens(states[0]) > 0 && everyState((s) => queens(s) === 0)) out.add('CARD-18');
  if (everyState((s) => connected(s, me, true))) out.add('CARD-21');
  const pawnsLost = mine(states[0], me, 'pawn').length - mine(end, me, 'pawn').length;
  if (won && pawnsLost <= 2 && myMoves.length >= 10) out.add('CARD-22');
  counter('earlyCastle', myMoves.some((x) => x.n <= 8 && !!x.m.castle), 5, 'CARD-24');
  if (i.missionsCompleted > 0 && i.missionsCompleted % 10 === 0 && result.reason === 'mission' && won) out.add('CARD-23');

  // Beginner gift: one random Common every third game while under 800.
  if (i.rating < 800 && i.gamesPlayed > 0 && i.gamesPlayed % 3 === 0) {
    const commons = CARDS.filter((c) => c.rarity === 'Common' && !c.notYet && !out.has(c.id));
    if (commons.length) out.add(commons[(i.gamesPlayed * 7 + (record.seed >>> 0)) % commons.length].id);
  }
  return { cards: [...out].filter((id) => !CARDS.find((c) => c.id === id)?.notYet), progress: prog };
}

/** Owner rule: you need 3 copies of a card to bring it into a Party match, and playing it uses all 3. */
export const COPIES_TO_PLAY = 3;

/** Add earned cards to a collection, and burn the ones played (3 copies each). */
export function updateCollection(collection: Record<string, number>, earned: string[], played: string[]): Record<string, number> {
  const c = { ...collection };
  for (const id of played) c[id] = Math.max(0, (c[id] ?? 0) - COPIES_TO_PLAY);
  for (const id of earned) c[id] = (c[id] ?? 0) + 1;
  for (const k of Object.keys(c)) if (!c[k]) delete c[k];
  return c;
}

/** Cards you can put in a hand: ones you have 3 of, no duplicates, playable in this build. */
export function handOptions(collection: Record<string, number>): string[] {
  return CARDS.filter((c) => !c.notYet && (collection[c.id] ?? 0) >= COPIES_TO_PLAY).map((c) => c.id);
}

/** The hand to bring: the cards picked, minus any no longer owned. */
export function currentHand(collection: Record<string, number>, picked: string[] | undefined): string[] {
  const ok = new Set(handOptions(collection));
  return [...new Set(picked ?? [])].filter((id) => ok.has(id)).slice(0, 3);
}
