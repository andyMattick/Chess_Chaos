import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { requestRanking } from '../ai/client';
import type { RankedMoveOut } from '../ai/worker';
import { alertById, type AlertId } from '../content/alerts';
import { makeMove } from '../core/movegen';
import { sameMove } from '../core/rules';
import type { GameState, MoveAction, PlayerId } from '../core/types';
import type { AlertMode } from '../systems/alerts';
import { attackersOf, dangerMap, defendersOf, hanging, newThreats } from '../tactics/attacks';
import { availableTactics, TACTIC_NAMES } from '../tactics/detectors';
import { EASY_GOALS, GOAL_TEXT, type EasyGoalId } from '../tactics/missions';
import type { BoardOverlays } from './Board';

/**
 * Training layer: drives the one active alert (docs/02 s2, docs/03 Alerts)
 * and the open three-move goals (FB-03) on top of a normal bot game.
 */
export interface TrainingConfig {
  alertId: AlertId;
  mode: AlertMode;
  goals: EasyGoalId[];
}

export interface TrainingApi {
  overlays: BoardOverlays | undefined;
  banner: { text: ReactNode; tone?: 'pink' | 'blue' } | null;
  locked: boolean;
  /** Return true when the alert consumed the tap. */
  interceptSquare(sq: number): boolean;
  /** Return false to stop the move (second look). */
  beforeCommit(m: MoveAction): boolean;
  afterCommit(m: MoveAction): void;
  panel: ReactNode;
  modal: ReactNode;
  toast: string | null;
  goalsDone: EasyGoalId[];
  hintsUsed: number;
}

interface Args {
  cfg?: TrainingConfig;
  live: GameState;
  states: GameState[];
  actions: MoveAction[];
  me: PlayerId;
  isMyTurn: boolean;
  selected: number | null;
  commit: (m: MoveAction) => void;
}

const LABELS = ['A', 'B', 'C'];

