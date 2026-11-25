/**
 * Party match content (docs/03): display data for the buffs, handicaps and
 * secret missions this build can play. Rules live in core/modifiers.ts and
 * systems/missions.ts; IDs match the catalog.
 */

export type Tier = 'Minor' | 'Major';
/** What a one-shot buff needs the player to tap before it fires. */
export type BuffTarget = 'none' | 'own-piece' | 'enemy-piece' | 'two-own' | 'own-pawn-side' | 'own-piece-knight' | 'own-piece-home' | 'pawn-row-square' | 'king-dash' | 'double-step';

export interface ModifierDef {
  id: string;
  kind: 'buff' | 'handicap';
  name: string;
  emoji: string;
  blurb: string;
  tier: Tier;
  /** One-shot button (buff) or always on. */
  oneShot?: BuffTarget;
  /** Only makes sense against a bot on this device (take-backs, a per-move timer). */
  botGameOnly?: boolean;
  /** Only changes what a human sees or taps: never given to a bot. */
  humanOnly?: boolean;
  tags?: string[];
}

export const MODIFIERS: ModifierDef[] = [
  // Buffs
  { id: 'BUFF-01', kind: 'buff', name: 'Double step', emoji: '👟', tier: 'Major', oneShot: 'double-step', blurb: 'Once: one of your pieces moves twice in a row.' },
  { id: 'BUFF-02', kind: 'buff', name: 'Shield', emoji: '🛡️', tier: 'Major', oneShot: 'own-piece', blurb: 'Once: a piece of yours can\'t be taken for 2 enemy turns. Free action.' },
  { id: 'BUFF-03', kind: 'buff', name: 'Take-back', emoji: '⏪', tier: 'Minor', botGameOnly: true, humanOnly: true, blurb: 'Once: undo your last move.' },
  { id: 'BUFF-04', kind: 'buff', name: 'Scout', emoji: '🔭', tier: 'Minor', humanOnly: true, blurb: 'Once: before a move counts, see the best answer they have to it.' },
  { id: 'BUFF-05', kind: 'buff', name: 'Pawn sprint', emoji: '🏃', tier: 'Minor', blurb: 'Your pawns can jump two squares any time.', tags: ['needsPawns'] },
  { id: 'BUFF-06', kind: 'buff', name: 'Second wind', emoji: '💨', tier: 'Major', blurb: 'The first piece you lose (not your queen) comes back home.', tags: ['needsStandardArmy'] },
  { id: 'BUFF-07', kind: 'buff', name: 'Long jump', emoji: '🦘', tier: 'Major', blurb: 'Your knights can also leap 3 and 1.', tags: ['needsKnights'] },
  { id: 'BUFF-08', kind: 'buff', name: 'Early crown', emoji: '👑', tier: 'Major', blurb: 'Your pawns promote one row early.', tags: ['needsPawns'] },
  { id: 'BUFF-09', kind: 'buff', name: 'Safe king', emoji: '🦺', tier: 'Minor', blurb: 'The first time they check you, the checking piece goes back where it came from.', tags: ['needsCheck'] },
  { id: 'BUFF-10', kind: 'buff', name: 'Backpedal', emoji: '🔙', tier: 'Minor', blurb: 'Each pawn may step backward once.', tags: ['needsPawns'] },
  { id: 'BUFF-11', kind: 'buff', name: 'Swap', emoji: '🔄', tier: 'Minor', oneShot: 'two-own', blurb: 'Once: two of your pieces swap places. Uses your move.' },
  { id: 'BUFF-12', kind: 'buff', name: 'Bonus hint', emoji: '💡', tier: 'Minor', humanOnly: true, blurb: 'Once: the piece with the best move glows.' },
  { id: 'BUFF-13', kind: 'buff', name: 'Rally', emoji: '📯', tier: 'Major', oneShot: 'none', blurb: 'Once: switch it on, and after your next capture you move a second, different piece. Free action.' },
  { id: 'BUFF-14', kind: 'buff', name: 'Reinforcements', emoji: '🪖', tier: 'Minor', oneShot: 'pawn-row-square', blurb: 'Once: drop a new pawn on your pawn row. Uses your move.', tags: ['needsPawns'] },
  { id: 'BUFF-15', kind: 'buff', name: 'Freeze ray', emoji: '🧊', tier: 'Minor', oneShot: 'enemy-piece', blurb: 'Once: an enemy piece can\'t move next turn. Free action.' },
  { id: 'BUFF-16', kind: 'buff', name: 'Royal dash', emoji: '🤴', tier: 'Minor', oneShot: 'king-dash', blurb: 'Once: your king zooms two squares in a line.' },
  { id: 'BUFF-17', kind: 'buff', name: 'Sidestep', emoji: '↔️', tier: 'Minor', oneShot: 'own-pawn-side', blurb: 'Once: a pawn steps sideways. Uses your move.', tags: ['needsPawns'] },
  { id: 'BUFF-18', kind: 'buff', name: 'Knight\'s blessing', emoji: '🐴', tier: 'Major', oneShot: 'own-piece-knight', blurb: 'Once: any piece jumps like a knight. Uses your move.' },
  { id: 'BUFF-19', kind: 'buff', name: 'X-ray', emoji: '🩻', tier: 'Minor', humanOnly: true, blurb: 'Once: see attackers and defenders on every piece for 3 turns.' },
  { id: 'BUFF-20', kind: 'buff', name: 'Recall', emoji: '🏠', tier: 'Minor', oneShot: 'own-piece-home', blurb: 'Once: send a piece back to its starting square. Uses your move.' },
  { id: 'BUFF-21', kind: 'buff', name: 'Home guard', emoji: '🏰', tier: 'Minor', oneShot: 'none', blurb: 'Once: your back row can\'t be taken next enemy turn. Free action.' },
  { id: 'BUFF-22', kind: 'buff', name: 'Time bank', emoji: '🏦', tier: 'Minor', oneShot: 'none', humanOnly: true, blurb: 'Once: add 30 seconds to your clock. Free action.', tags: ['needsClock'] },
  { id: 'BUFF-23', kind: 'buff', name: 'Peek', emoji: '👀', tier: 'Minor', oneShot: 'none', humanOnly: true, blurb: 'Once: see their secret mission. Free action.', tags: ['needsMissions', 'hiddenInfo'] },
  { id: 'BUFF-24', kind: 'buff', name: 'Safety net', emoji: '🥅', tier: 'Minor', humanOnly: true, blurb: 'The first time you\'re about to drop a piece, we warn you.' },
  // Handicaps
  { id: 'HCAP-01', kind: 'handicap', name: 'Fog', emoji: '🌫️', tier: 'Major', humanOnly: true, blurb: 'You only see squares your pieces stand on or can move to.', tags: ['hiddenInfo'] },
  { id: 'HCAP-02', kind: 'handicap', name: 'Frozen piece', emoji: '🥶', tier: 'Minor', blurb: 'One of your pieces is frozen for your first 3 turns.' },
  { id: 'HCAP-03', kind: 'handicap', name: 'Tired queen', emoji: '😴', tier: 'Minor', blurb: 'Your queen moves at most 3 squares.', tags: ['needsQueen'] },
  { id: 'HCAP-04', kind: 'handicap', name: 'Butterfingers', emoji: '🧈', tier: 'Minor', humanOnly: true, blurb: 'Touch a piece and you have to move it.' },
  { id: 'HCAP-05', kind: 'handicap', name: 'Slow pawns', emoji: '🐌', tier: 'Minor', blurb: 'Your pawns can\'t jump two squares.', tags: ['needsPawns'] },
  { id: 'HCAP-06', kind: 'handicap', name: 'No castling', emoji: '🚫', tier: 'Minor', blurb: 'You can\'t castle.', tags: ['needsCastling'] },
  { id: 'HCAP-07', kind: 'handicap', name: 'Short clock', emoji: '⏱️', tier: 'Major', humanOnly: true, botGameOnly: true, blurb: '10 seconds per move or a random move is played.' },
  { id: 'HCAP-08', kind: 'handicap', name: 'Blind spot', emoji: '🙈', tier: 'Major', humanOnly: true, blurb: 'One column is hidden from you all game.', tags: ['hiddenInfo', 'needsStandardBoard'] },
  { id: 'HCAP-09', kind: 'handicap', name: 'Heavy rooks', emoji: '🪨', tier: 'Minor', blurb: 'Your rooks can\'t move before move 10 (castling is fine).', tags: ['needsRooks'] },
  { id: 'HCAP-10', kind: 'handicap', name: 'Tax', emoji: '💸', tier: 'Minor', humanOnly: true, blurb: 'Each capture you make costs you a hint (while you have hints).', tags: ['needsHints'] },
  { id: 'HCAP-11', kind: 'handicap', name: 'Mirror', emoji: '🪞', tier: 'Major', blurb: 'If you can, move the same kind of piece your opponent just moved.' },
  { id: 'HCAP-12', kind: 'handicap', name: 'Homesick king', emoji: '🏡', tier: 'Minor', blurb: 'Your king can\'t leave your first two rows.' },
  { id: 'HCAP-13', kind: 'handicap', name: 'Forced capture', emoji: '😋', tier: 'Major', blurb: 'If you can capture, you must.' },
  { id: 'HCAP-14', kind: 'handicap', name: 'Missing pawn', emoji: '🕳️', tier: 'Minor', blurb: 'You start one pawn short.', tags: ['needsPawns', 'needsStandardArmy'] },
  { id: 'HCAP-15', kind: 'handicap', name: 'Sleepy start', emoji: '🥱', tier: 'Minor', blurb: 'They make two moves before your first one (the second can\'t capture or check).' },
  { id: 'HCAP-16', kind: 'handicap', name: 'Silent board', emoji: '🤫', tier: 'Minor', humanOnly: true, blurb: 'No move dots or highlights for you.' },
  { id: 'HCAP-17', kind: 'handicap', name: 'Rusty crown', emoji: '🦴', tier: 'Minor', blurb: 'Your pawns can only promote to knights.', tags: ['needsPawns'] },
  { id: 'HCAP-18', kind: 'handicap', name: 'Slippery board', emoji: '🧼', tier: 'Major', blurb: 'Rooks, bishops and queen slide as far as they can.' },
  { id: 'HCAP-19', kind: 'handicap', name: 'One-way rooks', emoji: '⬆️', tier: 'Major', blurb: 'Your rooks only move up and down.', tags: ['needsRooks'] },
  { id: 'HCAP-20', kind: 'handicap', name: 'Peaceful bishops', emoji: '☮️', tier: 'Major', blurb: 'Your bishops can\'t capture.', tags: ['needsBishops'] },
  { id: 'HCAP-21', kind: 'handicap', name: 'Costume party', emoji: '🎭', tier: 'Major', humanOnly: true, blurb: 'Their pieces all look the same to you until each one moves.', tags: ['hiddenInfo'] },
  { id: 'HCAP-22', kind: 'handicap', name: 'Restless king', emoji: '🦶', tier: 'Major', blurb: 'Every 5th turn you must move your king.' },
  { id: 'HCAP-23', kind: 'handicap', name: 'Toll road', emoji: '🚧', tier: 'Minor', humanOnly: true, blurb: 'Moving onto one of the 4 middle squares costs you a hint (while you have hints).', tags: ['needsHints', 'needsStandardBoard'] },
  { id: 'HCAP-24', kind: 'handicap', name: 'No take-backs', emoji: '✋', tier: 'Minor', humanOnly: true, botGameOnly: true, blurb: 'No Take back button and no "one fix" retry for you.' },
];

