import { useEffect, useMemo, useRef, useState } from 'react';
import { requestMove } from '../ai/client';
import { botById } from '../content/bots';
import { pieceType } from '../core/pieces';
import { newRecord, replay, type GameRecord } from '../core/record';
import { legalActions, play } from '../core/rules';
import { toSAN } from '../core/san';
import { newSeed } from '../core/rng';
import type { GameState, MoveAction, PlayerId } from '../core/types';
import { activeProfile, addGame, update, upsertProfile } from '../storage/storage';
import { updateRating } from '../systems/rating';
import { Board } from './Board';
import { PieceGlyph } from './PieceGlyph';
import { useSave } from './store';

export interface GameConfig {
  kind: 'local' | 'bot';
  botId?: string;
  /** In bot games, the seat the human plays. */
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
  checkmate: 'by checkmate',
  resign: 'by resignation',
  stalemate: 'Stalemate: no legal moves, but no check.',
  'draw-repetition': 'Draw: the same position happened three times.',
  'draw-50': 'Draw: 50 moves with no capture or pawn move.',
  'draw-material': 'Draw: nobody has enough pieces left to checkmate.',
  'draw-agreed': 'Draw agreed.',
};

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function GameScreen({ config, onExit, onRematch, reviewRecord }: Props) {
  const save = useSave();
  const bot = config.botId ? botById(config.botId) : undefined;
  const botSeat: PlayerId | null = config.kind === 'bot' ? (config.humanSeat === 'p1' ? 'p2' : 'p1') : null;

  const [rec, setRec] = useState<GameRecord>(() => reviewRecord ?? newRecord(newSeed(), config.names));
  const states = useMemo(() => replay(rec), [rec]);
  const live = states[states.length - 1];
  const [view, setView] = useState<number | null>(reviewRecord ? 0 : null);
  const shown = view === null ? live : states[view];
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<MoveAction[] | null>(null);
  const [speech, setSpeech] = useState<string | null>(bot ? pick(bot.lines.greet) : null);
  const [thinking, setThinking] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [ratingChange, setRatingChange] = useState<{ before: number; after: number } | null>(null);
  const finishedRef = useRef(!!reviewRecord);
  const reviewing = !!reviewRecord || view !== null;

  const sanList = useMemo(() => {
    const out: string[] = [];
    rec.actions.forEach((a, i) => {
      if (a.t === 'move') out.push(toSAN(states[i], a));
    });
    return out;
  }, [rec, states]);

  const isHumanTurn = !live.result && (config.kind === 'local' || live.turn === config.humanSeat);
  const legal = useMemo(() => (isHumanTurn && !reviewing ? legalActions(live) : []), [live, isHumanTurn, reviewing]);
  const targets = selected === null ? [] : legal.filter((m) => m.piece === shown.sq[selected]);

  const lastMove = useMemo(() => {
    const idx = view === null ? rec.actions.length : view;
    const a = rec.actions[idx - 1];
    if (!a || a.t !== 'move') return null;
    return { from: states[idx - 1].pieces[a.piece].at, to: a.to };
  }, [rec, states, view]);

  function commit(m: MoveAction) {
    const before = live;
    const after = play(before, m);
    if (bot && botSeat && before.turn !== botSeat && before.sq[m.to] >= 0 && Math.random() < 0.3) setSpeech('Hey! I liked that piece.');
    setRec((r) => ({ ...r, actions: [...r.actions, m] }));
    setSelected(null);
    setPromo(null);
    return after;
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

  // Bot turn.
  useEffect(() => {
    if (!botSeat || live.result || live.turn !== botSeat || reviewing) return;
    let cancelled = false;
    setThinking(true);
    requestMove(live, bot?.rating ?? 800, bot?.id).then((m) => {
      if (cancelled || !m) return;
      setThinking(false);
      if (live.sq[m.to] >= 0 && bot && Math.random() < 0.5) setSpeech(pick(bot.lines.capture));
      setRec((r) => ({ ...r, actions: [...r.actions, m] }));
    });
    return () => { cancelled = true; setThinking(false); };
  }, [live, botSeat, bot, reviewing]);

  // Game over: rating, records, saved game.
  useEffect(() => {
    if (!live.result || finishedRef.current) return;
    finishedRef.current = true;
    const profile = activeProfile(save);
    const finalRec: GameRecord = { ...rec, meta: { ...rec.meta, result: live.result, san: sanList } };
    if (bot && botSeat) {
      const won = live.result.winners.includes(config.humanSeat);
      const lost = live.result.winners.includes(botSeat);
      setSpeech(pick(won ? bot.lines.lose : lost ? bot.lines.win : bot.lines.greet));
    }
    if (!profile) return;
    update((d) => {
      let p = activeProfile(d)!;
      if (bot && botSeat) {
        const score = live.result!.winners.includes(config.humanSeat) ? 1 : live.result!.winners.length === 0 ? 0.5 : 0;
        const rating = updateRating(p.rating, bot.rating, score, p.gamesPlayed);
        setRatingChange({ before: p.rating, after: rating });
        const rec0 = p.botRecords[bot.id] ?? { w: 0, l: 0, d: 0 };
        const botRecords = { ...p.botRecords, [bot.id]: { w: rec0.w + (score === 1 ? 1 : 0), l: rec0.l + (score === 0 ? 1 : 0), d: rec0.d + (score === 0.5 ? 1 : 0) } };
        p = { ...p, rating, gamesPlayed: p.gamesPlayed + 1, botRecords, ratingHistory: [...p.ratingHistory, { at: Date.now(), rating }].slice(-200) };
      }
      return addGame(upsertProfile(d, p), p.id, finalRec);
    });
  }, [live.result]); // eslint-disable-line react-hooks/exhaustive-deps

  function undo() {
    if (!rec.actions.length || live.result) return;
    let n = rec.actions.length - 1;
    if (botSeat) {
      // Take back to the human's turn.
      while (n > 0 && states[n].turn !== config.humanSeat) n--;
      if (states[n].turn !== config.humanSeat) return;
    }
    setRec((r) => ({ ...r, actions: r.actions.slice(0, n) }));
    setSelected(null);
  }

  function resign() {
    if (live.result) return;
    const by = config.kind === 'bot' ? config.humanSeat : live.turn;
    setRec((r) => ({ ...r, actions: [...r.actions, { t: 'resign', by }] }));
  }

  const bottom = useMemo(() => {
    const base = config.kind === 'bot' ? config.humanSeat : 'p1';
    return flipped ? (base === 'p1' ? 'p2' : 'p1') : base;
  }, [config, flipped]);
  const top = bottom === 'p1' ? 'p2' : 'p1';

  const captured = (owner: PlayerId) =>
    shown.pieces.filter((p) => p.at < 0 && p.owner === owner).sort((a, b) => pieceType(b.type).value - pieceType(a.type).value);

  const turnName = config.names[shown.turn] ?? shown.turn;
  let status: string;
  if (shown.result) {
    const w = shown.result.winners;
    status = w.length ? `${w.map((x) => config.names[x]).join(' & ')} wins ${REASON_TEXT[shown.result.reason] ?? ''}` : REASON_TEXT[shown.result.reason] ?? 'Draw';
  } else if (thinking) status = `${turnName} is thinking…`;
  else status = `${turnName} to move`;

  const resultView = live.result && view === null && !reviewRecord;
  const humanWon = live.result?.winners.includes(config.humanSeat);

  return (
    <div className="game">
      <div className="game-main">
        <PlayerBar name={config.names[top] ?? top} seat={top} active={shown.turn === top && !shown.result} captured={captured(bottom)} bot={botSeat === top ? bot : undefined} speech={botSeat === top ? speech : null} />
        <div className="board-wrap">
          <Board
            state={shown}
            bottom={bottom}
            selected={reviewing ? null : selected}
            targets={reviewing ? [] : targets}
            lastMove={lastMove}
            showCoordinates={save.settings.showCoordinates}
            theme={save.settings.boardTheme}
            interactive={!reviewing && isHumanTurn}
            onSquare={onSquare}
          />
          {promo && (
            <div className="promo" role="dialog" aria-label="Choose a piece">
              <p>Pick your new piece!</p>
              <div className="promo-row">
                {promo.map((m) => (
                  <button key={m.promo} className="promo-btn" onClick={() => commit(m)} aria-label={m.promo}>
                    <svg viewBox="0 0 100 100"><PieceGlyph type={m.promo!} light={live.turn === 'p1'} /></svg>
                  </button>
                ))}
              </div>
              <button className="link" onClick={() => setPromo(null)}>Cancel</button>
            </div>
          )}
          {resultView && (
            <div className="result-card" role="dialog" aria-label="Game over">
              <div className="result-emoji">{config.kind === 'bot' ? (humanWon ? '🏆' : live.result!.winners.length ? '💪' : '🤝') : '🏁'}</div>
              <h2>{config.kind === 'bot' ? (humanWon ? 'You won!' : live.result!.winners.length ? 'Good fight!' : 'A draw!') : 'Game over'}</h2>
              <p>{status}</p>
              {ratingChange && (
                <p className="rating-change">
                  Rating {ratingChange.before} → <b>{ratingChange.after}</b> ({ratingChange.after >= ratingChange.before ? '+' : ''}{ratingChange.after - ratingChange.before})
                </p>
              )}
              <div className="row">
                <button className="btn primary" onClick={() => onRematch({ ...config, humanSeat: config.kind === 'bot' ? (config.humanSeat === 'p1' ? 'p2' : 'p1') : 'p1' })}>Play again</button>
                <button className="btn" onClick={() => setView(0)}>Replay game</button>
                <button className="btn" onClick={onExit}>Home</button>
              </div>
            </div>
          )}
        </div>
        <PlayerBar name={config.names[bottom] ?? bottom} seat={bottom} active={shown.turn === bottom && !shown.result} captured={captured(top)} bot={botSeat === bottom ? bot : undefined} speech={botSeat === bottom ? speech : null} />
      </div>

      <aside className="game-side">
        <div className={`status ${shown.result ? 'over' : ''}`} aria-live="polite">{status}</div>
        {reviewing ? (
          <div className="review-controls">
            <button className="btn small" onClick={() => setView(0)} aria-label="First move">⏮</button>
            <button className="btn small" onClick={() => setView((v) => Math.max(0, (v ?? states.length - 1) - 1))} aria-label="Previous move">◀</button>
            <span className="review-count">{(view ?? states.length - 1)}/{states.length - 1}</span>
            <button className="btn small" onClick={() => setView((v) => Math.min(states.length - 1, (v ?? 0) + 1))} aria-label="Next move">▶</button>
            <button className="btn small" onClick={() => setView(reviewRecord ? states.length - 1 : null)} aria-label="Last move">⏭</button>
          </div>
        ) : (
          <div className="row wrap">
            <button className="btn small" onClick={undo} disabled={!rec.actions.length || !!live.result || thinking}>↩ Take back</button>
            <button className="btn small" onClick={() => setFlipped((f) => !f)}>⇅ Flip</button>
            <button className="btn small danger" onClick={resign} disabled={!!live.result}>🏳 Resign</button>
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

function PlayerBar({ name, seat, active, captured, bot, speech }: {
  name: string; seat: string; active: boolean; captured: GameState['pieces'];
  bot?: ReturnType<typeof botById>; speech: string | null;
}) {
  return (
    <div className={`player-bar ${active ? 'active' : ''}`}>
      <div className="avatar" style={{ background: bot?.colour ?? (seat === 'p1' ? '#fffaf0' : '#2d2a3e'), color: !bot && seat !== 'p1' ? '#fffaf0' : undefined }}>
        {bot ? bot.emoji : seat === 'p1' ? '♙' : '♟'}
      </div>
      <div className="pname">
        {name}
        {bot && <span className="prating">{bot.rating}</span>}
      </div>
      <div className="captured" aria-label="Captured pieces">
        {captured.map((p) => (
          <svg key={p.id} viewBox="0 0 100 100"><PieceGlyph type={p.type} light={p.owner === 'p1'} /></svg>
        ))}
      </div>
      {speech && <div className="speech">{speech}</div>}
    </div>
  );
}
