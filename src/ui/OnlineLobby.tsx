import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { online, roomServerUrl } from '../net/client';
import { CLOCK_CHOICES, ROOM_GAMES, type RoomGame } from '../net/protocol';
import { BattleScreen } from './BattleScreen';
import { activeProfile, lookOf } from '../storage/storage';
import { GameScreen } from './GameScreen';
import { useSave } from './store';
import { HandPicker, useHand } from './Cards';
import { POWER_CARDS } from '../content/cards';

/**
 * Online play: make a room and share its code, or type a friend's code.
 * Each player uses their own device. No accounts, no chat.
 */
/** Link that opens the game straight into a room. */
export function roomLink(code: string): string {
  return `${location.origin}${location.pathname}?room=${code}`;
}

/** Room code from the page address (?room=ABCD), if any. */
export function roomFromUrl(): string | null {
  try {
    const c = new URLSearchParams(location.search).get('room');
    return c && /^[A-Za-z]{4}$/.test(c) ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}

/** The invite says what you're playing: mode, what it is, and the clock. */
export function inviteText(code: string, game: RoomGame, clock: { minutes: number; increment: number } | null): string {
  const g = ROOM_GAMES.find((x) => x.id === game);
  const name = g ? g.label : '♟️ Classic';
  const time = clock ? ` ⏱️ ${clock.minutes} min each${clock.increment ? ` +${clock.increment}s` : ''}.` : '';
  return `Play ${name} with me on Chess Chaos! ${g?.blurb ?? ''}${time} Room code: ${code}`.replace(/\s+/g, ' ');
}

function ShareCode({ code, game, clock }: { code: string; game: RoomGame; clock: { minutes: number; increment: number } | null }) {
  const [note, setNote] = useState<string | null>(null);
  const link = roomLink(code);
  const text = inviteText(code, game, clock);
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Chess Chaos', text, url: link });
        return;
      }
    } catch {
      return; // they closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setNote('Link copied! Paste it in a message.');
    } catch {
      setNote(link);
    }
  };
  return (
    <div className="share-row">
      <button className="btn primary" onClick={share}>📨 Send the code</button>
      <a className="btn" href={`sms:?&body=${encodeURIComponent(`${text} ${link}`)}`}>💬 Text it</a>
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}

