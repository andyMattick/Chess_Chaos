import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { online, roomServerUrl } from '../net/client';
import { CLOCK_CHOICES, ROOM_GAMES, type RoomGame } from '../net/protocol';
import { BattleScreen } from './BattleScreen';
import { activeProfile, lookOf } from '../storage/storage';
import { GameScreen } from './GameScreen';
import { useSave } from './store';
import { HandPicker, useHand } from './Cards';

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

function ShareCode({ code }: { code: string }) {
  const [note, setNote] = useState<string | null>(null);
  const link = roomLink(code);
  const text = `Play chess with me on Chess Chaos! Room code: ${code}`;
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

const WHEELS_KEY = 'chess-chaos:wheels';

export function OnlineLobby({ back, initialCode }: { back: () => void; initialCode?: string | null }) {
  const save = useSave();
  const net = useSyncExternalStore(online.subscribe, online.get, online.get);
  const p = activeProfile(save);
  const [code, setCode] = useState(initialCode ?? '');
  const [clockIdx, setClockIdx] = useState(1);
  const [game, setGame] = useState<RoomGame>('standard');
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
  // Training wheels: my own danger alerts and hints in 1 vs 1 games. Remembered on this device.
  const [wheels, setWheelsState] = useState(() => { try { return localStorage.getItem(WHEELS_KEY) === '1'; } catch { return false; } });
  const setWheels = (on: boolean) => { setWheelsState(on); try { localStorage.setItem(WHEELS_KEY, on ? '1' : '0'); } catch { /* ignore */ } };

  // Opened from a shared link: join straight away. Otherwise, coming back mid-game? Rejoin the seat.
  const joinedRef = useRef(false);
  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    if (initialCode && !net.code) {
      online.join(initialCode, name, rating, lookFor('p1'), wheels, hand);
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
        <ShareCode code={net.code} />
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
      <label className="wheels-toggle">
        <input type="checkbox" checked={wheels} onChange={(e) => setWheels(e.target.checked)} />
        <span>🚲 <b>Training wheels for me</b>: danger alerts, hints and goals, just like Train. Only you see them. Your opponent is told, and can choose to play just for fun. (1 vs 1 games only.)</span>
      </label>
      <details className="settings">
        <summary>🃏 Power cards for Party matches{hand.length ? ` (${hand.length} picked)` : ''}</summary>
        <HandPicker />
      </details>
      <div className="online-split">
        <section>
          <h3>Start a room</h3>
          <p className="muted">You get a 4-letter code to share.</p>
          <p className="muted small">What are we playing?</p>
          <div className="clock-chips" role="radiogroup" aria-label="Game">
            {ROOM_GAMES.map((g) => (
              <button key={g.id} role="radio" aria-checked={g.id === game} className={`chip ${g.id === game ? 'on' : ''}`} onClick={() => setGame(g.id)} title={g.blurb}>{g.label}</button>
            ))}
          </div>
          <p className="muted small">{ROOM_GAMES.find((g) => g.id === game)?.blurb}</p>
          <p className="muted small">How much time each?</p>
          <div className="clock-chips" role="radiogroup" aria-label="Clock">
            {CLOCK_CHOICES.map((c, i) => (
              <button key={c.label} role="radio" aria-checked={i === clockIdx} className={`chip ${i === clockIdx ? 'on' : ''}`} onClick={() => setClockIdx(i)}>{c.label}</button>
            ))}
          </div>
          <div className="row">
            {seatsFor === 2 ? (
              <>
                <button className="btn primary" onClick={() => online.create(name, rating, 'p1', clock, game, lookFor('p1'), wheels, hand)}>I'll be White</button>
                <button className="btn primary dark" onClick={() => online.create(name, rating, 'p2', clock, game, lookFor('p2'), wheels, hand)}>I'll be Black</button>
                <button className="btn" onClick={() => online.create(name, rating, 'random', clock, game, lookFor('p1'), wheels, hand)}>🎲 Whatever</button>
              </>
            ) : (
              <button className="btn primary" onClick={() => online.create(name, rating, 'p1', clock, game, lookFor('p1'))}>Make the room ({seatsFor} players)</button>
            )}
          </div>
        </section>
        <section>
          <h3>Join a room</h3>
          <input
            className="code-input" aria-label="Room code" placeholder="ABCD" maxLength={4} value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && code.length === 4 && online.join(code, name, rating, lookFor('p1'), wheels, hand)}
          />
          <button className="btn primary" disabled={code.length !== 4} onClick={() => online.join(code, name, rating, lookFor('p1'), wheels, hand)}>Join!</button>
        </section>
      </div>
      <button className="btn" onClick={exit}>← Home</button>
    </div>
  );
}
