import { ALERTS, type AlertDef, type AlertId } from '../content/alerts';

/**
 * Alert selection (docs/02 section 2): exactly one alert per training game,
 * from the pool for the player's rating band, weighted toward what their miss
 * map says they overlook most, and never the same alert two games running.
 */

const THINKING_ALERTS: AlertId[] = ['ALERT-05', 'ALERT-06', 'ALERT-07', 'ALERT-08', 'ALERT-09', 'ALERT-10'];

export interface AlertMode {
  /** 'always' shows the alert all game; 'on-request' needs a tap and has limited uses. */
  kind: 'always' | 'on-request';
  uses: number;
}

export function alertPool(rating: number): AlertDef[] {
  if (rating < 800) return ALERTS;
  return ALERTS.filter((a) => THINKING_ALERTS.includes(a.id));
}

export function alertMode(rating: number): AlertMode {
  return rating >= 1200 ? { kind: 'on-request', uses: 3 } : { kind: 'always', uses: Infinity };
}

export type MissMap = Record<string, { missed: number; found: number }>;

/** Top missed skill: most misses relative to finds, needing at least 2 misses. */
export function topMiss(miss: MissMap): string | null {
  let best: string | null = null;
  let score = 0;
  for (const [k, v] of Object.entries(miss)) {
    if (v.missed < 2) continue;
    const r = v.missed / (v.missed + v.found + 1);
    if (r > score) { score = r; best = k; }
  }
  return best;
}

export function chooseAlert(rating: number, miss: MissMap, last: string | undefined, random: () => number): AlertDef {
  const pool = alertPool(rating).filter((a) => a.id !== last);
  const focus = topMiss(miss);
  const weights = pool.map((a) => (focus && a.trains.includes(focus) ? 3 : 1));
  const total = weights.reduce((x, y) => x + y, 0);
  let r = random() * total;
  for (let i = 0; i < pool.length; i++) {
    if ((r -= weights[i]) < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
