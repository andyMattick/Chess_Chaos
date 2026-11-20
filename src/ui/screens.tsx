import { useState } from 'react';
import { type Bot } from '../content/bots';
import { PATH, unlockedCount } from '../systems/coins';
import type { GameRecord } from '../core/record';
import { activeProfile, exportSave, findLostSave, importSave, newProfile, update, updateProfile, upsertProfile, type Profile } from '../storage/storage';
import { buildMirror, linesFromRecords, nemesisBot, nemesisStrength } from '../systems/nemesis';
import { NemesisCard } from './Nemesis';
import { CloudRestore, CloudSaveCard } from './CloudSave';
import { useMailCount } from './Challenges';
import { useSave } from './store';
import { currentStreak, EMPTY_PROGRESS } from '../systems/puzzle';
import { dueCount } from '../systems/openings';
import { DAILY_ALL_BONUS, dailyById, dailyFor, dayKey, type DailyMission, type DailyState } from '../systems/daily';
import { claimDaily } from '../storage/daily';
import { setFriendsOnly } from '../storage/world';
import { luSession } from '../net/luClient';
import { POWER_CARDS } from '../content/cards';
import type { GameConfig } from './GameScreen';
import { petWorld } from './petWorld';

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

export function Home({ go }: { go: (screen: 'online' | 'bots' | 'profiles' | 'history' | 'wardrobe' | 'train' | 'chesscom' | 'battle' | 'leaderboard' | 'party' | 'puzzles' | 'cards' | 'modes' | 'challenges' | 'minis' | 'openings' | 'levelup') => void }) {
  const mail = useMailCount();
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
      <div className="hero-buttons">
        <button className="big" style={{ ['--c' as string]: '#5bd17a' }} onClick={() => go('bots')} disabled={!p}>
          <span className="big-emoji">🤖</span>
          <span className="big-title">Play the bots</span>
          <span className="big-sub">Beat one to open the next</span>
        </button>
        {(!petWorld || petWorld.live) && <button className="big" style={{ ['--c' as string]: '#4aa8ff' }} onClick={() => go('online')} disabled={!p}>
          <span className="big-emoji">🌐</span>
          <span className="big-title">{petWorld ? 'Play your grown-up' : 'Play online'}</span>
          <span className="big-sub">{petWorld ? 'Make a room, tell them the code' : 'Send a friend a code'}</span>
        </button>}
        <button className="big" style={{ ['--c' as string]: '#ff6fb5' }} onClick={() => go('party')} disabled={!p}>
          <span className="big-emoji">🎉</span>
          <span className="big-title">Party match</span>
          <span className="big-sub">Surprise mode, missions, cards</span>
        </button>
      </div>
      {p && !petWorld && luSession.savedCode() && (
        <button className="live-banner" onClick={() => go('levelup')}>⚡ Your live Level-Up room {luSession.savedCode()} is still open. Tap to go back.</button>
      )}
      {p && <DailyPanel daily={p.daily} go={go} />}
      <h3 className="home-section">More ways to play</h3>
      <div className="tiles">
        <Tile emoji="🗡️" title="Level-Up Chess" sub={p?.levelUp ? `${p.levelUp.won} battles won` : 'NEW! Pieces level up'} c="#3b5bdb" onClick={() => go('levelup')} disabled={!p} />
        <Tile emoji="🎮" title="Game modes" sub="25 ways to play" c="#36c5c5" onClick={() => go('modes')} disabled={!p} />
        <Tile emoji="⚔️" title="Battles" sub="3 and 4 players" c="#ff5a3c" onClick={() => go('battle')} disabled={!p} />
        {!petWorld && <Tile emoji="📬" title="Challenges" sub={mail ? `${mail} waiting for you!` : 'Play a friend, a move at a time'} c="#5bd17a" onClick={() => go('challenges')} disabled={!p} />}
        <Tile emoji="🌀" title="Mini-games" sub="Mazes, sprints, ladders" c="#8fd16a" onClick={() => go('minis')} disabled={!p} />
        <Tile emoji="🎓" title="Train" sub="Alerts and hints" c="#ffc93c" onClick={() => go('train')} disabled={!p} />
        <Tile emoji="📖" title="Openings" sub={p && dueCount(p.openings) ? `🔔 ${dueCount(p.openings)} lines to practise` : 'Learn the bots\' lines'} c="#4a6fa5" onClick={() => go('openings')} disabled={!p} />
        <Tile emoji="🧩" title="Puzzles" sub={p && currentStreak({ ...EMPTY_PROGRESS, ...p.puzzles }) > 0 ? `🔥 ${currentStreak({ ...EMPTY_PROGRESS, ...p.puzzles })}-day streak` : 'Daily, gauntlet'} c="#ff7a59" onClick={() => go('puzzles')} disabled={!p} />
      </div>
      <h3 className="home-section">My stuff</h3>
      <div className="tiles">
        <Tile emoji="🧌" title="Wardrobe" sub="Skins and boards" c="#ff9f43" onClick={() => go('wardrobe')} />
        <Tile emoji="🃏" title={POWER_CARDS ? 'Power cards' : 'My cards'} sub={p ? `${Object.values(p.collection ?? {}).reduce((a, n) => a + n, 0)} cards` : 'Earn by playing'} c="#c08cff" onClick={() => go('cards')} disabled={!p} />
        <Tile emoji="📜" title="My games" sub="Replay and analyse" c="#a77bff" onClick={() => go('history')} disabled={!p} />
        {!petWorld && <Tile emoji="🏆" title="Leaderboard" sub="Who's on top" c="#ffb13d" onClick={() => go('leaderboard')} disabled={!p} />}
        {!petWorld && save.settings.chesscomEnabled && <Tile emoji="♟️" title="Chess.com" sub="Players, nemesis bots" c="#7fb069" onClick={() => go('chesscom')} disabled={!p} />}
      </div>
      {p && <Settings />}
    </div>
  );
}

