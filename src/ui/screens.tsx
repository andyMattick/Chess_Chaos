import { useState } from 'react';
import { BOTS, type Bot } from '../content/bots';
import type { GameRecord } from '../core/record';
import { activeProfile, newProfile, update, upsertProfile, type Profile } from '../storage/storage';
import { useSave } from './store';
import type { GameConfig } from './GameScreen';

const COLOURS = ['#ff7a59', '#ffc93c', '#5bd17a', '#4aa8ff', '#a77bff', '#ff6fb5'];

export function ProfileChip({ onClick }: { onClick: () => void }) {
  const save = useSave();
  const p = activeProfile(save);
  return (
    <button className="profile-chip" onClick={onClick} aria-label="Change player">
      <span className="dot" style={{ background: p?.colour ?? '#ccc' }}>{p?.nickname.slice(0, 1).toUpperCase() ?? '?'}</span>
      <span>{p ? p.nickname : 'Pick a player'}</span>
      {p && <span className="chip-rating">★ {p.rating}</span>}
      {p && <span className="chip-coins">🪙 {p.coins ?? 0}</span>}
    </button>
  );
}

export function Home({ go }: { go: (screen: 'online' | 'bots' | 'profiles' | 'history' | 'wardrobe' | 'train') => void }) {
  const save = useSave();
  const p = activeProfile(save);
  return (
    <div className="home">
      <header className="home-head">
        <h1 className="logo" aria-label="Chess Chaos">
          {'CHESS'.split('').map((c, i) => <span key={i} className="l1" style={{ ['--r' as string]: `${[-8, 5, -3, 9, -6][i]}deg` }}>{c}</span>)}
          <span className="gap" />
          {'CHAOS'.split('').map((c, i) => <span key={i} className="l2" style={{ ['--r' as string]: `${[7, -10, 4, -5, 12][i]}deg` }}>{c}</span>)}
          <span className="splat" aria-hidden>💥</span>
        </h1>
        <ProfileChip onClick={() => go('profiles')} />
      </header>
      <p className="tagline">{p ? `Hi ${p.nickname}! What shall we play?` : 'Make a player to get started.'}</p>
      <div className="big-buttons">
        <button className="big" style={{ ['--c' as string]: '#ffc93c' }} onClick={() => go('train')} disabled={!p}>
          <span className="big-emoji">🎓</span>
          <span className="big-title">Train</span>
          <span className="big-sub">Danger alerts, hints and goals</span>
        </button>
        <button className="big" style={{ ['--c' as string]: '#5bd17a' }} onClick={() => go('bots')} disabled={!p}>
          <span className="big-emoji">🤖</span>
          <span className="big-title">Play the bots</span>
          <span className="big-sub">18 bots, each with its own opening</span>
        </button>
        <button className="big" style={{ ['--c' as string]: '#4aa8ff' }} onClick={() => go('online')} disabled={!p}>
          <span className="big-emoji">🌐</span>
          <span className="big-title">Play online</span>
          <span className="big-sub">Send a friend a 4-letter code</span>
        </button>
        <button className="big" style={{ ['--c' as string]: '#ff9f43' }} onClick={() => go('wardrobe')}>
          <span className="big-emoji">🧌</span>
          <span className="big-title">Wardrobe</span>
          <span className="big-sub">Monsters, robots, ghosts… and lava boards</span>
        </button>
        <button className="big" style={{ ['--c' as string]: '#a77bff' }} onClick={() => go('history')} disabled={!p}>
          <span className="big-emoji">📜</span>
          <span className="big-title">My games</span>
          <span className="big-sub">Replay any of your last 50 games</span>
        </button>
        <button className="big soon" style={{ ['--c' as string]: '#ff6fb5' }} disabled>
          <span className="big-emoji">🎉</span>
          <span className="big-title">Party match</span>
          <span className="big-sub">Coming soon: modes, missions and cards</span>
        </button>
        <button className="big soon" style={{ ['--c' as string]: '#ff7a59' }} disabled>
          <span className="big-emoji">🧩</span>
          <span className="big-title">Puzzles</span>
          <span className="big-sub">Coming soon: daily puzzle</span>
        </button>
      </div>
      {p && <Settings />}
    </div>
  );
}

function Settings() {
  const save = useSave();
  const s = save.settings;
  const set = (patch: Partial<typeof s>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  return (
    <details className="settings">
      <summary>⚙️ Settings</summary>
      <label><input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} /> Sound effects</label>
      <label><input type="checkbox" checked={s.showCoordinates} onChange={(e) => set({ showCoordinates: e.target.checked })} /> Show board letters and numbers</label>
    </details>
  );
}

