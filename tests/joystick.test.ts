import { describe, expect, it } from 'vitest';
import { DEAD_ZONE, joystickDir, KNOB_TRAVEL, knobAt, sameDir } from '../src/ui/joystick';

describe('world map joystick', () => {
  it('a small wobble in the middle does not walk', () => {
    expect(joystickDir(0, 0)).toBeNull();
    expect(joystickDir(DEAD_ZONE - 1, 0)).toBeNull();
    expect(joystickDir(NaN, 5)).toBeNull();
  });
  it('snaps a drag to the nearest of the four directions (screen y grows downwards)', () => {
    expect(joystickDir(0, -20)).toEqual([0, -1]);
    expect(joystickDir(0, 20)).toEqual([0, 1]);
    expect(joystickDir(-20, 3)).toEqual([-1, 0]);
    expect(joystickDir(25, -10)).toEqual([1, 0]);
    expect(joystickDir(12, -18)).toEqual([0, -1]);
  });
  it('keeps the knob inside the ring', () => {
    expect(knobAt(0, 0)).toEqual({ x: 0, y: 0 });
    expect(knobAt(10, 0)).toEqual({ x: 10, y: 0 });
    const far = knobAt(300, 400);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(KNOB_TRAVEL);
    expect(far.x / far.y).toBeCloseTo(0.75);
  });
  it('tells a new direction from the same one', () => {
    expect(sameDir([1, 0], [1, 0])).toBe(true);
    expect(sameDir([1, 0], [0, 1])).toBe(false);
    expect(sameDir(null, null)).toBe(true);
    expect(sameDir(null, [0, -1])).toBe(false);
  });
});
