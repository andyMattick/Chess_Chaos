import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../src/content/party';
import { MISSION_PICTURES } from '../src/content/missionPictures';
import { missionDone, missionHolds, missionTarget } from '../src/systems/missions';
import { pictureLine, sqIndex } from '../src/systems/missionPictures';

describe('mission pictures', () => {
  it('every secret mission has exactly one picture', () => {
    expect(MISSION_PICTURES.map((p) => p.id).sort()).toEqual(MISSIONS.map((m) => m.id).sort());
  });

  for (const pic of MISSION_PICTURES) {
    it(`${pic.id}: the picture's line is legal and its last move does the mission`, () => {
      const line = pictureLine(pic);
      expect(line, 'every move reads').toBeTruthy();
      const { states, moves } = line!;
      expect(moves.length).toBe(pic.san.length);
      const ply = moves.length - 1;
      expect(states[ply].turn).toBe('p1');
      const ctx = { states, ply, move: moves[ply], player: 'p1' as const, movesMade: pic.id === 'MISSION-19' ? 20 : Math.ceil(moves.length / 2) };
      expect(missionDone(pic.id, ctx)).toBe(true);
      // And it still stands in the picture (so the picture is not of a mission already undone).
      expect(missionHolds(pic.id, states[states.length - 1], 'p1', missionTarget(pic.id, ctx))).toBe(true);
      for (const sq of [...(pic.rings ?? []), ...(pic.zones ?? []), ...(pic.arrows ?? []).flatMap((a) => [a.from, a.to])]) {
        expect(sqIndex(sq)).toBeGreaterThanOrEqual(0);
        expect(sqIndex(sq)).toBeLessThan(64);
      }
      expect(pic.caption.length).toBeLessThan(170);
    });
  }
});
