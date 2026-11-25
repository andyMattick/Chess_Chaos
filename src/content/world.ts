/**
 * The World of C.H.A.O.S. overworld (owner, 2026-11-22: the main screen as a map
 * "with a Zelda walking around theme", daily missions as a place on the map).
 * Our own top-down world: walk your king around and step up to a door to go in.
 * Plain data: where each place stands, what it opens, and the fixed scenery.
 * Roads, trees and flowers are worked out from this by systems/world.ts.
 */

/** Where a place leads: one of the app's screens, or the Quest Board (daily missions). */
export type PlaceGo =
  | 'bots' | 'online' | 'party' | 'levelup' | 'modes' | 'battle' | 'challenges' | 'minis' | 'train'
  | 'openings' | 'puzzles' | 'wardrobe' | 'cards' | 'history' | 'leaderboard' | 'chesscom' | 'daily';

export interface Place {
  id: string;
  name: string;
  /** What you do there, in a few words. */
  sub: string;
  /** One or two short sentences for the card you see when you tap it (owner, 2026-11-22: descriptions for the phone). */
  about: string;
  emoji: string;
  go: PlaceGo;
  /** Which part of town it stands in (DISTRICTS); 'square' is the town square in the middle. */
  district: DistrictId | 'square';
  /** Top-left tile and size in tiles. The door is the tile just below the middle of the front wall. */
  x: number; y: number; w: number; h: number;
  roof: string;
  wall: string;
}

export const WORLD_W = 16;
export const WORLD_H = 24;
/** Where you start: the town square, just below the gate into Play. */
export const WORLD_START = { x: 8, y: 9 };

