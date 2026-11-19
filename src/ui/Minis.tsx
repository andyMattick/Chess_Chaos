import { useEffect, useMemo, useRef, useState } from 'react';
import { CANDY, HANDICAP_LADDER, MATE_LADDER, MAZES, MINIS, ROUNDS, SPRINT_SECONDS, TRADE_SECONDS, type PathLevel } from '../content/minis';
import { GUARD_DUTY, MATE_IN_ONE, SPOTLIGHT, TRADES } from '../content/minisPositions';
import { BOTS, type Bot } from '../content/bots';
import { fromFEN } from '../core/setup';
import { legalActions } from '../core/rules';
import type { GameState, MoveAction } from '../core/types';
import { hanging } from '../tactics/attacks';
import { guardsAll, isMate, isSpotlightBest, pathMoves, pathPar, pathStars, pathState, pathStep, shuffled, sqOf, tradeMove } from '../systems/minis';
import { noteDaily } from '../storage/daily';
import { activeProfile, boardSkins, lookOf, updateProfile, type MiniProgress } from '../storage/storage';
import { Board, type BoardOverlays } from './Board';
import type { GameConfig } from './GameScreen';
import { sfx } from './sound';
import { useSave } from './store';

/** Solo mini-games (docs/03 MINI-01 to MINI-09). */
export function MinisScreen({ back, play }: { back: () => void; play: (c: GameConfig) => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const [open, setOpen] = useState<string | null>(null);
  if (!p) return null;
  const prog = (id: string): MiniProgress => p.minis?.[id] ?? {};
  const close = () => setOpen(null);
  const me = p.nickname;
  // A bot near your rating, for Pawn wars and the handicap ladder.
  const nearBot = (): Bot => [...BOTS].sort((a, b) => Math.abs(a.rating - p.rating) - Math.abs(b.rating - p.rating))[0];
  const strongBot = (): Bot => [...BOTS].sort((a, b) => b.rating - a.rating)[0];
  const startBot = (bot: Bot, extra: Partial<GameConfig>) => play({ kind: 'bot', botId: bot.id, humanSeat: 'p1', unrated: true, names: { p1: me, p2: bot.name }, ...extra });

  if (open === 'MINI-02') return <PathGame id="MINI-02" levels={MAZES} goal="⭐" back={close} />;
  if (open === 'MINI-03') return <PathGame id="MINI-03" levels={CANDY} goal="🍬" back={close} />;
  if (open === 'MINI-05') return <Sprint back={close} />;
  if (open === 'MINI-06') return <GuardDuty back={close} />;
  if (open === 'MINI-07') return <TradeOrNot back={close} />;
  if (open === 'MINI-08') return <Spotlight back={close} />;
  if (open === 'MINI-04' || open === 'MINI-09') {
    const ladder = open === 'MINI-04' ? MATE_LADDER : HANDICAP_LADDER;
    const reached = prog(open).level ?? 0;
    const bot = open === 'MINI-04' ? strongBot() : nearBot();
    return (
      <div className="panel taped">
        <h2>{MINIS.find((m) => m.id === open)!.emoji} {MINIS.find((m) => m.id === open)!.name}</h2>
        <p>{MINIS.find((m) => m.id === open)!.blurb}</p>
        <ol className="ladder">
          {ladder.map((l, i) => (
            <li key={l.name} className={i < reached ? 'done' : i === reached ? 'next' : 'locked'}>
              <span>{i < reached ? '✅' : i === reached ? '👉' : '🔒'} <b>{l.name}</b></span>
              <button className="btn small primary" disabled={i > reached} onClick={() => startBot(bot, { fen: l.fen, mini: { id: open, level: i } })}>{i < reached ? 'Again' : 'Play'}</button>
            </li>
          ))}
        </ol>
        <p className="muted small">{open === 'MINI-04' ? `${bot.name} moves the lone king. Checkmate wins the step.` : `You play White against ${bot.name}. Win to bring the next pieces back.`} No rating change.</p>
        <button className="btn" onClick={close}>← Mini-games</button>
      </div>
    );
  }

  const best = (id: string) => {
    const g = prog(id);
    if (g.stars) { const n = Object.values(g.stars).reduce((a, b) => a + b, 0); return n ? `⭐ ${n}` : ''; }
    if (g.level) return `step ${g.level}`;
    if (g.best) return `best ${g.best}`;
    return '';
  };
  return (
    <div className="panel wide taped">
      <h2>Mini-games <span className="scribble">quick skills, just you</span></h2>
      <div className="mini-grid">
        {MINIS.map((m) => (
          <button key={m.id} className="mini-tile" onClick={() => (m.id === 'MINI-01' ? startBot(nearBot(), { mode: 'pawn-wars' }) : setOpen(m.id))}>
            <span className="mini-emoji">{m.emoji}</span>
            <b>{m.name}</b>
            <small>{m.blurb}</small>
            <span className="mini-skill">{m.skill}{best(m.id) ? ` · ${best(m.id)}` : ''}</span>
          </button>
        ))}
      </div>
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}

function record(id: string, f: (g: MiniProgress) => MiniProgress) {
  noteDaily('mini');
  updateProfile((p) => ({ ...p, minis: { ...(p.minis ?? {}), [id]: f(p.minis?.[id] ?? {}) } }));
}

function useBoardLook() {
  const save = useSave();
  return { showCoordinates: save.settings.showCoordinates, landscape: lookOf(save).landscape, skins: boardSkins(save) };
}

/** Tap a piece, tap a square. `only` limits which piece may move. */
function useTaps(s: GameState | null, onMove: (m: MoveAction, all: MoveAction[]) => void, only?: number) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [s]);
  const legal = useMemo(() => (s ? legalActions(s) : []), [s]);
  const targets = selected === null || !s ? [] : legal.filter((m) => s.pieces[m.piece].at === selected);
  const onSquare = (sq: number) => {
    if (!s) return;
    const id = s.sq[sq];
    if (id >= 0 && s.pieces[id].owner === s.turn && (only === undefined || only === id)) { setSelected(sq); return; }
    const hits = targets.filter((m) => m.to === sq);
    if (hits.length) { setSelected(null); onMove(hits[0], hits); }
  };
  return { selected, targets, onSquare };
}

