import { activeSeats, eliminate, inCheck, legalMoves, makeMove } from './movegen';
import { baseType, pieceType } from './pieces';
import type { RuleModule } from './rules';
import type { GameResult, GameState, MoveAction, PlayerId } from './types';

/**
 * Mode rule modules (docs/03 Game modes, docs/09 section 5). Each mode is a
 * list of modules; rules.ts looks them up by GameState.mode.
 * Kept free of imports from rules.ts to avoid a cycle.
 */

/** The hill: central 4 squares on 8x8, central 16 on the four-player board. */
export function hillSquares(s: GameState): Set<number> {
  const b = s.board;
  const size = b.width >= 12 ? 4 : 2;
  const f0 = Math.floor((b.width - size) / 2);
  const r0 = Math.floor((b.height - size) / 2);
  const out = new Set<number>();
  for (let f = f0; f < f0 + size; f++) for (let r = r0; r < r0 + size; r++) out.add(r * b.width + f);
  return out;
}

/** Three and four player battles: kings are captured, not checkmated (docs/09 s4). */
const battle: RuleModule = {
  id: 'battle',
  checkEnforced: () => false,
  // No en passant with more than two players. Only the en passant square itself is ruled out:
  // on the hexagon a pawn stepping across the middle lands on another file and rank number,
  // and that is an ordinary step (owner, 2026-11-19: pawns could not cross the halfway line).
  filterMoves: (s, moves) =>
    moves.filter((m) => !(s.enPassant && m.to === s.enPassant.square && s.sq[m.to] < 0 && baseType(s.pieces[m.piece].type) === 'pawn')),
  // A player who cannot move at all is out (they would be stuck forever).
  afterMove: (s) => {
    let n = s;
    for (let guard = 0; guard < 4 && activeSeats(n).length > 1; guard++) {
      if (legalMoves(n, false).length > 0) break;
      n = eliminate(n, n.turn);
    }
    return n;
  },
};

/** MODE-02 King of the hill: a king that reaches the centre wins. Two players. */
const kingOfTheHill: RuleModule = {
  id: 'koth',
  checkEnd: (s, prev, action) => {
    if (action.t !== 'move') return undefined;
    const p = s.pieces[action.piece];
    if (p.type === 'king' && hillSquares(s).has(p.at)) return { reason: 'mode-win', winners: [prev.turn] };
    return undefined;
  },
};

export interface HillData { scores: Record<string, number>; target: number }

export function hillData(s: GameState): HillData {
  const d = s.modeData?.hill as HillData | undefined;
  return d ?? { scores: {}, target: s.seats.length > 2 ? 30 : 20 };
}

/**
 * MODE-29 Hill wars: at the end of every full round each player scores 1 per
 * hill square they hold, 2 for their king. First to the target wins.
 */
const hillWars: RuleModule = {
  id: 'hill-wars',
  afterMove: (s, prev) => {
    const order = s.seats.filter((x) => x.status === 'active').map((x) => x.id);
    // A round ends when play comes back round to the first active seat.
    const roundEnded = order.length > 0 && s.turn === order[0] && prev.turn !== s.turn;
    if (!roundEnded) return s;
    const hill = hillSquares(s);
    const d = hillData(s);
    const scores = { ...d.scores };
    for (const sq of hill) {
      const id = s.sq[sq];
      if (id < 0) continue;
      const p = s.pieces[id];
      if (!order.includes(p.owner)) continue;
      scores[p.owner] = (scores[p.owner] ?? 0) + (p.type === 'king' ? 2 : 1);
    }
    return { ...s, modeData: { ...(s.modeData ?? {}), hill: { ...d, scores } } };
  },
  checkEnd: (s): GameResult | undefined => {
    const d = hillData(s);
    const leaders = Object.entries(d.scores).filter(([, v]) => v >= d.target).sort((a, b) => b[1] - a[1]);
    if (!leaders.length) return undefined;
    const top = leaders[0][1];
    const winners = leaders.filter(([, v]) => v === top).map(([k]) => k as PlayerId);
    const team = s.seats.find((x) => x.id === winners[0])?.team;
    return { reason: 'mode-win', winners: team ? s.seats.filter((x) => x.team === team).map((x) => x.id) : winners };
  },
};

/** MODE-03 Three-check: the third check wins. */
const threeCheck: RuleModule = {
  id: 'three-check',
  afterMove: (s, prev) => {
    if (!s.last || s.ply === prev.ply || !inCheck(s, s.turn)) return s;
    const c = { ...((s.modeData?.checks as Record<string, number>) ?? {}) };
    c[s.last.by] = (c[s.last.by] ?? 0) + 1;
    return { ...s, modeData: { ...(s.modeData ?? {}), checks: c } };
  },
  checkEnd: (s) => {
    const c = (s.modeData?.checks as Record<string, number>) ?? {};
    const w = Object.entries(c).find(([, n]) => n >= 3);
    return w ? { reason: 'mode-win', winners: [w[0] as PlayerId] } : undefined;
  },
};

