import { useState } from 'react';
import { chesscom, ChessComError, recentGames, type CCProfile, type CCStats } from '../chesscom/api';
import { recordFromPGN } from '../chesscom/pgn';
import type { GameRecord } from '../core/record';
import { activeProfile, addGame, update } from '../storage/storage';
import { useSave } from './store';
import type { GameConfig } from './GameScreen';
import type { Nemesis } from '../systems/nemesis';
import { makeNemesis, NemesisCard, startNemesis } from './Nemesis';

/**
 * Chess.com corner (docs/06): look up any public player, see their ratings,
 * and import their recent games into My games to replay with your skins.
 * Read-only; nothing is ever sent to Chess.com except the lookup.
 */
const RECENT_KEY = 'chess-chaos:cc-recent';

function recentNames(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

export function ChessCom({ back, open, play }: { back: () => void; open: (r: GameRecord) => void; play: (c: GameConfig) => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const [name, setName] = useState(recentNames()[0] ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CCProfile | null>(null);
  const [stats, setStats] = useState<CCStats | null>(null);
  const [imported, setImported] = useState<GameRecord[]>([]);
  const [nemesis, setNemesis] = useState<Nemesis | null>(null);

  const buildNemesisBot = async () => {
    if (!profile) return;
    setBusy('Reading their games… (this can take a little while)'); setError(null);
    try {
      const n = await makeNemesis(profile.username, stats);
      setNemesis(n);
      if (!n.games) setError('No standard games found in the last 12 months.');
    } catch (e) {
      setError(e instanceof ChessComError ? e.message : 'Could not download games right now.');
    } finally { setBusy(null); }
  };

  const lookup = async () => {
    const u = name.trim();
    if (!/^[A-Za-z0-9_-]{2,50}$/.test(u)) { setError('That does not look like a Chess.com username.'); return; }
    setBusy('Looking them up…'); setError(null); setImported([]);
    try {
      const [pr, st] = [await chesscom.profile(u), await chesscom.stats(u)];
      setProfile(pr); setStats(st); setNemesis(null);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify([u, ...recentNames().filter((x) => x.toLowerCase() !== u.toLowerCase())].slice(0, 6))); } catch { /* ignore */ }
    } catch (e) {
      setProfile(null); setStats(null);
      setError(e instanceof ChessComError ? e.message : 'Could not reach Chess.com. Try again in a bit.');
    } finally { setBusy(null); }
  };

  const importGames = async () => {
    if (!profile || !p) return;
    setBusy('Downloading games…'); setError(null);
    try {
      const games = await recentGames(profile.username, 20);
      const recs = games.map((g) => recordFromPGN(g.pgn!, g.url.split('/').pop())).filter((r): r is GameRecord => !!r && r.actions.length > 0)
        .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i);
      update((d) => recs.reduceRight((acc, r) => addGame(acc, p.id, r), d));
      setImported(recs);
      if (!recs.length) setError('No standard games found in the last few months.');
    } catch (e) {
      setError(e instanceof ChessComError ? e.message : 'Could not download games right now.');
    } finally { setBusy(null); }
  };

  const ratingRow = (label: string, block?: { last?: { rating: number }; record?: { win: number; loss: number; draw: number } }) =>
    block?.last ? (
      <div className="cc-rating" key={label}>
        <b>{label}</b> <span className="bot-rating">★ {block.last.rating}</span>
        {block.record && <span className="muted small"> W {block.record.win} · L {block.record.loss} · D {block.record.draw}</span>}
      </div>
    ) : null;

  return (
    <div className="panel taped">
      <h2>Chess.com corner</h2>
      <p className="muted">Type any Chess.com username to see their ratings and download their recent games to replay here.</p>
      <div className="row">
        <input className="code-input cc-input" aria-label="Chess.com username" placeholder="username" value={name} maxLength={50}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup()} />
        <button className="btn primary" onClick={lookup} disabled={!!busy || !name.trim()}>Look up</button>
      </div>
      {recentNames().length > 0 && (
        <div className="clock-chips">{recentNames().map((n) => <button key={n} className="chip" onClick={() => setName(n)}>{n}</button>)}</div>
      )}
      {busy && <p className="thinking-dots">{busy}</p>}
      {error && <p className="error-note">⚠️ {error}</p>}
      {profile && (
        <div className="cc-card">
          <div className="dot big" style={{ background: '#7fb069' }}>{profile.username.slice(0, 1).toUpperCase()}</div>
          <div>
            <h3>{profile.title ? `${profile.title} ` : ''}{profile.username}</h3>
            {ratingRow('Rapid', stats?.chess_rapid)}
            {ratingRow('Blitz', stats?.chess_blitz)}
            {ratingRow('Bullet', stats?.chess_bullet)}
            {ratingRow('Daily', stats?.chess_daily)}
            {stats?.tactics?.highest && <div className="cc-rating"><b>Puzzles</b> <span className="bot-rating">★ {stats.tactics.highest.rating}</span></div>}
          </div>
        </div>
      )}
      {profile && (
        <div className="row wrap">
          <button className="btn primary" onClick={importGames} disabled={!!busy}>⬇️ Download their last 20 games</button>
          <button className="btn primary dark" onClick={buildNemesisBot} disabled={!!busy}>😈 Make a nemesis bot</button>
        </div>
      )}
      {nemesis && nemesis.games > 0 && (
        <NemesisCard n={nemesis}>
          <div className="row wrap">
            <button className="btn primary" onClick={() => startNemesis(nemesis, p?.nickname ?? 'You', play, 'p1')}>Play as White</button>
            <button className="btn primary dark" onClick={() => startNemesis(nemesis, p?.nickname ?? 'You', play, 'p2')}>Play as Black</button>
          </div>
          <p className="muted small">Saved on the Bot path too, under "Your nemeses".</p>
        </NemesisCard>
      )}
      {imported.length > 0 && (
        <>
          <p><b>{imported.length} games saved to My games.</b> Tap one to replay it:</p>
          <ul className="history">
            {imported.map((g) => {
              const res = g.meta.result;
              const outcome = res ? (res.winners.length ? `${res.winners.map((w) => g.meta.players[w]).join(' & ')} won` : 'Draw') : 'Unfinished';
              return (
                <li key={g.id}>
                  <button onClick={() => open(g)}>
                    <b>{g.meta.players.p1} vs {g.meta.players.p2}</b>
                    <span>{outcome} · {Math.ceil(g.actions.length / 2)} moves · {new Date(g.meta.startedAt).toLocaleDateString()}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="muted small">Data from Chess.com's public API. Chess Chaos is not part of Chess.com.</p>
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}
