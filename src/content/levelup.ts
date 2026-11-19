/**
 * Level-Up Chess (owner design, 2026-11-19; design doc "Level-Up Chess: design
 * notes"). Content as data: pieces, values, level powers, how experience is
 * earned, missions. The rules live in src/levelup/rules.ts.
 *
 * Choices made for the first build where the design doc says "still to
 * decide" are marked FIRST BUILD; they are listed in docs/08 and the design doc.
 */
export type LUType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king' | 'catapult' | 'medic' | 'miner' | 'scout';
export type Base = 'triangle' | 'square' | 'circle';

/** Triangle beats circle, circle beats square, square beats triangle. */
export const BEATS: Record<Base, Base> = { triangle: 'circle', circle: 'square', square: 'triangle' };
export const BASE_ICON: Record<Base, string> = { triangle: '▲', square: '■', circle: '●' };

export interface LUPieceDef {
  type: LUType;
  name: string;
  /** Added to the die in a battle (design doc: queen 5, bishops and knights 3, pawns 1; others FIRST BUILD). */
  value: number;
  /** What each level adds, in kid words. Index 0 = level 1. */
  levels: [string, string, string];
}

export const LU_PIECES: Record<LUType, LUPieceDef> = {
  pawn: { type: 'pawn', name: 'Pawn', value: 1, levels: ['Steps forward, attacks one square diagonally forward. Can clear a barricade next to it, or climb onto an empty bombardier next to it to crew it (for good: it never climbs off).', 'Steps one square any way, and attacks diagonally any way.', 'Final form: can turn into a level 1 scout (it starts again at 0 points).'] },
  knight: { type: 'knight', name: 'Knight', value: 3, levels: ['Jumps in an L, over anything. Can clear a barricade next to it (uses its turn).', 'Can also jump two-and-two.', 'Final form: charges with a rider: +1 in battle and wins ties.'] },
  bishop: { type: 'bishop', name: 'Bishop', value: 3, levels: ['Slides diagonally.', 'Can also step one or two squares straight forward.', 'Final form: brings a fallen friend back from anywhere, next to itself.'] },
  rook: { type: 'rook', name: 'Rook', value: 4, levels: ['Slides in straight lines.', 'Protector: every friend next to it is safe from bombardier shots.', 'Final form: builds walls. Uses its turn to put a new barricade on an empty square next to it. A wall takes two goes to clear.'] },
  queen: { type: 'queen', name: 'Queen', value: 5, levels: ['Slides in any straight line.', '+1 in every battle she starts.', 'Final form: can also jump like a knight.'] },
  king: { type: 'king', name: 'King', value: 4, levels: ['Steps one square. Keep him out of check!', 'Can dash two squares in a straight line.', 'Final form: friends next to him get +1 when attacked.'] },
  catapult: { type: 'catapult', name: 'Bombardier', value: 2, levels: ['Starts with a pawn crew riding on it (the little pawn on top). It can never be destroyed. The crew never climbs off; an attack on the bombardier fights the crew, and if the crew loses it dies and the bombardier stays. With no crew it cannot move or fire until a pawn next to it climbs on. Each turn, as well as your move, it can do one step: mark a target 2 to 4 squares away (they see a warning), fire at the marked square, or reload. A bombardier that took its step cannot move that turn.', 'Marks targets up to 5 squares away.', 'Final form: the blast also hits the 4 diagonal squares around the target, and leaves a crater nobody can ever cross.'] },
  medic: { type: 'medic', name: 'Medic', value: 1, levels: ['A scout that picked Medic at level 2.', 'Medic: walks up to 3 squares and brings back a friend who fell within 3 squares, up to 3 turns after. Still sees like a scout.', 'Final form: reaches 4 squares away and has 5 turns to do it.'] },
  miner: { type: 'miner', name: 'Miner', value: 1, levels: ['A scout that picked Miner at level 2.', 'Miner: walks up to 2 squares, never attacks. Can drop its mine on the square it just left. Gets a new mine next to a bombardier. Clears enemy mines it steps on. Still sees like a scout.', 'Final form: carries 2 mines at a time.'] },
  scout: { type: 'scout', name: 'Scout', value: 1, levels: ['Dashes up to 4 squares in a straight line and lights up the fog around it. Moves OR strikes a piece next to it (die roll). At level 2 it picks a job: Medic, Miner or Spy.', 'Spy: invisible to the enemy (except their scouts).', 'Final form, Assassin: +1 on strikes and the only piece that can take a king, which wins at once. Never gives check.'] },
};

