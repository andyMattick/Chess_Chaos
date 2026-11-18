import { activeProfile } from '../storage/storage';
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
    ...Object.entries(p.opponents ?? {}).map(([key, o]) => ({ key, ...o })),
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
            <span className="bot-rating">★ {r.rating}</span>
          </li>
        ))}
      </ol>
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}