/* ---- MINI-02 and MINI-03 ---------------------------------------------- */
function PathGame({ id, levels, goal, back }: { id: string; levels: PathLevel[]; goal: string; back: () => void }) {
  const save = useSave();
  const look = useBoardLook();
  const stars = activeProfile(save)?.minis?.[id]?.stars ?? {};
  const [idx, setIdx] = useState(() => Math.min(levels.length - 1, Object.keys(stars).length));
  const level = levels[idx];
  const par = useMemo(() => pathPar(level), [level]);
  const [s, setS] = useState(() => pathState(level));
  const [left, setLeft] = useState(level.goals.map(sqOf));
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  const reset = (i = idx) => { setIdx(i); setS(pathState(levels[i])); setLeft(levels[i].goals.map(sqOf)); setMoves(0); setDone(null); };
  const pieceSq = s.pieces.find((x) => x.at >= 0)!.at;
  const targets = done === null ? pathMoves(s) : [];
  const onSquare = (sq: number) => {
    const m = targets.find((t) => t.to === sq);
    if (!m) return;
    const n = pathStep(s, m);
    const rest = left.filter((g) => g !== sq);
    setS(n); setLeft(rest); setMoves(moves + 1);
    if (rest.length < left.length) sfx.capture(false);
    if (!rest.length) {
      const got = pathStars(moves + 1, par);
      setDone(got);
      sfx.mate();
      record(id, (g) => ({ ...g, stars: { ...(g.stars ?? {}), [idx]: Math.max(got, g.stars?.[idx] ?? 0) } }));
    }
  };
  const overlays: BoardOverlays = { walls: true, badges: new Map(left.map((g) => [g, goal])) };
  const mini = MINIS.find((m) => m.id === id)!;
  return (
    <div className="panel wide taped mini-play">
      <h2>{mini.emoji} {mini.name}</h2>
      <div className="clock-chips">
        {levels.map((_, i) => <button key={i} className={`chip ${i === idx ? 'on' : ''}`} onClick={() => reset(i)}>{i + 1}{stars[i] ? ` ${'⭐'.repeat(stars[i])}` : ''}</button>)}
      </div>
      <p><b>Moves: {moves}</b> · best possible: {par} · {left.length ? `${left.length} ${goal} to go` : ''}</p>
      <div className="board-wrap">
        <Board state={s} bottom="p1" selected={done === null ? pieceSq : null} targets={targets} interactive={done === null} onSquare={onSquare} overlays={overlays} {...look} />
      </div>
      {done !== null && (
        <div className="result-card">
          <h3>{'⭐'.repeat(done)}{done < 3 ? '☆'.repeat(3 - done) : ''}</h3>
          <p>{done === 3 ? 'Perfect! The fewest moves possible.' : `Done in ${moves}! It can be done in ${par}. Try again?`}</p>
          <div className="row center">
            <button className="btn" onClick={() => reset()}>Try again</button>
            {idx < levels.length - 1 && <button className="btn primary" onClick={() => reset(idx + 1)}>Next level</button>}
          </div>
        </div>
      )}
      <div className="row"><button className="btn small" onClick={() => reset()}>↺ Start over</button><button className="btn" onClick={back}>← Mini-games</button></div>
    </div>
  );
}