/** Level thresholds: 3 points to reach level 2, then 5 more (8 in all) for level 3. */
export const LEVEL_AT = [0, 3, 8] as const;
export const levelOf = (xp: number) => (xp >= LEVEL_AT[2] ? 3 : xp >= LEVEL_AT[1] ? 2 : 1);

/** How experience is earned. Shown in the "How to earn points" menu, word for word. */
export interface XPRule { id: string; points: number; label: string; tip: string }
export const XP_RULES: XPRule[] = [
  { id: 'kill', points: 1, label: 'Win a battle', tip: 'Defeat an enemy piece.' },
  { id: 'kill-big', points: 1, label: 'Defeat a big piece', tip: 'One more point when it was worth 3 or more.' },
  { id: 'brave', points: 1, label: 'Brave!', tip: 'One more point when you win against a stronger piece.' },
  { id: 'centre', points: 1, label: 'Take the centre', tip: 'First time a piece reaches the middle 4 x 4.' },
  { id: 'check', points: 2, label: 'Check!', tip: 'Attack the enemy king.' },
  { id: 'fork', points: 2, label: 'Fork!', tip: 'Attack two big pieces (or the king and a big piece) at once.' },
  { id: 'pin', points: 2, label: 'Pin!', tip: 'Line up on a piece with a bigger one behind it.' },
  { id: 'castle', points: 2, label: 'Castle', tip: 'Tuck your king away with a rook.' },
  { id: 'revive', points: 1, label: 'Save a friend', tip: 'Bring a fallen piece back.' },
  { id: 'hit', points: 1, label: 'Bullseye', tip: 'A bombardier shot finds its target.' },
  { id: 'trap', points: 1, label: 'Mine blast', tip: 'Your miner\'s mine blows up an enemy.' },
  { id: 'sweep', points: 1, label: 'Mine cleared', tip: 'Your miner clears an enemy mine.' },
  { id: 'secret', points: 3, label: 'Secret mission', tip: 'Complete your secret mission.' },
  { id: 'global', points: 2, label: 'First!', tip: 'Be first to finish a mission everyone can see.' },
];
export const XP = Object.fromEntries(XP_RULES.map((r) => [r.id, r])) as Record<string, XPRule>;

export interface LUMission { id: string; name: string; text: string }
/**
 * Mission cards (owner called them race missions at first, then "mission cards"), played as a deck: three are face up; the
 * first player to do one claims it, and the next card is drawn, until the deck runs out.
 */