/** Hints each person gets in a Party match (the 💡 button; Tax and Toll road spend them). */
export const PARTY_HINTS = 3;

export function modifierById(id: string): ModifierDef | undefined {
  return MODIFIERS.find((m) => m.id === id);
}

export interface MissionDef {
  id: string;
  name: string;
  blurb: string;
  category: 'Medium' | 'Hard';
  tags?: string[];
  /**
   * What the other player must do once it is shown. 'piece': capture the
   * piece that did it. 'board': change the board so it is no longer true.
   */
  undo: 'piece' | 'board';
  /**
   * Shown first even when it is the weaker player's open mission: the other
   * player still gets one turn to stop it (weekly review 2026-11-20: Runaway
   * pawn slipped through and won before anyone saw it).
   */
  alwaysShown?: boolean;
  /** Short kid-facing hint for the defender. */
  stop: string;
}

/**
 * Owner rules (2026-11-18). A hidden mission, once done, is shown and must
 * stand until the end of the other player's next turn (that player gets this
 * many turns to undo it).
 */
export const MISSION_DEFENCE_TURNS = 1;
/**
 * The weaker player's mission (rating gap of MISSION_UNDERDOG_GAP or more):
 * shown to the opponent from the start, but doing it wins at once (0 turns to undo).
 */
