import { useEffect, useRef, useState } from 'react';
import { mailLabel, mailTurn, type MailGame, type Tournament } from '../net/world';
import { vaultBase } from '../storage/cloud';
import { activeProfile } from '../storage/storage';
import { acceptFriend, declineFriend, friendInbox, labelFor, myGames, myTournaments, takeAccepted } from '../storage/world';
import { showNumber } from '../net/vault';
import { sfx } from './sound';
import { useSave } from './store';

/**
 * Pop-ups anywhere in the app (owner, 2026-11-18): a new challenge, your move in
 * a challenge game, a friend request, a tournament invite, a friend saying yes.
 * The app asks the server every 45 seconds while it is open (and when it comes
 * back to the front). Each pop-up shows once; "Later" leaves it in 📬 Challenges.
 */
export interface Pop { id: string; emoji: string; text: string; kind: 'open' | 'friend' | 'info'; n?: string }

const POLL_MS = 45_000;
const SEEN_KEY = 'chess-chaos:seen-pops';

function seenSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}
function markSeen(id: string) {
  try {
    const s = [...seenSet(), id].slice(-300);
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch { /* storage full or off: the pop-up may show again */ }
}

/** What deserves a pop-up, from the server's lists. Pure, so it can be tested. */
export function popsFrom(me: string, games: MailGame[], tours: Tournament[], incoming: string[], accepted: string[], name: (n: string) => string): Pop[] {
  const out: Pop[] = [];
  const mode = (g: MailGame) => mailLabel(g.game);
  for (const n of accepted) out.push({ id: `fa:${n}:${Date.now()}`, emoji: '🤝', text: `${name(n)} said yes! You're friends now.`, kind: 'info' });
  for (const n of incoming) out.push({ id: `fr:${n}`, emoji: '🤝', text: `Player ${showNumber(n)}${!name(n).startsWith('Player') && name(n) !== n ? ` (${name(n)})` : ''} wants to be friends.`, kind: 'friend', n });
  for (const g of games) {
    const mine = g.players.p1 === me ? 'p1' : 'p2';
    const other = g.players[mine === 'p1' ? 'p2' : 'p1'];
    if (g.status === 'invited' && g.from !== me) {
      out.push({ id: `ch:${g.id}`, emoji: '📨', text: `${name(g.from)} challenged you to ${mode(g)}!`, kind: 'open' });
      continue;
    }
    if (g.status !== 'playing' || /^bot-/.test(other)) continue;
    const moves = g.lu ? g.lu.actions.length : g.record.actions.length;
    if (mailTurn(g) === mine && moves > 0) out.push({ id: `mv:${g.id}:${moves}`, emoji: '👉', text: `Your move against ${name(other)} (${mode(g)}).`, kind: 'open' });
  }
  for (const t of tours) {
    if (t.status === 'invited' && !t.joined.includes(me) && !t.declined.includes(me)) out.push({ id: `t:${t.id}`, emoji: '🏆', text: `${name(t.organizer)} invited you to a tournament!`, kind: 'open' });
  }
  return out;
}

/** `inChallenges`: the player is looking at 📬 Challenges, so everything there counts as seen. `quiet`: in a game, wait. */
export function Popups({ openChallenges, quiet, inChallenges }: { openChallenges: () => void; quiet: boolean; inChallenges: boolean }) {
  const save = useSave();
  const p = activeProfile(save);
  const number = p?.cloud?.number;
  const [queue, setQueue] = useState<Pop[]>([]);
  const looking = useRef(inChallenges);
  looking.current = inChallenges;
  useEffect(() => {
    if (!inChallenges) return;
    setQueue((q) => { q.filter((x) => x.kind !== 'info').forEach((x) => markSeen(x.id)); return q.filter((x) => x.kind === 'info'); });
  }, [inChallenges]);

  useEffect(() => {
    if (!number || !vaultBase()) return;
    let stop = false;
    const busy = { current: false };
    // The first look always happens (a page still loading can report itself hidden); later ones skip a hidden app.
    const check = async (first = false) => {
      if (busy.current || (!first && document.visibilityState === 'hidden')) return;
      busy.current = true;
      try {
        const [games, tours, inbox] = await Promise.all([myGames(), myTournaments(), friendInbox()]);
        const said = await takeAccepted(inbox);
        const prof = activeProfile();
        const seen = seenSet();
        const fresh = popsFrom(number, games, tours, inbox.incoming.map((x) => x.n), said, (n) => labelFor(prof, n)).filter((x) => !seen.has(x.id));
        if (looking.current) fresh.filter((x) => x.kind !== 'info').forEach((x) => markSeen(x.id));
        const toShow = looking.current ? fresh.filter((x) => x.kind === 'info') : fresh;
        if (!stop && toShow.length) {
          setQueue((q) => [...q, ...toShow.filter((x) => !q.some((y) => y.id === x.id))]);
          sfx.promote();
        }
      } catch { /* offline: try again next time */ }
      busy.current = false;
    };
    void check(true);
    const t = setInterval(() => void check(), POLL_MS);
    const onShow = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', onShow); };
  }, [number]);

  const top = queue[0];
  if (!top || quiet) return null;
  const done = () => { markSeen(top.id); setQueue((q) => q.slice(1)); };
  return (
    <div className="popup" role="status" aria-live="polite">
      <span className="popup-emoji">{top.emoji}</span>
      <span className="popup-text">{top.text}{queue.length > 1 && <small className="muted"> (+{queue.length - 1} more)</small>}</span>
      <span className="row">
        {top.kind === 'open' && <button className="btn small primary" onClick={() => { done(); openChallenges(); }}>Open</button>}
        {top.kind === 'friend' && top.n && <>
          <button className="btn small primary" onClick={() => { void acceptFriend(top.n!).catch(() => undefined); done(); }}>Yes!</button>
          <button className="btn small" onClick={() => { void declineFriend(top.n!).catch(() => undefined); done(); }}>No thanks</button>
        </>}
        <button className="btn small" onClick={done}>{top.kind === 'info' ? 'OK' : 'Later'}</button>
      </span>
    </div>
  );
}
