/**
 * Solo mini-games (docs/03 "Mini-games", MINI-01 to MINI-09). Content is data:
 * the levels below; generated positions are in minisPositions.ts.
 */
export interface MiniDef { id: string; name: string; emoji: string; skill: string; blurb: string }

export const MINIS: MiniDef[] = [
  { id: 'MINI-01', name: 'Pawn wars', emoji: '♟️', skill: 'Pawn play', blurb: 'Just kings and pawns. First pawn to the far side wins!' },
  { id: 'MINI-02', name: 'Piece mazes', emoji: '🌀', skill: 'Piece movement', blurb: 'Get to the star in as few moves as you can.' },
  { id: 'MINI-03', name: 'Capture the candy', emoji: '🍬', skill: 'Planning', blurb: 'Grab every candy in as few moves as you can.' },
  { id: 'MINI-04', name: 'Checkmate ladder', emoji: '🪜', skill: 'Basic mates', blurb: 'Trap a lone king: queen, then two rooks, then one rook.' },
  { id: 'MINI-05', name: 'Mate in one sprint', emoji: '⚡', skill: 'Patterns', blurb: 'Find as many checkmates as you can in 60 seconds.' },
  { id: 'MINI-06', name: 'Guard duty', emoji: '🛡️', skill: 'Defence', blurb: 'Something is in danger. Find one move that keeps every piece safe.' },
  { id: 'MINI-07', name: 'Trade or no trade', emoji: '⚖️', skill: 'Counting', blurb: 'Does this capture win stuff after they take back? Quick!' },
  { id: 'MINI-08', name: 'Spotlight', emoji: '🔦', skill: 'Calculation', blurb: 'One piece is lit up. Find its best move.' },
  { id: 'MINI-09', name: 'Handicap ladder', emoji: '🏋️', skill: 'Confidence', blurb: 'The bot starts without its queen. Win, and its pieces come back.' },
];

/** A maze or candy level: one piece, walls, and the goal squares (algebraic). */
export interface PathLevel { piece: 'rook' | 'bishop' | 'knight' | 'king' | 'queen'; start: string; goals: string[]; walls: string[] }

/** MINI-02: one goal (the star). */
export const MAZES: PathLevel[] = [
  { piece: 'rook', start: 'a1', goals: ['h8'], walls: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'] },
  { piece: 'bishop', start: 'c1', goals: ['f8'], walls: ['d2', 'e5', 'g7', 'c5'] },
  { piece: 'king', start: 'e1', goals: ['e8'], walls: ['b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4', 'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6'] },
  { piece: 'knight', start: 'b1', goals: ['b8'], walls: ['c3', 'a3', 'd4', 'b5'] },
  { piece: 'queen', start: 'a1', goals: ['h7'], walls: ['b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2', 'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6'] },
  { piece: 'rook', start: 'a1', goals: ['e5'], walls: ['b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'g3', 'g4', 'g5', 'g6', 'b6', 'c6', 'd6', 'f6', 'b3', 'b4', 'b5', 'd4', 'e4', 'f5'] },
  { piece: 'knight', start: 'a1', goals: ['h8'], walls: ['e4', 'f6', 'd5', 'g6', 'c4', 'f5'] },
  { piece: 'bishop', start: 'a1', goals: ['h2'], walls: ['c3', 'f6', 'b4', 'e1', 'g3', 'e5'] },
];

/** MINI-03: several candies, any order. */
export const CANDY: PathLevel[] = [
  { piece: 'rook', start: 'a1', goals: ['a8', 'h8', 'h1'], walls: [] },
  { piece: 'knight', start: 'b1', goals: ['c3', 'e4', 'f6'], walls: [] },
  { piece: 'bishop', start: 'c1', goals: ['a3', 'e3', 'g5', 'd6'], walls: [] },
  { piece: 'king', start: 'e1', goals: ['e3', 'c5', 'g6'], walls: ['d4', 'e4', 'f4'] },
  { piece: 'queen', start: 'd1', goals: ['a4', 'h5', 'd8', 'b6'], walls: ['d4', 'c2', 'e2'] },
  { piece: 'knight', start: 'g1', goals: ['e2', 'h6', 'c6', 'a1'], walls: ['f3', 'e5'] },
  { piece: 'rook', start: 'h1', goals: ['b2', 'g7', 'c5', 'e8', 'a6'], walls: ['b4', 'c2', 'f7', 'e6', 'g3'] },
  { piece: 'queen', start: 'e1', goals: ['a5', 'h4', 'c8', 'f7', 'b2', 'g6'], walls: ['c3', 'd6', 'f2', 'e5', 'b7'] },
];

/** MINI-04: White to mate a lone king. The level is won by checkmate. */
export const MATE_LADDER: { name: string; fen: string }[] = [
  { name: 'Queen and king', fen: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1' },
  { name: 'Two rooks', fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1' },
  { name: 'Rook and king', fen: '4k3/8/8/8/8/8/8/4K2R w - - 0 1' },
];

/**
 * MINI-09: the bot plays Black without some pieces; each win brings pieces
 * back. Written definition: it starts without its queen (doc 08 log for the steps).
 */
export const HANDICAP_LADDER: { name: string; fen: string }[] = [
  { name: 'No queen', fen: 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  { name: 'Queen back, no rook', fen: 'rnbqkbn1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQq - 0 1' },
  { name: 'Rook back, no knight', fen: 'r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  { name: 'Full army', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
];

/** Seconds for the sprint (MINI-05) and per question in Trade or no trade (MINI-07). */
export const SPRINT_SECONDS = 60;
export const TRADE_SECONDS = 8;
/** Rounds per go in Guard duty, Trade or no trade and Spotlight. */
export const ROUNDS = 10;