export const MISSION_DEFENCE_TURNS_VS_UNDERDOG = 0;
/**
 * Modes where the stronger player wins far more than in the rest of Party
 * (bot playtest, docs/12): the weaker player gets one more buff there.
 */
export const UNDERDOG_BONUS_MODES: Record<string, 'Major' | 'Minor'> = { boss: 'Minor', 'three-check': 'Minor', 'hidden-queen': 'Minor' };

/** Rating gap from which the weaker player gets that advantage. */
export const MISSION_UNDERDOG_GAP = 100;

/** Game-ending secret missions (docs/02 s5). Easy ones are training goals; bonus ones come later. */
export const MISSIONS: MissionDef[] = [
  { id: 'MISSION-05', category: 'Medium', name: 'Fork it!', blurb: 'Attack two pieces at once with one piece (a fork).', undo: 'piece', stop: 'Capture the piece that made the fork!' },
  { id: 'MISSION-06', category: 'Medium', name: 'Pin it!', blurb: 'Pin an enemy piece so it can\'t move without exposing its king.', tags: ['needsCheck'], undo: 'piece', stop: 'Capture the piece that made the pin!' },
  { id: 'MISSION-07', category: 'Medium', name: 'Rook raid', blurb: 'Get a rook to the enemy\'s pawn row and keep it there for a turn.', tags: ['needsRooks'], undo: 'board', stop: 'Chase every rook off your pawn row!' },
  { id: 'MISSION-10', category: 'Medium', name: 'Own the centre', blurb: 'Sit on 2 of the 4 middle squares and attack or hold all 4.', undo: 'board', stop: 'Take back a middle square, or stop them guarding all four!' },
  { id: 'MISSION-11', category: 'Medium', name: 'Queen swap', blurb: 'Trade queens while you\'re 2+ points ahead.', tags: ['needsQueen'], undo: 'board', stop: 'Win back material so they are not 2 points ahead!' },
  { id: 'MISSION-12', category: 'Medium', name: 'Check ×3', blurb: 'Give check three times.', tags: ['needsCheck'], undo: 'piece', stop: 'Capture the piece that gave the third check!' },
  { id: 'MISSION-17', category: 'Medium', name: 'Runaway pawn', blurb: 'Get a pawn to the 5th row with no enemy pawns in its way.', tags: ['needsPawns'], undo: 'board', alwaysShown: true, stop: 'Capture the runaway pawn, or get a pawn in its way!' },
  { id: 'MISSION-18', category: 'Medium', name: 'Pawn pile-up', blurb: 'Make the enemy have two pawns on the same column.', tags: ['needsPawns'], undo: 'board', stop: 'Move or trade a doubled pawn so they are not on one column!' },
  { id: 'MISSION-19', category: 'Medium', name: 'Bishop buddies', blurb: 'Still have both bishops after your move 20.', tags: ['needsBishops'], undo: 'board', stop: 'Capture one of their bishops!' },
  { id: 'MISSION-21', category: 'Medium', name: 'Knight fortress', blurb: 'Park a knight deep in enemy land, guarded by a pawn, where no pawn can chase it.', tags: ['needsKnights', 'needsPawns'], undo: 'board', stop: 'Capture the knight or the pawn guarding it!' },
  { id: 'MISSION-23', category: 'Medium', name: 'Rook tower', blurb: 'Stack both rooks on a column with no pawns.', tags: ['needsRooks'], undo: 'board', stop: 'Split the rooks, or put a pawn on their column!' },
  { id: 'MISSION-04', category: 'Hard', name: 'Crown a pawn', blurb: 'Promote a pawn.', tags: ['needsPawns'], undo: 'piece', stop: 'Capture the new piece!' },
  { id: 'MISSION-14', category: 'Hard', name: 'Sneak attack', blurb: 'Move one piece out of the way so another attacks something big.', undo: 'piece', stop: 'Capture the piece that moved out of the way!' },
  { id: 'MISSION-15', category: 'Hard', name: 'Skewer', blurb: 'Attack a big piece with a smaller one hiding behind it.', undo: 'board', stop: 'Capture the skewer piece, block its line, or guard the piece behind!' },
  { id: 'MISSION-16', category: 'Hard', name: 'En passant!', blurb: 'Capture a pawn en passant (the sneaky pawn capture).', tags: ['needsPawns'], undo: 'piece', stop: 'Capture the pawn that took en passant!' },
];

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/**
 * Bonus objectives (docs/02 s5): shown openly, checked when the game ends,
 * never end the game. Done: pick one of three Common cards.
 */