/* ---- MINI-05 ---------------------------------------------------------- */
function Sprint({ back }: { back: () => void }) {
  const look = useBoardLook();
  const order = useMemo(() => shuffled(MATE_IN_ONE, Math.random), []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState<string | null>(null);
  const over = end !== null && now >= end;
  useEffect(() => { if (end === null || over) return; const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, [end, over]);
  const saved = useRef(false);
  useEffect(() => { if (over && !saved.current) { saved.current = true; record('MINI-05', (g) => ({ ...g, best: Math.max(score, g.best ?? 0) })); } }, [over]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = order[i % order.length];
  const s = useMemo(() => fromFEN(p.fen), [p]);
  const taps = useTaps(over || end === null ? null : s, (m, all) => {
    const ok = all.some((x) => isMate(p.fen, x)) || isMate(p.fen, m);
    if (ok) { setScore((n) => n + 1); sfx.capture(false); setFlash('✅ Checkmate!'); } else setFlash(`❌ Not mate. It was ${p.answers[0]}.`);
    setTimeout(() => setFlash(null), 900);
    setI((n) => n + 1);
  });
  const left = end === null ? SPRINT_SECONDS : Math.max(0, Math.ceil((end - now) / 1000));
  return (
    <div className="panel wide taped mini-play">
      <h2>⚡ Mate in one sprint</h2>
      {end === null ? (
        <div className="result-card"><p>White to move. Find the checkmate! As many as you can in {SPRINT_SECONDS} seconds.</p><button className="btn primary" onClick={() => { setEnd(Date.now() + SPRINT_SECONDS * 1000); setNow(Date.now()); }}>Go!</button></div>
      ) : (
        <p className="sprint-bar"><b>⏱️ {left}s</b> · ✅ {score}{flash ? ` · ${flash}` : ''}</p>
      )}
      <div className="board-wrap">
        <Board state={s} bottom="p1" selected={taps.selected} targets={taps.targets} interactive={!over && end !== null} onSquare={taps.onSquare} {...look} />
      </div>
      {over && <div className="result-card"><h3>Time! {score} {score === 1 ? 'checkmate' : 'checkmates'}</h3><button className="btn primary" onClick={() => { setScore(0); setI((n) => n + 1); setEnd(Date.now() + SPRINT_SECONDS * 1000); setNow(Date.now()); saved.current = false; }}>Again</button></div>}
      <button className="btn" onClick={back}>← Mini-games</button>
    </div>
  );
}

/* ---- Shared ten-round quiz frame for MINI-06 and MINI-08 -------------- */
function useRounds<T>(list: T[]) {
  const [order] = useState(() => shuffled(list, Math.random).slice(0, ROUNDS));
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<{ ok: boolean; text: string } | null>(null);
  return { item: order[i], i, score, answer, done: i >= order.length,
    mark(ok: boolean, text: string) { setAnswer({ ok, text }); if (ok) { setScore((n) => n + 1); sfx.capture(false); } },
    next() { setAnswer(null); setI((n) => n + 1); },
  };
}

function Finish({ score, id, back, again }: { score: number; id: string; back: () => void; again: () => void }) {
  const saved = useRef(false);
  useEffect(() => { if (!saved.current) { saved.current = true; record(id, (g) => ({ ...g, best: Math.max(score, g.best ?? 0) })); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="result-card">
      <h3>{score} out of {ROUNDS}!</h3>
      <p>{score >= 8 ? 'Amazing!' : score >= 5 ? 'Nice work!' : 'Good practice. Every try makes you better.'}</p>
      <div className="row center"><button className="btn primary" onClick={again}>Again</button><button className="btn" onClick={back}>← Mini-games</button></div>
    </div>
  );
}

/* ---- MINI-06 ---------------------------------------------------------- */
function GuardDuty({ back }: { back: () => void }) {
  const [key, setKey] = useState(0);
  return <GuardRounds key={key} back={back} again={() => setKey((k) => k + 1)} />;
}
function GuardRounds({ back, again }: { back: () => void; again: () => void }) {
  const look = useBoardLook();
  const r = useRounds(GUARD_DUTY);
  const s = useMemo(() => (r.item ? fromFEN(r.item.fen) : null), [r.item]);
  const danger = s ? hanging(s, 'p1').map((h) => h.piece.at) : [];
  const taps = useTaps(r.answer || !s ? null : s, (m) => {
    const ok = guardsAll(r.item.fen, m);
    r.mark(ok, ok ? '✅ Everything is safe!' : '❌ Something is still in danger.');
  });
  if (r.done) return <div className="panel taped"><h2>🛡️ Guard duty</h2><Finish score={r.score} id="MINI-06" back={back} again={again} /></div>;
  return (
    <div className="panel wide taped mini-play">
      <h2>🛡️ Guard duty</h2>
      <p>Round {r.i + 1} of {ROUNDS} · ✅ {r.score}. The wobbly pieces are in danger. Find ONE move that keeps every piece safe (move it, guard it, or block).</p>
      <div className="board-wrap">
        <Board state={s!} bottom="p1" selected={taps.selected} targets={taps.targets} interactive={!r.answer} onSquare={taps.onSquare} overlays={{ wobble: new Set(danger) }} {...look} />
      </div>
      {r.answer && <div className="result-card"><p>{r.answer.text}</p><button className="btn primary" onClick={r.next}>Next</button></div>}
      <button className="btn" onClick={back}>← Mini-games</button>
    </div>
  );
}

/* ---- MINI-07 ---------------------------------------------------------- */
function TradeOrNot({ back }: { back: () => void }) {
  const [key, setKey] = useState(0);
  return <TradeRounds key={key} back={back} again={() => setKey((k) => k + 1)} />;
}
function TradeRounds({ back, again }: { back: () => void; again: () => void }) {
  const look = useBoardLook();
  const r = useRounds(TRADES);
  const [until, setUntil] = useState(() => Date.now() + TRADE_SECONDS * 1000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (r.answer || r.done) return; const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, [r.answer, r.done]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => { if (!r.answer && !r.done && left === 0) r.mark(false, `⏱️ Too slow! ${r.item.wins ? 'It wins material.' : 'It does not win material.'}`); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  if (r.done) return <div className="panel taped"><h2>⚖️ Trade or no trade</h2><Finish score={r.score} id="MINI-07" back={back} again={again} /></div>;
  const s = fromFEN(r.item.fen);
  const m = tradeMove(r.item.fen, r.item.move)!;
  const answer = (yes: boolean) => r.mark(yes === r.item.wins, yes === r.item.wins ? '✅ Right!' : r.item.wins ? '❌ It does win material: count the pieces that can take back.' : '❌ It loses material once they take back.');
  return (
    <div className="panel wide taped mini-play">
      <h2>⚖️ Trade or no trade</h2>
      <p>Round {r.i + 1} of {ROUNDS} · ✅ {r.score} · ⏱️ {left}s. White plays the arrow move. After Black takes back (if it can), has White won material?</p>
      <div className="board-wrap">
        <Board state={s} bottom="p1" selected={null} targets={[]} interactive={false} onSquare={() => {}} overlays={{ arrows: [{ from: s.pieces[m.piece].at, to: m.to, color: '#ff5a3c' }] }} {...look} />
      </div>
      {!r.answer ? (
        <div className="row center"><button className="btn primary" onClick={() => answer(true)}>👍 Wins material</button><button className="btn" onClick={() => answer(false)}>👎 Not worth it</button></div>
      ) : (
        <div className="result-card"><p>{r.answer.text}</p><button className="btn primary" onClick={() => { r.next(); setUntil(Date.now() + TRADE_SECONDS * 1000); setNow(Date.now()); }}>Next</button></div>
      )}
      <button className="btn" onClick={back}>← Mini-games</button>
    </div>
  );
}

/* ---- MINI-08 ---------------------------------------------------------- */
function Spotlight({ back }: { back: () => void }) {
  const [key, setKey] = useState(0);
  return <SpotRounds key={key} back={back} again={() => setKey((k) => k + 1)} />;
}
function SpotRounds({ back, again }: { back: () => void; again: () => void }) {
  const look = useBoardLook();
  const r = useRounds(SPOTLIGHT);
  const s = useMemo(() => (r.item ? fromFEN(r.item.fen) : null), [r.item]);
  if (r.done || !s) return <div className="panel taped"><h2>🔦 Spotlight</h2><Finish score={r.score} id="MINI-08" back={back} again={again} /></div>;
  const lit = s.sq[r.item.square];
  // The lit piece is always picked up: just tap where it goes.
  const targets = r.answer ? [] : legalActions(s).filter((m) => m.piece === lit);
  const onSquare = (sq: number) => {
    const m = targets.find((t) => t.to === sq);
    if (!m) return;
    const ok = isSpotlightBest(r.item.fen, r.item.best, m);
    r.mark(ok, ok ? '✅ That\'s the best move for it!' : `❌ Better: ${r.item.best.join(' or ')}.`);
  };
  return (
    <div className="panel wide taped mini-play">
      <h2>🔦 Spotlight</h2>
      <p>Round {r.i + 1} of {ROUNDS} · ✅ {r.score}. The lit-up piece is ready to move. Tap its best square!</p>
      <div className="board-wrap">
        <Board state={s} bottom="p1" selected={r.answer ? null : r.item.square} targets={targets} interactive={!r.answer} onSquare={onSquare} overlays={{ glow: new Set([r.item.square]) }} {...look} />
      </div>
      {r.answer && <div className="result-card"><p>{r.answer.text}</p><button className="btn primary" onClick={r.next}>Next</button></div>}
      <button className="btn" onClick={back}>← Mini-games</button>
    </div>
  );
}
