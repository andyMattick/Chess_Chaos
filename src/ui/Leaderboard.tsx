import { activeProfile, type Opponent } from '../storage/storage';
import { BOTS } from '../content/bots';
import type { GameRecord } from '../core/record';
import { useSave } from './store';

/**
 * Leaderboard: you, everyone you have played online, and the bots you have
 * met, ranked by rating. Saved on this device only; ratings are as of the
 * last game against each person.
 */
export function Leaderboard({ back }: { back: () => void }) {
  const save = useSave();
  const p = activeProfile(save);
  if (!p) return null;
  const rows = [
    { key: 'me', name: p.nickname, kind: 'you' as const, rating: p.rating, w: 0, l: 0, d: 0, last: Date.now() },
    ...Object.entries(withHistory(p.opponents ?? {}, p.botRecords ?? {}, save.games[p.id] ?? [], p.nickname)).map(([key, o]) => ({ key, ...o })),
    // Other players on this device count too.
    ...save.profiles.filter((x) => x.id !== p.id).map((x) => ({ key: `local:${x.id}`, name: x.nickname, kind: 'device' as const, rating: x.rating, w: 0, l: 0, d: 0, last: 0 })),
  ].sort((a, b) => b.rating - a.rating);
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div className="panel taped">
      <h2>Leaderboard <span className="scribble">who's on top?</span></h2>
      <p className="muted small">Everyone you've played, ranked by rating. Ratings are from your last game with each one. Saved on this device.</p>
      {rows.length === 1 && <p className="muted">Play some bots or friends online and they'll show up here.</p>}
      <ol className="leaderboard">
        {rows.map((r, i) => (
          <li key={r.key} className={r.kind === 'you' ? 'me' : ''}>
            <span className="place">{medal[i] ?? i + 1}</span>
            <span className="lb-name">
              <b>{r.name}{r.kind === 'you' ? ' (you)' : ''}</b>
              <small>{r.kind === 'bot' ? '🤖 bot' : r.kind === 'online' ? '🌐 online' : r.kind === 'device' ? '📱 this device' : ''}{r.kind === 'bot' || r.kind === 'online' ? ` · you: W ${r.w} · L ${r.l} · D ${r.d}` : ''}</small>
            </span>
            <span className="bot-rating">{r.rating ? `★ ${r.rating}` : '★ ?'}</span>
          </li>
        ))}
      </ol>
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}

/**
 * Games played before the leaderboard existed: fill in bots from the bot path
 * record and online players from saved games (their rating is unknown until you
 * play them again).
 */
function withHistory(known: Record<string, Opponent>, botRecords: Record<string, { w: number; l: number; d: number }>, games: GameRecord[], me: string): Record<string, Opponent> {
  const out = { ...known };
  for (const [id, r] of Object.entries(botRecords)) {
    const b = BOTS.find((x) => x.id === id);
    if (b && !out[`bot:${b.id}`]) out[`bot:${b.id}`] = { name: b.name, kind: 'bot', rating: b.rating, ...r, last: 0 };
  }
  const added = new Set<string>();
  const botNames = new Set(BOTS.flatMap((b) => [b.name.toLowerCase(), `${b.emoji} ${b.name}`.toLowerCase()]));
  for (const g of games) {
    if (g.id.startsWith('cc-') || g.setup.kind !== 'fen' || !g.meta.result) continue;
    const names = Object.entries(g.meta.players);
    const mine = names.find(([, n]) => n === me)?.[0];
    if (!mine) continue;
    for (const [seat, n] of names) {
      const key = `online:${n.toLowerCase()}`;
      if (seat === mine || botNames.has(n.toLowerCase()) || (out[key] && !added.has(key)) || n === '…') continue;
      const w = g.meta.result.winners;
      const prev = out[key] ?? { name: n, kind: 'online' as const, rating: 0, w: 0, l: 0, d: 0, last: 0 };
      added.add(key);
      out[key] = { ...prev, w: prev.w + (w.includes(mine as never) ? 1 : 0), l: prev.l + (w.length && !w.includes(mine as never) ? 1 : 0), d: prev.d + (w.length ? 0 : 1), last: Math.max(prev.last, g.meta.startedAt) };
    }
  }
  return out;
}
