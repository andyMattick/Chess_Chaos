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
/** Where you start (the town square, just below the Quest Board). */
export const WORLD_START = { x: 8, y: 10 };

export const PLACES: Place[] = [
  { id: 'tower', name: 'Bot Tower', sub: 'Play the bots', about: 'Play chess against friendly bots. Beat one to open the next, all the way to the top.', emoji: '🤖', go: 'bots', x: 6, y: 1, w: 4, h: 3, district: 'play', roof: '#5bd17a', wall: '#d9d2c3' },
  { id: 'woods', name: 'Level-Up Woods', sub: 'Pieces level up', about: 'Level-Up Chess: your pieces win battles and grow stronger. Hide in the forest!', emoji: '🗡️', go: 'levelup', x: 1, y: 1, w: 3, h: 2, district: 'play', roof: '#3b5bdb', wall: '#c9b48f' },
  { id: 'ring', name: 'Battle Ring', sub: '3 and 4 players', about: 'Big battles for 3 or 4 players on special boards.', emoji: '⚔️', go: 'battle', x: 12, y: 1, w: 3, h: 2, district: 'play', roof: '#ff5a3c', wall: '#e3cfa8' },
  { id: 'arena', name: 'Party Arena', sub: 'Surprise mode, missions', about: 'A surprise game mode, secret missions and power-ups. Every party is different!', emoji: '🎉', go: 'party', x: 1, y: 5, w: 4, h: 2, district: 'play', roof: '#ff6fb5', wall: '#fbe3ef' },
  { id: 'cave', name: 'Puzzle Cave', sub: 'Find the trick', about: 'Chess puzzles: find the winning trick. Keep a streak going every day.', emoji: '🧩', go: 'puzzles', x: 1, y: 14, w: 3, h: 2, district: 'train', roof: '#8a7f73', wall: '#6e655c' },
  { id: 'quests', name: 'Quest Board', sub: 'Daily missions', about: 'Three small missions every day. Finish them for bonus coins.', emoji: '📅', go: 'daily', x: 7, y: 8, w: 2, h: 1, district: 'square', roof: '#a0662b', wall: '#f3e3c3' },
  { id: 'carnival', name: 'Chaos Carnival', sub: '25 game modes', about: 'Try any of 25 wild ways to play: hills, lava, atomic and more.', emoji: '🎪', go: 'modes', x: 11, y: 5, w: 3, h: 2, district: 'play', roof: '#36c5c5', wall: '#fff1c9' },
  { id: 'park', name: 'Mini-game Park', sub: 'Mazes, sprints', about: 'Quick little games: mazes, races and puzzles with just a few pieces.', emoji: '🌀', go: 'minis', x: 4, y: 14, w: 3, h: 2, district: 'train', roof: '#8fd16a', wall: '#f2f7d9' },
  { id: 'school', name: 'Training School', sub: 'Alerts and hints', about: 'Practice games with tips that warn you before you make a mistake.', emoji: '🎓', go: 'train', x: 1, y: 10, w: 3, h: 2, district: 'train', roof: '#ffc93c', wall: '#f7ead0' },
  { id: 'post', name: 'Post Office', sub: 'Challenges by mail', about: 'Play a friend one move at a time. Their move arrives here like a letter.', emoji: '📬', go: 'challenges', x: 1, y: 18, w: 3, h: 2, district: 'friends', roof: '#e8413c', wall: '#f3e7d6' },
  { id: 'library', name: 'Library', sub: 'Learn openings', about: "Learn the bots' favourite openings: the best first moves of a game.", emoji: '📖', go: 'openings', x: 4, y: 10, w: 3, h: 2, district: 'train', roof: '#4a6fa5', wall: '#e8dcc6' },
  { id: 'memory', name: 'Memory House', sub: 'My games', about: 'Watch your old games again and see your best and worst moves.', emoji: '📜', go: 'history', x: 12, y: 10, w: 3, h: 2, district: 'records', roof: '#a77bff', wall: '#efe4ff' },
  { id: 'tailor', name: 'Wardrobe Shop', sub: 'Skins and boards', about: 'Spend your coins on new piece armies and board landscapes.', emoji: '🧌', go: 'wardrobe', x: 9, y: 18, w: 3, h: 2, district: 'shops', roof: '#ff9f43', wall: '#fde9d2' },
  { id: 'cards', name: 'Card Shop', sub: 'My cards', about: 'See the cards you have won from party matches.', emoji: '🃏', go: 'cards', x: 12, y: 18, w: 3, h: 2, district: 'shops', roof: '#c08cff', wall: '#f4eaff' },
  { id: 'fame', name: 'Hall of Fame', sub: 'Leaderboard', about: "The leaderboard: see who's on top this week.", emoji: '🏆', go: 'leaderboard', x: 12, y: 14, w: 3, h: 2, district: 'records', roof: '#ffb13d', wall: '#fff3d6' },
  { id: 'harbour', name: 'Harbour', sub: 'Play a friend online', about: 'Play a friend online right now. Send them a room code.', emoji: '⛵', go: 'online', x: 4, y: 19, w: 3, h: 2, district: 'friends', roof: '#4aa8ff', wall: '#dcefff' },
  { id: 'signpost', name: 'Chess.com Signpost', sub: 'Players, nemesis bots', about: 'Look up Chess.com players and turn them into bots to beat.', emoji: '♟️', go: 'chesscom', x: 7, y: 19, w: 1, h: 1, district: 'friends', roof: '#7fb069', wall: '#c9a46c' },
];

