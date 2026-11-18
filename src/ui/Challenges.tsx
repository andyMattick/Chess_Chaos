import { useEffect, useState } from 'react';
import { ROOM_GAMES, type RoomGame } from '../net/protocol';
import { showNumber } from '../net/vault';
import { MAIL_GAMES, type MailGame } from '../net/world';
import { replay } from '../core/record';
import { vaultBase } from '../storage/cloud';
import { activeProfile } from '../storage/storage';
import { addFriend, answerChallenge, challenge, labelFor, myGames, nameNumber, removeFriend } from '../storage/world';
import { showNumber as fmt } from '../net/vault';
import { CloudSaveCard } from './CloudSave';
import { StatsLine, useWorldBoard } from './FriendStats';
import type { GameConfig } from './GameScreen';
import { useSave } from './store';

/**
 * Challenges by player number (owner, 2026-11-18): send a friend a game,
 * play a move whenever you like. Numbers only on the server; you can name a
 * number on your own phone. No messages.
 */
export function Challenges({ back, play }: { back: () => void; play: (c: GameConfig) => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const [games, setGames] = useState<MailGame[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [game, setGame] = useState<RoomGame>('standard');
  const [colour, setColour] = useState<'p1' | 'p2' | 'random'>('random');
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const [nameText, setNameText] = useState('');
  const [addNo, setAddNo] = useState('');
  const [addName, setAddName] = useState('');
  const number = p?.cloud?.number;
  const { board } = useWorldBoard();

  const refresh = () => myGames().then((g) => { setGames(g); setErr(null); }).catch((e) => setErr((e as Error).message));
  useEffect(() => {
    if (!number) return;
    void refresh();
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') void refresh(); }, 20000);
    return () => clearInterval(t);
  }, [number]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;
  if (!vaultBase()) return <div className="panel"><h2>📬 Challenges</h2><p>Challenges need the game server, which is not set up here.</p><button className="btn" onClick={back}>← Home</button></div>;
  if (!number) {
    return (
      <div className="panel taped">
        <h2>📬 Challenges <span className="scribble">play a friend, a move at a time</span></h2>
        <p>Send a friend a game and play a move whenever you like. First you need a player number: it's your address for challenges.</p>
        <CloudSaveCard />
        <button className="btn" onClick={back}>← Home</button>
      </div>
    );
  }

  const mySeat = (g: MailGame) => (g.players.p1 === number ? 'p1' : 'p2') as 'p1' | 'p2';
  const otherNo = (g: MailGame) => g.players[mySeat(g) === 'p1' ? 'p2' : 'p1'];
  const label = (n: string) => labelFor(p, n);
  const turnOf = (g: MailGame) => replay(g.record).at(-1)!.turn;
  const open = (g: MailGame) => {
    const me = mySeat(g);
    const names = { p1: me === 'p1' ? p.nickname : label(g.players.p1), p2: me === 'p2' ? p.nickname : label(g.players.p2) };
    play({ kind: 'mail', mail: { id: g.id, game: g }, humanSeat: me, names, mode: g.record.setup.mode });
  };
  const send = () => {
    setBusy(true); setErr(null);
    challenge(to.replace(/\D/g, ''), game, colour)
      .then(() => { setTo(''); return refresh(); })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setBusy(false));
  };
  const act = (g: MailGame, a: 'accept' | 'decline' | 'cancel') => answerChallenge(g.id, a).then((x) => (a === 'accept' ? open(x) : refresh())).catch((e) => setErr((e as Error).message));

  const list = games ?? [];
  const myTurn = list.filter((g) => g.status === 'playing' && turnOf(g) === mySeat(g));
  const theirTurn = list.filter((g) => g.status === 'playing' && turnOf(g) !== mySeat(g));
  const forMe = list.filter((g) => g.status === 'invited' && g.from !== number);
  const sent = list.filter((g) => g.status === 'invited' && g.from === number);
  const finished = list.filter((g) => ['done', 'declined', 'expired'].includes(g.status)).slice(0, 10);
  const modeLabel = (g: MailGame) => ROOM_GAMES.find((x) => x.id === g.game)?.label ?? g.game;
  const resultText = (g: MailGame) => {
    if (g.status === 'declined') return 'said no';
    if (g.status === 'expired') return 'nobody answered';
    const w = g.record.meta.result?.winners ?? [];
    return !w.length ? '🤝 draw' : w.includes(mySeat(g)) ? '🏆 you won' : 'they won';
  };
  const who = (g: MailGame) => {
    const n = otherNo(g);
    return naming === n ? (
      <span className="row">
        <input aria-label="Name for this player" autoFocus value={nameText} maxLength={16} placeholder="A name only you see" onChange={(e) => setNameText(e.target.value)} />
        <button className="btn small" onClick={() => { nameNumber(n, nameText); setNaming(null); }}>Save</button>
      </span>
    ) : (
      <span><b>{label(n)}</b> <button className="link-btn" aria-label="Name this player" onClick={() => { setNaming(n); setNameText(p.contacts?.[n] ?? ''); }}>✏️</button></span>
    );
  };
  const row = (g: MailGame, actions: React.ReactNode) => (
    <li key={g.id} className="mail-row">{who(g)}<small>{modeLabel(g)} · you play {mySeat(g) === 'p1' ? 'White' : 'Black'}</small><span className="row wrap">{actions}</span></li>
  );

  return (
    <div className="panel wide taped">
      <h2>📬 Challenges <span className="scribble">a move at a time</span></h2>
      <div className="cloud-card">
        <span>Your player number</span>
        <code className="big-number">{showNumber(number)}</code>
        <small className="muted">Give it to a friend so they can challenge you. Only share it with people you know.</small>
      </div>

      {myTurn.length > 0 && <><h3>👉 Your move</h3><ul className="mail-list">{myTurn.map((g) => row(g, <button className="btn small primary" onClick={() => open(g)}>Play</button>))}</ul></>}
      {forMe.length > 0 && <><h3>📨 Challenges for you</h3><ul className="mail-list">{forMe.map((g) => row(g, <>
        <button className="btn small primary" onClick={() => act(g, 'accept')}>Let's play!</button>
        <button className="btn small" onClick={() => act(g, 'decline')}>No thanks</button>
      </>))}</ul></>}
      {theirTurn.length > 0 && <><h3>⏳ Their move</h3><ul className="mail-list">{theirTurn.map((g) => row(g, <button className="btn small" onClick={() => open(g)}>Look</button>))}</ul></>}
      {sent.length > 0 && <><h3>📤 Waiting for an answer</h3><ul className="mail-list">{sent.map((g) => row(g, <button className="btn small" onClick={() => act(g, 'cancel')}>Cancel</button>))}</ul></>}

      <h3>👫 Friends <span className="scribble">only on this phone</span></h3>
      {(p.friends ?? []).length === 0 && <p className="muted small">No friends yet. Add a friend's number below, or tap "Add as friend" after you play someone.</p>}
      <ul className="mail-list">
        {(p.friends ?? []).map((n) => (
          <li key={n} className="mail-row">
            {naming === n ? (
              <span className="row">
                <input aria-label="Name for this friend" autoFocus value={nameText} maxLength={16} placeholder="A name only you see" onChange={(e) => setNameText(e.target.value)} />
                <button className="btn small" onClick={() => { nameNumber(n, nameText); setNaming(null); }}>Save</button>
              </span>
            ) : (
              <span><b>{label(n)}</b> <button className="link-btn" aria-label="Rename" onClick={() => { setNaming(n); setNameText(p.contacts?.[n] ?? ''); }}>✏️</button></span>
            )}
            <small className="muted">{fmt(n)}</small>
            <small><StatsLine row={board?.friends.find((r) => r.n === n)} n={n} /></small>
            <span className="row wrap">
              <button className="btn small primary" onClick={() => { setTo(n); document.querySelector('.mail-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>⚔️ Challenge</button>
              <button className="btn small" onClick={() => removeFriend(n)}>Remove</button>
            </span>
          </li>
        ))}
      </ul>
      {(() => {
        // People you have played challenges with who are not friends yet.
        const known = [...new Set(list.map(otherNo))].filter((n) => !(p.friends ?? []).includes(n));
        return known.length > 0 && (
          <div className="friend-suggest">
            <small className="muted">People you've played:</small>
            {known.slice(0, 6).map((n) => <button key={n} className="chip" onClick={() => addFriend(n)}>➕ {label(n)}</button>)}
          </div>
        );
      })()}
      <div className="mail-form add-friend">
        <input aria-label="New friend's player number" inputMode="numeric" placeholder="Friend's player number" value={addNo} onChange={(e) => setAddNo(e.target.value)} />
        <input aria-label="New friend's name" placeholder="Their name (only you see it)" maxLength={16} value={addName} onChange={(e) => setAddName(e.target.value)} />
        <button className="btn small" disabled={addNo.replace(/\D/g, '').length !== 8} onClick={() => { try { addFriend(addNo, addName); setAddNo(''); setAddName(''); } catch (e) { setErr((e as Error).message); } }}>➕ Add friend</button>
      </div>

      <h3>⚔️ Challenge a friend</h3>
      {(p.friends ?? []).length > 0 && (
        <div className="clock-chips">
          {(p.friends ?? []).slice(0, 12).map((n) => <button key={n} className={`chip ${to.replace(/\D/g, '') === n ? 'on' : ''}`} onClick={() => setTo(n)}>{label(n)}</button>)}
        </div>
      )}
      <div className="mail-form">
        <input aria-label="Friend's player number" inputMode="numeric" placeholder="Friend's player number (8 digits)" value={to} onChange={(e) => setTo(e.target.value)} />
        <select aria-label="Game" value={game} onChange={(e) => setGame(e.target.value as RoomGame)}>
          {MAIL_GAMES.map((id) => <option key={id} value={id}>{ROOM_GAMES.find((x) => x.id === id)?.label ?? id}</option>)}
        </select>
        <div className="clock-chips">
          {(['p1', 'p2', 'random'] as const).map((c) => (
            <button key={c} className={`chip ${colour === c ? 'on' : ''}`} onClick={() => setColour(c)}>{c === 'p1' ? '♙ White' : c === 'p2' ? '♟ Black' : '🎲 Either'}</button>
          ))}
        </div>
        <button className="btn primary" disabled={busy || to.replace(/\D/g, '').length !== 8} onClick={send}>{busy ? 'Sending…' : 'Send challenge'}</button>
      </div>
      {err && <p className="warn">{err}</p>}
      {games === null && !err && <p className="muted">Loading…</p>}
      <p className="muted small">If nobody moves for 14 days, the player to move loses on time. Challenges count for your rating.</p>

      {finished.length > 0 && <><h3>📜 Finished</h3><ul className="mail-list">{finished.map((g) => row(g, <>
        <span className="small">{resultText(g)}</span>
        {g.status === 'done' && <button className="btn small" onClick={() => open(g)}>Look</button>}
      </>))}</ul></>}
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}

/** How many challenge games wait for this player (for the Home tile). */
export function useMailCount(): number {
  const save = useSave();
  const p = activeProfile(save);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!p?.cloud || !vaultBase()) return;
    const me = p.cloud.number;
    myGames().then((gs) => setN(gs.filter((g) => (g.status === 'invited' && g.from !== me) || (g.status === 'playing' && replay(g.record).at(-1)!.turn === (g.players.p1 === me ? 'p1' : 'p2'))).length)).catch(() => {});
  }, [p?.cloud?.number]); // eslint-disable-line react-hooks/exhaustive-deps
  return n;
}