/** MODE-06 Capture race: first to 15 points of captured material wins. */
const captureRace: RuleModule = {
  id: 'capture-race',
  afterMove: (s, prev) => {
    if (!s.last?.captured || s.ply === prev.ply) return s;
    const pts = { ...((s.modeData?.points as Record<string, number>) ?? {}) };
    pts[s.last.by] = (pts[s.last.by] ?? 0) + Math.floor(pieceType(baseType(s.last.captured)).value);
    return { ...s, modeData: { ...(s.modeData ?? {}), points: pts } };
  },
  checkEnd: (s) => {
    const pts = (s.modeData?.points as Record<string, number>) ?? {};
    const w = Object.entries(pts).find(([, n]) => n >= 15);
    return w ? { reason: 'mode-win', winners: [w[0] as PlayerId] } : undefined;
  },
};

/** Deterministic dice from the game seed and the move number. */
export function die(s: GameState, sides: number): number {
  let h = (s.rng ^ Math.imul(s.ply + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % sides;
}

/**
 * MODE-01 Dice chess (owner rules, 2026-11-18). On your turn you may:
 *  - give check, if you can (any move that checks);
 *  - get out of check, if you are in check (any legal move);
 *  - move your king (always allowed);
 *  - or roll: the die shows one of the 6 kinds. If you have no legal move with it, roll again,
 *    up to 3 times; after 3 misses you may move any piece.
 * The rolls come from the game seed, so games replay exactly. The engine allows the union of
 * the options; the screen asks you to pick one before showing the roll.
 */
export const DIE_FACES = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
export interface DiceRoll { rolls: string[]; kind: string | 'any' }

export function diceRoll(s: GameState, legal: MoveAction[]): DiceRoll {
  const kinds = new Set(legal.map((m) => baseType(s.pieces[m.piece].type)));
  const rolls: string[] = [];
  for (let i = 0; i < 3; i++) {
    const face = DIE_FACES[dieSalted(s, 6, i)];
    rolls.push(face);
    if (kinds.has(face)) return { rolls, kind: face };
  }
  return { rolls, kind: 'any' };
}

function dieSalted(s: GameState, sides: number, salt: number): number {
  let h = (s.rng ^ Math.imul(s.ply + 1 + salt * 7919, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % sides;
}

export type DiceChoice = 'check' | 'king' | 'roll' | 'escape';

/** The moves each choice allows (legal moves only). */
export function diceOptions(s: GameState, legal: MoveAction[]): Record<DiceChoice, MoveAction[]> {
  const me = s.turn;
  const isKing = (m: MoveAction) => baseType(s.pieces[m.piece].type) === 'king';
  const checks = (m: MoveAction) => { const n = makeMove(s, m); return s.seats.some((x) => x.id !== me && x.status === 'active' && inCheck(n, x.id)); };
  if (inCheck(s, me)) return { escape: legal, check: [], king: [], roll: [] };
  const roll = diceRoll(s, legal);
  return {
    escape: [],
    check: legal.filter(checks),
    king: legal.filter(isKing),
    roll: roll.kind === 'any' ? legal : legal.filter((m) => baseType(s.pieces[m.piece].type) === roll.kind),
  };
}

/** Old name kept for the status line: the kind the dice gives this turn (null = any). */
export function rolledType(s: GameState, moves: MoveAction[]): string | null {
  if (inCheck(s, s.turn)) return null;
  const legal = moves.filter((m) => !inCheck(makeMove(s, m), s.turn));
  const r = diceRoll(s, legal);
  return r.kind === 'any' ? null : r.kind;
}

const randomPiece: RuleModule = {
  id: 'random-piece',
  filterMoves: (s, moves) => {
    const legal = moves.filter((m) => !inCheck(makeMove(s, m), s.turn));
    const o = diceOptions(s, legal);
    const ok = new Set([...o.escape, ...o.check, ...o.king, ...o.roll]);
    return moves.filter((m) => ok.has(m));
  },
};

/** MODE-22 Truce: no captures for each player's first 10 moves. */
const truce: RuleModule = {
  id: 'truce',
  filterMoves: (s, moves) => {
    if (s.ply >= 20) return moves;
    const quiet = moves.filter((m) => s.sq[m.to] < 0 && !(baseType(s.pieces[m.piece].type) === 'pawn' && s.enPassant?.square === m.to));
    return quiet.length ? quiet : moves;
  },
};

/** MODE-20 Capture the flag: each side's flag is on its own back rank, files c to f. */
export function flagSquare(s: GameState, owner: PlayerId): number {
  const b = s.board;
  const idx = s.seats.findIndex((x) => x.id === owner);
  const file = 2 + ((s.rng >>> (idx * 4)) & 3);
  const rank = s.seats[idx].forward[1] > 0 ? 0 : b.height - 1;
  return rank * b.width + file;
}
const captureTheFlag: RuleModule = {
  id: 'capture-the-flag',
  checkEnd: (s) => {
    // A piece that is still sitting on the enemy flag when its own turn comes round wins.
    const me = s.turn;
    for (const seat of s.seats) {
      if (seat.id === me) continue;
      const id = s.sq[flagSquare(s, seat.id)];
      if (id >= 0 && s.pieces[id].owner === me && baseType(s.pieces[id].type) !== 'pawn' && s.pieces[id].type !== 'king') {
        return { reason: 'mode-win', winners: [me] };
      }
    }
    return undefined;
  },
};

/** MODE-05 Shuffle start: no castling (the back rank is shuffled at setup). */
const shuffle: RuleModule = { id: 'shuffle', filterMoves: (_s, moves) => moves.filter((m) => !m.castle) };

/** Start-of-game changes for modes that rearrange the board. `pick(n)` returns 0..n-1. */
export const MODE_SETUP: Record<string, (s: GameState, pick: (n: number) => number) => GameState> = {
  shuffle: (s, pick) => {
    // Shuffle White's back rank (bishops on opposite colours), mirror it for Black.
    const files = [0, 1, 2, 3, 4, 5, 6, 7];
    const take = (list: number[]) => list.splice(pick(list.length), 1)[0];
    const order: string[] = new Array(8);
    const dark = files.filter((f) => f % 2 === 0), light = files.filter((f) => f % 2 === 1);
    const b1 = take(dark), b2 = take(light);
    order[b1] = 'bishop'; order[b2] = 'bishop';
    const rest = files.filter((f) => f !== b1 && f !== b2);
    for (const t of ['queen', 'knight', 'knight', 'rook', 'rook', 'king']) order[take(rest)] = t;
    const pieces = s.pieces.map((p) => ({ ...p }));
    for (const p of pieces) {
      if (p.at < 0 || baseType(p.type) === 'pawn') continue;
      const r = Math.floor(p.at / 8), f = p.at % 8;
      if (r !== 0 && r !== 7) continue;
      p.type = order[f];
      p.moved = true; // no castling
    }
    return { ...s, pieces };
  },
};

export const MODE_MODULES: Record<string, RuleModule[]> = {
  'three-check': [threeCheck],
  'capture-race': [captureRace],
  'random-piece': [randomPiece],
  truce: [truce],
  'capture-the-flag': [captureTheFlag],
  shuffle: [shuffle],
  standard: [],
  koth: [kingOfTheHill],
  'hill-wars': [hillWars],
  battle: [battle],
  'battle-hill': [battle, hillWars],
  'battle-paint': [battle],
};

export interface ModeInfo {
  id: string;
  catalogId: string;
  name: string;
  emoji: string;
  players: number[];
  blurb: string;
}

export const MODE_INFO: ModeInfo[] = [
  { id: 'standard', catalogId: 'MODE-00', name: 'Classic chess', emoji: '♟️', players: [2], blurb: 'Normal chess. Checkmate wins.' },
  { id: 'koth', catalogId: 'MODE-02', name: 'King of the hill', emoji: '⛰️', players: [2], blurb: 'Get your king to one of the 4 middle squares to win, or checkmate.' },
  { id: 'hill-wars', catalogId: 'MODE-29', name: 'Hill wars', emoji: '🚩', players: [2, 3, 4], blurb: 'Hold the middle! Every round you score 1 point per hill square you sit on, 2 for your king. First to the target wins.' },
  { id: 'three-check', catalogId: 'MODE-03', name: 'Three-check', emoji: '✔️', players: [2], blurb: 'Give check three times to win. Or checkmate.' },
  { id: 'capture-race', catalogId: 'MODE-06', name: 'Capture race', emoji: '🏁', players: [2], blurb: 'First to capture 15 points wins (pawn 1, knight/bishop 3, rook 5, queen 9).' },
  { id: 'random-piece', catalogId: 'MODE-01', name: 'Dice chess', emoji: '🎲', players: [2], blurb: 'Each turn: give check, move your king, or roll the dice for which kind of piece to move (3 tries, then anything goes).' },
  { id: 'truce', catalogId: 'MODE-22', name: 'Truce', emoji: '🕊️', players: [2], blurb: 'No captures for the first 10 moves each. Build up, then BOOM.' },
  { id: 'capture-the-flag', catalogId: 'MODE-20', name: 'Capture the flag', emoji: '🏳️', players: [2], blurb: 'Land a piece (not a pawn or king) on the enemy flag and survive one turn to win.' },
  { id: 'shuffle', catalogId: 'MODE-05', name: 'Shuffle start', emoji: '🔀', players: [2], blurb: 'The back row is shuffled! Same for both sides. No castling.' },
  { id: 'atomic', catalogId: 'MODE-13', name: 'Atomic', emoji: '💥', players: [2], blurb: 'Every capture EXPLODES: the two pieces and everything next to them (except pawns) are blown away. Blow up the enemy king to win. Kings can\'t capture.' },
  { id: 'giveaway', catalogId: 'MODE-15', name: 'Giveaway', emoji: '🎁', players: [2], blurb: 'Backwards chess! If you can capture, you must. Lose all your pieces (or get stuck) to win. The king is just a normal piece.' },
  { id: 'racing-kings', catalogId: 'MODE-16', name: 'Racing kings', emoji: '🏎️', players: [2], blurb: 'No pawns, no checks allowed. First king to the far row wins!' },
  { id: 'wrap', catalogId: 'MODE-18', name: 'Wrap-around', emoji: '🌀', players: [2], blurb: 'The left and right edges are joined: pieces can slide off one side and come back on the other. No castling.' },
  { id: 'lava', catalogId: 'MODE-21', name: 'Lava squares', emoji: '🌋', players: [2], blurb: 'Every 5 moves, 3 squares turn to lava for 5 moves. Nothing can land on or slide through lava (knights can jump it).' },
  { id: 'mini', catalogId: 'MODE-23', name: 'Mini board', emoji: '🐭', players: [2], blurb: 'A tiny 5 by 5 board. Pawns step one square at a time. Quick and sharp!' },
  { id: 'horde', catalogId: 'MODE-04', name: 'Horde', emoji: '🐜', players: [2], blurb: 'White is 36 pawns and no king! Black wins by taking every pawn. White wins by checkmate.' },
  { id: 'monster', catalogId: 'MODE-24', name: 'Monster', emoji: '👾', players: [2], blurb: 'White has a king and 8 pawns but moves TWICE every turn. Black has a full army.' },
  { id: 'shrinking', catalogId: 'MODE-09', name: 'Shrinking board', emoji: '📉', players: [2], blurb: 'Every 15 moves the outside ring of the board falls away. Pieces left on it are lost (a king jumps to safety inside).' },
  { id: 'progressive', catalogId: 'MODE-17', name: 'Progressive', emoji: '📈', players: [2], blurb: 'White makes 1 move, Black 2, White 3, and so on, up to 5 a turn. You can stop early; giving check ends your run at once.' },
  { id: 'drop-in', catalogId: 'MODE-14', name: 'Drop-in', emoji: '🪂', players: [2], blurb: 'Pieces you capture join YOUR army. On your turn you can drop one on any empty square instead of moving.' },
  { id: 'boss', catalogId: 'MODE-08', name: 'Boss battle', emoji: '👹', players: [2], blurb: 'One side has a king, pawns and a Boss (queen + knight moves, 3 lives). The other side has the full army. Take the Boss 3 times or checkmate!' },
  { id: 'mystery-army', catalogId: 'MODE-25', name: 'Mystery army', emoji: '🎲', players: [2], blurb: 'Both sides get the same surprise army worth 39 points. Who uses it better?' },
  { id: 'hidden-queen', catalogId: 'MODE-19', name: 'Hidden queen', emoji: '🕵️', players: [2], blurb: 'Secretly pick one pawn. It can move like a queen! The first time it does, everyone finds out.' },
  { id: 'draft', catalogId: 'MODE-07', name: 'Draft', emoji: '🛒', players: [2], blurb: 'Spend 30 points to build your own army, then fight with it.' },
  { id: 'survival', catalogId: 'MODE-12', name: 'Endgame survival', emoji: '🛡️', players: [2], blurb: 'Hold out for 20 moves from a tricky endgame. A draw counts!' },
  { id: 'paint', catalogId: 'MODE-30', name: 'Paint the board', emoji: '🎨', players: [2, 3, 4], blurb: 'Every square your pieces land on turns your colour. After 30 rounds, the most squares wins!' },
  { id: 'pawn-wars', catalogId: 'MINI-01', name: 'Pawn wars', emoji: '♟️', players: [2], blurb: 'Just pawns (and kings). First pawn to reach the far side wins!' },
  { id: 'card-chess', catalogId: 'MODE-32', name: 'Card chess', emoji: '🎴', players: [2], blurb: 'You hold 3 cards. Move a piece that matches one of them, or throw a card away. Three of the same card? Take two moves!' },
  { id: 'battle', catalogId: 'MODE-26/27/28', name: 'Battle royale', emoji: '⚔️', players: [3, 4], blurb: 'Everyone for themselves (or 2 vs 2). Capture a king to knock that player out. Last king standing wins.' },
];