export const PLACES: Place[] = [
  { id: 'tower', name: 'Bot Tower', sub: 'Play the bots', about: 'Play chess against friendly bots. Beat one to open the next, all the way to the top.', emoji: '🤖', go: 'bots', x: 6, y: 1, w: 4, h: 3, district: 'play', roof: '#5bd17a', wall: '#d9d2c3' },
  { id: 'woods', name: 'Level-Up Woods', sub: 'Pieces level up', about: 'Level-Up Chess: your pieces win battles and grow stronger. Hide in the forest!', emoji: '🗡️', go: 'levelup', x: 1, y: 1, w: 3, h: 2, district: 'play', roof: '#3b5bdb', wall: '#c9b48f' },
  { id: 'ring', name: 'Battle Ring', sub: '3 and 4 players', about: 'Big battles for 3 or 4 players on special boards.', emoji: '⚔️', go: 'battle', x: 12, y: 1, w: 3, h: 2, district: 'play', roof: '#ff5a3c', wall: '#e3cfa8' },
  { id: 'arena', name: 'Party Arena', sub: 'Surprise mode, missions', about: 'A surprise game mode, secret missions and power-ups. Every party is different!', emoji: '🎉', go: 'party', x: 1, y: 5, w: 4, h: 2, district: 'play', roof: '#ff6fb5', wall: '#fbe3ef' },
  { id: 'cave', name: 'Puzzle Cave', sub: 'Find the trick', about: 'Chess puzzles: find the winning trick. Keep a streak going every day.', emoji: '🧩', go: 'puzzles', x: 1, y: 14, w: 3, h: 2, district: 'train', roof: '#8a7f73', wall: '#6e655c' },
  { id: 'quests', name: 'Quest Board', sub: 'Daily missions', about: 'Three small missions every day. Finish them for bonus coins.', emoji: '📅', go: 'daily', x: 11, y: 8, w: 2, h: 1, district: 'square', roof: '#a0662b', wall: '#f3e3c3' },
  { id: 'carnival', name: 'Chaos Carnival', sub: '25 game modes', about: 'Try any of 25 wild ways to play: hills, lava, atomic and more.', emoji: '🎪', go: 'modes', x: 11, y: 5, w: 4, h: 2, district: 'play', roof: '#36c5c5', wall: '#fff1c9' },
  { id: 'park', name: 'Mini-game Park', sub: 'Mazes, sprints', about: 'Quick little games: mazes, races and puzzles with just a few pieces.', emoji: '🌀', go: 'minis', x: 4, y: 14, w: 3, h: 2, district: 'train', roof: '#8fd16a', wall: '#f2f7d9' },
  { id: 'school', name: 'Training School', sub: 'Alerts and hints', about: 'Practice games with tips that warn you before you make a mistake.', emoji: '🎓', go: 'train', x: 1, y: 11, w: 3, h: 2, district: 'train', roof: '#ffc93c', wall: '#f7ead0' },
  { id: 'post', name: 'Post Office', sub: 'Challenges by mail', about: 'Play a friend one move at a time. Their move arrives here like a letter.', emoji: '📬', go: 'challenges', x: 1, y: 17, w: 3, h: 2, district: 'friends', roof: '#e8413c', wall: '#f3e7d6' },
  { id: 'library', name: 'Library', sub: 'Learn openings', about: "Learn the bots' favourite openings: the best first moves of a game.", emoji: '📖', go: 'openings', x: 4, y: 11, w: 3, h: 2, district: 'train', roof: '#4a6fa5', wall: '#e8dcc6' },
  { id: 'memory', name: 'Memory House', sub: 'My games', about: 'Watch your old games again and see your best and worst moves.', emoji: '📜', go: 'history', x: 9, y: 11, w: 3, h: 2, district: 'records', roof: '#a77bff', wall: '#efe4ff' },
  { id: 'tailor', name: 'Wardrobe Shop', sub: 'Skins and boards', about: 'Spend your coins on new piece armies and board landscapes.', emoji: '🧌', go: 'wardrobe', x: 9, y: 17, w: 3, h: 2, district: 'shops', roof: '#ff9f43', wall: '#fde9d2' },
  { id: 'cards', name: 'Card Shop', sub: 'My cards', about: 'See the cards you have won from party matches.', emoji: '🃏', go: 'cards', x: 12, y: 17, w: 3, h: 2, district: 'shops', roof: '#c08cff', wall: '#f4eaff' },
  { id: 'fame', name: 'Hall of Fame', sub: 'Leaderboard', about: "The leaderboard: see who's on top this week.", emoji: '🏆', go: 'leaderboard', x: 12, y: 11, w: 3, h: 2, district: 'records', roof: '#ffb13d', wall: '#fff3d6' },
  { id: 'harbour', name: 'Harbour', sub: 'Play a friend online', about: 'Play a friend online right now. Send them a room code.', emoji: '⛵', go: 'online', x: 4, y: 19, w: 3, h: 2, district: 'friends', roof: '#4aa8ff', wall: '#dcefff' },
  { id: 'signpost', name: 'Chess.com Signpost', sub: 'Players, nemesis bots', about: 'Look up Chess.com players and turn them into bots to beat.', emoji: '♟️', go: 'chesscom', x: 5, y: 17, w: 1, h: 1, district: 'friends', roof: '#7fb069', wall: '#c9a46c' },
];

/**
 * The parts of town (owner, 2026-11-25: "organize the buildings into train,
 * play, records, etc."; then "move the buildings around to organize better,
 * and put walls up around areas to make it more clear where I am").
 *
 *   rows 1-7    Play, across the top
 *   rows 8-10   the town square (open, paved)
 *   rows 11-16  Train (left) | main street | Records (right)
 *   rows 17-21  Friends (left) | main street | Shops (right), by the sea
 *
 * Each part is a walled yard: a low wall runs round it, and you go in and out
 * by its gates (gaps in the wall facing the square or the main street). Walls
 * sit on the edges between tiles, so they take no room. Each part has its own
 * ground and a name board over its first gate.
 */
export type DistrictId = 'play' | 'train' | 'records' | 'friends' | 'shops';
export interface Gate { x: number; y: number; side: 'up' | 'down' | 'left' | 'right' }
export interface District {
  id: DistrictId;
  name: string;
  /** Icon name from ui/icons.tsx, drawn on the name board. */
  icon: string;
  area: { x: number; y: number; w: number; h: number };
  /** A tile just inside the wall, and which side of it is open. The name board hangs over the first. */
  gates: Gate[];
  /** Two shades for the ground (checkerboard). Paved parts get stones. */
  ground: [string, string];
  paved?: boolean;
}

