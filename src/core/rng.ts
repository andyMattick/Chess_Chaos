/**
 * Seeded generator (mulberry32). The state is a single 32-bit integer kept in
 * GameState.rng so every game can be replayed from its seed (docs/04 section 1).
 */
export function rngNext(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

export function rngInt(state: number, n: number): [value: number, next: number] {
  const [v, next] = rngNext(state);
  return [Math.floor(v * n), next];
}

export function newSeed(): number {
  return (Math.random() * 0xffffffff) | 0;
}