export function useTraining({ cfg, live, states, actions, me, isMyTurn, selected, commit }: Args): TrainingApi {
  const alert = cfg ? alertById(cfg.alertId) : undefined;
  const id = alert?.id;
  const ply = states.length - 1;
  const [ranked, setRanked] = useState<{ ply: number; list: RankedMoveOut[] } | null>(null);
  const [usesLeft, setUsesLeft] = useState(cfg?.mode.uses ?? 0);
  const [hintPly, setHintPly] = useState<number | null>(null);
  const [answered, setAnswered] = useState<number | null>(null);
  const [wrongTaps, setWrongTaps] = useState(0);
  const [secondLook, setSecondLook] = useState<{ move: MoveAction; ply: number } | null>(null);
  const [secondLookUsed, setSecondLookUsed] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [goalsDone, setGoalsDone] = useState<EasyGoalId[]>([]);
  const pickRef = useRef<{ ply: number; best?: MoveAction; ok?: MoveAction; bad?: MoveAction } | null>(null);

  // A new game (online rematch, or training wheels switched on) starts the layer fresh.
  const firstCfg = useRef(cfg);
  useEffect(() => {
    if (firstCfg.current === cfg) return;
    firstCfg.current = cfg;
    setUsesLeft(cfg?.mode.uses ?? 0); setGoalsDone([]); setHintPly(null); setAnswered(null);
    setSecondLook(null); setSecondLookUsed(null); setWrongTaps(0); setRanked(null);
  }, [cfg]);

  const onRequest = cfg?.mode.kind === 'on-request';
  const active = !!alert && isMyTurn && (!onRequest || hintPly === ply);

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast((x) => (x === t ? null : x)), 2600);
  };

  // Search-based alerts need the ranked move list at the start of each of my turns.
  useEffect(() => {
    if (!alert?.needsSearch || !isMyTurn || live.result) return;
    if (onRequest && hintPly !== ply && id !== 'ALERT-09') return;
    let cancelled = false;
    requestRanking(live, 2).then((list) => { if (!cancelled) setRanked({ ply, list }); });
    return () => { cancelled = true; };
  }, [alert, isMyTurn, ply, live, onRequest, hintPly, id]);

  const rankedNow = ranked?.ply === ply ? ranked.list : null;

  // Threats from the opponent's last move (ALERT-08).
  const threats = useMemo(() => {
    if (id !== 'ALERT-08' || !isMyTurn || ply === 0) return [];
    return newThreats(states[ply - 1], live, me).filter((t) => t.kind === 'attack');
  }, [id, isMyTurn, ply, states, live, me]);
  const needsAnswer = id === 'ALERT-08' && threats.length > 0 && answered !== ply && (!onRequest || usesLeft > 0);

  // Goals: tick off as they are met.
  const nextGoal = cfg?.goals.find((g) => !goalsDone.includes(g));
  useEffect(() => {
    if (!cfg || !nextGoal) return;
    const ctx = { states, actions, player: me };
    const done = cfg.goals.filter((g) => !goalsDone.includes(g) && EASY_GOALS[g](ctx));
    if (done.length) {
      setGoalsDone((d) => [...d, ...done]);
      say(`🎯 Goal done: ${GOAL_TEXT[done[0]].title}!`);
    }
  }, [ply]); // eslint-disable-line react-hooks/exhaustive-deps

  const overlays = useMemo<BoardOverlays | undefined>(() => {
    if (!active || !id) return undefined;
    const o: BoardOverlays = {};
    switch (id) {
      case 'ALERT-01': {
        const d = dangerMap(live, me);
        o.tint = new Map();
        d.forEach((n, sq) => { if (n > 0) o.tint!.set(sq, `rgba(255, 60, 40, ${Math.min(0.62, 0.22 + n * 0.14)})`); });
        break;
      }
      case 'ALERT-02':
        o.wobble = new Set(hanging(live, me, 1).map((h) => h.piece.at));
        break;
      case 'ALERT-03':
        if (rankedNow?.[0]) o.glow = new Set([live.pieces[rankedNow[0].move.piece].at]);
        break;
      case 'ALERT-04':
        if (rankedNow?.[0]) o.glow = new Set([rankedNow[0].move.to]);
        break;
      case 'ALERT-05': {
        if (!rankedNow || rankedNow.length < 3) break;
        const best = rankedNow[0];
        const ok = rankedNow.find((r, i) => i > 0 && r.score >= best.score - 160 && r.score <= best.score - 25) ?? rankedNow[1];
        const bad = [...rankedNow].reverse().find((r) => r.score <= best.score - 200 && r.move !== ok.move) ?? rankedNow[rankedNow.length - 1];
        const trio = [best, ok, bad];
        // Shuffle labels by ply so "A" is not always the best.
        const order = [0, 1, 2].sort((a, b) => ((a * 7 + ply * 3) % 5) - ((b * 7 + ply * 3) % 5));
        o.arrows = order.map((k, i) => ({ from: live.pieces[trio[k].move.piece].at, to: trio[k].move.to, label: LABELS[i] }));
        pickRef.current = { ply, best: best.move, ok: ok.move, bad: bad.move };
        break;
      }
      case 'ALERT-06': {
        if (!rankedNow || selected === null) break;
        const best = rankedNow[0].score;
        o.targetColors = new Map();
        for (const r of rankedNow) {
          if (live.pieces[r.move.piece].at !== selected) continue;
          const diff = best - r.score;
          o.targetColors.set(r.move.to, diff <= 30 ? '#ff2d2d' : diff <= 120 ? '#ff9a2d' : diff <= 250 ? '#7ec8ff' : '#2f5bff');
        }
        break;
      }
      case 'ALERT-08':
        if (needsAnswer && wrongTaps >= 2) o.wobble = new Set(threats.map((t) => t.square));
        break;
      case 'ALERT-10': {
        o.counts = new Map();
        for (const p of live.pieces) {
          if (p.at < 0 || p.type === 'king') continue;
          const att = attackersOf(live, p.at, p.owner).length;
          if (!att) continue;
          o.counts.set(p.at, { att, def: defendersOf(live, p.at, p.owner).length });
        }
        break;
      }
    }
    return o;
  }, [active, id, live, me, rankedNow, selected, ply, needsAnswer, wrongTaps, threats]);

  const ideas = useMemo(() => (active && id === 'ALERT-07' ? availableTactics(live) : []), [active, id, live]);

  let banner: TrainingApi['banner'] = null;
  if (needsAnswer) banner = { text: '🕵️ What does that move want? Tap the piece it\'s after!', tone: 'pink' };
  else if (ideas.length) {
    const t = TACTIC_NAMES[ideas[0].id];
    banner = { text: <>💡 There's a <u>{t.word}</u> on the board! {t.explain}</> };
  } else if (active && id === 'ALERT-05' && overlays?.arrows) banner = { text: '🎲 One arrow is great, one is okay, one is an oops. Pick!', tone: 'blue' };
  else if (active && id === 'ALERT-06' && selected === null && rankedNow) banner = { text: '🌡️ Pick up a piece: 🔥 hot = good, 🧊 cold = bad', tone: 'blue' };
  else if (active && alert?.needsSearch && !rankedNow && id !== 'ALERT-09') banner = { text: <span className="thinking-dots">thinking up a hint…</span>, tone: 'blue' };

  function interceptSquare(sq: number): boolean {
    if (!needsAnswer) return false;
    if (threats.some((t) => t.square === sq)) {
      setAnswered(ply);
      setWrongTaps(0);
      if (onRequest) setUsesLeft((u) => u - 1);
      say('Yes! That\'s what they\'re after. Now keep it safe.');
    } else {
      setWrongTaps((w) => w + 1);
      say('Not that one. Look at what the last move attacks.');
    }
    return true;
  }

  function beforeCommit(m: MoveAction): boolean {
    if (id !== 'ALERT-09' || secondLookUsed === ply) return true;
    if (onRequest && usesLeft <= 0) return true;
    let drop = 0;
    if (rankedNow) {
      const mine = rankedNow.find((r) => sameMove(r.move, m));
      if (mine) drop = rankedNow[0].score - mine.score;
    } else {
      const lost = hanging(makeMove(live, m), me, 2)[0];
      if (lost && !hanging(live, me, 2).some((h) => h.piece.id === lost.piece.id)) drop = lost.loss * 100;
    }
    if (drop < 200) return true;
    setSecondLook({ move: m, ply });
    setSecondLookUsed(ply);
    if (onRequest) setUsesLeft((u) => u - 1);
    return false;
  }

  function afterCommit(m: MoveAction) {
    if (id === 'ALERT-05' && pickRef.current?.ply === ply) {
      const p = pickRef.current;
      if (p.best && sameMove(m, p.best)) say('🎉 You picked the GREAT one!');
      else if (p.ok && sameMove(m, p.ok)) say('👍 That was the okay one.');
      else if (p.bad && sameMove(m, p.bad)) say('😬 That was the oops one. Watch your pieces!');
    }
    if (onRequest && hintPly === ply && id !== 'ALERT-08' && id !== 'ALERT-09') setHintPly(null);
  }

  const modal = secondLook ? (
    <div className="promo" role="dialog" aria-label="Second look">
      <p>👀 Wait! Take a second look.<br />After that move, something of yours can be taken. Can you see why?</p>
      <div className="row center">
        <button className="btn primary" onClick={() => setSecondLook(null)}>Let me try again</button>
        <button className="btn" onClick={() => { const m = secondLook.move; setSecondLook(null); commit(m); }}>Play it anyway</button>
      </div>
    </div>
  ) : null;

  const panel = alert ? (
    <div className="train-card">
      <h4>{alert.emoji} {alert.name}</h4>
      <p>{alert.blurb}</p>
      {onRequest && (
        <button className="btn small" disabled={usesLeft <= 0 || !isMyTurn || hintPly === ply || id === 'ALERT-08' || id === 'ALERT-09'} onClick={() => { setHintPly(ply); setUsesLeft((u) => u - 1); }}>
          💡 Use a hint ({usesLeft} left)
        </button>
      )}
      {id === 'ALERT-06' && <div className="legend"><span style={{ background: '#ff2d2d', color: '#fff' }}>hot</span><span style={{ background: '#ff9a2d' }}>warm</span><span style={{ background: '#7ec8ff' }}>cool</span><span style={{ background: '#2f5bff', color: '#fff' }}>cold</span></div>}
      {cfg && (
        <div className={`goal ${nextGoal ? '' : 'done'}`} style={{ marginTop: 8 }}>
          {nextGoal ? <>🎯 {GOAL_TEXT[nextGoal].title}<small>{GOAL_TEXT[nextGoal].hint}</small></> : <>🎯 All goals done! ({goalsDone.length})</>}
        </div>
      )}
    </div>
  ) : null;

  return {
    overlays,
    banner,
    locked: needsAnswer,
    interceptSquare,
    beforeCommit,
    afterCommit,
    panel,
    modal,
    toast,
    goalsDone,
    hintsUsed: (cfg?.mode.uses ?? 0) - usesLeft,
  };
}