export const DISTRICTS: District[] = [
  { id: 'play', name: 'Play', icon: 'swords', area: { x: 1, y: 1, w: 14, h: 7 }, gates: [{ x: 7, y: 7, side: 'down' }, { x: 8, y: 7, side: 'down' }], ground: ['#95da6c', '#8dd264'] },
  { id: 'train', name: 'Train', icon: 'cap', area: { x: 1, y: 11, w: 6, h: 6 }, gates: [{ x: 6, y: 13, side: 'right' }, { x: 6, y: 16, side: 'right' }], ground: ['#86cfa4', '#7ec79c'] },
  { id: 'records', name: 'Records', icon: 'trophy', area: { x: 9, y: 11, w: 6, h: 6 }, gates: [{ x: 9, y: 14, side: 'left' }], ground: ['#c9d873', '#c1d06b'] },
  { id: 'friends', name: 'Friends', icon: 'boat', area: { x: 1, y: 17, w: 6, h: 5 }, gates: [{ x: 6, y: 18, side: 'right' }, { x: 6, y: 21, side: 'right' }], ground: ['#8fd3c3', '#87cbbb'] },
  { id: 'shops', name: 'Shops', icon: 'shirt', area: { x: 9, y: 17, w: 6, h: 5 }, gates: [{ x: 9, y: 19, side: 'left' }], ground: ['#ddd3bd', '#d5cbb4'], paved: true },
];

/** The town square (between Play and the rest): paved, no wall. The main street runs from it to the sea. */
export const SQUARE = { x: 1, y: 8, w: 14, h: 3 };
export const MAIN_STREET = { x: 7, y: 11, w: 2, h: 11 };

/**
 * Plain wooden signposts, each arm pointing to a part of town. They stand on
 * their own tile, never on a road.
 */
export interface Signpost { x: number; y: number; arms: { dir: 'up' | 'down' | 'left' | 'right'; to: DistrictId }[] }
export const SIGNPOSTS: Signpost[] = [
  { x: 6, y: 10, arms: [{ dir: 'up', to: 'play' }, { dir: 'left', to: 'train' }, { dir: 'right', to: 'records' }] },
  { x: 8, y: 16, arms: [{ dir: 'left', to: 'friends' }, { dir: 'right', to: 'shops' }] },
];

export function districtAt(x: number, y: number): District | null {
  return DISTRICTS.find((d) => x >= d.area.x && y >= d.area.y && x < d.area.x + d.area.w && y < d.area.y + d.area.h) ?? null;
}

export const GATE_STEP: Record<Gate['side'], [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * Is there a wall between these two neighbouring tiles? Yes when they are in
 * different parts of town (or one is in a part and the other is not), unless
 * a gate opens that way.
 */
export function wallBetween(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const da = districtAt(a.x, a.y), db = districtAt(b.x, b.y);
  if (da === db) return false;
  const opens = (d: District | null, from: { x: number; y: number }, to: { x: number; y: number }) =>
    !!d && d.gates.some((g) => g.x === from.x && g.y === from.y && from.x + GATE_STEP[g.side][0] === to.x && from.y + GATE_STEP[g.side][1] === to.y);
  return !opens(da, a, b) && !opens(db, b, a);
}

/** Fixed scenery: the sea along the bottom, and a pond. Everything else is grass, roads, trees and flowers. */
export const WATER: { x: number; y: number }[] = [
  ...Array.from({ length: WORLD_W * 2 }, (_, i) => ({ x: i % WORLD_W, y: 22 + Math.floor(i / WORLD_W) })),
  { x: 10, y: 15 }, { x: 11, y: 15 }, { x: 11, y: 16 },
];

export function doorOf(p: Pick<Place, 'x' | 'y' | 'w' | 'h'>): { x: number; y: number } {
  return { x: p.x + Math.floor(p.w / 2), y: p.y + p.h };
}