/**
 * The parts of town (owner, 2026-11-25: "organize the buildings into train,
 * play, records, etc. The map is kind of nondescript"). Each has its own
 * ground colour and a name board at its edge (`board`), and the signposts
 * point the way to it. Areas are rectangles of tiles; the town square and
 * the main street (columns 7 to 9) belong to none of them.
 */
export type DistrictId = 'play' | 'train' | 'records' | 'friends' | 'shops';
export interface District {
  id: DistrictId;
  name: string;
  /** Icon name from ui/icons.tsx, drawn on the name board. */
  icon: string;
  area: { x: number; y: number; w: number; h: number };
  board: { x: number; y: number };
  /** Two grass shades (checkerboard), or a paved look for the market. */
  ground: [string, string];
  paved?: boolean;
}

export const DISTRICTS: District[] = [
  { id: 'play', name: 'Play', icon: 'swords', area: { x: 1, y: 1, w: 14, h: 7 }, board: { x: 6, y: 7 }, ground: ['#95da6c', '#8dd264'] },
  { id: 'train', name: 'Train', icon: 'cap', area: { x: 1, y: 9, w: 6, h: 8 }, board: { x: 5, y: 9 }, ground: ['#86cfa4', '#7ec79c'] },
  { id: 'records', name: 'Records', icon: 'trophy', area: { x: 10, y: 9, w: 5, h: 8 }, board: { x: 10, y: 9 }, ground: ['#c3d56c', '#bbcd64'] },
  { id: 'friends', name: 'Friends', icon: 'boat', area: { x: 1, y: 17, w: 7, h: 5 }, board: { x: 6, y: 17 }, ground: ['#8fd3c3', '#87cbbb'] },
  { id: 'shops', name: 'Shops', icon: 'shirt', area: { x: 9, y: 17, w: 6, h: 5 }, board: { x: 10, y: 17 }, ground: ['#ddd3bd', '#d5cbb4'], paved: true },
];

/**
 * Plain wooden signposts at the crossroads, each arm pointing to a part of
 * town. Signs, boards and buildings are never on a road.
 */
export interface Signpost { x: number; y: number; arms: { dir: 'up' | 'down' | 'left' | 'right'; to: DistrictId }[] }
export const SIGNPOSTS: Signpost[] = [
  { x: 10, y: 11, arms: [{ dir: 'up', to: 'play' }, { dir: 'left', to: 'train' }, { dir: 'right', to: 'records' }] },
  { x: 8, y: 16, arms: [{ dir: 'left', to: 'friends' }, { dir: 'right', to: 'shops' }] },
];

export function districtAt(x: number, y: number): District | null {
  return DISTRICTS.find((d) => x >= d.area.x && y >= d.area.y && x < d.area.x + d.area.w && y < d.area.y + d.area.h) ?? null;
}

/** Fixed scenery: the sea along the bottom, and a pond. Everything else is grass, roads, trees and flowers. */
export const WATER: { x: number; y: number }[] = [
  ...Array.from({ length: WORLD_W * 2 }, (_, i) => ({ x: i % WORLD_W, y: 22 + Math.floor(i / WORLD_W) })),
  { x: 10, y: 13 }, { x: 11, y: 13 }, { x: 10, y: 14 },
];

export function doorOf(p: Pick<Place, 'x' | 'y' | 'w' | 'h'>): { x: number; y: number } {
  return { x: p.x + Math.floor(p.w / 2), y: p.y + p.h };
}
