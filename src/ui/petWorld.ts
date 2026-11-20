/**
 * Inside Pet World's 🎲 Game Room (owner, 2026-11-20: "do option 2").
 *
 * Pet World shows Chess Chaos in a locked-down frame, opened as
 *   https://chess-chaos-seven.vercel.app/?host=petworld&origin=<Pet World's address>&vs=<bot|live|pass>
 * Then Chess Chaos:
 *  - hides Chess.com, the world leaderboard, Challenges, friend invites, live-room pop-ups and the "get a number" ask.
 *    A player number she already has (on her phone) can be loaded on Home or the player screen, and then saves as
 *    usual, so both places keep the same progress (owner, 2026-11-20: "there is no way for her to bring in the number
 *    she has on her phone account?"). "Play online" (a room code) shows only when vs=live, so a child
 *    can play the grown-up who is in Pet World's Game Room with her;
 *  - tells Pet World when a game ends (win, loss or draw, against a bot or online), with window.postMessage to that
 *    one address only. Nothing about the player is sent: no names, no ratings, no moves.
 * Outside a frame, or with an address that isn't Pet World's, nothing changes.
 */

const PET_WORLD_ORIGIN = /^(https:\/\/pet-world-2(-[a-z0-9-]+)?\.vercel\.app|http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?)$/;

export interface PetWorldHost { origin: string; live: boolean }

export function readPetWorld(search: string, framed: boolean): PetWorldHost | null {
  if (!framed) return null;
  try {
    const q = new URLSearchParams(search);
    if (q.get('host') !== 'petworld') return null;
    const origin = q.get('origin') ?? '';
    if (!PET_WORLD_ORIGIN.test(origin)) return null;
    return { origin, live: q.get('vs') === 'live' };
  } catch {
    return null;
  }
}

const framed = (() => { try { return typeof window !== 'undefined' && window.parent !== window; } catch { return true; } })();
export const petWorld: PetWorldHost | null = typeof location === 'undefined' ? null : readPetWorld(location.search, framed);

export interface PetWorldResult { result: 'win' | 'loss' | 'draw'; vs: 'bot' | 'online'; bot?: string; mode?: string }

/** The message Pet World reads (src/shared/gameRoom.js there). */
export function resultMessage(r: PetWorldResult, id: string) {
  return {
    type: 'chess-chaos:result' as const, v: 1, id: id.slice(0, 40), result: r.result, vs: r.vs,
    bot: (r.bot ?? '').slice(0, 30), mode: (r.mode ?? 'standard').slice(0, 30),
  };
}

export function tellPetWorld(r: PetWorldResult): void {
  if (!petWorld) return;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try { window.parent.postMessage(resultMessage(r, id), petWorld.origin); } catch { /* Pet World is gone: nothing to tell */ }
}
