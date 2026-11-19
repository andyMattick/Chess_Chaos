import { useEffect, useRef, useState } from 'react';
import { chesscom, ChessComError, recentGames } from '../chesscom/api';
import { recordFromPGN } from '../chesscom/pgn';
import { requestSlips } from '../ai/client';
import { parseSAN } from '../core/san';
import { slipReady, SLIPS_PER_SESSION, type Slip } from '../systems/slips';
import { mergeMiss } from '../systems/review';
import { legalActions, play } from '../core/rules';
import type { GameState, MoveAction } from '../core/types';
import { noteDaily } from '../storage/daily';
import { activeProfile, boardSkins, load as loadSave, lookOf, updateProfile } from '../storage/storage';
import { builtInPuzzles, checkMove, puzzleFrom, currentStreak, EMPTY_PROGRESS, recordSolve, solverMoves, type Puzzle } from '../systems/puzzle';
import { Board } from './Board';
import { moveEvents, shakeFor, type MoveEvents } from './effects';
import { setSoundEnabled, sfx } from './sound';
import { useSave } from './store';
import { QuickToggles } from './QuickToggles';
import { SURVIVAL } from '../content/survival';
import type { GameConfig } from './GameScreen';

/**
 * Puzzles (docs/06 CC-02, CC-03): Chess.com's daily and random puzzles played
 * on our board, plus built-in warm-ups that work offline. Wrong moves slide
 * back; one hint per puzzle (the right piece glows). Daily solves build a
 * streak. Puzzles never change the rating (docs/02).
 */
type Tab = 'daily' | 'random' | 'warmup' | 'gauntlet' | 'survival' | 'slips';
type Phase = 'loading' | 'play' | 'wrong' | 'reply' | 'solved' | 'shown' | 'error';

