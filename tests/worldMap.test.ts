import { describe, expect, it } from 'vitest';
import { doorOf, PLACES, WORLD_H, WORLD_START, WORLD_W } from '../src/content/world';
import { buildWorld, doorPlace, groundAt, pathTo, placeOn, walkable } from '../src/systems/world';

const HOME_SCREENS = ['bots', 'online', 'party', 'levelup', 'modes', 'battle', 'challenges', 'minis', 'train', 'openings', 'puzzles', 'wardrobe', 'cards', 'history', 'leaderboard', 'chesscom', 'daily'];

describe('World of C.H.A.O.S. map', () => {
  const w = buildWorld();

  it('has one place for every main-screen choice, inside the map, not overlapping', () => {
    expect(PLACES.map((p) => p.go).sort()).toEqual([...HOME_SCREENS].sort());
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
    const seen = new Set<string>();
    for (const p of PLACES) {
      expect(p.x).toBeGreaterThanOrEqual(1); expect(p.x + p.w).toBeLessThanOrEqual(WORLD_W - 1);
      expect(p.y).toBeGreaterThanOrEqual(1); expect(p.y + p.h).toBeLessThan(WORLD_H);
      for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
        expect(seen.has(`${x},${y}`), `${p.id} overlaps at ${x},${y}`).toBe(false);
        seen.add(`${x},${y}`);
      }
    }
  });

  it('every place has a short description for its card', () => {
    for (const p of PLACES) {
      expect(p.about.length, p.id).toBeGreaterThan(20);
      expect(p.about.length, p.id).toBeLessThanOrEqual(100);
      expect(p.about.split('. ').length, p.id).toBeLessThanOrEqual(2);
    }
  });

  it('can walk from the town square to every door, and the door says which place it is', () => {
    expect(walkable(w, WORLD_START)).toBe(true);
    for (const p of PLACES) {
      const d = doorOf(p);
      expect(walkable(w, d), `${p.id} door`).toBe(true);
      expect(groundAt(w, d)).toBe('road');
      expect(doorPlace(w, d)?.id).toBe(p.id);
      const path = pathTo(w, WORLD_START, { x: p.x, y: p.y }); // tapping the roof walks to the door
      expect(path.length, p.id).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual(d);
      for (let i = 1; i < path.length; i++) expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)).toBe(1);
      expect(path.every((t) => walkable(w, t))).toBe(true);
      expect(placeOn(w, { x: p.x, y: p.y })?.id).toBe(p.id);
    }
  });

  it('is the same every time, and still works with places hidden (Pet World, Chess.com off)', () => {
    expect(buildWorld().ground).toEqual(w.ground);
    const fewer = PLACES.filter((p) => !['online', 'challenges', 'leaderboard', 'chesscom'].includes(p.go));
    const w2 = buildWorld(fewer);
    for (const p of fewer) expect(pathTo(w2, WORLD_START, doorOf(p)).length).toBeGreaterThan(0);
    expect(placeOn(w2, { x: 12, y: 19 })).toBeNull();
  });

  it('tapping water or a tree walks next to it; tapping where you stand does nothing', () => {
    expect(pathTo(w, WORLD_START, WORLD_START)).toEqual([]);
    const sea = pathTo(w, WORLD_START, { x: 8, y: 23 });
    expect(sea.length).toBe(0); // far out at sea: no open tile next to it
    const shore = pathTo(w, WORLD_START, { x: 8, y: 22 });
    expect(shore[shore.length - 1]).toEqual({ x: 8, y: 21 });
  });
});