function DailyPanel({ daily, go }: { daily: DailyState | undefined; go: (s: DailyMission['go']) => void }) {
  const d = dailyFor(daily, dayKey());
  const all = d.ids.every((id) => d.claimed.includes(id));
  return (
    <section className="daily" aria-label="Daily missions">
      <h3 className="home-section">📅 Daily missions {all && <span className="daily-all">All done! See you tomorrow ⭐</span>}</h3>
      <div className="daily-list">
        {d.ids.map((id) => {
          const m = dailyById(id);
          if (!m) return null;
          const got = d.progress[id] ?? 0;
          const done = got >= m.need;
          const claimed = d.claimed.includes(id);
          return (
            <div key={id} className={`daily-card ${done ? 'done' : ''} ${claimed ? 'claimed' : ''}`}>
              <div className="daily-text">{claimed ? '✅ ' : ''}{m.text}</div>
              <div className="daily-bar"><span style={{ width: `${(Math.min(got, m.need) / m.need) * 100}%` }} /></div>
              <div className="daily-foot">
                <span className="small">{Math.min(got, m.need)} / {m.need}</span>
                {claimed ? <span className="small">🪙 {m.coins} collected</span>
                  : done ? <button className="btn primary small" onClick={() => claimDaily(id)}>Collect 🪙 {m.coins}</button>
                  : <button className="btn small" onClick={() => go(m.go)}>Go ▶</button>}
              </div>
            </div>
          );
        })}
      </div>
      {!all && <p className="muted small">Finish all three for {DAILY_ALL_BONUS} bonus coins. New missions every day.</p>}
    </section>
  );
}

function Tile({ emoji, title, sub, c, onClick, disabled }: { emoji: string; title: string; sub: string; c: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="tile" style={{ ['--c' as string]: c }} onClick={onClick} disabled={disabled}>
      <span className="tile-emoji">{emoji}</span>
      <span className="tile-title">{title}</span>
      <span className="tile-sub">{sub}</span>
    </button>
  );
}

