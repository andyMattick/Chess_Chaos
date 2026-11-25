/**
 * Small text helpers so records and counts read as plain words, not label
 * strings (design review, 2026-11-25: "W 2 · L 1 · D 0" means nothing to a
 * seven-year-old).
 */
export function recordText(r: { w: number; l: number; d: number }): string {
  const parts = [`won ${r.w}`, `lost ${r.l}`];
  if (r.d) parts.push(`drew ${r.d}`);
  const s = parts.join(', ');
  return s[0].toUpperCase() + s.slice(1);
}

/** "3 games", "1 game". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
