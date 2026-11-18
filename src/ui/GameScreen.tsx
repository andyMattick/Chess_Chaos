import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { requestMove } from '../ai/client';
import { botById } from '../content/bots';
import { skinFor } from '../content/cosmetics';
import { pieceType } from '../core/pieces';
import { newRecord, replay, type GameRecord } from '../core/record';
import { hillData } from '../core/modes';
import { legalActions } from '../core/rules';
import { toSAN } from '../core/san';
import { newSeed } from '../core/rng';
import type { Action, GameState, MoveAction, PlayerId } from '../core/types';
import { online, roomSkins, timeLeft } from '../net/client';
import { EMOTES } from '../net/protocol';
import { lookOf, activeProfile, addGame, noteOpponent, update, upsertProfile } from '../storage/storage';
import { updateRating } from '../systems/rating';
import { coinsFor, type CoinAward } from '../systems/coins';
import { Board } from './Board';
import { Character } from './skins';
import { useSave } from './store';
import { requestReview } from '../ai/client';
import type { ReviewResult } from '../systems/review';
import { mergeMiss } from '../systems/review';
import { sameMove } from '../core/rules';
import { useTraining, type TrainingConfig } from './training';
import { moveEvents, shakeFor, type MoveEvents } from './effects';
import { setSoundEnabled, sfx } from './sound';

export interface GameConfig {
  /** 'local' is only used to replay saved games. */
  kind: 'local' | 'bot' | 'online';
  /** Game mode for new games (koth, hill-wars…). Default classic. */
  mode?: string;
  /** Training game: one alert and open goals (docs/02 s2). */
  training?: TrainingConfig;
  botId?: string;
  /** In bot games, the seat the human plays. Online, the server decides. */
  humanSeat: PlayerId;
  names: Record<string, string>;
}

interface Props {
  config: GameConfig;
  onExit: () => void;
  onRematch: (c: GameConfig) => void;
  /** Open a saved game in review mode instead of playing. */
  reviewRecord?: GameRecord;
}

const REASON_TEXT: Record<string, string> = {
  checkmate: 'by checkmate!',
  resign: '(the other side gave up)',
  stalemate: 'Stalemate: no legal moves, but no check.',
  'draw-repetition': 'Draw: same position three times.',
  'draw-50': 'Draw: 50 moves with no capture or pawn move.',
  'draw-material': 'Draw: nobody can checkmate with what is left.',
  'draw-agreed': 'Draw agreed.',
  time: 'on time! (the other clock ran out)',
  'mode-win': 'by taking the hill! ⛰️',
};

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

const other = (p: PlayerId): PlayerId => (p === 'p1' ? 'p2' : 'p1');

