import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { requestMove } from '../ai/client';
import { botById } from '../content/bots';
import { skinFor } from '../content/cosmetics';
import { pieceType } from '../core/pieces';
import { newRecord, replay, type GameRecord } from '../core/record';
import { legalActions } from '../core/rules';
import { toSAN } from '../core/san';
import { newSeed } from '../core/rng';
import type { Action, GameState, MoveAction, PlayerId } from '../core/types';
import { online } from '../net/client';
import { EMOTES } from '../net/protocol';
import { activeProfile, addGame, update, upsertProfile } from '../storage/storage';
import { updateRating } from '../systems/rating';
import { Board } from './Board';
import { Character } from './skins';
import { useSave } from './store';

export interface GameConfig {
  /** 'local' is only used to replay saved games. */
  kind: 'local' | 'bot' | 'online';
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
};

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

const other = (p: PlayerId): PlayerId => (p === 'p1' ? 'p2' : 'p1');

export function GameScreen({ config, onExit, onRematch, reviewRecord }: Props) {
  const save = useSave();
  const net = useSyncExternalStore(online.subscribe, online.get, online.get);
  const isOnline = config.kind === 'online';
  const bot = config.botId ? botById(config.botId) : undefined;
  const me: PlayerId = isOnline ? net.seat ?? 'p1' : config.humanSeat;
  const botSeat: PlayerId | null = config.kind === 'bot' ? other(config.humanSeat) : null;

  const [localRec, setLocalRec] = useState<GameRecord>(() => reviewRecord ?? newRecord(newSeed(), config.names));
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
  const legal = useMemo(() => (isHumanTurn && !reviewing ? legalActions(live) : []), [live, isHumanTurn, reviewing]);
  const targets = selected === null ? [] : legal.filter((m) => m.piece === shown.sq[selected]);

  const lastMove = useMemo(() => {
    const idx = view === null ? rec.actions.length : view;
    const a = rec.actions[idx - 1];
    if (!a || a.t !== 'move') return null;
    return { from: states[idx - 1].pieces[a.piece].at, to: a.to };
  }, [rec, states, view]);

  function commit(m: MoveAction) {
    push(m);
    setSelected(null);
    setPromo(null);
  }

  function onSquare(sq: number) {
    if (reviewing || !isHumanTurn) return;
    if (selected !== null) {
      const moves = targets.filter((m) => m.to === sq);
      if (moves.length > 1 && moves.some((m) => m.promo)) { setPromo(moves); return; }
      if (moves.length >= 1) { commit(moves[0]); return; }
    }
    const id = live.sq[sq];
    if (id >= 0 && live.pieces[id].owner === live.turn && legal.some((m) => m.piece === id)) setSelected(sq);
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
      return addGame(upsertProfile(d, p), p.id, finalRec);
    });
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
        <Character skin={skinFor(save.settings.skins, seat, 'king')} type="king" owner={seat} seed={seat === 'p1' ? 3 : 9} />
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
          note={isOnline && opp && top !== me ? (opp.botControlled ? '🤖 a bot took over' : !opp.connected ? '📡 reconnecting…' : null) : null}
        />
        <div className="board-wrap">
          <Board
            state={shown}
            bottom={bottom}
            selected={reviewing ? null : selected}
            targets={reviewing ? [] : targets}
            lastMove={lastMove}
            showCoordinates={save.settings.showCoordinates}
            landscape={save.settings.landscape}
            skins={save.settings.skins}
            interactive={!reviewing && isHumanTurn}
            onSquare={onSquare}
          />
          {promo && (
            <div className="promo" role="dialog" aria-label="Choose a piece">
              <p>Your pawn made it! Turn it into…</p>
              <div className="promo-row">
                {promo.map((m) => (
                  <button key={m.promo} className="promo-btn" onClick={() => commit(m)} aria-label={m.promo}>
                    <svg viewBox="0 0 100 100"><Character skin={skinFor(save.settings.skins, me, m.promo!)} type={m.promo!} owner={me} badge /></svg>
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
        </div>
        <PlayerBar
          name={names[bottom]} rating={bot && bottom === botSeat ? bot.rating : net.seats[bottom]?.rating} avatar={avatar(bottom)}
          active={shown.turn === bottom && !shown.result} captured={captured(top)} speech={speech?.seat === bottom ? speech.text : null}
          colour={bot && bottom === botSeat ? bot.colour : undefined}
        />
      </div>

      <aside className="game-side">
        {isOnline && <div className="room-code">Room <b>{net.code}</b></div>}
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

function MoveCell({ san, idx, view, onPick }: { san?: string; idx: number; view: number | null; onPick: (n: number) => void }) {
  if (!san) return <span className="mv" />;
  return (
    <button className={`mv ${view === idx ? 'on' : ''}`} onClick={() => onPick(idx)}>
      {san}
    </button>
  );
}

function PlayerBar({ name, rating, avatar, active, captured, speech, colour, note }: {
  name: string; rating?: number; avatar: ReactNode; active: boolean; captured: GameState['pieces'];
  speech: string | null; colour?: string; note?: string | null;
}) {
  const save = useSave();
  return (
    <div className={`player-bar ${active ? 'active' : ''}`}>
      <div className="avatar" style={{ background: colour ?? '#fff' }}>{avatar}</div>
      <div className="pname">
        {name}
        {rating !== undefined && <span className="prating">★{rating}</span>}
        {note && <span className="pnote">{note}</span>}
      </div>
      {speech && <div className="speech">{speech}</div>}
      <div className="captured" aria-label="Captured pieces">
        {captured.map((p) => (
          <svg key={p.id} viewBox="0 0 100 100"><Character skin={skinFor(save.settings.skins, p.owner, p.type)} type={p.type} owner={p.owner} seed={p.id + 1} /></svg>
        ))}
      </div>
    </div>
  );
}
