import { useEffect, useMemo, useRef, useState } from 'react';
import { BOTS, botById, type Bot } from '../content/bots';
import { legalActions } from '../core/rules';
import type { GameState, MoveAction } from '../core/types';
import { noteDaily } from '../storage/daily';
import { activeProfile, boardSkins, lookOf, updateProfile } from '../storage/storage';
import { MIRROR_KEY, NEMESIS_PREFIX, nemesisBot } from '../systems/nemesis';
import { cardKey, grade, isLineMove, lineMoves, sessionLines, trainerLines, trainerStats, type Colour } from '../systems/openings';
import { Board } from './Board';
import { moveEvents, type MoveEvents } from './effects';
import { sfx } from './sound';
import { useSave } from './store';

/**
 * Opening trainer (docs/07 phase 8): a bot quizzes you on its own opening
 * lines. You play your side, it plays the other. Clean lines come back later
 * and later (spaced repetition); a slip sends a line back to the start.
 */
type Phase = 'pick' | 'play' | 'wrong' | 'line-done' | 'done';

export function OpeningTrainer({ back, botId: startBot }: { back: () => void; botId?: string }) {
  const save = useSave();
  const p = activeProfile(save);
  const cards = p?.openings ?? {};
  // Path bots, and your Mirror and nemesis bots (they have books too).
  const bots: Bot[] = useMemo(() => {
    const own = [p?.mirror, ...(p?.nemeses ?? [])].filter((n): n is NonNullable<typeof n> => !!n && (n.asWhite.length > 0 || n.asBlack.length > 0)).map(nemesisBot);
    return [...BOTS, ...own];
  }, [p?.mirror?.builtAt, p?.nemeses?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [bot, setBot] = useState<Bot | null>(() => (startBot ? botById(startBot) ?? bots.find((b) => b.id === startBot) ?? null : null));
  const [colour, setColour] = useState<Colour>('w');
  const [queue, setQueue] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [ply, setPly] = useState(0);
  const [state, setState] = useState<GameState | null>(null);
  const [slips, setSlips] = useState(0);
  const [phase, setPhase] = useState<Phase>('pick');
  const [selected, setSelected] = useState<number | null>(null);
  const [fx, setFx] = useState<MoveEvents | null>(null);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [results, setResults] = useState<{ line: string; slips: number; days: number }[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const now = Date.now();
  const key = (b: Bot, c: Colour) => (line: string) => cardKey(b.id, c, line);
  const line = queue[idx] ? lineMoves(queue[idx]) : null;
  const mySide = colour === 'w' ? 'p1' : 'p2';
  const myTurnAt = (n: number) => (colour === 'w' ? n % 2 === 0 : n % 2 === 1);

  function begin(b: Bot, c: Colour) {
    const lines = trainerLines(b, c);
    const q = sessionLines(lines, cards, key(b, c), Date.now());
    setBot(b); setColour(c); setQueue(q); setIdx(0); setResults([]);
    if (q.length) startLine(q, 0, c); else setPhase('done');
  }

  function startLine(q: string[], i: number, c: Colour) {
    const l = lineMoves(q[i]);
    if (!l) return;
    setIdx(i); setPly(0); setSlips(0); setState(l.states[0]); setLastMove(null); setFx(null); setSelected(null);
    setPhase('play');
    // As Black, the bot opens.
    if (c === 'b') later(() => botMove(l, 0), 600);
  }

  function show(before: GameState, after: GameState, m: MoveAction, n: number) {
    const ev = moveEvents(before, after, m, n + 1);
    setFx(ev);
    if (ev?.capture) sfx.capture(ev.capture.big); else sfx.move();
    setLastMove({ from: before.pieces[m.piece].at, to: m.to });
  }

  function botMove(l: NonNullable<typeof line>, n: number) {
    if (n >= l.moves.length) { finishLine(); return; }
    show(l.states[n], l.states[n + 1], l.moves[n], n);
    setState(l.states[n + 1]);
    setPly(n + 1);
    if (n + 1 >= l.moves.length) later(finishLine, 500);
  }

  function finishLine() {
    if (!bot) return;
    const k = cardKey(bot.id, colour, queue[idx]);
    const before = (activeProfile()?.openings ?? {})[k];
    const card = grade(before, slipsRef.current, Date.now());
    updateProfile((x) => ({ ...x, openings: { ...(x.openings ?? {}), [k]: card } }));
    setResults((r) => [...r, { line: queue[idx], slips: slipsRef.current, days: Math.round((card.due - Date.now()) / 86400000) }]);
    noteDaily('opening');
    if (slipsRef.current === 0) sfx.promote();
    setPhase('line-done');
  }
  // The latest slip count for timers.
  const slipsRef = useRef(0);
  slipsRef.current = slips;

  function commit(m: MoveAction) {
    if (!line || !state || phase !== 'play') return;
    setSelected(null);
    if (!isLineMove(line, ply, m)) {
      setSlips((x) => x + 1);
      setPhase('wrong');
      sfx.nudge();
      later(() => setPhase('play'), 1400);
      return;
    }
    show(line.states[ply], line.states[ply + 1], m, ply);
    setState(line.states[ply + 1]);
    const n = ply + 1;
    setPly(n);
    if (n >= line.moves.length) { later(finishLine, 450); return; }
    later(() => botMove(line, n), 550);
  }

  function onSquare(sq: number) {
    if (!state || phase !== 'play' || !myTurnAt(ply)) return;
    const legal = legalActions(state);
    if (selected !== null) {
      const moves = legal.filter((m) => m.piece === state.sq[selected] && m.to === sq);
      if (moves.length) { commit(moves.find((m) => m.promo === 'queen') ?? moves[0]); return; }
    }
    const id = state.sq[sq];
    setSelected(id >= 0 && state.pieces[id].owner === state.turn && legal.some((m) => m.piece === id) ? sq : null);
  }

  // ---- Choosing a bot and a colour ----
  if (!bot || phase === 'pick') {
    return (
      <div className="panel wide taped">
        <h2>📖 Opening trainer <span className="scribble">learn their lines</span></h2>
        <p className="muted">Each bot teaches the opening it loves. You play your side, the bot plays the other. Get a line right and it comes back in a few days; slip and you practise it again soon.</p>
        {bot ? (
          <div className="reveal-card">
            <h3>{bot.emoji} {bot.name}: {bot.opening}</h3>
            <div className="row wrap">
              {(['w', 'b'] as Colour[]).map((c) => {
                const st = trainerStats(trainerLines(bot, c), cards, key(bot, c), now);
                return (
                  <button key={c} className={`btn ${c === 'w' ? 'primary' : 'primary dark'}`} disabled={!st.total} onClick={() => begin(bot, c)}>
                    {c === 'w' ? '♙ As White' : '♟ As Black'}
                    <small> {st.due ? `${st.due} due` : st.fresh ? `${st.fresh} new` : 'all learned'} · {st.learned}/{st.total} learned</small>
                  </button>
                );
              })}
            </div>
            <button className="btn small" onClick={() => setBot(null)}>← Other bots</button>
          </div>
        ) : (
          <div className="mode-grid">
            {bots.map((b) => {
              const w = trainerStats(trainerLines(b, 'w'), cards, key(b, 'w'), now);
              const bl = trainerStats(trainerLines(b, 'b'), cards, key(b, 'b'), now);
              const due = w.due + bl.due;
              return (
                <button key={b.id} className="mode-tile trainer-tile" onClick={() => setBot(b)}>
                  <span className="mode-emoji">{b.emoji}</span>
                  <b>{(b.id as string) === `${NEMESIS_PREFIX}${MIRROR_KEY}` ? 'Your own openings' : b.name}</b>
                  <small>{b.opening}</small>
                  <small>{w.learned + bl.learned}/{w.total + bl.total} learned{due ? ` · 🔔 ${due} due` : ''}</small>
                </button>
              );
            })}
          </div>
        )}
        <button className="btn" onClick={back}>← Home</button>
      </div>
    );
  }

  // ---- Playing lines ----
  const want = line && phase === 'wrong' ? line.moves[ply] : null;
  const overlays = want && state ? { arrows: [{ from: state.pieces[want.piece].at, to: want.to, color: '#2fb36b' }], glow: new Set([state.pieces[want.piece].at]) } : undefined;
  const targets = state && selected !== null && phase === 'play' ? legalActions(state).filter((m) => m.piece === state.sq[selected]) : [];
  const yourMoves = line ? line.moves.filter((_, i) => myTurnAt(i)).length : 0;
  const status =
    phase === 'wrong' ? `Not this line. ${bot.name} plays the green arrow here. Try it!` :
    phase === 'line-done' ? (slips ? `Line done, with ${slips} slip${slips > 1 ? 's' : ''}. We'll practise it again soon.` : '🎉 Perfect! This line comes back later.') :
    phase === 'done' ? 'Session done!' :
    myTurnAt(ply) ? `Your move (${Math.floor(ply / 2) + 1} of ${yourMoves}). What does ${bot.name} play here?` : `${bot.name} moves…`;

  return (
    <div className="game puzzle">
      <div className="game-main">
        <div className="banner-slot"><div className={`banner ${phase === 'wrong' ? 'pink' : phase === 'line-done' && !slips ? '' : 'blue'}`}>{status}</div></div>
        <div className="board-wrap">
          {state ? (
            <Board state={state} bottom={mySide} selected={selected} targets={targets} lastMove={lastMove} showCoordinates={save.settings.showCoordinates}
              landscape={lookOf(save).landscape} skins={boardSkins(save)} interactive={phase === 'play'} onSquare={onSquare} fx={fx} overlays={overlays} />
          ) : <div className="puzzle-empty">📖</div>}
          {(phase === 'line-done' || phase === 'done') && (
            <div className="result-card">
              <div className="result-emoji">{phase === 'done' ? '📖' : slips ? '🔁' : '🎉'}</div>
              {phase === 'line-done' && <h2>{slips ? 'Keep practising!' : 'Perfect line!'}</h2>}
              {phase === 'done' && <h2>{results.length ? 'Session done!' : 'Nothing due right now'}</h2>}
              {phase === 'done' && !results.length && <p>Every line here is learned for now. Come back in a day or two!</p>}
              {results.length > 0 && (
                <ul className="small trainer-results">
                  {results.map((r, i) => <li key={i}>{r.slips ? '🔁' : '✅'} {r.line.split(' ').slice(0, 6).join(' ')}… {r.days > 0 ? `back in ${r.days} day${r.days > 1 ? 's' : ''}` : 'again soon'}</li>)}
                </ul>
              )}
              <div className="share-row">
                {phase === 'line-done' && idx + 1 < queue.length && <button className="btn primary" onClick={() => startLine(queue, idx + 1, colour)}>Next line →</button>}
                {phase === 'line-done' && idx + 1 >= queue.length && <button className="btn primary" onClick={() => setPhase('done')}>Finish</button>}
                {phase === 'done' && <button className="btn primary" onClick={() => begin(bot, colour)}>Practise more</button>}
                <button className="btn" onClick={() => setPhase('pick')}>Pick another bot</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <aside className="game-side">
        <h2 style={{ margin: 0 }}>{bot.emoji} {bot.name}</h2>
        <p className="muted small">Learning the {bot.opening} as {colour === 'w' ? 'White' : 'Black'}. Line {Math.min(idx + 1, queue.length)} of {queue.length}.</p>
        <p className="tip small">💡 {bot.tip}</p>
        <button className="btn" onClick={() => setPhase('pick')}>← Stop</button>
      </aside>
    </div>
  );
}