export function Profiles({ done }: { done: () => void }) {
  const save = useSave();
  const [name, setName] = useState('');
  const [colour, setColour] = useState(COLOURS[save.profiles.length % COLOURS.length]);
  const choose = (p: Profile) => {
    update((d) => ({ ...d, activeProfileId: p.id }));
    done();
  };
  const create = () => {
    const nick = name.trim().slice(0, 16);
    if (!nick) return;
    const p = newProfile(nick, colour);
    update((d) => ({ ...upsertProfile(d, p), activeProfileId: p.id }));
    done();
  };
  return (
    <div className="panel">
      <h2>Who is playing?</h2>
      <div className="profile-grid">
        {save.profiles.map((p) => (
          <button key={p.id} className={`profile-card ${p.id === save.activeProfileId ? 'on' : ''}`} onClick={() => choose(p)}>
            <span className="dot big" style={{ background: p.colour }}>{p.nickname.slice(0, 1).toUpperCase()}</span>
            <b>{p.nickname}</b>
            <span>★ {p.rating}</span>
          </button>
        ))}
      </div>
      <div className="new-profile">
        <h3>New player</h3>
        <input aria-label="Nickname" placeholder="Nickname (no real names)" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        <div className="swatches">
          {COLOURS.map((c) => (
            <button key={c} aria-label={`Colour ${c}`} className={`swatch ${c === colour ? 'on' : ''}`} style={{ background: c }} onClick={() => setColour(c)} />
          ))}
        </div>
        <button className="btn primary" onClick={create} disabled={!name.trim()}>Let's go!</button>
      </div>
      {save.profiles.length > 0 && <button className="btn" onClick={done}>← Back</button>}
    </div>
  );
}

export function BotRoster({ start, back }: { start: (c: GameConfig) => void; back: () => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const [chosen, setChosen] = useState<Bot | null>(null);
  if (chosen) {
    const begin = (seat: 'p1' | 'p2' | 'random') => {
      const humanSeat = seat === 'random' ? (Math.random() < 0.5 ? 'p1' : 'p2') : seat;
      const me = p?.nickname ?? 'You';
      start({ kind: 'bot', botId: chosen.id, humanSeat, names: humanSeat === 'p1' ? { p1: me, p2: chosen.name } : { p1: chosen.name, p2: me } });
    };
    return (
      <div className="panel">
        <div className="bot-hero" style={{ ['--c' as string]: chosen.colour }}>
          <span className="bot-emoji">{chosen.emoji}</span>
          <div>
            <h2>{chosen.name} <small>★ {chosen.rating}</small></h2>
            <p>Plays the <b>{chosen.opening}</b>. {chosen.personality}</p>
            <p className="tip">💡 {chosen.tip}</p>
          </div>
        </div>
        <h3>Pick your colour</h3>
        <div className="row">
          <button className="btn primary" onClick={() => begin('p1')}>♙ White (move first)</button>
          <button className="btn primary dark" onClick={() => begin('p2')}>♟ Black</button>
          <button className="btn" onClick={() => begin('random')}>🎲 Surprise me</button>
        </div>
        <button className="btn" onClick={() => setChosen(null)}>← All bots</button>
      </div>
    );
  }
  return (
    <div className="panel wide">
      <h2>Pick a bot</h2>
      <p className="muted">Each bot plays its own favourite opening. Your rating: ★ {p?.rating}</p>
      <div className="bot-grid">
        {BOTS.map((b) => {
          const r = p?.botRecords[b.id];
          return (
            <button key={b.id} className="bot-card" style={{ ['--c' as string]: b.colour }} onClick={() => setChosen(b)}>
              <span className="bot-emoji">{b.emoji}</span>
              <b>{b.name}</b>
              <span className="bot-rating">★ {b.rating}</span>
              <span className="bot-opening">{b.opening}</span>
              {r && <span className="bot-record">W {r.w} · L {r.l} · D {r.d}</span>}
            </button>
          );
        })}
      </div>
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}

export function History({ open, back }: { open: (r: GameRecord) => void; back: () => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const games = (p && save.games[p.id]) || [];
  return (
    <div className="panel">
      <h2>My games</h2>
      {games.length === 0 && <p className="muted">No finished games yet. Go play one!</p>}
      <ul className="history">
        {games.map((g) => {
          const res = g.meta.result;
          const names = g.meta.players;
          const outcome = res ? (res.winners.length ? `${res.winners.map((w) => names[w]).join(' & ')} won` : 'Draw') : 'Unfinished';
          return (
            <li key={g.id}>
              <button onClick={() => open(g)}>
                <b>{names.p1} vs {names.p2}</b>
                <span>{outcome} · {Math.ceil((g.meta.san?.length ?? g.actions.length) / 2)} moves · {new Date(g.meta.startedAt).toLocaleDateString()}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}
