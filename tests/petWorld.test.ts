import { describe, expect, it } from 'vitest';
import { readPetWorld, resultMessage } from '../src/ui/petWorld';

describe('inside Pet World (src/ui/petWorld.ts)', () => {
  const q = (origin: string, vs = 'bot') => `?host=petworld&origin=${encodeURIComponent(origin)}&vs=${vs}`;
  it('turns on only in a frame, with host=petworld and a Pet World address', () => {
    expect(readPetWorld(q('https://pet-world-2.vercel.app'), true)).toEqual({ origin: 'https://pet-world-2.vercel.app', live: false });
    expect(readPetWorld(q('https://pet-world-2-git-main-x.vercel.app', 'live'), true)?.live).toBe(true);
    expect(readPetWorld(q('http://localhost:5173'), true)).not.toBeNull();
    expect(readPetWorld(q('https://pet-world-2.vercel.app'), false)).toBeNull();          // not in a frame
    expect(readPetWorld('?origin=https://pet-world-2.vercel.app', true)).toBeNull();       // no host=petworld
    expect(readPetWorld(q('https://evil.example'), true)).toBeNull();                       // someone else's page
    expect(readPetWorld(q('https://pet-world-2.vercel.app.evil.example'), true)).toBeNull();
    expect(readPetWorld(q('https://xpet-world-2.vercel.app'), true)).toBeNull();
  });
  it('sends only the result: no names, ratings or moves', () => {
    const m = resultMessage({ result: 'win', vs: 'bot', bot: 'Captain Castle', mode: 'standard' }, 'abc');
    expect(m).toEqual({ type: 'chess-chaos:result', v: 1, id: 'abc', result: 'win', vs: 'bot', bot: 'Captain Castle', mode: 'standard' });
    expect(resultMessage({ result: 'draw', vs: 'online' }, 'x'.repeat(99)).id).toHaveLength(40);
  });
});
