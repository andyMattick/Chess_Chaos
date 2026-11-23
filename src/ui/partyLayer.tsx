import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MissionPictureView } from './MissionPictureView';
import { requestRanking } from '../ai/client';
import { bonusById, missionById, modifierById, PARTY_HINTS, type BuffTarget } from '../content/party';
import { fileOf, rankOf } from '../core/board';
import { legalActions } from '../core/rules';
import { toSAN } from '../core/san';
import { MODE_INFO } from '../core/modes';
import { makeMove } from '../core/movegen';
import { play } from '../core/rules';
import type { Action, GameState, MoveAction, PlayerId } from '../core/types';
import type { PartySetup } from '../systems/party';
import { missionIsOpen, missionsLive, missionWinsAtOnce } from '../systems/party';
import { missionChallenges } from '../core/rules';
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
  /** No take-backs (HCAP-24): no Take back button and no retry. */
  noTakeBacks: boolean;
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

function other_(p: PlayerId): PlayerId {
  return p === 'p1' ? 'p2' : 'p1';
}

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
  // Party hints (the 💡 button). Tax and Toll road spend them.
  const [hintsLeft, setHintsLeft] = useState(PARTY_HINTS);
  const charged = useRef(live.ply);
  // Scout: armed, then the next move you pick shows their best answer first.
  const [scoutArmed, setScoutArmed] = useState(false);
  const [scouted, setScouted] = useState<{ m: MoveAction; reply: string | null; arrow: { from: number; to: number } | null } | null>(null);
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
    if (party && party.missions[me] && live_ && !announced.current) { announced.current = true; say(missionWinsAtOnce(party, me) ? '🎯 Missions are LIVE! Do yours and you win at once.' : '🎯 Secret missions are LIVE! Do yours, then keep it safe through their next turn to win.'); }
  }, [live_, party]);

  // Tax (HCAP-10) and Toll road (HCAP-23): your own move can cost a hint.
  useEffect(() => {
    if (!party || live.ply <= charged.current) { charged.current = live.ply; return; }
    charged.current = live.ply;
    const l = live.last;
    if (!l || l.by !== me) return;
    const centre = live.board.width === 8 && live.board.height === 8 && [3, 4].includes(fileOf(live.board, l.to)) && [3, 4].includes(rankOf(live.board, l.to));
    const why = mine.includes('HCAP-10') && l.captured ? '💸 Tax: that capture cost a hint.' : mine.includes('HCAP-23') && centre ? '🚧 Toll road: the middle cost a hint.' : null;
    if (why && hintsLeft > 0) { setHintsLeft((h) => Math.max(0, h - 1)); say(why); }
  }, [live.ply]); // eslint-disable-line react-hooks/exhaustive-deps

  // Secret missions shown and stopped (owner rule: the other player gets a few turns to undo it).
  const challenges = missionChallenges(live);
  const offMap = (live.modeData?.missionsOff as Partial<Record<PlayerId, string>> | undefined) ?? {};
  const chKey = Object.entries(challenges).map(([o, c]) => `${o}:${c!.id}`).join(',');
  const offKey = Object.keys(offMap).join(',');
  const seen = useRef({ ch: '', off: '' });
  useEffect(() => {
    if (!party) return;
    if (chKey && chKey !== seen.current.ch) {
      const [owner, c] = Object.entries(challenges).find(([o]) => !seen.current.ch.includes(o)) ?? Object.entries(challenges)[0];
      const def = missionById(c!.id);
      say(owner === me ? `🎯 You did your secret mission: ${def?.name}! Now hold on!` : `⚠️ ${names[owner as PlayerId]} did a secret mission: ${def?.name}! Stop it!`);
    }
    if (offKey && offKey !== seen.current.off) {
      const owner = (Object.keys(offMap) as PlayerId[]).find((o) => !seen.current.off.includes(o)) ?? (Object.keys(offMap)[0] as PlayerId);
      const def = missionById(offMap[owner]!);
      say(owner === me ? `🛡️ ${names[other_(owner)]} stopped your ${def?.name}. Keep playing!` : `🛡️ You stopped ${def?.name}! It is out of the game.`);
    }
    seen.current = { ch: chKey, off: offKey };
  }, [chKey, offKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
    return { active: false, targeting: false, interceptSquare: () => false, beforeCommit: () => true, hideHints: false, noTakeBacks: false, lockSelection: false, panel: null, banner: null, modal: null, toast: null };
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
    if (id === 'BUFF-04') { setScoutArmed((x) => !x); return; }
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
    // BUFF-04 scout: show their best answer before the move counts.
    if (scoutArmed && !used('BUFF-04')) {
      setScoutArmed(false);
      setUsedLocal((u) => [...u, 'BUFF-04']);
      let after: GameState;
      try { after = play(live, m); } catch { return true; }
      if (after.result || after.turn === me) { setScouted({ m, reply: null, arrow: null }); return false; }
      setScouted({ m, reply: '…', arrow: null });
      requestRanking(after, 1).then((r) => {
        const best = r[0]?.move;
        setScouted((x) => (x && x.m === m ? { m, reply: best ? toSAN(after, best) : null, arrow: best ? { from: after.pieces[best.piece].at, to: best.to } : null } : x));
      });
      return false;
    }
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
    // Shown missions: mark the pieces that did it.
    for (const c of Object.values(challenges)) {
      const def = missionById(c!.id);
      if (!def || c!.id === 'MISSION-18') continue;
      for (const id of c!.target) {
        const p = live.pieces[id];
        if (p && p.at >= 0) (o.badges ??= new Map()).set(p.at, '🎯');
      }
    }
    if (scouted?.arrow) o.arrows = [{ ...scouted.arrow, color: '#ff8a3d', label: '?' }];
    // Fog (HCAP-01) and Blind spot (HCAP-08): squares you cannot see. Lifted when the game ends.
    if (!live.result && (has('HCAP-01') || has('HCAP-08'))) {
      const fog = new Set<number>();
      if (has('HCAP-01')) {
        const seen = new Set<number>();
        for (const p of live.pieces) if (p.at >= 0 && p.owner === me) seen.add(p.at);
        for (const m of legalActions({ ...live, turn: me })) seen.add(m.to);
        live.sq.forEach((_, i) => { if (!seen.has(i) && !live.board.blocked[i]) fog.add(i); });
      }
      const blind = (live.modeData?.blindFile as Partial<Record<PlayerId, number>> | undefined)?.[me];
      if (has('HCAP-08') && blind !== undefined) live.sq.forEach((_, i) => { if (fileOf(live.board, i) === blind && !live.board.blocked[i]) fog.add(i); });
      // Your own pieces always show.
      for (const p of live.pieces) if (p.at >= 0 && p.owner === me) fog.delete(p.at);
      o.fog = fog;
    }
    // Costume party (HCAP-21): their pieces look the same until each one has moved.
    if (!live.result && has('HCAP-21')) o.disguise = new Set(live.pieces.filter((p) => p.at >= 0 && p.owner !== me && !p.moved).map((p) => p.at));
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
      const oneShot = who === me && d.kind === 'buff' && (d.oneShot || ['BUFF-03', 'BUFF-04', 'BUFF-12', 'BUFF-19'].includes(id));
      return (
        <div key={id} className={`mod ${d.kind}`} title={d.blurb}>
          <span className="mod-emoji">{d.emoji}</span>
          <span><b>{d.name}</b><small>{d.blurb}</small></span>
          {oneShot && (
            <button className="btn small" disabled={!myTurn || used(id) || (!!aiming && aiming.id !== id)} onClick={() => (aiming?.id === id ? setAiming(null) : useBuff(id))}>{used(id) ? 'used' : aiming?.id === id || (id === 'BUFF-04' && scoutArmed) ? 'Cancel' : 'Use!'}</button>
          )}
        </div>
      );
    });
  };

  function missionBanner(): string | null {
    const turnsWord = (n: number) => (n <= 1 ? 'this turn' : `${n} turns`);
    for (const [owner, c] of Object.entries(challenges) as [PlayerId, NonNullable<(typeof challenges)[PlayerId]>][]) {
      const def = missionById(c.id);
      if (!def) continue;
      const left = Math.max(1, c.left);
      if (owner === me) return `🎯 Secret mission shown: ${def.name}! ${names[other_(me)]} has ${turnsWord(left)} to undo it. Keep it safe!`;
      return `⚠️ ${names[owner]}'s secret mission: ${def.name}. ${def.stop} You have ${turnsWord(left)}.`;
    }
    return null;
  }
  const myChallenge = challenges[me];
  const myOff = offMap[me];

  const panel = (
    <div className="party-panel">
      {mode && <div className="party-mode">{mode.emoji} <b>{mode.name}</b><small>{mode.blurb}</small></div>}
      <div className="mods">
        <h4>You</h4>{modList(me)}
        {other && <><h4>{names[other]}</h4>{modList(other)}</>}
      </div>
      {myMission && (
      <button
        className={`mission-card ${peek ? 'open' : ''} ${live_ ? 'live' : ''}`}
        onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}
        onKeyDown={(e) => e.key === ' ' && setPeek(true)} onKeyUp={() => setPeek(false)}
        aria-label="Hold to see your secret mission"
      >
        {myOff ? <>🛡️ <b>{missionById(myOff)?.name}</b><small>Stopped. It is out of the game.</small></>
          : myChallenge ? <>🎯 <b>{missionById(myChallenge.id)?.name}</b><small>Shown! Keep it safe for {Math.max(1, myChallenge.left)} more {myChallenge.left > 1 ? 'turns' : 'turn'}.</small></>
          : missionIsOpen(party, me) && missionText ? <>🎯 <b>{missionText.name}</b><small>{missionWinsAtOnce(party, me) ? 'Open mission: do it and you win at once!' : 'Open mission: do it, then keep it safe for one turn.'}</small>{peek && <MissionPictureView id={missionText.id} size={170} />}</>
          : peek && missionText ? <>🎯 <b>{missionText.name}</b><small>{missionText.blurb}</small><MissionPictureView id={missionText.id} size={170} /></> : <>🤫 Secret mission<small>{live_ ? 'LIVE! Hold to peek' : `Hold to peek · live after move ${party.gate[me] ?? 10}`}</small></>}
      </button>
      )}
      {other && !missionIsOpen(party, other) && used('BUFF-23') && party.missions[other] && party.missions[other] !== '?' && !offMap[other] && (
        <div className="mission-card live warn-card">👀 <b>Peek: {names[other]}'s secret mission is {missionById(party.missions[other]!)?.name}</b><small>{missionById(party.missions[other]!)?.blurb} {missionById(party.missions[other]!)?.stop}</small><MissionPictureView id={party.missions[other]!} size={150} /></div>
      )}
      {party.bonus && Object.keys(party.bonus).length > 0 && (
        <div className="bonus-goals">
          {(Object.entries(party.bonus) as [PlayerId, string][]).map(([who, id]) => {
            const b = bonusById(id);
            return b ? <div key={who} className="mod buff"><span className="mod-emoji">{b.emoji}</span><span><b>{who === me ? 'Your bonus' : `${names[who]}'s bonus`}: {b.name}</b><small>{b.blurb} Done when the game ends: pick a card!</small></span></div> : null;
          })}
        </div>
      )}
      {(
        <div className="row wrap party-hints">
          <button className="btn small" disabled={!myTurn || hintsLeft <= 0 || has('HCAP-16') || hint !== null} onClick={() => { setHintsLeft((h) => h - 1); requestRanking(live, 2).then((r) => { if (r[0]) setHint(live.pieces[r[0].move.piece].at); }); }}>💡 Hint ({hintsLeft} left)</button>
          {(has('HCAP-10') || has('HCAP-23')) && <small className="muted">{has('HCAP-10') ? '💸 Captures cost a hint. ' : ''}{has('HCAP-23') ? '🚧 Middle squares cost a hint.' : ''}</small>}
        </div>
      )}
      {other && missionIsOpen(party, other) && party.missions[other] && party.missions[other] !== '?' && !offMap[other] && (
        <div className="mission-card live warn-card">⚠️ <b>{names[other]}'s mission: {missionById(party.missions[other]!)?.name}</b><small>{missionById(party.missions[other]!)?.blurb} {missionWinsAtOnce(party, other) ? 'If they do it, they win at once!' : 'If they do it, you get one turn to stop it!'}</small></div>
      )}
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
            <>
              <h4>🃏 {names[other]}'s cards</h4>
              <div className="hand-row">
                {party.cards![other]!.map((id) => cardById(id) && (
                  <CardTile key={id} c={cardById(id)!} small>
                    <span className="pc-blurb">{cardById(id)!.blurb}</span>
                    {playedCards(live, other).includes(id) && <span className="pc-kind">🔥 used</span>}
                  </CardTile>
                ))}
              </div>
            </>
          )}
          <p className="muted small">At the end, the winner takes one of the loser's cards. All other cards brought in are used up.</p>
        </div>
      )}
      {clockLeft !== null && <div className={`clock running ${clockLeft <= 3 ? 'panic' : 'low'}`}>⏱️ {clockLeft}</div>}
    </div>
  );

  const modal = scouted ? (
    <div className="promo" role="dialog" aria-label="Scout">
      <p>🔭 Scout: {scouted.reply === '…' ? <span className="thinking-dots">looking ahead</span> : scouted.reply ? <>if you play that, their best answer is <b>{scouted.reply}</b> (the orange arrow).</> : <>that move ends it, or they have no answer.</>}</p>
      <div className="row center">
        <button className="btn primary" onClick={() => setScouted(null)}>Pick another move</button>
        <button className="btn" disabled={scouted.reply === '…'} onClick={() => { const m = scouted.m; setScouted(null); push(m); }}>Play it</button>
      </div>
    </div>
  ) : warn ? (
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
    noTakeBacks: has('HCAP-24'),
    lockSelection: has('HCAP-04') && selected !== null,
    panel,
    banner: scoutArmed ? '🔭 Scout is on: pick a move and see their best answer before it counts.' : cardAim ? `${cardById(cardAim.id)?.emoji} ${cardById(cardAim.id)?.taps[cardAim.taps.length]?.prompt} (tap Cancel to stop)` : aiming ? `${modifierById(aiming.id)?.emoji} ${PROMPTS[aiming.target][aiming.taps.length]} (tap the button again to cancel)` : missionBanner(),
    modal,
    toast,
  };
}
