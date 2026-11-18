import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { requestRanking } from '../ai/client';
import { missionById, modifierById, type BuffTarget } from '../content/party';
import { MODE_INFO } from '../core/modes';
import { makeMove } from '../core/movegen';
import { play } from '../core/rules';
import type { Action, GameState, MoveAction, PlayerId } from '../core/types';
import type { PartySetup } from '../systems/party';
import { missionsLive } from '../systems/party';
import { attackersOf, defendersOf, hanging } from '../tactics/attacks';
import type { BoardOverlays } from './Board';
import { cardById } from '../content/cards';
import { playedCards } from '../core/cards';
import { CardTile } from './Cards';

/**
 * Party match layer on top of a game: shows the mode, both sides' modifiers,
 * your secret mission (hold to peek), and runs the one-shot buff buttons and
 * the handicaps that only change what you see or tap.
 */
interface Args {
  party?: PartySetup;
  live: GameState;
  me: PlayerId;
  myTurn: boolean;
  names: Record<string, string>;
  push: (a: Action) => void;
  /** Undo back to my previous turn (bot games only; for Take-back). */
  takeBack?: () => void;
  selected: number | null;
}

export interface PartyApi {
  active: boolean;
  /** A buff is waiting for taps on the board. */
  targeting: boolean;
  interceptSquare(sq: number): boolean;
  beforeCommit(m: MoveAction): boolean;
  overlays?: BoardOverlays;
  hideHints: boolean;
  lockSelection: boolean;
  panel: ReactNode;
  banner: string | null;
  modal: ReactNode;
  toast: string | null;
}

const PROMPTS: Record<BuffTarget, string[]> = {
  none: [],
  'own-piece': ['Tap one of your pieces to protect'],
  'enemy-piece': ['Tap an enemy piece to freeze'],
  'two-own': ['Tap the first piece to swap', 'Tap the second piece'],
  'own-pawn-side': ['Tap one of your pawns', 'Tap the square next to it'],
  'own-piece-knight': ['Tap the piece that will jump', 'Tap where it lands (knight jump)'],
  'own-piece-home': ['Tap the piece to send home'],
  'pawn-row-square': ['Tap an empty square on your pawn row'],
  'king-dash': ['Tap where your king dashes (2 squares in a line)'],
  'double-step': ['Tap the piece', 'Tap its first stop', 'Tap its second stop'],
};

