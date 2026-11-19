import { claim, dailyFor, dayKey, noteKind, type DailyKind } from '../systems/daily';
import { activeProfile, load, updateProfile } from './storage';

/** Count progress toward today's daily missions for the active player. */
export function noteDaily(kind: DailyKind, n = 1) {
  if (!activeProfile(load())) return;
  updateProfile((p) => ({ ...p, daily: noteKind(dailyFor(p.daily, dayKey()), kind, n) }));
}

/** Collect the coins for a finished daily mission. */
export function claimDaily(id: string) {
  updateProfile((p) => {
    const r = claim(dailyFor(p.daily, dayKey()), id);
    return { ...p, daily: r.state, coins: (p.coins ?? 0) + r.coins };
  });
}
