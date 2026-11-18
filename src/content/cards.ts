/**
 * Power cards (docs/03 Cards): what the player sees. Rules live in
 * core/cards.ts (playing) and systems/cards.ts (earning). IDs match the catalog.
 */
export type Rarity = 'Common' | 'Rare' | 'Epic';
export type CardKind = 'Upgrade' | 'Summon' | 'Effect';
/** What to tap, in order. Each tap fills one field of the buff action. */
export type CardTap = 'piece' | 'target' | 'to' | 'piece-or-pair';

export interface CardDef {
  id: string;
  name: string;
  emoji: string;
  kind: CardKind;
  rarity: Rarity;
  /** Kid text: what it does. */
  blurb: string;
  /** Kid text: how to earn one. */
  earn: string;
  taps: { field: 'piece' | 'target' | 'to'; prompt: string }[];
  /** Uses your move (upgrades, summons, Teleporter, Twin). */
  usesMove: boolean;
  /** Can't be played or earned yet in this build. */
  notYet?: boolean;
  /** The piece this card belongs to, for collections (owner, 2026-11-18). */
  suit: Suit;
}

export type Suit = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export const SUITS: Suit[] = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];
export const SUIT_ICON: Record<Suit, string> = { pawn: '♙', rook: '♖', knight: '♘', bishop: '♗', queen: '♕', king: '♔' };

const up = (base: string) => [{ field: 'piece' as const, prompt: `Tap the ${base} to power up` }];