export function usePartyLayer({ party, live, me, myTurn, names, push, takeBack, selected }: Args): PartyApi {
  const [aiming, setAiming] = useState<{ id: string; target: BuffTarget; taps: number[] } | null>(null);
  // A power card waiting for taps.
  const [cardAim, setCardAim] = useState<{ id: string; taps: number[] } | null>(null);
  const [peek, setPeek] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [usedLocal, setUsedLocal] = useState<string[]>([]);
  const [hint, setHint] = useState<number | null>(null);
  const [xrayUntil, setXrayUntil] = useState(-1);
  const [warn, setWarn] = useState<MoveAction | null>(null);
  const [clockLeft, setClockLeft] = useState<number | null>(null);
  const announced = useRef(false);
  const say = (t: string) => { setToast(t); setTimeout(() => setToast((x) => (x === t ? null : x)), 2600); };

  const mine = useMemo(() => party?.modifiers[me] ?? [], [party, me]);
  const has = (id: string) => mine.includes(id);
  const usedEngine = ((live.modeData?.usedBuffs as Record<string, string[]> | undefined) ?? {})[me] ?? [];
  const used = (id: string) => usedEngine.includes(id) || usedLocal.includes(id);

  // Stop aiming a buff when the turn passes.
  useEffect(() => { if (!myTurn) { setAiming(null); setCardAim(null); } }, [myTurn]);

  // "Missions are live" announcement.
  const live_ = party ? missionsLive(live, party, me) : false;
  useEffect(() => {
    if (party && live_ && !announced.current) { announced.current = true; say('🎯 Secret missions are LIVE! Finish yours to win.'); }
  }, [live_, party]);

  // HCAP-07 short clock: 10 seconds a move, then a random legal move.
  useEffect(() => {
    if (!party || !has('HCAP-07') || !myTurn) { setClockLeft(null); return; }
    const end = Date.now() + 10_000;
    setClockLeft(10);
    const t = setInterval(() => {
      const left = Math.ceil((end - Date.now()) / 1000);
      setClockLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(t);
        import('../core/rules').then(({ legalActions }) => {
          const moves = legalActions(live);
          if (moves.length) { push(moves[Math.floor(Math.random() * moves.length)]); say('⏱️ Too slow! A random move was played.'); }
        });
      }
    }, 250);
    return () => clearInterval(t);
  }, [myTurn, live.ply]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!party) {
    return { active: false, targeting: false, interceptSquare: () => false, beforeCommit: () => true, hideHints: false, lockSelection: false, panel: null, banner: null, modal: null, toast: null };
  }

  function fire(id: string, taps: number[]) {
    const p = (sq: number) => live.sq[sq];
    const a: Action = { t: 'buff', by: me, id };
    const target = modifierById(id)?.oneShot ?? 'none';
    if (target === 'own-piece' || target === 'enemy-piece') a.target = p(taps[0]);
    if (target === 'two-own') { a.piece = p(taps[0]); a.target = p(taps[1]); }
    if (target === 'own-pawn-side' || target === 'own-piece-knight') { a.piece = p(taps[0]); a.to = taps[1]; }
    if (target === 'own-piece-home') a.piece = p(taps[0]);
    if (target === 'pawn-row-square' || target === 'king-dash') a.to = taps[0];
    if (target === 'double-step') { a.piece = p(taps[0]); a.to = taps[1]; a.to2 = taps[2]; }
    try {
      play(live, a); // validate first so a wrong tap explains itself
      push(a);
      say(`${modifierById(id)?.emoji} ${modifierById(id)?.name}!`);
    } catch (e) {
      say(`Can't do that: ${(e as Error).message}`);
    }
    setAiming(null);
  }

  function useBuff(id: string) {
    const def = modifierById(id);
    if (!def || !myTurn || used(id)) return;
    if (id === 'BUFF-03') { takeBack?.(); setUsedLocal((u) => [...u, id]); say('⏪ Taken back!'); return; }
    if (id === 'BUFF-12') {
      setUsedLocal((u) => [...u, id]);
      requestRanking(live, 2).then((r) => { if (r[0]) setHint(live.pieces[r[0].move.piece].at); });
      return;
    }
    if (id === 'BUFF-19') { setUsedLocal((u) => [...u, id]); setXrayUntil(live.ply + 6); return; }
    const target = def.oneShot ?? 'none';
    if (target === 'none') { fire(id, []); return; }
    setAiming({ id, target, taps: [] });
  }

  // ---- Power cards ----
  const myCards = party.cards?.[me] ?? [];
  const played = playedCards(live, me);
  const cardThisTurn = (live.modeData?.cardPly as number | undefined) === live.ply;

  function fireCard(id: string, taps: number[]) {
    const def = cardById(id)!;
    const a: Action = { t: 'buff', by: me, id };
    def.taps.forEach((t, i) => {
      const sq = taps[i];
      if (t.field === 'piece') a.piece = live.sq[sq];
      if (t.field === 'target') a.target = live.sq[sq];
      // A square: also pass what is on it (Twin joins two knights).
      if (t.field === 'to') { a.to = sq; if (live.sq[sq] >= 0) a.target = live.sq[sq]; }
    });
    try {
      play(live, a);
      push(a);
      say(`${def.emoji} ${def.name}!`);
    } catch (e) {
      say(`Can't do that: ${(e as Error).message}`);
    }
    setCardAim(null);
  }

  function playCard(id: string) {
    const def = cardById(id);
    if (!def || !myTurn || played.includes(id) || cardThisTurn) return;
    setAiming(null);
    if (!def.taps.length) { fireCard(id, []); return; }
    setCardAim({ id, taps: [] });
  }

  function interceptSquare(sq: number): boolean {
    if (cardAim) {
      const def = cardById(cardAim.id)!;
      const taps = [...cardAim.taps, sq];
      if (taps.length >= def.taps.length) fireCard(cardAim.id, taps);
      else setCardAim({ ...cardAim, taps });
      return true;
    }
    if (!aiming) return false;
    const taps = [...aiming.taps, sq];
    if (taps.length >= PROMPTS[aiming.target].length) fire(aiming.id, taps);
    else setAiming({ ...aiming, taps });
    return true;
  }

  // BUFF-24 safety net: one warning before dropping a piece.
  function beforeCommit(m: MoveAction): boolean {
    setHint(null);
    if (!has('BUFF-24') || used('BUFF-24')) return true;
    const after = makeMove(live, m);
    const lost = hanging(after, me, 2).find((h) => !hanging(live, me, 2).some((x) => x.piece.id === h.piece.id));
    if (!lost) return true;
    setUsedLocal((u) => [...u, 'BUFF-24']);
    setWarn(m);
    return false;
  }

  const overlays: BoardOverlays | undefined = (() => {
    const o: BoardOverlays = {};
    if (hint !== null && myTurn) o.glow = new Set([hint]);
    if (aiming) o.glow = new Set(aiming.taps);
    if (cardAim) o.glow = new Set(cardAim.taps);
    if (xrayUntil > live.ply && myTurn) {
      o.counts = new Map();
      for (const p of live.pieces) {
        if (p.at < 0 || p.type === 'king') continue;
        const att = attackersOf(live, p.at, p.owner).length;
        if (att) o.counts.set(p.at, { att, def: defendersOf(live, p.at, p.owner).length });
      }
    }
    return Object.keys(o).length ? o : undefined;
  })();

  const mode = MODE_INFO.find((m) => m.id === live.mode);
  const myMission = party.missions[me];
  const other = (Object.keys(party.missions) as PlayerId[]).find((k) => k !== me);
  const missionText = myMission && myMission !== '?' ? missionById(myMission) : undefined;

  const modList = (who: PlayerId) => {
    const ids = party.modifiers[who] ?? [];
    if (!ids.length) return <span className="muted small">nothing</span>;
    return ids.map((id) => {
      const d = modifierById(id);
      if (!d) return null;
      const oneShot = who === me && d.kind === 'buff' && (d.oneShot || ['BUFF-03', 'BUFF-12', 'BUFF-19'].includes(id));
      return (
        <div key={id} className={`mod ${d.kind}`} title={d.blurb}>
          <span className="mod-emoji">{d.emoji}</span>
          <span><b>{d.name}</b><small>{d.blurb}</small></span>
          {oneShot && (
            <button className="btn small" disabled={!myTurn || used(id) || (!!aiming && aiming.id !== id)} onClick={() => (aiming?.id === id ? setAiming(null) : useBuff(id))}>{used(id) ? 'used' : aiming?.id === id ? 'Cancel' : 'Use!'}</button>
          )}
        </div>
      );
    });
  };

  const panel = (
    <div className="party-panel">
      {mode && <div className="party-mode">{mode.emoji} <b>{mode.name}</b><small>{mode.blurb}</small></div>}
      <div className="mods">
        <h4>You</h4>{modList(me)}
        {other && <><h4>{names[other]}</h4>{modList(other)}</>}
      </div>
      <button
        className={`mission-card ${peek ? 'open' : ''} ${live_ ? 'live' : ''}`}
        onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}
        onKeyDown={(e) => e.key === ' ' && setPeek(true)} onKeyUp={() => setPeek(false)}
        aria-label="Hold to see your secret mission"
      >
        {peek && missionText ? <>🎯 <b>{missionText.name}</b><small>{missionText.blurb}</small></> : <>🤫 Secret mission<small>{live_ ? 'LIVE! Hold to peek' : `Hold to peek · live after move ${party.gate[me] ?? 10}`}</small></>}
      </button>
      {(myCards.length > 0 || (other && (party.cards?.[other]?.length ?? 0) > 0)) && (
        <div className="party-cards">
          <h4>🃏 Your power cards</h4>
          {myCards.length ? (
            <div className="hand-row">
              {myCards.map((id) => {
                const def = cardById(id);
                if (!def) return null;
                const burned = played.includes(id);
                return (
                  <CardTile key={id} c={def} small>
                    <span className="pc-blurb">{def.blurb}</span>
                    {burned ? <span className="pc-kind">🔥 burned</span> : (
                      <button className="btn small" disabled={!myTurn || cardThisTurn || (!!cardAim && cardAim.id !== id)} onClick={() => (cardAim?.id === id ? setCardAim(null) : playCard(id))}>
                        {cardAim?.id === id ? 'Cancel' : def.usesMove ? 'Play (uses move)' : 'Play (free)'}
                      </button>
                    )}
                  </CardTile>
                );
              })}
            </div>
          ) : <p className="muted small">No cards this game.</p>}
          {other && (party.cards?.[other]?.length ?? 0) > 0 && (
            <p className="muted small">{names[other]} has: {party.cards![other]!.map((id) => `${cardById(id)?.emoji} ${cardById(id)?.name}${playedCards(live, other).includes(id) ? ' (used)' : ''}`).join(' · ')}</p>
          )}
        </div>
      )}
      {clockLeft !== null && <div className={`clock running ${clockLeft <= 3 ? 'panic' : 'low'}`}>⏱️ {clockLeft}</div>}
    </div>
  );

  const modal = warn ? (
    <div className="promo" role="dialog" aria-label="Safety net">
      <p>🥅 Safety net! That move drops a piece. Sure?</p>
      <div className="row center">
        <button className="btn primary" onClick={() => setWarn(null)}>Let me rethink</button>
        <button className="btn" onClick={() => { const m = warn; setWarn(null); push(m); }}>Play it anyway</button>
      </div>
    </div>
  ) : null;

  return {
    active: true,
    targeting: !!aiming || !!cardAim,
    interceptSquare,
    beforeCommit,
    overlays,
    hideHints: has('HCAP-16'),
    lockSelection: has('HCAP-04') && selected !== null,
    panel,
    banner: cardAim ? `${cardById(cardAim.id)?.emoji} ${cardById(cardAim.id)?.taps[cardAim.taps.length]?.prompt} (tap Cancel to stop)` : aiming ? `${modifierById(aiming.id)?.emoji} ${PROMPTS[aiming.target][aiming.taps.length]} (tap the button again to cancel)` : null,
    modal,
    toast,
  };
}
