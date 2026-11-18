import { chesscom, recentGames, type CCStats } from '../chesscom/api';
import { updateProfile } from '../storage/storage';
import { buildNemesis, nemesisBot, type Nemesis } from '../systems/nemesis';
import type { GameConfig } from './GameScreen';

/** Download a player's games (up to 200 from the last 12 months) and build their nemesis bot. */
export async function makeNemesis(username: string, stats: CCStats | null): Promise<Nemesis> {
  const st = stats ?? (await chesscom.stats(username).catch(() => null));
  const cc = st?.chess_rapid?.last?.rating ?? st?.chess_blitz?.last?.rating ?? st?.chess_bullet?.last?.rating ?? st?.chess_daily?.last?.rating ?? null;
  const games = await recentGames(username, 200, 12);
  const n = buildNemesis(username, games, cc);
  updateProfile((p) => ({ ...p, nemeses: [n, ...(p.nemeses ?? []).filter((x) => x.key !== n.key)].slice(0, 6) }));
  return n;
}

export function startNemesis(n: Nemesis, me: string, start: (c: GameConfig) => void, seat?: 'p1' | 'p2') {
  const bot = nemesisBot(n);
  const humanSeat = seat ?? (Math.random() < 0.5 ? 'p1' : 'p2');
  start({ kind: 'bot', botId: bot.id, humanSeat, names: humanSeat === 'p1' ? { p1: me, p2: `😈 ${n.name}` } : { p1: `😈 ${n.name}`, p2: me } });
}

/** The nemesis card: who it copies, how strong, their favourite openings. */
export function NemesisCard({ n, children }: { n: Nemesis; children?: React.ReactNode }) {
  const lines = n.asWhite.length + n.asBlack.length;
  return (
    <div className="nemesis-card">
      <div className="nemesis-face">😈</div>
      <div>
        <h3>{n.name}'s nemesis <span className="bot-rating">★ {n.rating}</span></h3>
        <p className="small">
          Plays the openings of <b>{n.name}</b> from {n.games} real games, then thinks with our engine at about ★ {n.rating} strength
          {n.ccRating && n.ccRating > n.rating ? ` (the strongest we have; ${n.name} is ★ ${n.ccRating} on Chess.com)` : ''}.
        </p>
        {n.topWhite.length > 0 && <p className="small">As White: {n.topWhite.join(' · ')}</p>}
        {n.topBlack.length > 0 && <p className="small">As Black: {n.topBlack.join(' · ')}</p>}
        {n.firstMove && <p className="small">Favourite first move: <b>{n.firstMove}</b></p>}
        {lines === 0 && <p className="small muted">Not enough repeat games to copy openings yet. It plays its own way from move 1.</p>}
        {children}
      </div>
    </div>
  );
}
