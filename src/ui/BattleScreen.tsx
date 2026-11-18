import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { requestMove } from '../ai/client';
import { BOTS } from '../content/bots';
import { skinFor } from '../content/cosmetics';
import { hillData } from '../core/modes';
import { newBattleRecord, replay, type GameRecord } from '../core/record';
import { newSeed } from '../core/rng';
import { legalActions } from '../core/rules';
import type { Action, MoveAction, PlayerId } from '../core/types';
import type { BattleKind } from '../core/variants';
import { online, timeLeft } from '../net/client';
import { EMOTES } from '../net/protocol';
import { activeProfile, addGame, lookOf, noteOpponent, update, upsertProfile } from '../storage/storage';
import { coinsFor, type CoinAward } from '../systems/coins';
import { updateRating } from '../systems/rating';
import { Board } from './Board';
import { moveEvents, shakeFor, type MoveEvents } from './effects';
import { Character } from './skins';
import { setSoundEnabled, sfx } from './sound';
import { useSave } from './store';

/**
 * Three and four player battles (docs/09 s4-5): everyone for themselves or
 * 2 vs 2, optionally fighting over a big hill. Your army is always at the
 * bottom. Works against bots on this device or online.
 */
export interface LocalBattle {
  kind: BattleKind;
  mode: 'battle' | 'battle-hill';
  botRating: number;
}

const SEAT_ORDER: PlayerId[] = ['p1', 'p2', 'p3', 'p4'];
const SIDE_NAME: Record<PlayerId, string> = { p1: 'South', p2: 'West', p3: 'North', p4: 'East' };

