import { useEffect, useRef, useState } from 'react';
import { chesscom, ChessComError } from '../chesscom/api';
import { legalActions, play } from '../core/rules';
import type { GameState, MoveAction } from '../core/types';
import { activeProfile, lookOf, updateProfile } from '../storage/storage';
import { builtInPuzzles, checkMove, puzzleFrom, currentStreak, EMPTY_PROGRESS, recordSolve, solverMoves, type Puzzle } from '../systems/puzzle';
import { Board } from './Board';
import { moveEvents, shakeFor, type MoveEvents } from './effects';
import { setSoundEnabled, sfx } from './sound';
import { useSave } from './store';
import { QuickToggles } from './QuickToggles';

/**
 * Puzzles (docs/06 CC-02, CC-03): Chess.com's daily and random puzzles played
 * on our board, plus built-in warm-ups that work offline. Wrong moves slide
 * back; one hint per puzzle (the right piece glows). Daily solves build a
 * streak. Puzzles never change the rating (docs/02).
 */
type Tab = 'daily' | 'random' | 'warmup';
type Phase = 'loading' | 'play' | 'wrong' | 'reply' | 'solved' | 'shown' | 'error';

export function PuzzleScreen({ back }: { back: () => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const ccOn = save.settings.chesscomEnabled;
  const [tab, setTab] = useState<Tab>(ccOn ? 'daily' : 'warmup');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [ply, setPly] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const [tries, setTries] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [fx, setFx] = useState<MoveEvents | null>(null);
  const [reward, setReward] = useState<{ coins: number; streakUp: boolean; streak: number } | null>(null);
  const [warmIdx, setWarmIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => setSoundEnabled(save.settings.sound), [save.settings.sound]);

  const progress = { ...EMPTY_PROGRESS, ...(p?.puzzles ?? {}) };
  const streak = currentStreak(progress);

  function start(pz: Puzzle) {
    timers.current.forEach(clearTimeout); timers.current = [];
    setPuzzle(pz); setState(pz.start); setPly(0); setPhase('play'); setSelected(null);
    setHint(false); setTries(0); setLastMove(null); setFx(null); setReward(null); setError(null);
  }

  async function load(t: Tab, idx = warmIdx) {
    setTab(t); setPhase('loading'); setPuzzle(null); setError(null);
    if (t === 'warmup') {
      const all = builtInPuzzles();
      // Unsolved warm-ups first, then round again.
      const order = [...all.filter((x) => !progress.paid.includes(x.id)), ...all.filter((x) => progress.paid.includes(x.id))];
      start(order[idx % order.length]);
      return;
    }
    try {
      const raw = t === 'daily' ? await chesscom.dailyPuzzle() : await chesscom.randomPuzzle();
      const id = `cc-${t}-${raw.publish_time ?? raw.url ?? raw.fen}`;
      const pz = puzzleFrom({ id, title: raw.title, source: t, fen: raw.fen, pgn: raw.pgn, url: raw.url });
      if (!pz) throw new Error('unreadable');
      start(pz);
    } catch (e) {
      setPhase('error');
      setError(e instanceof ChessComError ? e.message : 'Chess.com is not answering right now. Try a warm-up instead!');
    }
  }

  useEffect(() => { load(tab); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function bump(ev: MoveEvents | null) {
    setFx(ev);
    const el = wrapRef.current;
    const cls = ev ? shakeFor(ev) : 'shake';
    if (el && cls) { el.classList.remove('shake', 'shake-big'); void el.offsetWidth; el.classList.add(cls); }
  }

  function playMove(before: GameState, m: MoveAction, n: number): GameState {
    const after = play(before, m);
    const ev = moveEvents(before, after, m, n + 1);
    if (ev) {
      bump(ev);
      if (ev.mate) sfx.mate(); else if (ev.capture) sfx.capture(ev.capture.big); else if (ev.promo) sfx.promote(); else sfx.move();
      if (ev.check && !ev.mate) sfx.check();
    }
    setLastMove({ from: before.pieces[m.piece].at, to: m.to });
    return after;
  }

  function solved(pz: Puzzle) {
    setPhase('solved');
    if (!p) return;
    const r = recordSolve(progress, pz, hint);
    updateProfile((x) => ({ ...x, coins: (x.coins ?? 0) + r.coins, puzzles: r.progress }));
    setReward({ coins: r.coins, streakUp: r.streakUp, streak: r.progress.streak });
  }

  function commit(m: MoveAction) {
    if (!puzzle || !state || phase !== 'play') return;
    setSelected(null);
    const verdict = checkMove(puzzle, state, ply, m);
    const before = state;
    const after = playMove(before, m, ply);
    setState(after);
    if (verdict === 'wrong') {
      setPhase('wrong');
      setTries((t) => t + 1);
      later(() => { sfx.nudge(); setState(before); setLastMove(null); setFx(null); setPhase('play'); }, 650);
      return;
    }
    // A different mate than the script still ends the puzzle.
    const next = ply + 1;
    if (after.result || next >= puzzle.line.length) { solved(puzzle); return; }
    setPhase('reply');
    later(() => {
      const reply = puzzle.line[next];
      const s2 = playMove(after, reply, next);
      setState(s2); setPly(next + 1);
      if (next + 1 >= puzzle.line.length) solved(puzzle);
      else { setPhase('play'); setHint(false); }
    }, 550);
    setPly(next);
  }

  /** Play the rest of the line for them. */
  function showMe() {
    if (!puzzle || !state) return;
    setPhase('shown'); setSelected(null);
    let s = state;
    puzzle.line.slice(ply).forEach((m, i) => {
      later(() => { s = playMove(s, m, ply + i); setState(s); }, 400 + i * 800);
    });
  }

  function onSquare(sq: number) {
    if (!state || phase !== 'play') return;
    const legal = legalActions(state);
    if (selected !== null) {
      const moves = legal.filter((m) => m.piece === state.sq[selected] && m.to === sq);
      if (moves.length) {
        const want = puzzle?.line[ply];
        commit(moves.find((m) => want && m.promo === want.promo) ?? moves.find((m) => m.promo === 'queen') ?? moves[0]);
        return;
      }
    }
    const id = state.sq[sq];
    setSelected(id >= 0 && state.pieces[id].owner === state.turn && legal.some((m) => m.piece === id) ? sq : null);
  }

  const targets = state && selected !== null && phase === 'play' ? legalActions(state).filter((m) => m.piece === state.sq[selected]) : [];
  const want = puzzle && phase === 'play' ? puzzle.line[ply] : null;
  const overlays = hint && want && state ? { glow: new Set([state.pieces[want.piece].at]) } : undefined;
  const side = puzzle?.solver === 'p1' ? 'White' : 'Black';
  const left = puzzle ? solverMoves(puzzle) - Math.floor(ply / 2) : 0;
  const nextPuzzle = () => {
    if (tab === 'warmup') { const i = warmIdx + 1; setWarmIdx(i); load('warmup', i); }
    else load(tab === 'daily' ? 'random' : tab);
  };

  const status =
    phase === 'loading' ? 'Fetching a puzzle…' :
    phase === 'error' ? error :
    phase === 'wrong' ? 'Not that one. Have another look!' :
    phase === 'reply' ? 'Good! Now watch the reply…' :
    phase === 'solved' ? '🎉 Solved!' :
    phase === 'shown' ? 'Here is the answer. Try the next one!' :
    tries >= 2 && !hint ? 'Tricky! Try the hint. It makes the right piece glow.' :
    `${side} to move. ${left > 1 ? `Find ${left} good moves.` : 'Find the best move!'}`;

  return (
    <div className="game puzzle">
      <div className="game-main">
        <div className="banner-slot">
          {phase !== 'loading' && phase !== 'error' && <div className={`banner ${phase === 'wrong' ? 'pink' : phase === 'solved' ? '' : 'blue'}`}>{status}</div>}
        </div>
        <div className="board-wrap" ref={wrapRef}>
          {state && puzzle ? (
            <Board
              state={state}
              bottom={puzzle.solver}
              selected={selected}
              targets={targets}
              lastMove={lastMove}
              showCoordinates={save.settings.showCoordinates}
              landscape={lookOf(save).landscape}
              skins={lookOf(save).skins}
              interactive={phase === 'play'}
              onSquare={onSquare}
              fx={fx}
              overlays={overlays}
            />
          ) : (
            <div className="puzzle-empty">{phase === 'error' ? '🧩💤' : '🧩'}</div>
          )}
          {phase === 'solved' && reward && (
            <div className="result-card">
              <div className="result-emoji">{reward.streakUp ? '🔥' : '🧩'}</div>
              <h2>Solved!</h2>
              {reward.streakUp && <p className="rating-change">Daily streak: {reward.streak} day{reward.streak === 1 ? '' : 's'}!</p>}
              <p className="rating-change">{reward.coins ? `+${reward.coins} 🪙` : 'You already got coins for this one.'}</p>
              <div className="share-row">
                <button className="btn primary" onClick={nextPuzzle}>Next puzzle →</button>
                <button className="btn" onClick={() => setReward(null)}>Look at the board</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <aside className="game-side">
        <h2 style={{ margin: 0 }}>Puzzles <span className="scribble">find the trick</span></h2>
        <div className="puzzle-stats">
          <span title="Days in a row with the daily puzzle solved">🔥 {streak} day{streak === 1 ? '' : 's'}</span>
          <span>🏅 best {progress.best}</span>
          <span>🧩 {progress.solved} solved</span>
        </div>
        <div className="puzzle-tabs">
          {ccOn && <button className={`btn ${tab === 'daily' ? 'primary' : ''}`} onClick={() => load('daily')}>📅 Today's</button>}
          {ccOn && <button className={`btn ${tab === 'random' ? 'primary' : ''}`} onClick={() => load('random')}>🎲 Random</button>}
          <button className={`btn ${tab === 'warmup' ? 'primary' : ''}`} onClick={() => load('warmup')}>🌱 Warm-ups</button>
        </div>
        {puzzle && <p className="status">{puzzle.title}</p>}
        {(phase === 'loading' || phase === 'error') && <p className="status">{status}</p>}
        {puzzle && puzzle.source !== 'built-in' && <p className="muted small">Puzzle from Chess.com.{tab === 'daily' ? ' Solve one every day to grow your streak!' : ''}</p>}
        {phase === 'play' && (
          <div className="review-controls">
            <button className="btn" onClick={() => setHint(true)} disabled={hint}>💡 Hint{hint ? ' (used)' : ''}</button>
            {tries >= 3 && <button className="btn" onClick={showMe}>👀 Show me</button>}
          </div>
        )}
        {(phase === 'solved' || phase === 'shown') && !reward && <button className="btn primary" onClick={nextPuzzle}>Next puzzle →</button>}
        {phase === 'error' && <button className="btn primary" onClick={() => load('warmup')}>🌱 Play a warm-up</button>}
        <p className="muted small">Puzzles don't change your rating. A hint halves the coins.</p>
        <QuickToggles />
        <button className="btn" onClick={back}>← Home</button>
      </aside>
    </div>
  );
}