export function OnlineLobby({ back, initialCode }: { back: () => void; initialCode?: string | null }) {
  const save = useSave();
  const net = useSyncExternalStore(online.subscribe, online.get, online.get);
  const p = activeProfile(save);
  const [code, setCode] = useState(initialCode ?? '');
  const [pane, setPane] = useState<'start' | 'join'>(initialCode ? 'join' : 'start');
  const [clockIdx, setClockIdx] = useState(1);
  const [game, setGame] = useState<RoomGame>('standard');
  // Secret missions: on for a Surprise party, off for a chosen mode, unless the host switches it.
  const [missionsPick, setMissionsPick] = useState<boolean | null>(null);
  const missions = missionsPick ?? game === 'party';
  const seatsFor = ROOM_GAMES.find((g) => g.id === game)?.seats ?? 2;
  const clock = CLOCK_CHOICES[clockIdx].setting;
  const name = p?.nickname ?? 'Player';
  // Your army travels with you: the White army look from your Wardrobe (or Black if you pick Black).
  const lookFor = (side: 'p1' | 'p2') => {
    const skins = lookOf(save).skins;
    return { army: skins.armies[side] ?? 'classic', pieces: Object.fromEntries(Object.entries(skins.pieces[side] ?? {}).filter(([, v]) => !!v)) as Record<string, string> };
  };
  const rating = p?.rating ?? 600;
  const hand = useHand();

  // Opened from a shared link: join straight away. Otherwise, coming back mid-game? Rejoin the seat.
  const joinedRef = useRef(false);
  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    if (initialCode && !net.code) {
      online.join(initialCode, name, rating, lookFor('p1'), false, hand, p?.modePrefs);
      try { history.replaceState(null, '', location.pathname); } catch { /* ignore */ }
    } else if (!net.code && online.saved()) online.resume();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exit = () => { online.leave(); back(); };

  if (!roomServerUrl()) {
    return (
      <div className="panel taped">
        <h2>Online play isn't switched on here yet</h2>
        <p>This copy of the game doesn't know where its room server lives. The setup steps are in the README (it takes about five minutes and is free).</p>
        <button className="btn" onClick={back}>← Home</button>
      </div>
    );
  }

  const seatIds = net.seatIds ?? ['p1', 'p2'];
  const allSeated = seatIds.every((k) => !!net.seats[k]);
  if (net.code && net.record && allSeated && net.seat) {
    if (seatIds.length > 2) return <BattleScreen key={`${net.code}-${net.record.id}`} onExit={exit} />;
    return <GameScreen key={`${net.code}-${net.record.id}`} config={{ kind: 'online', humanSeat: net.seat, names: {} }} onExit={exit} onRematch={() => online.rematch()} />;
  }

  if (net.code) {
    return (
      <div className="panel taped center-text">
        <h2>Your room is ready!</h2>
        <p>Send this to your friend. They tap the link, or type the code under <b>Play online → Join</b>:</p>
        <div className="big-code" aria-label={`Room code ${net.code.split('').join(' ')}`}>
          {net.code.split('').map((c, i) => <span key={i} style={{ transform: `rotate(${[-6, 4, -3, 7][i]}deg)` }}>{c}</span>)}
        </div>
        <p className="invite-mode">You're playing <b>{ROOM_GAMES.find((g) => g.id === net.game)?.label}</b>: {ROOM_GAMES.find((g) => g.id === net.game)?.blurb}</p>
        <ShareCode code={net.code} game={net.game} clock={net.clock ? { minutes: Math.round(((net.clock.left.p1 ?? 0) as number) / 60000), increment: net.clock.increment } : null} />
        {seatIds.length > 2 && (
          <div className="seat-wait">
            <p><b>{ROOM_GAMES.find((g) => g.id === net.game)?.label}</b>: {seatIds.filter((k) => net.seats[k]).length} of {seatIds.length} players here</p>
            <ul>{seatIds.map((k) => <li key={k}>{net.seats[k] ? `✅ ${net.seats[k]!.name}` : '⏳ empty seat'}</li>)}</ul>
            {net.host === net.seat && <button className="btn" onClick={() => online.fillBots()}>🤖 Fill empty seats with bots and start</button>}
          </div>
        )}
        <p className="waiting">waiting for them to show up<span className="dots">...</span></p>
        <button className="btn" onClick={exit}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="panel taped">
      <h2>Play online</h2>
      <p className="muted">Play a friend on their own phone, tablet or computer.</p>
      {net.error && <p className="error-note">⚠️ {net.error}</p>}
      {net.status === 'connecting' && <p className="muted">Connecting…</p>}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={pane === 'start'} className={`tab ${pane === 'start' ? 'on' : ''}`} onClick={() => setPane('start')}>🆕 Start a room</button>
        <button role="tab" aria-selected={pane === 'join'} className={`tab ${pane === 'join' ? 'on' : ''}`} onClick={() => setPane('join')}>🔑 Join with a code</button>
      </div>
      {pane === 'start' && (
        <section className="lobby-pane">
          <p className="muted small">What are we playing?</p>
          <div className="clock-chips" role="radiogroup" aria-label="Game">
            {ROOM_GAMES.filter((g) => !g.more && g.seats === 2).map((g) => (
              <button key={g.id} role="radio" aria-checked={g.id === game} className={`chip ${g.id === game ? 'on' : ''}`} onClick={() => setGame(g.id)} title={g.blurb}>{g.label}</button>
            ))}
          </div>
          <details className="more-modes" open={!!ROOM_GAMES.find((g) => g.id === game)?.more}>
            <summary>More modes ({ROOM_GAMES.filter((g) => g.more).length})</summary>
            <div className="clock-chips" role="radiogroup" aria-label="More game modes">
              {ROOM_GAMES.filter((g) => g.more).map((g) => (
                <button key={g.id} role="radio" aria-checked={g.id === game} className={`chip ${g.id === game ? 'on' : ''}`} onClick={() => setGame(g.id)} title={g.blurb}>{g.label}</button>
              ))}
            </div>
          </details>
          <details className="more-modes" open={(ROOM_GAMES.find((g) => g.id === game)?.seats ?? 2) > 2}>
            <summary>3 and 4 players ({ROOM_GAMES.filter((g) => g.seats > 2).length})</summary>
            <div className="clock-chips" role="radiogroup" aria-label="Battles">
              {ROOM_GAMES.filter((g) => g.seats > 2).map((g) => (
                <button key={g.id} role="radio" aria-checked={g.id === game} className={`chip ${g.id === game ? 'on' : ''}`} onClick={() => setGame(g.id)} title={g.blurb}>{g.label}</button>
              ))}
            </div>
          </details>
          <p className="game-blurb"><b>{ROOM_GAMES.find((g) => g.id === game)?.label}</b>: {ROOM_GAMES.find((g) => g.id === game)?.blurb}</p>
          {game === 'party' && POWER_CARDS && (
            <details className="settings">
              <summary>🃏 Power cards for this Party match{hand.length ? ` (${hand.length} picked)` : ''}</summary>
              <HandPicker />
            </details>
          )}
          {seatsFor === 2 && (
            <div className="mission-toggle">
              <label><input type="checkbox" checked={missions} onChange={(e) => setMissionsPick(e.target.checked)} /> 🤫 Secret missions</label>
              <p className="muted small">Each player gets a secret goal. Do it and you can win! Extras (buffs and handicaps from your ratings) are suggested when your friend joins, and you both vote on them.</p>
            </div>
          )}
          <p className="muted small">How much time each?</p>
          <div className="clock-chips" role="radiogroup" aria-label="Clock">
            {CLOCK_CHOICES.map((c, i) => (
              <button key={c.label} role="radio" aria-checked={i === clockIdx} className={`chip ${i === clockIdx ? 'on' : ''}`} onClick={() => setClockIdx(i)}>{c.label}</button>
            ))}
          </div>
          <div className="row wrap colour-row">
            {seatsFor === 2 ? (
              <>
                <button className="btn primary" onClick={() => online.create(name, rating, 'p1', clock, game, lookFor('p1'), false, hand, p?.modePrefs, missions)}>I'll be White</button>
                <button className="btn primary dark" onClick={() => online.create(name, rating, 'p2', clock, game, lookFor('p2'), false, hand, p?.modePrefs, missions)}>I'll be Black</button>
                <button className="btn" onClick={() => online.create(name, rating, 'random', clock, game, lookFor('p1'), false, hand, p?.modePrefs, missions)}>🎲 Whatever</button>
              </>
            ) : (
              <button className="btn primary" onClick={() => online.create(name, rating, 'p1', clock, game, lookFor('p1'))}>Make the room ({seatsFor} players)</button>
            )}
          </div>
        </section>
      )}
      {pane === 'join' && (
        <section className="lobby-pane">
          <p className="muted small">Type the 4 letters your friend sent you.</p>
          <input
            className="code-input" aria-label="Room code" placeholder="ABCD" maxLength={4} value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && code.length === 4 && online.join(code, name, rating, lookFor('p1'), false, hand, p?.modePrefs)}
          />
          <button className="btn primary" disabled={code.length !== 4} onClick={() => online.join(code, name, rating, lookFor('p1'), false, hand, p?.modePrefs)}>Join!</button>
          {POWER_CARDS && <details className="settings">
            <summary>🃏 Power cards, in case it's a Party match{hand.length ? ` (${hand.length} picked)` : ''}</summary>
            <HandPicker />
          </details>}
        </section>
      )}
      <button className="btn" onClick={exit}>← Home</button>
    </div>
  );
}
