import { describe, expect, it } from 'vitest';
import { DISTRICTS, districtAt, doorOf, GATE_STEP, PLACES, SIGNPOSTS, wallBetween, WORLD_H, WORLD_START, WORLD_W } from '../src/content/world';
import { buildWorld, canStep, doorPlace, groundAt, pathTo, placeOn, walkable } from '../src/systems/world';

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
      for (let i = 1; i < path.length; i++) {
        expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)).toBe(1);
        expect(wallBetween(path[i - 1], path[i]), `${p.id}: the path goes through a wall`).toBe(false);
      }
      expect(path.every((t) => walkable(w, t))).toBe(true);
      expect(placeOn(w, { x: p.x, y: p.y })?.id).toBe(p.id);
    }
  });

  it('is the same every time, and still works with places hidden (Pet World, Chess.com off)', () => {
    expect(buildWorld().ground).toEqual(w.ground);
    const fewer = PLACES.filter((p) => !['online', 'challenges', 'leaderboard', 'chesscom'].includes(p.go));
    const w2 = buildWorld(fewer);
    for (const p of fewer) expect(pathTo(w2, WORLD_START, doorOf(p)).length).toBeGreaterThan(0);
    expect(placeOn(w2, { x: 4, y: 19 })).toBeNull(); // the Harbour is hidden
    expect(w2.districts.map((d) => d.id)).not.toContain('friends'); // nothing left there: no board, no signpost arm
    expect(w2.signposts.flatMap((s) => s.arms.map((a) => a.to))).not.toContain('friends');
  });

  it('tapping water or a tree walks next to it; tapping where you stand does nothing', () => {
    expect(pathTo(w, WORLD_START, WORLD_START)).toEqual([]);
    const sea = pathTo(w, WORLD_START, { x: 8, y: 23 });
    expect(sea.length).toBe(0); // far out at sea: no open tile next to it
    const shore = pathTo(w, WORLD_START, { x: 8, y: 22 });
    expect(shore[shore.length - 1]).toEqual({ x: 8, y: 21 });
  });

  it('groups the places into parts of town, each with a name board, and the signposts point the right way', () => {
    // Owner, 2026-11-25: "organize the buildings into train, play, records, etc."
    for (const p of PLACES) {
      if (p.district === 'square') continue;
      for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) expect(districtAt(x, y)?.id, `${p.id} at ${x},${y}`).toBe(p.district);
    }
    for (const d of DISTRICTS) {
      expect(PLACES.some((p) => p.district === d.id), d.id).toBe(true);
      // Every gate opens onto the square or the main street, and you can walk through it.
      for (const g of d.gates) {
        const [dx, dy] = GATE_STEP[g.side];
        const out = { x: g.x + dx, y: g.y + dy };
        expect(districtAt(out.x, out.y), `${d.id} gate`).toBeNull();
        expect(canStep(w, out, g) && canStep(w, g, out), `${d.id} gate at ${g.x},${g.y}`).toBe(true);
      }
      expect(SIGNPOSTS.some((s) => s.arms.some((a) => a.to === d.id)), `a signpost points to ${d.id}`).toBe(true);
    }
    for (const s of SIGNPOSTS) {
      expect(groundAt(w, s)).toBe('sign');
      for (const a of s.arms) {
        const d = DISTRICTS.find((x) => x.id === a.to)!;
        const cx = d.area.x + d.area.w / 2, cy = d.area.y + d.area.h / 2;
        if (a.dir === 'up') expect(cy, a.to).toBeLessThan(s.y);
        if (a.dir === 'down') expect(cy, a.to).toBeGreaterThan(s.y);
        if (a.dir === 'left') expect(cx, a.to).toBeLessThan(s.x);
        if (a.dir === 'right') expect(cx, a.to).toBeGreaterThan(s.x);
      }
    }
  });

  it('walls keep you out except through a gate, and the town stays tidy', () => {
    // Straight across the wall between the main street and Train: blocked. Through the gate: fine.
    expect(wallBetween({ x: 7, y: 12 }, { x: 6, y: 12 })).toBe(true);
    expect(wallBetween({ x: 7, y: 13 }, { x: 6, y: 13 })).toBe(false);
    expect(wallBetween({ x: 8, y: 13 }, { x: 9, y: 13 })).toBe(true); // Records opens a row lower
    // Between two parts of town there is never a gate.
    expect(wallBetween({ x: 3, y: 16 }, { x: 3, y: 17 })).toBe(true);
    // No stray trees inside the town (only the forest at the edges).
    for (let y = 1; y < WORLD_H - 2; y++) for (let x = 1; x < WORLD_W - 1; x++) expect(groundAt(w, { x, y }), `${x},${y}`).not.toBe('tree');
  });
});