export function BattleScreen({ local, onExit, onAgain }: { local?: LocalBattle; onExit: () => void; onAgain?: () => void }) {
  const save = useSave();
  const net = useSyncExternalStore(online.subscribe, online.get, online.get);
  const isOnline = !local;
  const profile = activeProfile(save);
  const look = lookOf(save);

  const bots = useMemo(() => {
    if (!local) return [];
    const pool = [...BOTS].sort((a, b) => Math.abs(a.rating - local.botRating) - Math.abs(b.rating - local.botRating)).slice(0, 6);
    return pool.sort(() => Math.random() - 0.5).slice(0, 3);
  }, [local]);
  const [localRec, setLocalRec] = useState<GameRecord>(() => {
    if (!local) return newBattleRecord(1, {}, 'four');
    const names: Record<string, string> = { p1: profile?.nickname ?? 'You' };
    SEAT_ORDER.slice(1).forEach((k, i) => { names[k] = bots[i] ? `${bots[i].emoji} ${bots[i].name}` : k; });
    return newBattleRecord(newSeed(), names, local.kind, local.mode);
  });
  const rec = isOnline && net.record ? net.record : localRec;
  const states = useMemo(() => replay(rec), [rec]);
  const live = states[states.length - 1];
  const me: PlayerId = isOnline ? net.seat ?? 'p1' : 'p1';
  const seatIds = live.seats.map((x) => x.id);
  const names: Record<string, string> = isOnline
    ? Object.fromEntries(seatIds.map((k) => [k, net.seats[k]?.name ?? '…']))
    : rec.meta.players;
  const ratings: Record<string, number> = isOnline
    ? Object.fromEntries(seatIds.map((k) => [k, net.seats[k]?.rating ?? 600]))
    : Object.fromEntries(seatIds.map((k, i) => [k, k === me ? profile?.rating ?? 600 : bots[i - 1]?.rating ?? 600]));

  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<MoveAction[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fx, setFx] = useState<MoveEvents | null>(null);
  const [speech, setSpeech] = useState<{ seat: PlayerId; text: string } | null>(null);
  const [award, setAward] = useState<{ coins: CoinAward; before: number; after: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastPly = useRef(states.length - 1);
  const finished = useRef(false);

  const myTurn = !live.result && live.turn === me && live.seats.find((x) => x.id === me)?.status === 'active';
  const legal = useMemo(() => (myTurn ? legalActions(live) : []), [live, myTurn]);
  const targets = selected === null ? [] : legal.filter((m) => m.piece === live.sq[selected]);
  const say = (t: string) => { setToast(t); setTimeout(() => setToast((x) => (x === t ? null : x)), 2600); };

  function push(a: Action) {
    if (isOnline) online.act(a);
    else setLocalRec((r) => ({ ...r, actions: [...r.actions, a] }));
  }
  function commit(m: MoveAction) { push(m); setSelected(null); setPromo(null); }
  function onSquare(sq: number) {
    if (!myTurn) return;
    if (selected !== null) {
      const moves = targets.filter((m) => m.to === sq);
      if (moves.length > 1 && moves.some((m) => m.promo)) { setPromo(moves); return; }
      if (moves.length) { commit(moves[0]); return; }
    }
    const id = live.sq[sq];
    setSelected(id >= 0 && live.pieces[id].owner === me && legal.some((m) => m.piece === id) ? sq : null);
  }

  // Bots (local games): whoever is not me.
  useEffect(() => {
    if (isOnline || live.result || live.turn === me) return;
    let cancelled = false;
    requestMove(live, local!.botRating, undefined, 350).then((m) => {
      if (!cancelled && m) setLocalRec((r) => ({ ...r, actions: [...r.actions, m] }));
    });
    return () => { cancelled = true; };
  }, [live, isOnline, me, local]);

  // Effects, sounds and knock-outs.
  useEffect(() => {
    setSoundEnabled(save.settings.sound);
    const n = states.length - 1;
    if (n <= lastPly.current) { lastPly.current = n; return; }
    lastPly.current = n;
    const before = states[n - 1];
    const ev = moveEvents(before, live, rec.actions[n - 1], n);
    const out = live.seats.filter((x) => x.status === 'eliminated' && before.seats.find((y) => y.id === x.id)?.status === 'active');
    if (ev) {
      setFx(ev);
      const el = wrapRef.current;
      const cls = out.length ? 'shake-big' : shakeFor(ev);
      if (el && cls) { el.classList.remove('shake', 'shake-big'); void el.offsetWidth; el.classList.add(cls); }
      if (ev.capture) sfx.capture(ev.capture.big || out.length > 0); else if (ev.castle) sfx.castle(); else if (ev.promo) sfx.promote(); else sfx.move();
      if (ev.check) sfx.check();
    }
    for (const x of out) {
      say(x.id === me ? '💀 You got knocked out! Watch the rest or head home.' : `💀 ${names[x.id]} is KNOCKED OUT!`);
      if (x.id === me) sfx.lose();
    }
    const t = setTimeout(() => setFx((f) => (f?.ply === ev?.ply ? null : f)), 1500);
    return () => clearTimeout(t);
  }, [states.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep online clocks counting down.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!isOnline || !net.clock?.running) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [isOnline, net.clock?.running]);

  // Online emotes.
  useEffect(() => {
    if (!isOnline || !net.lastEmote) return;
    const e = EMOTES.find((x) => x.id === net.lastEmote!.id);
    if (e) setSpeech({ seat: net.lastEmote.from, text: e.text });
    const t = setTimeout(() => setSpeech(null), 3500);
    return () => clearTimeout(t);
  }, [isOnline, net.lastEmote]);

  // A rematch online starts a fresh record.
  useEffect(() => {
    if (isOnline && !live.result && rec.actions.length === 0) { finished.current = false; setAward(null); }
  }, [isOnline, live.result, rec.actions.length]);

  // Game over: coins, rating, saved game.
  useEffect(() => {
    if (!live.result || finished.current) return;
    finished.current = true;
    const won = live.result.winners.includes(me);
    if (won) sfx.mate();
    if (!profile) return;
    const opponents = seatIds.filter((k) => k !== me && !(live.seats.find((x) => x.id === k)?.team && live.seats.find((x) => x.id === k)?.team === live.seats.find((x) => x.id === me)?.team));
    const opp = opponents.reduce((a, k) => a + (ratings[k] ?? 600), 0) / Math.max(1, opponents.length);
    const movesPlayed = rec.actions.filter((a, i) => a.t === 'move' && states[i].turn === me).length;
    const coins = coinsFor({ kind: isOnline ? 'online' : 'bot', result: won ? 'win' : 'loss', opponent: opp, rating: profile.rating, movesPlayed });
    // Beating several opponents at once pays a little extra.
    if (won && opponents.length > 1) { coins.lines.push({ label: `Outlasted ${opponents.length} armies`, coins: 5 * opponents.length }); coins.total += 5 * opponents.length; }
    update((d) => {
      let p = activeProfile(d)!;
      const before = p.rating;
      const rating = movesPlayed >= 3 ? updateRating(p.rating, opp, won ? 1 : 0, p.gamesPlayed, 0.5) : p.rating;
      setAward({ coins, before, after: rating });
      if (movesPlayed >= 3) {
        for (const k of opponents) {
          const isBot = !isOnline || net.seats[k]?.botControlled;
          p = noteOpponent(p, { key: `${isBot ? 'bot' : 'online'}:${names[k].toLowerCase()}`, name: names[k], kind: isBot ? 'bot' : 'online', rating: ratings[k] ?? 600, score: won ? 1 : 0 });
        }
      }
      p = { ...p, rating, coins: p.coins + coins.total, gamesPlayed: p.gamesPlayed + 1, ratingHistory: [...p.ratingHistory, { at: Date.now(), rating }].slice(-200) };
      return addGame(upsertProfile(d, p), p.id, { ...rec, meta: { ...rec.meta, players: names, result: live.result } });
    });
  }, [live.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const hill = live.mode === 'battle-hill' ? hillData(live) : null;
  const myStatus = live.seats.find((x) => x.id === me)?.status;
  const won = live.result?.winners.includes(me);
  const turnName = names[live.turn];

  return (
    <div className="game battle">
      <div className="game-main">
        <div className="banner-slot">
          {!live.result && (
            <div className={`banner ${myTurn ? '' : 'blue'}`}>
              {myStatus === 'eliminated' ? '👻 You are out. Watching…' : myTurn ? '⚔️ Your move!' : `${turnName} is moving…`}
            </div>
          )}
        </div>
        <div className="board-wrap" ref={wrapRef}>
          <Board
            state={live} bottom={me} selected={selected} targets={targets} lastMove={lastMoveOf(rec, states)}
            showCoordinates={false} landscape={look.landscape} skins={look.skins} interactive={myTurn} onSquare={onSquare} fx={fx}
          />
          {promo && (
            <div className="promo" role="dialog" aria-label="Choose a piece">
              <p>Your pawn made it! Turn it into…</p>
              <div className="promo-row">
                {promo.map((m) => (
                  <button key={m.promo} className="promo-btn" onClick={() => commit(m)} aria-label={m.promo}>
                    <svg viewBox="0 0 100 100"><Character skin={skinFor(look.skins, me, m.promo!)} type={m.promo!} owner={me} badge /></svg>
                  </button>
                ))}
              </div>
            </div>
          )}
          {live.result && (
            <div className="result-card" role="dialog" aria-label="Game over">
              <div className="result-emoji">{won ? '👑' : '💥'}</div>
              <h2>{won ? (live.result.winners.length > 1 ? 'YOUR TEAM WINS!' : 'LAST ONE STANDING!') : `${live.result.winners.map((w) => names[w]).join(' & ')} wins!`}</h2>
              <p>{live.result.reason === 'mode-win' ? 'They ruled the hill.' : 'The last king standing takes it all.'}</p>
              {award && award.coins.total > 0 && (
                <div className="coin-award"><span className="coin-big">🪙</span> +{award.coins.total}<small>{award.coins.lines.map((l) => `${l.label} +${l.coins}`).join(' · ')}</small></div>
              )}
              {award && award.after !== award.before && <p className="rating-change">★ {award.before} → <b>{award.after}</b></p>}
              <div className="row center">
                {isOnline ? (
                  <button className="btn primary" onClick={() => online.rematch()} disabled={net.rematchVotes.includes(me)}>{net.rematchVotes.includes(me) ? 'Waiting for the others…' : 'Rematch'}</button>
                ) : (
                  <button className="btn primary" onClick={onAgain}>Play again</button>
                )}
                <button className="btn" onClick={onExit}>Home</button>
              </div>
            </div>
          )}
          {toast && <div className="toast">{toast}</div>}
        </div>
      </div>

      <aside className="game-side">
        {isOnline && <div className="room-code">Room <b>{net.code}</b></div>}
        {hill && <div className="hill-goal">🚩 First to <b>{hill.target}</b> hill points</div>}
        <ol className="seat-list">
          {seatIds.map((k) => {
            const seat = live.seats.find((x) => x.id === k)!;
            const ms = isOnline ? timeLeft(net, k) : null;
            const score = hill?.scores[k] ?? 0;
            return (
              <li key={k} className={`seat ${live.turn === k && !live.result ? 'turn' : ''} ${seat.status === 'eliminated' ? 'out' : ''} ${k === me ? 'me' : ''}`}>
                <div className="avatar"><svg viewBox="0 0 100 100"><Character skin={skinFor(look.skins, k, 'king')} type="king" owner={k} seed={3} /></svg></div>
                <div className="seat-info">
                  <b>{names[k]}{k === me ? ' (you)' : ''}{isOnline && net.gamesPlayed > 0 && <span className="wins"> 🏆{net.score[k] ?? 0}</span>}</b>
                  <span className="muted small">{SIDE_NAME[k]}{seat.team ? ` · Team ${seat.team}` : ''} · ★{ratings[k]}</span>
                  {hill && <div className="hill-bar"><div style={{ width: `${Math.min(100, (score / hill.target) * 100)}%` }} /><span>{score}</span></div>}
                  {speech?.seat === k && <span className="speech">{speech.text}</span>}
                </div>
                {seat.status === 'eliminated' ? <span className="out-tag">OUT</span> : live.result?.winners.includes(k) ? <span className="out-tag win">👑</span> : null}
                {ms !== null && <span className={`clock ${net.clock?.running === k ? 'running' : ''} ${ms < 20000 ? 'low' : ''}`}>{fmt(ms)}</span>}
              </li>
            );
          })}
        </ol>
        {isOnline && (
          <div className="emotes" aria-label="Send a reaction">
            {EMOTES.map((e) => <button key={e.id} className="emote" onClick={() => online.emote(e.id)} title={e.text}>{e.text.split(' ')[0]}</button>)}
          </div>
        )}
        {!live.result && myStatus === 'active' && <button className="btn small danger" onClick={() => push({ t: 'resign', by: me })}>🏳 Give up</button>}
        <button className="btn" onClick={onExit}>← Home</button>
      </aside>
    </div>
  );
}

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  return ms < 10_000 ? (ms / 1000).toFixed(1) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function lastMoveOf(rec: GameRecord, states: ReturnType<typeof replay>) {
  const i = rec.actions.length - 1;
  const a = rec.actions[i];
  if (!a || a.t !== 'move') return null;
  return { from: states[i].pieces[a.piece].at, to: a.to };
}