export function GameScreen({ config, onExit, onRematch, reviewRecord }: Props) {
  const save = useSave();
  const net = useSyncExternalStore(online.subscribe, online.get, online.get);
  const isOnline = config.kind === 'online';
  // Online, everyone sees each army the way its owner dressed it.
  const skinsNow = isOnline ? roomSkins(net, lookOf(save).skins) : lookOf(save).skins;
  const bot = config.botId ? botById(config.botId) : undefined;
  const me: PlayerId = isOnline ? net.seat ?? 'p1' : config.humanSeat;
  const botSeat: PlayerId | null = config.kind === 'bot' ? other(config.humanSeat) : null;

  const [localRec, setLocalRec] = useState<GameRecord>(() => reviewRecord ?? newRecord(newSeed(), config.names, undefined, config.mode ?? 'standard'));
  const rec = isOnline && net.record ? net.record : localRec;
  const names: Record<string, string> = isOnline
    ? { p1: net.seats.p1?.name ?? '…', p2: net.seats.p2?.name ?? '…' }
    : config.names;
  const states = useMemo(() => replay(rec), [rec]);
  const live = states[states.length - 1];
  const [view, setView] = useState<number | null>(reviewRecord ? 0 : null);
  const shown = view === null ? live : states[Math.min(view, states.length - 1)];
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<MoveAction[] | null>(null);
  const [speech, setSpeech] = useState<{ seat: PlayerId; text: string } | null>(bot && botSeat ? { seat: botSeat, text: pick(bot.lines.greet) } : null);
  const [thinking, setThinking] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [ratingChange, setRatingChange] = useState<{ before: number; after: number } | null>(null);
  const [coinAward, setCoinAward] = useState<CoinAward | null>(null);
  const finishedRef = useRef(!!reviewRecord);
  const reviewing = !!reviewRecord || view !== null;

  function push(a: Action) {
    if (isOnline) online.act(a);
    else setLocalRec((r) => ({ ...r, actions: [...r.actions, a] }));
  }

  const sanList = useMemo(() => {
    const out: string[] = [];
    rec.actions.forEach((a, i) => {
      if (a.t === 'move') out.push(toSAN(states[i], a));
    });
    return out;
  }, [rec, states]);

  const isHumanTurn = !live.result && !reviewRecord && live.turn === me;
  // "One fix" retry: replay the position before the mistake and try again.
  const [review, setReview] = useState<ReviewResult | null | 'loading'>(null);
  const [retry, setRetry] = useState<{ tries: number; solved: boolean; reveal: boolean } | null>(null);
  const fix = review && review !== 'loading' ? review.fix : null;
  const retrying = !!retry && !!fix && view === fix.ply;
  const legal = useMemo(
    () => (retrying && !retry!.solved && !retry!.reveal ? legalActions(states[fix!.ply]) : isHumanTurn && !reviewing ? legalActions(live) : []),
    [live, isHumanTurn, reviewing, retrying, retry, fix, states],
  );
  const targets = selected === null ? [] : legal.filter((m) => m.piece === shown.sq[selected]);

  const lastMove = useMemo(() => {
    const idx = view === null ? rec.actions.length : view;
    const a = rec.actions[idx - 1];
    if (!a || a.t !== 'move') return null;
    return { from: states[idx - 1].pieces[a.piece].at, to: a.to };
  }, [rec, states, view]);

  // Chaos: effects and sounds for each new move (not while replaying).
  const [fx, setFx] = useState<MoveEvents | null>(null);
  const lastFxPly = useRef(states.length - 1);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setSoundEnabled(save.settings.sound);
    const n = states.length - 1;
    if (reviewRecord || n <= lastFxPly.current) { lastFxPly.current = n; return; }
    lastFxPly.current = n;
    const ev = moveEvents(states[n - 1], live, rec.actions[n - 1], n);
    if (!ev) return;
    setFx(ev);
    // Restart the shake animation without remounting the board (pieces keep sliding).
    const el = wrapRef.current;
    const cls = shakeFor(ev);
    if (el && cls) {
      el.classList.remove('shake', 'shake-big');
      void el.offsetWidth;
      el.classList.add(cls);
    }
    if (ev.mate) sfx.mate();
    else if (ev.capture) sfx.capture(ev.capture.big);
    else if (ev.promo) sfx.promote();
    else if (ev.castle) sfx.castle();
    else sfx.move();
    if (ev.check) sfx.check();
    const t = setTimeout(() => setFx((f) => (f?.ply === ev.ply ? null : f)), ev.mate ? 3200 : 1500);
    return () => clearTimeout(t);
  }, [states.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveActions = useMemo(() => rec.actions.filter((a): a is MoveAction => a.t === 'move'), [rec]);
  const training = useTraining({
    cfg: config.training, live, states, actions: moveActions, me,
    isMyTurn: isHumanTurn && !reviewing, selected, commit: (m) => commit(m),
  });

  function commit(m: MoveAction) {
    setSelected(null);
    setPromo(null);
    if (retrying && fix) {
      const good = fix.goodMoves.some((g) => sameMove(g, m));
      if (good) setRetry({ ...retry!, solved: true });
      else setRetry({ ...retry!, tries: retry!.tries + 1, reveal: retry!.tries + 1 >= 2 });
      return;
    }
    if (!training.beforeCommit(m)) return;
    push(m);
    training.afterCommit(m);
  }

  function onSquare(sq: number) {
    if (retrying) {
      if (retry!.solved || retry!.reveal) return;
    } else {
      if (reviewing || !isHumanTurn) return;
      if (training.interceptSquare(sq) || training.locked) return;
    }
    const pos = retrying ? states[fix!.ply] : live;
    if (selected !== null) {
      const moves = targets.filter((m) => m.to === sq);
      if (moves.length > 1 && moves.some((m) => m.promo)) { setPromo(moves); return; }
      if (moves.length >= 1) { commit(moves[0]); return; }
    }
    const id = pos.sq[sq];
    if (id >= 0 && pos.pieces[id].owner === pos.turn && legal.some((m) => m.piece === id)) setSelected(sq);
    else setSelected(null);
  }

  // Bot turn (runs on this device).
  useEffect(() => {
    if (!botSeat || live.result || live.turn !== botSeat || reviewing) return;
    let cancelled = false;
    setThinking(true);
    requestMove(live, bot?.rating ?? 800, bot?.id).then((m) => {
      if (cancelled || !m) return;
      setThinking(false);
      if (live.sq[m.to] >= 0 && bot && Math.random() < 0.5) setSpeech({ seat: botSeat, text: pick(bot.lines.capture) });
      setLocalRec((r) => ({ ...r, actions: [...r.actions, m] }));
    });
    return () => { cancelled = true; setThinking(false); };
  }, [live, botSeat, bot, reviewing]);

  // Online emotes show as speech bubbles for a few seconds.
  useEffect(() => {
    if (!isOnline || !net.lastEmote) return;
    const e = EMOTES.find((x) => x.id === net.lastEmote!.id);
    if (e) setSpeech({ seat: net.lastEmote.from, text: e.text });
    const t = setTimeout(() => setSpeech(null), 3500);
    return () => clearTimeout(t);
  }, [isOnline, net.lastEmote]);

  // A rematch online starts a fresh record.
  useEffect(() => {
    if (isOnline && !live.result && rec.actions.length === 0) {
      finishedRef.current = false;
      setRatingChange(null);
      setView(null);
    }
  }, [isOnline, live.result, rec.actions.length]);

  // Game over: rating, records, saved game.
  useEffect(() => {
    if (!live.result || finishedRef.current) return;
    finishedRef.current = true;
    const finalRec: GameRecord = { ...rec, meta: { ...rec.meta, players: names, result: live.result, san: sanList } };
    const won = live.result.winners.includes(me);
    const drawn = live.result.winners.length === 0;
    if (bot && botSeat) setSpeech({ seat: botSeat, text: pick(won ? bot.lines.lose : !drawn ? bot.lines.win : bot.lines.greet) });
    if (!activeProfile(save)) return;
    const oppRating = bot?.rating ?? (isOnline ? net.seats[other(me)]?.rating : undefined);
    update((d) => {
      let p = activeProfile(d)!;
      if (oppRating !== undefined) {
        const firstWin = !!bot && won && (p.botRecords[bot.id]?.w ?? 0) === 0;
        const movesPlayed = rec.actions.filter((a, i) => a.t === 'move' && states[i].turn === me).length;
        const award = coinsFor({
          kind: config.training ? 'training' : isOnline ? 'online' : 'bot',
          result: won ? 'win' : drawn ? 'draw' : 'loss',
          opponent: oppRating, rating: p.rating, goalsDone: training.goalsDone.length, firstWin, movesPlayed,
        });
        setCoinAward(award);
        p = { ...p, coins: (p.coins ?? 0) + award.total };
      }
      if (oppRating !== undefined && rec.actions.length >= 2) {
        const score = won ? 1 : drawn ? 0.5 : 0;
        const rating = updateRating(p.rating, oppRating, score, p.gamesPlayed);
        setRatingChange({ before: p.rating, after: rating });
        p = { ...p, rating, gamesPlayed: p.gamesPlayed + 1, ratingHistory: [...p.ratingHistory, { at: Date.now(), rating }].slice(-200) };
        if (bot) {
          const r0 = p.botRecords[bot.id] ?? { w: 0, l: 0, d: 0 };
          p = { ...p, botRecords: { ...p.botRecords, [bot.id]: { w: r0.w + (score === 1 ? 1 : 0), l: r0.l + (score === 0 ? 1 : 0), d: r0.d + (score === 0.5 ? 1 : 0) } } };
        }
      }
      if (oppRating !== undefined && rec.actions.length >= 2) {
        const score = won ? 1 : drawn ? 0.5 : 0;
        const oppName = names[other(me)];
        p = noteOpponent(p, bot
          ? { key: `bot:${bot.id}`, name: bot.name, kind: 'bot', rating: bot.rating, score }
          : { key: `online:${oppName.toLowerCase()}`, name: oppName, kind: 'online', rating: oppRating, score });
      }
      if (config.training) {
        p = { ...p, lastAlert: config.training.alertId, badges: { ...p.badges, 'goal-getter': (p.badges['goal-getter'] ?? 0) + training.goalsDone.length } };
      }
      return addGame(upsertProfile(d, p), p.id, finalRec);
    });
    // Post-game review for games against bots (FB-01, FB-02, FB-07).
    if (bot && rec.actions.length >= 4) {
      setReview('loading');
      requestReview(finalRec, me).then((r) => {
        setReview(r);
        if (!r) return;
        update((d) => {
          const p = activeProfile(d);
          if (!p) return d;
          const badges = { ...p.badges };
          let tricks = 0;
          for (const [k, n] of Object.entries(r.badges)) {
            badges[k] = (badges[k] ?? 0) + n;
            if (k !== 'no-hang-streak') tricks += n;
          }
          const bonus = Math.min(tricks, 5) * 2;
          if (bonus) setCoinAward((c) => c && { total: c.total + bonus, lines: [...c.lines, { label: `Tricks found ×${Math.min(tricks, 5)}`, coins: bonus }] });
          return upsertProfile(d, { ...p, missMap: mergeMiss(p.missMap, r.miss), badges, coins: (p.coins ?? 0) + bonus });
        });
      });
    }
  }, [live.result]); // eslint-disable-line react-hooks/exhaustive-deps

  function undo() {
    if (!rec.actions.length || live.result || isOnline) return;
    let n = rec.actions.length - 1;
    if (botSeat) {
      while (n > 0 && states[n].turn !== config.humanSeat) n--;
      if (states[n].turn !== config.humanSeat) return;
    }
    setLocalRec((r) => ({ ...r, actions: r.actions.slice(0, n) }));
    setSelected(null);
  }

  function resign() {
    if (live.result) return;
    push({ t: 'resign', by: me });
  }

  const bottom: PlayerId = flipped ? other(me) : me;
  const top = other(bottom);

  const captured = (owner: PlayerId) =>
    shown.pieces.filter((p) => p.at < 0 && p.owner === owner).sort((a, b) => pieceType(b.type).value - pieceType(a.type).value);
  // Material lead in whole points (pawn 1, knight/bishop 3, rook 5, queen 9).
  const material = (owner: PlayerId) => shown.pieces.filter((p) => p.at >= 0 && p.owner === owner && p.type !== 'king').reduce((a, p) => a + Math.floor(pieceType(p.type).value), 0);
  const lead = (seat: PlayerId) => material(seat) - material(other(seat));

  let status: string;
  if (shown.result) {
    const w = shown.result.winners;
    status = w.length ? `${w.map((x) => names[x]).join(' & ')} wins ${REASON_TEXT[shown.result.reason] ?? ''}` : REASON_TEXT[shown.result.reason] ?? 'Draw';
  } else if (thinking) status = `${names[shown.turn]} is thinking…`;
  else if (!reviewRecord && shown.turn === me) status = 'Your move!';
  else status = `${names[shown.turn]} to move`;

  const resultView = live.result && view === null && !reviewRecord;
  const won = live.result?.winners.includes(me);
  const opp = isOnline ? net.seats[other(me)] : undefined;
  const iVotedRematch = isOnline && net.rematchVotes.includes(me);
  const theyVotedRematch = isOnline && net.rematchVotes.includes(other(me));

  const avatar = (seat: PlayerId) => {
    if (bot && seat === botSeat) return <span className="avatar-emoji">{bot.emoji}</span>;
    return (
      <svg viewBox="0 0 100 100">
        <Character skin={skinFor(skinsNow, seat, 'king')} type="king" owner={seat} seed={seat === 'p1' ? 3 : 9} />
      </svg>
    );
  };

  return (
    <div className="game">
      <div className="game-main">
        <PlayerBar
          name={names[top]} rating={bot && top === botSeat ? bot.rating : net.seats[top]?.rating} avatar={avatar(top)}
          active={shown.turn === top && !shown.result} captured={captured(bottom)} speech={speech?.seat === top ? speech.text : null}
          colour={bot && top === botSeat ? bot.colour : undefined}
          lead={lead(top)} skins={skinsNow}
          clockMs={isOnline && !reviewing ? timeLeft(net, top) : null} clockRunning={net.clock?.running === top}
          note={isOnline && opp && top !== me ? (opp.botControlled ? '🤖 a bot took over' : !opp.connected ? '📡 reconnecting…' : null) : null}
        />
        <div className="banner-slot">
            {training.banner && !reviewing && !live.result && <div className={`banner ${training.banner.tone ?? ''}`}>{training.banner.text}</div>}
            {retrying && fix && (
              <div className={`banner ${retry!.solved ? '' : 'blue'}`}>
                {retry!.solved ? '🎉 Yes! That\'s much better.' : retry!.reveal ? `The better move was ${fix.bestSan}. See the glow!` : retry!.tries ? 'Not quite. One more try!' : '🔧 Find a better move than ' + fix.san}
              </div>
            )}
        </div>
        <div className="board-wrap" ref={wrapRef}>
          <Board
            state={shown}
            bottom={bottom}
            selected={reviewing && !retrying ? null : selected}
            targets={reviewing && !retrying ? [] : targets}
            lastMove={lastMove}
            showCoordinates={save.settings.showCoordinates}
            landscape={lookOf(save).landscape}
            skins={skinsNow}
            interactive={(!reviewing && isHumanTurn) || retrying}
            onSquare={onSquare}
            fx={view === null ? fx : null}
            overlays={retrying && retry!.reveal && fix ? revealOverlay(states[fix.ply], fix.goodMoves[0]) : training.overlays}
          />
          {training.modal}
          {promo && (
            <div className="promo" role="dialog" aria-label="Choose a piece">
              <p>Your pawn made it! Turn it into…</p>
              <div className="promo-row">
                {promo.map((m) => (
                  <button key={m.promo} className="promo-btn" onClick={() => commit(m)} aria-label={m.promo}>
                    <svg viewBox="0 0 100 100"><Character skin={skinFor(skinsNow, me, m.promo!)} type={m.promo!} owner={me} badge /></svg>
                  </button>
                ))}
              </div>
              <button className="link" onClick={() => setPromo(null)}>never mind</button>
            </div>
          )}
          {resultView && (
            <div className="result-card" role="dialog" aria-label="Game over">
              <div className="result-emoji">{won ? '🏆' : live.result!.winners.length ? '💥' : '🤝'}</div>
              <h2>{won ? 'YOU WON!' : live.result!.winners.length ? 'Ooof. Good fight!' : 'A draw!'}</h2>
              <p>{status}</p>
              {review === 'loading' && <p className="muted thinking-dots">Looking over your game…</p>}
              {review && review !== 'loading' && (
                <div className="review">
                  {review.win && (
                    <div className="moment win">
                      <b>⭐ Your best moment: {review.win.san}</b>
                      <div>{review.win.text}</div>
                      <button className="btn small" onClick={() => { setRetry(null); setView(review.win!.ply + 1); }}>Show me</button>
                    </div>
                  )}
                  {review.fix && (
                    <div className="moment fix">
                      <b>🔧 One thing to fix: {review.fix.san}</b>
                      <div>{review.fix.text}</div>
                      <button className="btn small" onClick={() => { setRetry({ tries: 0, solved: false, reveal: false }); setView(review.fix!.ply); }}>Try it again</button>
                    </div>
                  )}
                </div>
              )}
              {coinAward && coinAward.total > 0 && (
                <div className="coin-award" title={coinAward.lines.map((l) => `${l.label} +${l.coins}`).join('\n')}>
                  <span className="coin-big">🪙</span> +{coinAward.total}
                  <small>{coinAward.lines.map((l) => `${l.label} +${l.coins}`).join(' · ')}</small>
                </div>
              )}
              {ratingChange && (
                <p className="rating-change">
                  ★ {ratingChange.before} → <b>{ratingChange.after}</b> ({ratingChange.after >= ratingChange.before ? '+' : ''}{ratingChange.after - ratingChange.before})
                </p>
              )}
              <div className="row center">
                {isOnline ? (
                  <button className="btn primary" onClick={() => online.rematch()} disabled={iVotedRematch}>
                    {iVotedRematch ? 'Waiting for them…' : theyVotedRematch ? 'They want a rematch! Go!' : 'Rematch'}
                  </button>
                ) : (
                  <button className="btn primary" onClick={() => onRematch({ ...config, humanSeat: other(config.humanSeat) })}>Play again</button>
                )}
                <button className="btn" onClick={() => setView(0)}>Replay it</button>
                <button className="btn" onClick={onExit}>Home</button>
              </div>
            </div>
          )}
          {training.toast && <div className="toast">{training.toast}</div>}
        </div>
        <PlayerBar
          name={names[bottom]} rating={bot && bottom === botSeat ? bot.rating : net.seats[bottom]?.rating} avatar={avatar(bottom)}
          active={shown.turn === bottom && !shown.result} captured={captured(top)} speech={speech?.seat === bottom ? speech.text : null}
          colour={bot && bottom === botSeat ? bot.colour : undefined}
          lead={lead(bottom)} skins={skinsNow}
          clockMs={isOnline && !reviewing ? timeLeft(net, bottom) : null} clockRunning={net.clock?.running === bottom}
        />
      </div>

      <aside className="game-side">
        {isOnline && <div className="room-code">Room <b>{net.code}</b></div>}
        {isOnline && (
          <div className="scoreboard" aria-label="Match score">
            <span>{names[me]}</span>
            <b>{fmtScore(net.score[me] ?? 0)}</b>
            <i>–</i>
            <b>{fmtScore(net.score[other(me)] ?? 0)}</b>
            <span>{names[other(me)]}</span>
            <small>{net.gamesPlayed ? `after ${net.gamesPlayed} game${net.gamesPlayed > 1 ? 's' : ''}` : 'first game'}</small>
          </div>
        )}
        {!reviewRecord && training.panel}
        {live.mode === 'koth' && <div className="hill-goal">⛰️ King of the hill: get your king to a yellow square to win!</div>}
        {live.mode === 'hill-wars' && (() => {
          const h = hillData(shown);
          return (
            <div className="hill-goal">
              🚩 Hill wars: first to <b>{h.target}</b>
              {(['p1', 'p2'] as PlayerId[]).map((k) => (
                <div key={k} className="hill-bar"><div style={{ width: `${Math.min(100, ((h.scores[k] ?? 0) / h.target) * 100)}%` }} /><span>{names[k]}: {h.scores[k] ?? 0}</span></div>
              ))}
            </div>
          );
        })()}
        {retrying && <button className="btn small" onClick={() => { setRetry(null); setView(null); }}>← Back to results</button>}
        <div className={`status ${shown.result ? 'over' : ''}`} aria-live="polite">{status}</div>
        {reviewing ? (
          <div className="review-controls">
            <button className="btn small" onClick={() => setView(0)} aria-label="First move">⏮</button>
            <button className="btn small" onClick={() => setView((v) => Math.max(0, (v ?? states.length - 1) - 1))} aria-label="Previous move">◀</button>
            <span className="review-count">{view ?? states.length - 1}/{states.length - 1}</span>
            <button className="btn small" onClick={() => setView((v) => Math.min(states.length - 1, (v ?? 0) + 1))} aria-label="Next move">▶</button>
            <button className="btn small" onClick={() => setView(reviewRecord ? states.length - 1 : null)} aria-label="Last move">⏭</button>
          </div>
        ) : (
          <div className="row wrap">
            {!isOnline && <button className="btn small" onClick={undo} disabled={!rec.actions.length || !!live.result || thinking}>↩ Take back</button>}
            <button className="btn small" onClick={() => setFlipped((f) => !f)}>⇅ Flip</button>
            <button className="btn small danger" onClick={resign} disabled={!!live.result}>🏳 Give up</button>
          </div>
        )}
        {isOnline && (
          <div className="emotes" aria-label="Send a reaction">
            {EMOTES.map((e) => (
              <button key={e.id} className="emote" onClick={() => online.emote(e.id)} title={e.text}>{e.text.split(' ')[0]}</button>
            ))}
          </div>
        )}
        <ol className="moves" aria-label="Moves">
          {Array.from({ length: Math.ceil(sanList.length / 2) }, (_, i) => (
            <li key={i}>
              <span className="num">{i + 1}.</span>
              <MoveCell san={sanList[i * 2]} idx={i * 2 + 1} view={view} onPick={(n) => setView(n)} />
              <MoveCell san={sanList[i * 2 + 1]} idx={i * 2 + 2} view={view} onPick={(n) => setView(n)} />
            </li>
          ))}
        </ol>
        <button className="btn" onClick={onExit}>← Home</button>
      </aside>
    </div>
  );
}