export function PuzzleScreen({ back, startGame }: { back: () => void; startGame?: (c: GameConfig) => void }) {
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
  // MODE-11 Puzzle gauntlet: three lives, keep going as long as you can.
  const [run, setRun] = useState<{ lives: number; score: number; idx: number; seen: string[]; over: boolean } | null>(null);
  // Blunder replay: looking through games for your slips.
  const [scan, setScan] = useState<{ done: number; total: number; found: number; source: string } | null>(null);
  const [ccName, setCcName] = useState('');
  const [slipIdx, setSlipIdx] = useState(0);
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

  // Only the latest load may change the screen (a slow Chess.com answer must not undo a later choice).
  const loadId = useRef(0);
  async function load(t: Tab, idx = warmIdx) {
    const my = ++loadId.current;
    const stale = () => my !== loadId.current;
    setTab(t); setPhase('loading'); setPuzzle(null); setError(null);
    if (t === 'survival') { setPhase('play'); return; }
    if (t === 'slips') {
      const pending = activeProfile(loadSave())?.slips?.pending ?? [];
      if (!pending.length) { setPhase('play'); return; }
      const slip = pending[idx % pending.length];
      const pz = puzzleFrom({ id: slip.id, title: slip.text, source: 'slip', fen: slip.fen, san: [slip.best] });
      if (!pz) { setPhase('play'); return; }
      pz.ok = slip.ok.map((x) => parseSAN(pz.start, x)).filter((m): m is MoveAction => !!m);
      start(pz);
      return;
    }
    if (t === 'gauntlet') {
      const r = run && !run.over ? run : { lives: 3, score: 0, idx: 0, seen: [], over: false };
      setRun(r);
      const all = builtInPuzzles();
      if (r.idx < all.length) { start(all[r.idx]); return; }
      if (!ccOn) { setRun({ ...r, over: true }); setPhase('play'); return; }
      try {
        const raw = r.idx === all.length ? await chesscom.dailyPuzzle() : await chesscom.randomPuzzle();
        if (stale()) return;
        const id = `cc-${r.idx === all.length ? 'daily' : 'random'}-${raw.publish_time ?? raw.url ?? raw.fen}`;
        const pz = puzzleFrom({ id, title: raw.title, source: r.idx === all.length ? 'daily' : 'random', fen: raw.fen, pgn: raw.pgn, url: raw.url });
        if (!pz || r.seen.includes(id)) { setRun({ ...r, over: true }); setPhase('play'); return; }
        setRun({ ...r, seen: [...r.seen, id] });
        start(pz);
      } catch {
        if (stale()) return;
        setRun({ ...r, over: true }); setPhase('play');
      }
      return;
    }
    if (t === 'warmup') {
      const all = builtInPuzzles();
      // Unsolved warm-ups first, then round again.
      const order = [...all.filter((x) => !progress.paid.includes(x.id)), ...all.filter((x) => progress.paid.includes(x.id))];
      start(order[idx % order.length]);
      return;
    }
    try {
      const raw = t === 'daily' ? await chesscom.dailyPuzzle() : await chesscom.randomPuzzle();
      if (stale()) return;
      const id = `cc-${t}-${raw.publish_time ?? raw.url ?? raw.fen}`;
      const pz = puzzleFrom({ id, title: raw.title, source: t, fen: raw.fen, pgn: raw.pgn, url: raw.url });
      if (!pz) throw new Error('unreadable');
      start(pz);
    } catch (e) {
      if (stale()) return;
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
    const score = tab === 'gauntlet' && run ? run.score + 1 : 0;
    if (tab === 'gauntlet' && run) setRun({ ...run, score, idx: run.idx + 1 });
    if (!p) return;
    // A solved slip leaves the list.
    if (pz.source === 'slip') updateProfile((x) => ({ ...x, slips: { pending: (x.slips?.pending ?? []).filter((y) => y.id !== pz.id), solved: [pz.id, ...(x.slips?.solved ?? [])].slice(0, 300), scanned: x.slips?.scanned ?? [] } }));
    const r = recordSolve(progress, pz, hint);
    updateProfile((x) => ({ ...x, coins: (x.coins ?? 0) + r.coins, puzzles: { ...r.progress, gauntletBest: Math.max(x.puzzles?.gauntletBest ?? 0, score) } }));
    setReward({ coins: r.coins, streakUp: r.streakUp, streak: r.progress.streak });
    noteDaily('puzzle');
  }

  function commit(m: MoveAction) {
    if (!puzzle || !state || phase !== 'play') return;
    setSelected(null);
    const verdict = checkMove(puzzle, state, ply, m);
    const before = state;
    const after = playMove(before, m, ply);
    setState(after);
    if (verdict === 'wrong' && tab === 'gauntlet' && run) {
      // Gauntlet: a wrong move costs a life; then see the answer and move on.
      const lives = run.lives - 1;
      setRun({ ...run, lives, idx: run.idx + 1, over: lives <= 0 });
      sfx.nudge();
      later(() => { setState(before); setLastMove(null); setFx(null); showMeFrom(before, ply); }, 650);
      return;
    }
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
    if (state) showMeFrom(state, ply);
  }
  function showMeFrom(from: GameState, at: number) {
    if (!puzzle) return;
    setPhase('shown'); setSelected(null);
    let s = from;
    puzzle.line.slice(at).forEach((m, i) => {
      later(() => { s = playMove(s, m, at + i); setState(s); }, 400 + i * 800);
    });
  }

  /** Look through games for big slips (docs/06 CC-05): up to 10 new puzzles per session, shown as they are found. */
  async function lookForSlips(source: 'here' | 'chesscom') {
    if (!p || scan) return;
    const known = new Set([...(p.slips?.scanned ?? []), ...(p.slips?.pending ?? []).map((x) => x.id.split(':')[0])]);
    let games: { rec: import('../core/record').GameRecord; seat: 'p1' | 'p2' }[] = [];
    const me = p.nickname.trim().toLowerCase();
    if (source === 'here') {
      for (const rec of loadSave().games[p.id] ?? []) {
        if (!slipReady(rec) || known.has(rec.id)) continue;
        const n1 = rec.meta.players.p1?.trim().toLowerCase(), n2 = rec.meta.players.p2?.trim().toLowerCase();
        const seat = n1 === me && n2 !== me ? 'p1' : n2 === me && n1 !== me ? 'p2' : null;
        if (seat) games.push({ rec, seat });
      }
    } else {
      const u = ccName.trim().toLowerCase();
      if (!u) return;
      setScan({ done: 0, total: 0, found: 0, source: 'Chess.com' });
      try {
        for (const g of await recentGames(u, 20)) {
          if (!g.pgn || g.rules !== 'chess') continue;
          const rec = recordFromPGN(g.pgn, g.url);
          const seat = g.white.username.toLowerCase() === u ? 'p1' : g.black.username.toLowerCase() === u ? 'p2' : null;
          if (rec && seat && slipReady(rec) && !known.has(rec.id)) games.push({ rec, seat });
        }
      } catch (e) {
        setScan(null);
        setError(e instanceof ChessComError ? e.message : 'Chess.com is not answering right now.');
        return;
      }
    }
    games = games.slice(0, 20);
    let found = 0;
    let shownOne = false;
    setScan({ done: 0, total: games.length, found: 0, source: source === 'here' ? 'your games' : 'Chess.com' });
    for (let i = 0; i < games.length && found < SLIPS_PER_SESSION; i++) {
      const { rec, seat } = games[i];
      const slips: Slip[] = await requestSlips(rec, seat, source, Math.min(3, SLIPS_PER_SESSION - found));
      found += slips.length;
      updateProfile((x) => {
        const solved = new Set(x.slips?.solved ?? []);
        const pending = [...(x.slips?.pending ?? []), ...slips.filter((y) => !solved.has(y.id) && !(x.slips?.pending ?? []).some((z) => z.id === y.id))].slice(-40);
        // The miss map learns which tactics you missed (docs/06 CC-05 step 4).
        const miss = Object.fromEntries(slips.filter((y) => y.tactic).map((y) => [y.tactic!, { missed: 1, found: 0 }]));
        return { ...x, missMap: mergeMiss(x.missMap, miss), slips: { pending, solved: x.slips?.solved ?? [], scanned: [rec.id, ...(x.slips?.scanned ?? [])].slice(0, 400) } };
      });
      setScan({ done: i + 1, total: games.length, found, source: source === 'here' ? 'your games' : 'Chess.com' });
      if (found && !shownOne && !puzzle && tab === 'slips') { shownOne = true; load('slips', 0); }
    }
    setScan((x) => (x ? { ...x, done: x.total } : x));
    setTimeout(() => setScan(null), 4000);
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
    if (tab === 'gauntlet') { if (!run?.over) load('gauntlet'); return; }
    if (tab === 'warmup') { const i = warmIdx + 1; setWarmIdx(i); load('warmup', i); }
    else if (tab === 'slips') { const i = phase === 'solved' ? slipIdx : slipIdx + 1; setSlipIdx(i); load('slips', i); }
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
              skins={boardSkins(save)}
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
          <button className={`btn ${tab === 'gauntlet' ? 'primary' : ''}`} onClick={() => { setRun(null); setTimeout(() => load('gauntlet'), 0); }}>❤️ Gauntlet</button>
          {startGame && <button className={`btn ${tab === 'survival' ? 'primary' : ''}`} onClick={() => load('survival')}>🛡️ Survival</button>}
          <button className={`btn ${tab === 'slips' ? 'primary' : ''}`} onClick={() => { setSlipIdx(0); load('slips', 0); }}>🔁 My slips{(p?.slips?.pending.length ?? 0) > 0 ? ` (${p!.slips!.pending.length})` : ''}</button>
        </div>
        {tab === 'gauntlet' && run && (
          <div className="gauntlet">
            <b>{'❤️'.repeat(Math.max(0, run.lives))}{'🖤'.repeat(Math.max(0, 3 - run.lives))}</b> Score: <b>{run.score}</b> · Best: {progress.gauntletBest ?? 0}
            {run.over && <p><b>{run.lives <= 0 ? 'Out of lives!' : 'You did every puzzle we have!'}</b> Final score: {run.score}. <button className="btn small" onClick={() => { setRun(null); setTimeout(() => load('gauntlet'), 0); }}>Go again</button></p>}
          </div>
        )}
        {tab === 'survival' && startGame && (
          <div className="survival-list">
            <p className="muted small">Hold out for 20 moves against a strong bot. A draw counts as a win!</p>
            {SURVIVAL.map((l) => (
              <button key={l.id} className="mode-tile" onClick={() => startGame({
                kind: 'bot', botId: 'BOT-18', humanSeat: l.survivor, mode: 'survival', unrated: true, extra: { fen: l.fen, survivor: l.survivor },
                names: l.survivor === 'p1' ? { p1: p?.nickname ?? 'You', p2: 'Survival bot' } : { p1: 'Survival bot', p2: p?.nickname ?? 'You' },
              })}>
                <span className="mode-emoji">{l.emoji}</span><b>{l.name}</b><small>{l.tip}</small>
              </button>
            ))}
          </div>
        )}
        {tab === 'slips' && (
          <div className="slips-box">
            <p className="muted small">Your own big oops moments come back as puzzles. You played the move shown; can you find a better one? Any move about as good as the best counts.</p>
            {!puzzle && !scan && <p><b>{(p?.slips?.pending.length ?? 0) ? '' : 'No slip puzzles yet.'}</b> Look through your games to find some.</p>}
            <div className="row wrap">
              <button className="btn small" disabled={!!scan} onClick={() => lookForSlips('here')}>🔍 Look through my games here</button>
            </div>
            {ccOn && (
              <div className="row wrap">
                <input aria-label="Chess.com username" placeholder="Chess.com username" value={ccName} onChange={(e) => setCcName(e.target.value)} maxLength={30} />
                <button className="btn small" disabled={!!scan || !ccName.trim()} onClick={() => lookForSlips('chesscom')}>🔍 Their last 20 games</button>
              </div>
            )}
            {scan && <p className="small"><span className="thinking-dots">Looking through {scan.source}</span> {scan.done} of {scan.total} games · {scan.found} found</p>}
            {puzzle?.source === 'slip' && phase === 'play' && <p className="small">🔁 Slip {Math.min(slipIdx, (p?.slips?.pending.length ?? 1) - 1) + 1} of {p?.slips?.pending.length ?? 1}</p>}
          </div>
        )}
        {puzzle && <p className="status">{puzzle.title}</p>}
        {(phase === 'loading' || phase === 'error') && <p className="status">{status}</p>}
        {puzzle && puzzle.source !== 'built-in' && puzzle.source !== 'slip' && <p className="muted small">Puzzle from Chess.com.{tab === 'daily' ? ' Solve one every day to grow your streak!' : ''}</p>}
        {phase === 'play' && puzzle && (
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