export interface BonusDef { id: string; name: string; emoji: string; blurb: string; tags?: string[] }
export const BONUS_MISSIONS: BonusDef[] = [
  { id: 'MISSION-03', name: 'Queen survives', emoji: '👑', blurb: 'Win without losing your queen.', tags: ['needsQueen'] },
  { id: 'MISSION-09', name: 'Little hero mate', emoji: '🐴', blurb: 'Win with checkmate by a knight or bishop move.', tags: ['needsCheck'] },
  { id: 'MISSION-20', name: 'Back-row mate', emoji: '🧱', blurb: 'Checkmate with a rook or queen on their back row, the king stuck behind its own pieces.', tags: ['needsCheck'] },
  { id: 'MISSION-24', name: 'Brave sacrifice', emoji: '🎁', blurb: 'Give up a piece for less, don\'t win it back within 3 moves, and still win.' },
];
/** Chance that each player gets a bonus objective in a Party match. */
export const BONUS_CHANCE = 1 / 3;

export function bonusById(id: string): BonusDef | undefined {
  return BONUS_MISSIONS.find((m) => m.id === id);
}

/**
 * How the Party mode list is grouped on screen (design review, 2026-11-25:
 * 26 modes in one wall of chips). Every Party mode is in exactly one group
 * (tests/party.test.ts).
 */
export const PARTY_MODE_GROUPS: { name: string; modes: string[] }[] = [
  { name: 'Chess, almost', modes: ['standard', 'shuffle', 'truce', 'mini', 'pawn-wars'] },
  { name: 'A new way to win', modes: ['koth', 'three-check', 'capture-race', 'capture-the-flag', 'racing-kings', 'giveaway', 'hill-wars', 'paint'] },
  { name: 'Wild boards', modes: ['wrap', 'lava', 'shrinking', 'atomic'] },
  { name: 'Wild armies', modes: ['horde', 'monster', 'boss', 'mystery-army', 'hidden-queen', 'drop-in'] },
  { name: 'Luck and turns', modes: ['random-piece', 'card-chess', 'progressive'] },
];