function fmtScore(n: number) {
  return Number.isInteger(n) ? String(n) : `${Math.floor(n)}½`;
}

function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (ms < 10_000) return (ms / 1000).toFixed(1);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function revealOverlay(s: GameState, m?: MoveAction) {
  if (!m) return undefined;
  return { glow: new Set([s.pieces[m.piece].at, m.to]) };
}

function MoveCell({ san, idx, view, onPick }: { san?: string; idx: number; view: number | null; onPick: (n: number) => void }) {
  if (!san) return <span className="mv" />;
  return (
    <button className={`mv ${view === idx ? 'on' : ''}`} onClick={() => onPick(idx)}>
      {san}
    </button>
  );
}

function PlayerBar({ name, rating, avatar, active, captured, speech, colour, note, clockMs, clockRunning, lead, skins }: {
  name: string; rating?: number; avatar: ReactNode; active: boolean; captured: GameState['pieces'];
  speech: string | null; colour?: string; note?: string | null; clockMs?: number | null; clockRunning?: boolean; lead?: number; skins: import('../content/cosmetics').SkinChoice;
}) {
  // Re-render a few times a second while this clock is running.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!clockRunning || clockMs === null || clockMs === undefined) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [clockRunning, clockMs]);
  const ms = clockMs ?? null;
  return (
    <div className={`player-bar ${active ? 'active' : ''}`}>
      <div className="avatar" style={{ background: colour ?? '#fff' }}>{avatar}</div>
      <div className="pname">
        {name}
        {rating !== undefined && <span className="prating">★{rating}</span>}
        {note && <span className="pnote">{note}</span>}
      </div>
      {speech && <div className="speech">{speech}</div>}
      {ms !== null && (
        <div className={`clock ${clockRunning ? 'running' : ''} ${ms < 20_000 ? 'low' : ''} ${ms < 10_000 ? 'panic' : ''}`} aria-label="Time left">
          {formatClock(ms)}
        </div>
      )}
      <div className="captured" aria-label="Captured pieces">
        {captured.map((p) => (
          <svg key={p.id} viewBox="0 0 100 100"><Character skin={skinFor(skins, p.owner, p.type)} type={p.type} owner={p.owner} seed={p.id + 1} /></svg>
        ))}
        {!!lead && lead > 0 && <span className="lead">+{lead}</span>}
      </div>
    </div>
  );
}
