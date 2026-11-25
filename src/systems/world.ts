/**
 * The overworld's ground (content/world.ts): which tiles you can walk on,
 * roads from the town square to every door, trees and flowers, and finding
 * a path for a tap. Pure and deterministic, so the map is the same every visit.
 */
import { DISTRICTS, doorOf, PLACES, SIGNPOSTS, WATER, WORLD_H, WORLD_START, WORLD_W, type District, type Place, type Signpost } from '../content/world';

export type Ground = 'grass' | 'road' | 'tree' | 'flowers' | 'water' | 'building' | 'sign';
export interface Tile { x: number; y: number }

const key = (t: Tile) => t.y * WORLD_W + t.x;
const inside = (t: Tile) => t.x >= 0 && t.y >= 0 && t.x < WORLD_W && t.y < WORLD_H;
const STEPS: Tile[] = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }];

/** Small fixed hash, so trees and flowers land in the same spots every time. */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) / 4294967296;
}

function bfs(from: Tile, open: (t: Tile) => boolean): Map<number, number> {
  const prev = new Map<number, number>([[key(from), -1]]);
  const queue = [from];
  while (queue.length) {
    const t = queue.shift()!;
    for (const d of STEPS) {
      const n = { x: t.x + d.x, y: t.y + d.y };
      if (!inside(n) || prev.has(key(n)) || !open(n)) continue;
      prev.set(key(n), key(t));
      queue.push(n);
    }
  }
  return prev;
}

function walkBack(prev: Map<number, number>, to: Tile): Tile[] {
  if (!prev.has(key(to))) return [];
  const out: Tile[] = [];
  for (let k = key(to); k !== -1; k = prev.get(k)!) out.push({ x: k % WORLD_W, y: Math.floor(k / WORLD_W) });
  return out.reverse();
}

export interface World {
  ground: Ground[];
  /** Which place stands on each tile (index into the given places), or -1. */
  placeAt: number[];
  places: Place[];
  /** Parts of town that have at least one of these places, with their name boards. */
  districts: District[];
  /** Signposts, with arms only for parts of town that are shown. */
  signposts: Signpost[];
}

/** Lay out the world for these places (some places are hidden in Pet World or with Chess.com off). */
export function buildWorld(places: Place[] = PLACES): World {
  const ground: Ground[] = Array(WORLD_W * WORLD_H).fill('grass');
  const placeAt: number[] = Array(WORLD_W * WORLD_H).fill(-1);
  for (const w of WATER) ground[key(w)] = 'water';
  // The border is forest (the sea closes the bottom).
  for (let x = 0; x < WORLD_W; x++) if (ground[key({ x, y: 0 })] === 'grass') ground[key({ x, y: 0 })] = 'tree';
  for (let y = 0; y < WORLD_H; y++) for (const x of [0, WORLD_W - 1]) if (ground[key({ x, y })] === 'grass') ground[key({ x, y })] = 'tree';
  places.forEach((p, i) => {
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) { ground[key({ x, y })] = 'building'; placeAt[key({ x, y })] = i; }
  });
  // Name boards and signposts stand on their own tile, so roads go round them.
  const districts = DISTRICTS.filter((d) => places.some((p) => p.district === d.id));
  const signposts = SIGNPOSTS.map((s) => ({ ...s, arms: s.arms.filter((a) => districts.some((d) => d.id === a.to)) })).filter((s) => s.arms.length);
  for (const d of districts) ground[key(d.board)] = 'sign';
  for (const s of signposts) ground[key(s)] = 'sign';
  // Roads: the shortest way from the town square to every door.
  const walk = (t: Tile) => ground[key(t)] === 'grass' || ground[key(t)] === 'road';
  const prev = bfs(WORLD_START, walk);
  for (const p of places) for (const t of walkBack(prev, doorOf(p))) ground[key(t)] = 'road';
  // Trees and flowers on the grass, never next to a door or on the square.
  const nearDoor = (t: Tile) => places.some((p) => { const d = doorOf(p); return Math.abs(d.x - t.x) + Math.abs(d.y - t.y) <= 1; });
  for (let y = 1; y < WORLD_H; y++) for (let x = 1; x < WORLD_W - 1; x++) {
    const t = { x, y };
    const nearSign = [...signposts, ...districts.map((d) => d.board)].some((s) => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);
    if (ground[key(t)] !== 'grass' || nearDoor(t) || nearSign || (Math.abs(x - WORLD_START.x) <= 1 && Math.abs(y - WORLD_START.y) <= 1)) continue;
    const r = hash(x, y);
    if (r < 0.12) ground[key(t)] = 'tree';
    else if (r < 0.24) ground[key(t)] = 'flowers';
  }
  return { ground, placeAt, places, districts, signposts };
}

export function groundAt(w: World, t: Tile): Ground {
  return inside(t) ? w.ground[key(t)] : 'tree';
}

export function walkable(w: World, t: Tile): boolean {
  const g = groundAt(w, t);
  return g === 'grass' || g === 'road' || g === 'flowers';
}

export function placeOn(w: World, t: Tile): Place | null {
  if (!inside(t)) return null;
  const i = w.placeAt[key(t)];
  return i >= 0 ? w.places[i] : null;
}

/** The place whose door is this tile, if any. */
export function doorPlace(w: World, t: Tile): Place | null {
  return w.places.find((p) => { const d = doorOf(p); return d.x === t.x && d.y === t.y; }) ?? null;
}

/**
 * Steps from `from` to `to` (not including `from`). Tapping a building walks to
 * its door; tapping a tree or water walks to the nearest open tile next to it.
 * Empty when there is no way (or you are already there).
 */
export function pathTo(w: World, from: Tile, to: Tile): Tile[] {
  const p = placeOn(w, to);
  let goal = p ? doorOf(p) : to;
  if (!walkable(w, goal)) {
    const near = STEPS.map((d) => ({ x: goal.x + d.x, y: goal.y + d.y })).filter((n) => inside(n) && walkable(w, n));
    if (!near.length) return [];
    near.sort((a, b) => Math.abs(a.x - from.x) + Math.abs(a.y - from.y) - (Math.abs(b.x - from.x) + Math.abs(b.y - from.y)));
    goal = near[0];
  }
  const prev = bfs(from, (t) => walkable(w, t));
  return walkBack(prev, goal).slice(1);
}
