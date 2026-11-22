import { useEffect, useMemo, useRef, useState } from 'react';
import { legalActions, play } from '../core/rules';
import type { GameState, MoveAction } from '../core/types';
import { PATH } from '../systems/coins';
import { applyPlacement, judgeMove, nextIndex, pickTest, placementRating, type PlacementPuzzle } from '../systems/placement';
import { solverMoves } from '../systems/puzzle';
import { activeProfile, boardSkins, lookOf, updateProfile } from '../storage/storage';
import { Board } from './Board';
import { moveEvents, shakeFor, type MoveEvents } from './effects';
import { setSoundEnabled, sfx } from './sound';
import { useSave } from './store';

/**
 * Placement test (systems/placement.ts), offered once to a brand-new player.
 * "New to chess" skips it and keeps the usual start. One try per puzzle, no
 * hints; a miss shows the trick and moves on. Never says the player did badly.
 */
type Phase = 'ask' | 'intro' | 'play' | 'reply' | 'right' | 'missed' | 'done';

export function Placement({ done, again = false }: { done: () => void; again?: boolean }) {
  const save = useSave();
  const p = activeProfile(save);
  const test = useMemo(() => pickTest(Math.random), []);
  // A current player (from the Bot Path) goes straight to the explanation.
  const [phase, setPhase] = useState<Phase>(again ? 'intro' : 'ask');
  const [before, setBefore] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState<GameState | null>(null);
  const [ply, setPly] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [fx, setFx] = useState<MoveEvents | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => setSoundEnabled(save.settings.sound), [save.settings.sound]);

  const pz: PlacementPuzzle | undefined = test[idx];

  function skip() {
    updateProfile((x) => ({ ...x, placement: { at: Date.now(), skipped: true } }));
    done();
  }

  function begin(i: number) {
    timers.current.forEach(clearTimeout); timers.current = [];
    setIdx(i); setState(test[i].start); setPly(0); setSelected(null); setLastMove(null); setFx(null); setPhase('play');
  }

  function finish(res: boolean[]) {
    const r = placementRating(res);
    setRating(r);
    setPhase('done');
    setBefore(p ? p.rating : null);
    updateProfile((x) => {
      const now = Date.now();
      const next = applyPlacement(x, r, res.filter(Boolean).length, now);
      const history = x.gamesPlayed === 0 ? [{ at: now, rating: next.rating }] : next.rating !== x.rating ? [...x.ratingHistory, { at: now, rating: next.rating }] : x.ratingHistory;
      return { ...x, rating: next.rating, ratingHistory: history, placement: next.placement };
    });
  }

  function after(res: boolean[]) {
    setResults(res);
    const n = nextIndex(test, res);
    if (n === null) finish(res); else begin(n);
  }

  function playMove(before: GameState, m: MoveAction, n: number): GameState {
    const a = play(before, m);
    const ev = moveEvents(before, a, m, n + 1);
    if (ev) {
      setFx(ev);
      const el = wrapRef.current;
      const cls = shakeFor(ev);
      if (el && cls) { el.classList.remove('shake', 'shake-big'); void el.offsetWidth; el.classList.add(cls); }
      if (ev.mate) sfx.mate(); else if (ev.capture) sfx.capture(ev.capture.big); else sfx.move();
    }
    setLastMove({ from: before.pieces[m.piece].at, to: m.to });
    return a;
  }

  function commit(m: MoveAction) {
    if (!pz || !state || phase !== 'play') return;
    setSelected(null);
    const verdict = judgeMove(pz, state, ply, m);
    const before = state;
    const a = playMove(before, m, ply);
    setState(a);
    if (verdict === 'wrong') {
      // One try: show the trick from where they were, then move on.
      setPhase('missed');
      sfx.nudge();
      later(() => {
        let s = before;
        setLastMove(null); setFx(null); setState(before);
        pz.line.slice(ply).forEach((x, i) => later(() => { s = playMove(s, x, ply + i); setState(s); }, 500 + i * 800));
      }, 700);
      return;
    }
    const next = ply + 1;
    if (verdict === 'solved' || a.result || next >= pz.line.length) { setPhase('right'); return; }
    setPhase('reply');
    later(() => {
      const s2 = playMove(a, pz.line[next], next);
      setState(s2); setPly(next + 1);
      if (next + 1 >= pz.line.length) setPhase('right'); else setPhase('play');
    }, 550);
    setPly(next);
  }

  function onSquare(sq: number) {
    if (!state || phase !== 'play') return;
    const legal = legalActions(state);
    if (selected !== null) {
      const moves = legal.filter((m) => m.piece === state.sq[selected] && m.to === sq);
      if (moves.length) {
        const want = pz?.line[ply];
        commit(moves.find((m) => want && m.promo === want.promo) ?? moves.find((m) => m.promo === 'queen') ?? moves[0]);
        return;
      }
    }
    const id = state.sq[sq];
    setSelected(id >= 0 && state.pieces[id].owner === state.turn && legal.some((m) => m.piece === id) ? sq : null);
  }

  if (phase === 'ask' || phase === 'intro') {
    return (
      <div className="panel placement">
        {phase === 'ask' ? (
          <>
            <h2>Hi {p?.nickname ?? 'there'}! Have you played chess before?</h2>
            <div className="placement-choices">
              <button className="mode-tile" onClick={skip}>
                <span className="mode-emoji">🌱</span><b>I'm new to chess</b><small>Start at the beginning with Pip, the friendliest bot.</small>
              </button>
              <button className="mode-tile" onClick={() => setPhase('intro')}>
                <span className="mode-emoji">🧩</span><b>I know how to play</b><small>Solve a few puzzles so the bots match you.</small>
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Find your level</h2>
            <p>Up to {test.length} puzzles. They get harder: first find 1 good move, then 2, then 3, then 4.</p>
            <p>You get one try at each. Missing some is fine! It just helps us pick the right bots for you.</p>
            {again && p && p.gamesPlayed > 0 && <p>Your rating is ★{p.rating}. The test can only move it up, never down.</p>}
            <div className="row wrap">
              <button className="btn primary" onClick={() => begin(0)}>Start the puzzles</button>
              <button className="btn" onClick={again ? done : skip}>{again ? 'Not now' : 'Skip for now'}</button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === 'done' && rating !== null) {
    const solved = results.filter(Boolean).length;
    const open = PATH.filter((b) => b.rating <= Math.max(rating, p?.placement?.rating ?? 0));
    return (
      <div className="panel placement">
        <div className="result-emoji">{solved >= 6 ? '🏆' : solved >= 3 ? '🌟' : '🌱'}</div>
        <h2>{again && before !== null && before > rating ? `Puzzle level: ★${rating}` : `${again ? 'Your rating' : 'Your starting rating'}: ★${Math.max(rating, again && before !== null ? before : 0)}`}</h2>
        {again && before !== null && before >= rating && <p>Your rating stays ★{before}. You're already playing at that level or better!</p>}
        <p>You solved {solved} puzzle{solved === 1 ? '' : 's'}. {solved ? 'Nice thinking!' : 'Every chess player starts somewhere. You will grow fast!'}</p>
        <p>{open.length > 3 ? `We opened the Bot Path up to ${open[open.length - 1].name} ★${open[open.length - 1].rating}.` : 'The first bots on the Bot Path are ready for you.'} Your rating goes up as you win.</p>
        <button className="btn primary" onClick={done}>Let's play!</button>
      </div>
    );
  }

  if (!pz || !state) return null;
  const side = pz.solver === 'p1' ? 'White' : 'Black';
  const left = solverMoves(pz) - Math.floor(ply / 2);
  const targets = selected !== null && phase === 'play' ? legalActions(state).filter((m) => m.piece === state.sq[selected]) : [];
  const status =
    phase === 'missed' ? 'Good try! Here is the trick.' :
    phase === 'reply' ? 'Good! Now watch the reply…' :
    phase === 'right' ? 'Got it! ✨' :
    `${side} to move. ${left > 1 ? `Find ${left} good moves.` : 'Find the best move!'}`;
  const moreAfter = () => after([...results, phase === 'right']);

  return (
    <div className="game puzzle placement-play">
      <div className="game-main">
        <div className="banner-slot"><div className={`banner ${phase === 'right' ? '' : 'blue'}`}>{status}</div></div>
        <div className="board-wrap" ref={wrapRef}>
          <Board
            state={state}
            bottom={pz.solver}
            selected={selected}
            targets={targets}
            lastMove={lastMove}
            showCoordinates={save.settings.showCoordinates}
            landscape={lookOf(save).landscape}
            skins={boardSkins(save)}
            interactive={phase === 'play'}
            onSquare={onSquare}
            fx={fx}
          />
        </div>
      </div>
      <aside className="game-side">
        <h2 style={{ margin: 0 }}>Find your level</h2>
        <p className="status">Puzzle {idx + 1} of {test.length}: {pz.tier === 1 ? '1 good move' : `${pz.tier} moves ahead`}</p>
        {(phase === 'right' || phase === 'missed') && (
          <button className="btn primary" onClick={moreAfter}>{nextIndex(test, [...results, phase === 'right']) === null ? 'See my level →' : 'Next puzzle →'}</button>
        )}
        <button className="btn" onClick={() => finish(results)}>Stop here</button>
      </aside>
    </div>
  );
}