function Settings() {
  const save = useSave();
  const p = activeProfile(save);
  const s = save.settings;
  const set = (patch: Partial<typeof s>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  return (
    <details className="settings">
      <summary>⚙️ Settings</summary>
      <label><input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} /> Sound effects</label>
      <label><input type="checkbox" checked={s.shake !== false} onChange={(e) => set({ shake: e.target.checked })} /> Board shake and phone buzz</label>
      {!petWorld && <label><input type="checkbox" checked={s.chesscomEnabled} onChange={(e) => set({ chesscomEnabled: e.target.checked })} /> Show the Chess.com corner (parents can switch this off)</label>}
      {!petWorld && p?.cloud && <label><input type="checkbox" checked={!!p.friendsOnly} onChange={(e) => void setFriendsOnly(e.target.checked)} /> 🔒 Friends only: strangers from the world leaderboard can't challenge me or send friend requests (parents can switch this on)</label>}
      <label><input type="checkbox" checked={s.showCoordinates} onChange={(e) => set({ showCoordinates: e.target.checked })} /> Show board letters and numbers</label>
      <label><input type="checkbox" checked={!!s.plainPieces} onChange={(e) => set({ plainPieces: e.target.checked })} /> ♟ Plain pieces (no skins) on the board</label>
      {!petWorld && <CloudSaveCard />}
      <BackupButtons />
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
  const lost = !save.profiles.length ? findLostSave() : null;
  return (
    <div className="panel">
      {lost && (
        <div className="rescue-card">
          <b>🛟 We found saved progress on this device!</b>
          <p>{lost.profiles.map((p) => `${p.nickname} (★ ${p.rating})`).join(', ')}</p>
          <button className="btn primary" onClick={() => { update(() => lost); done(); }}>Bring it back</button>
        </div>
      )}
      {!save.profiles.length && !lost && isHomeScreenApp() && (
        <p className="rescue-card">
          📱 <b>Played before in Safari or another browser?</b> The home-screen app keeps its own save. Open the game there, tap ⚙️ Settings → 💾 Back up my progress, save the file, then come back here and tap 📂 Load a backup.
        </p>
      )}
      {!save.profiles.length && !lost && (
        <div className="welcome">
          <h1>♟️💥 Chess Chaos</h1>
          <p>Learn chess by playing! Beat friendly bots, solve puzzles, and try wild party modes with a friend.</p>
          <p className="small muted">No sign-up. Just pick a nickname (not your real name).</p>
        </div>
      )}
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
      <CloudRestore done={done} />
      {save.profiles.length > 0 ? <button className="btn" onClick={done}>← Back</button> : <BackupButtons onlyLoad />}
    </div>
  );
}

/** Opened from an icon on the home screen (it has its own storage on iPhone). */
function isHomeScreenApp(): boolean {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

/** Backup without accounts: a small file you keep (or send to yourself), and load on any device. */
function BackupButtons({ onlyLoad }: { onlyLoad?: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  const download = async () => {
    const text = exportSave();
    const name = `chess-chaos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([text], name, { type: 'application/json' });
    // On phones, the share sheet lets you save it to Files, Drive or send it to yourself.
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: 'Chess Chaos backup' }); setNote('Backup shared.'); return; } catch { /* cancelled: fall back to a download */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setNote('Backup saved to your downloads.');
  };
  const load = (f: File | undefined) => {
    if (!f) return;
    f.text().then((t) => {
      try { const r = importSave(t); setNote(`Loaded ${r.players} player${r.players === 1 ? '' : 's'}!`); }
      catch (e) { setNote(`That didn't work: ${(e as Error).message}`); }
    });
  };
  return (
    <div className="backup">
      {!onlyLoad && <button className="btn small" onClick={download}>💾 Back up my progress</button>}
      <label className="btn small">
        📂 Load a backup
        <input type="file" accept="application/json,.json" hidden onChange={(e) => load(e.target.files?.[0])} />
      </label>
      {note && <small>{note}</small>}
      {!onlyLoad && <small className="muted">Progress lives on this device and this web address only. Back it up now and then, especially before clearing the browser.</small>}
    </div>
  );
}

export function BotRoster({ start, back, learn }: { start: (c: GameConfig) => void; back: () => void; learn?: (botId: string) => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const [chosen, setChosen] = useState<Bot | null>(null);
  const [showAll, setShowAll] = useState(false);
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
        {learn && <button className="btn" onClick={() => learn(chosen.id)}>📖 Learn this opening</button>}
        <button className="btn" onClick={() => setChosen(null)}>← All bots</button>
      </div>
    );
  }
  const unlocked = unlockedCount(p?.botRecords ?? {});
  const nextIdx = PATH.findIndex((b, i) => i < unlocked && !(p?.botRecords[b.id]?.w));
  return (
    <div className="panel wide taped">
      <h2>The Bot Path <span className="scribble">beat one to open the next</span></h2>
      <p className="muted">After its favourite opening, each bot plays with the game's own chess engine at its own strength. Your rating: ★ {p?.rating} · 🪙 first win against a bot pays 25 extra coins.</p>
      <div className="path">
        {PATH.slice(0, showAll ? PATH.length : Math.min(PATH.length, unlocked + 2)).map((b, i) => {
          const r = p?.botRecords[b.id];
          const open = i < unlocked;
          return (
            <div key={b.id}>
              {i > 0 && <div className="path-dash" style={{ marginLeft: 36 }} />}
              <div className="path-node">
                <button
                  className={`path-stop ${open ? '' : 'locked'} ${r?.w ? 'beaten' : ''} ${i === nextIdx ? 'next' : ''}`}
                  style={{ ['--c' as string]: b.colour }} disabled={!open} onClick={() => setChosen(b)} aria-label={`${b.name}${open ? '' : ' (locked)'}`}
                >
                  {open ? b.emoji : '🔒'}
                </button>
                <button className="path-info" disabled={!open} onClick={() => setChosen(b)}>
                  <b>{open ? b.name : '???'} <span className="bot-rating">★ {b.rating}</span></b>
                  <span className="bot-opening">{open ? b.opening : 'Beat the bot before to unlock'}</span>
                  {r && <span className="bot-record">W {r.w} · L {r.l} · D {r.d}</span>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!showAll && PATH.length > unlocked + 2 && (
        <button className="btn small" onClick={() => setShowAll(true)}>🔒 {PATH.length - unlocked - 2} more bots further down the path…</button>
      )}
      {p && <MirrorSection p={p} games={save.games[p.id] ?? []} play={(b) => setChosen(b)} />}
      {(p?.nemeses?.length ?? 0) > 0 && (
        <section className="nemesis-list">
          <h3>😈 Your nemeses <span className="scribble">bots that play like real people</span></h3>
          {p!.nemeses.map((n) => {
            const b = nemesisBot(n);
            const r = p!.botRecords[b.id];
            return (
              <NemesisCard key={n.key} n={n}>
                <div className="row wrap">
                  <button className="btn primary" onClick={() => setChosen(b)}>Play {n.name}'s nemesis</button>
                  <button className="btn small" onClick={() => updateProfile((x) => ({ ...x, nemeses: x.nemeses.filter((y) => y.key !== n.key) }))}>Remove</button>
                  {r && <span className="bot-record">W {r.w} · L {r.l} · D {r.d}</span>}
                </div>
              </NemesisCard>
            );
          })}
        </section>
      )}
      {!petWorld && save.settings.chesscomEnabled && <p className="muted small">Make a nemesis bot of any Chess.com player in the Chess.com corner.</p>}
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}

/** The Mirror bot: built on this phone from your own classic games. */
function MirrorSection({ p, games, play }: { p: Profile; games: GameRecord[]; play: (b: Bot) => void }) {
  const lines = p.myLines?.length ? p.myLines : linesFromRecords(games, p.nickname);
  const need = 3;
  const open = () => {
    // Build it now if needed (players from before the Mirror), at your current strength.
    const m = { ...(p.mirror ?? buildMirror(lines, p.nickname, p.rating)), rating: nemesisStrength(p.rating) };
    updateProfile((x) => ({ ...x, myLines: x.myLines?.length ? x.myLines : lines, mirror: m }));
    play(nemesisBot(m));
  };
  const n = p.mirror ?? (lines.length >= need ? buildMirror(lines, p.nickname, p.rating) : null);
  const r = p.botRecords['NEM:@me'];
  return (
    <section className="nemesis-list">
      <h3>🪞 Your Mirror <span className="scribble">a bot that plays like you</span></h3>
      {n && lines.length >= need ? (
        <NemesisCard n={n}>
          <div className="row wrap">
            <button className="btn primary" onClick={open}>Play your Mirror</button>
            {r && <span className="bot-record">W {r.w} · L {r.l} · D {r.d}</span>}
          </div>
        </NemesisCard>
      ) : (
        <p className="muted small">Play {need - lines.length} more classic {need - lines.length === 1 ? 'game' : 'games'} and a Mirror bot appears. It copies your openings and learns every game. It all stays on this phone.</p>
      )}
    </section>
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
