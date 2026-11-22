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
  emoji: string;
  go: PlaceGo;
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
  { id: 'tower', name: 'Bot Tower', sub: 'Play the bots', emoji: '🤖', go: 'bots', x: 6, y: 1, w: 4, h: 3, roof: '#5bd17a', wall: '#d9d2c3' },
  { id: 'woods', name: 'Level-Up Woods', sub: 'Pieces level up', emoji: '🗡️', go: 'levelup', x: 1, y: 1, w: 3, h: 2, roof: '#3b5bdb', wall: '#c9b48f' },
  { id: 'ring', name: 'Battle Ring', sub: '3 and 4 players', emoji: '⚔️', go: 'battle', x: 12, y: 1, w: 3, h: 2, roof: '#ff5a3c', wall: '#e3cfa8' },
  { id: 'arena', name: 'Party Arena', sub: 'Surprise mode, missions', emoji: '🎉', go: 'party', x: 1, y: 6, w: 4, h: 2, roof: '#ff6fb5', wall: '#fbe3ef' },
  { id: 'cave', name: 'Puzzle Cave', sub: 'Find the trick', emoji: '🧩', go: 'puzzles', x: 11, y: 6, w: 4, h: 2, roof: '#8a7f73', wall: '#6e655c' },
  { id: 'quests', name: 'Quest Board', sub: 'Daily missions', emoji: '📅', go: 'daily', x: 7, y: 8, w: 2, h: 1, roof: '#a0662b', wall: '#f3e3c3' },
  { id: 'carnival', name: 'Chaos Carnival', sub: '25 game modes', emoji: '🎪', go: 'modes', x: 1, y: 11, w: 3, h: 2, roof: '#36c5c5', wall: '#fff1c9' },
  { id: 'park', name: 'Mini-game Park', sub: 'Mazes, sprints', emoji: '🌀', go: 'minis', x: 12, y: 11, w: 3, h: 2, roof: '#8fd16a', wall: '#f2f7d9' },
  { id: 'school', name: 'Training School', sub: 'Alerts and hints', emoji: '🎓', go: 'train', x: 5, y: 13, w: 3, h: 2, roof: '#ffc93c', wall: '#f7ead0' },
  { id: 'post', name: 'Post Office', sub: 'Challenges by mail', emoji: '📬', go: 'challenges', x: 9, y: 13, w: 3, h: 2, roof: '#e8413c', wall: '#f3e7d6' },
  { id: 'library', name: 'Library', sub: 'Learn openings', emoji: '📖', go: 'openings', x: 1, y: 16, w: 3, h: 2, roof: '#4a6fa5', wall: '#e8dcc6' },
  { id: 'memory', name: 'Memory House', sub: 'My games', emoji: '📜', go: 'history', x: 12, y: 16, w: 3, h: 2, roof: '#a77bff', wall: '#efe4ff' },
  { id: 'tailor', name: 'Wardrobe Shop', sub: 'Skins and boards', emoji: '🧌', go: 'wardrobe', x: 5, y: 17, w: 3, h: 2, roof: '#ff9f43', wall: '#fde9d2' },
  { id: 'cards', name: 'Card Shop', sub: 'My cards', emoji: '🃏', go: 'cards', x: 8, y: 17, w: 3, h: 2, roof: '#c08cff', wall: '#f4eaff' },
  { id: 'fame', name: 'Hall of Fame', sub: 'Leaderboard', emoji: '🏆', go: 'leaderboard', x: 1, y: 19, w: 3, h: 2, roof: '#ffb13d', wall: '#fff3d6' },
  { id: 'harbour', name: 'Harbour', sub: 'Play a friend online', emoji: '⛵', go: 'online', x: 12, y: 19, w: 3, h: 2, roof: '#4aa8ff', wall: '#dcefff' },
  { id: 'signpost', name: 'Chess.com Signpost', sub: 'Players, nemesis bots', emoji: '♟️', go: 'chesscom', x: 7, y: 20, w: 1, h: 1, roof: '#7fb069', wall: '#c9a46c' },
];

/** Fixed scenery: the sea along the bottom, and a pond. Everything else is grass, roads, trees and flowers. */
export const WATER: { x: number; y: number }[] = [
  ...Array.from({ length: WORLD_W * 2 }, (_, i) => ({ x: i % WORLD_W, y: 22 + Math.floor(i / WORLD_W) })),
  { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 4, y: 10 },
];

export function doorOf(p: Pick<Place, 'x' | 'y' | 'w' | 'h'>): { x: number; y: number } {
  return { x: p.x + Math.floor(p.w / 2), y: p.y + p.h };
}