export const RACE_FACE_UP = 3;
export const GLOBAL_MISSIONS: LUMission[] = [
  { id: 'G-castle', name: 'Home safe', text: 'First to castle.' },
  { id: 'G-kill', name: 'First blood', text: 'First to win a battle.' },
  { id: 'G-tree', name: 'Lumberjack', text: 'First to clear a barricade.' },
  { id: 'G-level', name: 'Rising star', text: 'First to get a piece to level 2.' },
  { id: 'G-pawnkill', name: 'Little hero', text: 'First to win a battle with a pawn.' },
  { id: 'G-shot', name: 'Fire!', text: 'First catapult hit.' },
  { id: 'G-centre', name: 'King of the hill', text: 'First to reach the middle.' },
  { id: 'G-check', name: 'Check!', text: 'First to give check.' },
  { id: 'G-fork', name: 'Forked', text: 'First to make a fork.' },
  { id: 'G-promote', name: 'All the way', text: 'First to get a pawn to the far side.' },
  { id: 'G-mine', name: 'Booby trap', text: 'First to hide a mine.' },
  { id: 'G-revive', name: 'Not today', text: 'First to bring a piece back.' },
  { id: 'G-strike', name: 'Quick knife', text: 'First scout strike that wins.' },
  { id: 'G-max', name: 'Final form', text: 'First piece to reach level 3.' },
];
/** Secret missions: one each, hidden from the other player. */
export const SECRET_MISSIONS: LUMission[] = [
  { id: 'S-giant', name: 'Giant slayer', text: 'Beat a queen or rook in battle with a pawn.' },
  { id: 'S-bullseye', name: 'Bullseye', text: 'Destroy a piece with your catapult.' },
  { id: 'S-life', name: 'Second life', text: 'Bring a fallen piece back.' },
  { id: 'S-trees', name: 'Clear-cut', text: 'Clear 3 barricades.' },
  { id: 'S-knightcheck', name: 'Knight raid', text: 'Give check with a knight.' },
  { id: 'S-trap', name: 'Trapper', text: 'Blow up a piece with a mine.' },
  { id: 'S-max', name: 'Final form', text: 'Get any piece to level 3.' },
];
export const missionById = (id: string) => [...GLOBAL_MISSIONS, ...SECRET_MISSIONS].find((m) => m.id === id);

/** Win grades (design doc: winning with the secret mission done is a higher grade). */
export const WIN_GRADES = {
  sneak: 'Sneak attack win', // the assassin took the king
  complete: 'Complete win', // checkmate with your secret mission done
  plain: 'Win',
} as const;

/**
 * Board (owner, 2026-11-19: "the world felt too big, make it skinnier, but more trees"):
 * 12 files wide (the armies fill it exactly) and 16 ranks long. Barricade forest in ranks 4-11, thicker than before.
 */
export const LU_WIDTH = 12;
export const LU_HEIGHT = 16;
/** Owner, 2026-11-19: the outside extras are always bombardiers; the inside extras start as scouts and pick a job at level 2. */
export const LU_BACK: LUType[] = ['catapult', 'scout', 'rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook', 'scout', 'catapult'];
/** The jobs a scout can pick at level 2. A Spy stays a scout (and becomes an Assassin at level 3). */
export type LURole = 'medic' | 'miner' | 'spy';
export const LU_ROLES: { role: LURole; name: string; text: string }[] = [
  { role: 'medic', name: 'Medic', text: 'Brings fallen friends back.' },
  { role: 'miner', name: 'Miner', text: 'Hides mines, clears enemy mines.' },
  { role: 'spy', name: 'Spy', text: 'Invisible to the enemy. Becomes an Assassin at level 3.' },
];
export const LU_FIRST_FILE = 0;
export const FOREST_RANKS: [number, number] = [4, 11];
/** About this share of forest squares start with a barricade (FIRST BUILD). */
export const FOREST_DENSITY = 0.55;
/** Hits a barricade takes (FIRST BUILD): every battle won next to it is one hit. */
export const BARRICADE_HP = 2;
/** Medic: revive window in the owner's own turns (design doc: 3). */
export const REVIVE_TURNS = [3, 3, 5];
export const REVIVE_RANGE = [2, 3, 4];
/** Mines a miner carries at once, by level (it only becomes a miner at level 2). */
export const MINER_CARRY = [0, 1, 2];
/** Level 2 reaches further; level 3 keeps that reach and gets the blast (owner, 2026-11-19). */
export const CATAPULT_RANGE = [4, 5, 5];
/** A bombardier needs a target at least this far away. */
export const CATAPULT_MIN = 2;
/** Scout sight radius by level (squares; FIRST BUILD: the doc's "3 across" grows to 5, 7, 9 across). */
export const SCOUT_SIGHT = [2, 3, 4];
/** A defender that out-rolls the attacker by this much destroys it ("a really bad roll"). */
export const CRUSH_MARGIN = 4;