export const CARDS: CardDef[] = [
  { id: 'CARD-01', name: 'Chancellor', emoji: '🦄', kind: 'Upgrade', rarity: 'Rare', suit: 'rook', usesMove: true, taps: up('rook'),
    blurb: 'A rook that can also jump like a knight.', earn: 'Win a game where your rook reached the 7th row.' },
  { id: 'CARD-02', name: 'Archbishop', emoji: '🧙', kind: 'Upgrade', rarity: 'Rare', suit: 'bishop', usesMove: true, taps: up('bishop'),
    blurb: 'A bishop that can also jump like a knight.', earn: 'Win a game while you still have both bishops.' },
  { id: 'CARD-03', name: 'Amazon', emoji: '⚔️', kind: 'Upgrade', rarity: 'Epic', suit: 'queen', usesMove: true, taps: up('queen'),
    blurb: 'Your queen can also jump like a knight, until her first capture.', earn: 'Win 3 rated games in a row.' },
  { id: 'CARD-04', name: 'Super pawn', emoji: '💪', kind: 'Upgrade', rarity: 'Common', suit: 'pawn', usesMove: true, taps: up('pawn'),
    blurb: 'A pawn that steps and takes one square any way. It can\'t promote.', earn: 'Promote a pawn (get it to the far side).' },
  { id: 'CARD-05', name: 'Jumper rook', emoji: '🦘', kind: 'Upgrade', rarity: 'Rare', suit: 'rook', usesMove: true, taps: up('rook'),
    blurb: 'A rook that can hop over one piece each move.', earn: 'Join up your two rooks by move 12, in 3 games.' },
  { id: 'CARD-06', name: 'Ghost bishop', emoji: '👻', kind: 'Upgrade', rarity: 'Common', suit: 'bishop', usesMove: true, taps: up('bishop'),
    blurb: 'A bishop that floats through your own pieces.', earn: 'Pin an enemy piece to its king.' },
  { id: 'CARD-07', name: 'Nightrider', emoji: '🌙', kind: 'Upgrade', rarity: 'Rare', suit: 'knight', usesMove: true, taps: up('knight'),
    blurb: 'A knight that keeps jumping the same way, again and again.', earn: 'Fork two pieces with a knight (attack both at once).' },
  { id: 'CARD-08', name: 'Bodyguard', emoji: '💂', kind: 'Upgrade', rarity: 'Common', suit: 'king', usesMove: true, taps: [{ field: 'piece', prompt: 'Tap your knight or bishop' }],
    blurb: 'For 5 turns, your pieces right next to it can\'t be taken.', earn: 'Play 10 moves in a row without leaving a piece unprotected.' },
  { id: 'CARD-09', name: 'Cannon', emoji: '💣', kind: 'Upgrade', rarity: 'Common', suit: 'rook', usesMove: true, taps: up('rook'),
    blurb: 'Moves like a rook, but takes by jumping over exactly one piece.', earn: 'Make a sneak attack (move one piece to uncover another).' },
  { id: 'CARD-10', name: 'Wall', emoji: '🧱', kind: 'Summon', rarity: 'Common', suit: 'rook', usesMove: true, taps: [{ field: 'to', prompt: 'Tap an empty square in your half' }],
    blurb: 'Build a wall that nothing can pass or take. It falls after 3 of your turns.', earn: 'Win or draw after being 3 points behind.' },
  { id: 'CARD-11', name: 'Teleporter', emoji: '🌀', kind: 'Effect', rarity: 'Rare', suit: 'knight', usesMove: true, taps: [{ field: 'piece', prompt: 'Tap the piece to teleport' }, { field: 'to', prompt: 'Tap any empty square' }],
    blurb: 'Zap one of your pieces to any empty square. It can\'t give check.', earn: 'Win a game where your knight took a rook or queen.' },
  { id: 'CARD-12', name: 'Twin', emoji: '👯', kind: 'Effect', rarity: 'Common', suit: 'queen', usesMove: true, taps: [{ field: 'piece', prompt: 'Tap your rook, or one knight' }, { field: 'to', prompt: 'Tap a square next to the rook, or your other knight' }],
    blurb: 'Split a rook into two knights, or join two knights into a rook.', earn: 'Coming soon (Draft games).' },
  { id: 'CARD-13', name: 'Camel', emoji: '🐫', kind: 'Upgrade', rarity: 'Common', suit: 'knight', usesMove: true, taps: up('knight'),
    blurb: 'A long-legged knight: 3 squares one way, 1 to the side.', earn: 'Win a Dice chess game.' },
  { id: 'CARD-14', name: 'Grasshopper', emoji: '🦗', kind: 'Upgrade', rarity: 'Common', suit: 'pawn', usesMove: true, taps: up('pawn'),
    blurb: 'Hops over the next piece in any line and lands just past it.', earn: 'Coming soon (Mini board games).' },
  { id: 'CARD-15', name: 'Dragon rook', emoji: '🐉', kind: 'Upgrade', rarity: 'Rare', suit: 'rook', usesMove: true, taps: up('rook'),
    blurb: 'A rook that can also step one square diagonally.', earn: 'Checkmate with a rook.' },
  { id: 'CARD-16', name: 'Dragon bishop', emoji: '🐲', kind: 'Upgrade', rarity: 'Rare', suit: 'bishop', usesMove: true, taps: up('bishop'),
    blurb: 'A bishop that can also step one square straight.', earn: 'Own the middle: sit on 2 centre squares and guard all 4.' },
  { id: 'CARD-17', name: 'Lance', emoji: '🗡️', kind: 'Upgrade', rarity: 'Common', suit: 'pawn', usesMove: true, taps: up('pawn'),
    blurb: 'A pawn that charges straight ahead any distance. No going back.', earn: 'Make a passed pawn (no enemy pawns can stop it), in 3 games.' },
  { id: 'CARD-18', name: 'Phoenix', emoji: '🔥', kind: 'Effect', rarity: 'Rare', suit: 'queen', usesMove: false, taps: [{ field: 'piece', prompt: 'Tap the piece to protect' }],
    blurb: 'Mark a piece. The first time it\'s taken, it flies back home (if home is empty).', earn: 'Win a game after losing your queen.' },
  { id: 'CARD-19', name: 'Bomb pawn', emoji: '🧨', kind: 'Effect', rarity: 'Common', suit: 'pawn', usesMove: false, taps: [{ field: 'piece', prompt: 'Tap the pawn to turn into a bomb' }],
    blurb: 'Mark a pawn. Whatever takes it goes BOOM too (not a king).', earn: 'Coming soon (Atomic games).' },
  { id: 'CARD-20', name: 'Magnet', emoji: '🧲', kind: 'Effect', rarity: 'Common', suit: 'bishop', usesMove: false, taps: [{ field: 'piece', prompt: 'Tap your magnet piece' }, { field: 'target', prompt: 'Tap the enemy piece in line with it' }],
    blurb: 'Pull an enemy piece one square closer to yours. Free action.', earn: 'Make a skewer (attack a big piece with a smaller one behind).' },
  { id: 'CARD-21', name: 'Battering ram', emoji: '🐏', kind: 'Effect', rarity: 'Common', suit: 'rook', usesMove: false, taps: [{ field: 'piece', prompt: 'Tap your rook' }, { field: 'target', prompt: 'Tap the enemy right next to it' }],
    blurb: 'Push an enemy next to your rook one square away. Free action.', earn: 'Line up both rooks on a file with no pawns.' },
  { id: 'CARD-22', name: 'Medic', emoji: '🩹', kind: 'Effect', rarity: 'Rare', suit: 'bishop', usesMove: false, taps: [{ field: 'piece', prompt: 'Tap your bishop' }, { field: 'to', prompt: 'Tap an empty square next to it' }],
    blurb: 'Bring back one of your lost pawns next to a bishop. Free action.', earn: 'Win a game losing 2 pawns or fewer.' },
  { id: 'CARD-23', name: 'Decoy king', emoji: '🎭', kind: 'Summon', rarity: 'Epic', suit: 'king', usesMove: true, taps: [], notYet: true,
    blurb: 'A fake king the enemy can\'t tell apart from yours.', earn: 'Coming soon.' },
  { id: 'CARD-24', name: 'Guard', emoji: '🛡️', kind: 'Upgrade', rarity: 'Common', suit: 'pawn', usesMove: true, taps: up('pawn'),
    blurb: 'A pawn that moves like a king (but isn\'t one). It can\'t promote.', earn: 'Castle by move 8, in 5 games.' },
  // King cards (owner, 2026-11-18): so every piece has cards for collections.
  { id: 'CARD-25', name: 'Knight king', emoji: '🏇', kind: 'Upgrade', rarity: 'Rare', suit: 'king', usesMove: true, taps: up('king'),
    blurb: 'Your king can also jump like a knight. It is still your king!', earn: 'Win a game after you castled.' },
  { id: 'CARD-26', name: 'Long-step king', emoji: '👢', kind: 'Upgrade', rarity: 'Common', suit: 'king', usesMove: true, taps: up('king'),
    blurb: 'Your king can move up to 2 squares in a straight line (not over pieces).', earn: 'Win a game of 20+ moves where your king was never in check.' },
];

export function cardById(id: string): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}

export const HAND_SIZE = 3;
