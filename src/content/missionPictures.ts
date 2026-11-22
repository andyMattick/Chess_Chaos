/**
 * A small picture for every secret mission (owner, 2026-11-22: "knight fortress
 * secret mission is not clear. can we get an image to show what it would look
 * like (for all secret missions)?"). Each picture is a real position: start
 * from `fen`, play `san` (White's moves and Black's replies); White's last move
 * does the mission. tests/missionPictures.test.ts plays every line and checks
 * the mission's own detector (systems/missions.ts) says "done".
 *
 * The picture shows the board after the last move (or before it, `show: 'before'`),
 * with that move (or the `arrowMove`-th) as a blue arrow. Extra marks: `hit` red arrows (what is attacked),
 * `guard` green arrows (what protects), `rings` (squares to look at) and `zones`
 * (shaded squares, explained in the caption).
 */
export interface MissionPicture {
  id: string;
  fen: string;
  san: string[];
  show?: 'before' | 'after';
  /** Which move of `san` is drawn as the blue arrow (default: the last one). */
  arrowMove?: number;
  arrows?: { from: string; to: string; kind: 'hit' | 'guard' }[];
  rings?: string[];
  zones?: string[];
  caption: string;
}

export const MISSION_PICTURES: MissionPicture[] = [
  {
    id: 'MISSION-04', fen: '6k1/1P6/8/8/8/8/8/6K1 w - - 0 1', san: ['b8=Q+'],
    rings: ['b8'],
    caption: 'Walk a pawn all the way to the last row. It turns into a queen!',
  },
  {
    id: 'MISSION-05', fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', san: ['Nc7+'],
    arrows: [{ from: 'c7', to: 'e8', kind: 'hit' }, { from: 'c7', to: 'a8', kind: 'hit' }],
    caption: 'One knight jump attacks the king AND the rook. They can only save one.',
  },
  {
    id: 'MISSION-06', fen: '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', san: ['Bb5'],
    arrows: [{ from: 'b5', to: 'e8', kind: 'hit' }],
    rings: ['c6'],
    caption: 'The knight is stuck: if it moves, the bishop would attack the king behind it.',
  },
  {
    id: 'MISSION-07', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', san: ['Ra7', 'h6', 'Kf1'], arrowMove: 0,
    show: 'after',
    zones: ['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7'],
    rings: ['a7'],
    caption: 'Get a rook onto their pawn row (shaded) and keep it there through their turn.',
  },
  {
    id: 'MISSION-10', fen: '4k3/8/8/8/3P4/8/4P3/4K3 w - - 0 1', san: ['e4'],
    arrows: [{ from: 'e4', to: 'd5', kind: 'guard' }, { from: 'd4', to: 'e5', kind: 'guard' }],
    zones: ['d4', 'e4', 'd5', 'e5'],
    caption: 'Stand on 2 of the 4 middle squares (shaded) and guard all 4.',
  },
  {
    id: 'MISSION-11', fen: '3qk3/8/8/8/8/8/8/R2QK3 w - - 0 1', san: ['Qxd8+', 'Kxd8', 'Kd2'], arrowMove: 0,
    rings: ['d8'],
    caption: "You're ahead (you have an extra rook). Swap queens: with fewer pieces left, your extra rook wins.",
  },
  {
    id: 'MISSION-12', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', san: ['Ra8+', 'Kd7', 'Ra7+', 'Ke6', 'Ra6+'],
    rings: ['e6'],
    caption: 'Check, check, check! Three checks in one game (here: Ra8, Ra7 and now Ra6).',
  },
  {
    id: 'MISSION-14', fen: '4q1k1/8/8/8/4N3/8/8/K3R3 w - - 0 1', san: ['Nc5'],
    arrows: [{ from: 'e1', to: 'e8', kind: 'hit' }],
    caption: 'The knight hops out of the way, and now the rook behind it attacks the queen.',
  },
  {
    id: 'MISSION-15', fen: '4q3/8/8/4k3/8/8/8/K6R w - - 0 1', san: ['Re1+'],
    arrows: [{ from: 'e1', to: 'e5', kind: 'hit' }],
    rings: ['e8'],
    caption: 'The rook checks the king. When the king steps aside, the queen behind it is caught.',
  },
  {
    id: 'MISSION-16', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', san: ['exd6'], show: 'before',
    rings: ['d5'],
    caption: 'Their pawn just jumped two squares and landed next to yours. Take it as if it moved one: your pawn goes to d6.',
  },
  {
    id: 'MISSION-17', fen: '4k3/p7/8/8/4P3/8/8/4K3 w - - 0 1', san: ['e5'],
    zones: ['d6', 'd7', 'e6', 'e7', 'e8', 'f6', 'f7'],
    caption: 'Your pawn reaches the 5th row, and no enemy pawn is ahead on its column or next to it (shaded). Nothing can stop it walking.',
  },
  {
    id: 'MISSION-18', fen: '4k3/1pp5/2n5/1B6/8/8/8/4K3 w - - 0 1', san: ['Bxc6', 'bxc6', 'Kd2'], arrowMove: 0,
    rings: ['c6', 'c7'],
    caption: 'Take a piece so a pawn must take back. Now they have two pawns on one column.',
  },
  {
    id: 'MISSION-19', fen: '4k3/pp3ppp/8/8/8/8/PP3PPP/2B1KB2 w - - 0 1', san: ['Bd3'],
    rings: ['c1', 'd3'],
    caption: 'Still have BOTH bishops after your 20th move. Keep them safe!',
  },
  {
    id: 'MISSION-21', fen: '4k3/p6p/8/8/4P3/2N5/8/4K3 w - - 0 1', san: ['Nd5'],
    arrows: [{ from: 'e4', to: 'd5', kind: 'guard' }],
    zones: ['c6', 'c7', 'e6', 'e7'],
    caption: 'Jump a knight into their half (row 5 or 6). A pawn guards it. No enemy pawn is on the shaded squares, so none can ever chase it away.',
  },
  {
    id: 'MISSION-23', fen: '4k3/pp4pp/8/8/8/8/PP3RPP/3R2K1 w - - 0 1', san: ['Rfd2'],
    zones: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'],
    caption: 'Both rooks on one column (shaded) with no pawns on it. A rook tower!',
  },
];

export function missionPicture(id: string): MissionPicture | undefined {
  return MISSION_PICTURES.find((p) => p.id === id);
}
