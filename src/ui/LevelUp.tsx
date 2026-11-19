import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  BASE_ICON, LEVEL_AT, LU_PIECES, LU_ROLES, RACE_FACE_UP, XP, XP_RULES, missionById, type LUType,
} from '../content/levelup';
import { chooseAction, type LUBotLevel } from '../levelup/ai';
import {
  H, SQUARES, W, actor, pieceAt, battleOdds, isWall, fileOf, identified, inCheck, legalActions, level, newGame, play, rankOf, strikeOdds, stunned, viewOf, visible,
  type LUAction, type LUEvent, type LUPiece, type LUState, type Side,
} from '../levelup/rules';
import { activeProfile, updateProfile } from '../storage/storage';
import { luReplay, type MailGame } from '../net/world';
import { luSession, useLuRoom } from '../net/luClient';
import { roomServerUrl } from '../net/client';
import { EMOTES } from '../net/protocol';
import { fetchLadder, getGame, joinLadder, labelFor, ladderChallenge, leaveLadder, resignMail, sendLiveInvite, sendLuMove } from '../storage/world';
import { LADDER_REACH, type LadderRow } from '../net/world';
import { vaultBase } from '../storage/cloud';
import { NumberPrompt } from './CloudSave';
import { noteDaily } from '../storage/daily';
import { luSfx } from './sound';
import { LU_ARTS, luGrass, luSprite, type LUArt } from './luTheme';
import { update } from '../storage/storage';
import { useSave } from './store';

/**
 * Level-Up Chess (owner, 2026-11-19): pieces earn points for good chess and
 * level up; every attack is a dice battle; fog of war; a forest that the
 * fighting clears. You (bottom, blue) against a bot (top, red).
 */
const CELL = 12;

type Popup =
  | { k: 'battle'; title: string; att: LUPiece; def: LUPiece; a?: [number, number]; d?: [number, number]; roll?: number; outcome: 'win' | 'bounce' | 'crushed'; why: string; mine: boolean }
  | { k: 'level'; piece: LUPiece; lv: number; why: string }
  | { k: 'mission'; text: string; sub: string };

const nameOf = (p: LUPiece) => (p.type === 'scout' && level(p) >= 3 ? 'Assassin' : p.type === 'scout' && level(p) === 2 ? 'Spy' : LU_PIECES[p.type].name);

function pieceLine(p: LUPiece): string {
  const lv = level(p);
  return lv >= 3 ? `${nameOf(p)} · Lv 3 · ${p.xp} pts · MAX` : `${nameOf(p)} · Lv ${lv} · ${p.xp}/${(LEVEL_AT as readonly number[])[lv]} pts to Lv ${lv + 1}`;
}

export function LevelUpScreen({ back, mail, challengeFriend, joinCode }: { back: () => void; mail?: MailGame; challengeFriend?: () => void; joinCode?: string }) {
  const save = useSave();
  const p = activeProfile(save);
  const art: LUArt = save.settings.luArt ?? '8bit';
  const sprite = (name: Parameters<typeof luSprite>[1], side?: 'p1' | 'p2') => luSprite(art, name, side);
  const setArt = (a: LUArt) => update((d) => ({ ...d, settings: { ...d.settings, luArt: a } }));
  // A challenge: you play your seat against a friend, a move at a time (owner, 2026-11-19).
  // Live: a room with a code, moves as they happen (owner, 2026-11-19).
  const room = useLuRoom();
  // Opened from an invite or a link: join that room straight away.
  const [live, setLive] = useState(() => {
    if (!joinCode) return false;
    luSession.join(joinCode, activeProfile()?.nickname ?? 'Player');
    return true;
  });
  const ME: Side = live ? room.seat ?? 'p1' : mail && mail.players.p2 === p?.cloud?.number ? 'p2' : 'p1';
  const flip = ME === 'p2';
  const them = mail ? labelFor(p, mail.players[ME === 'p1' ? 'p2' : 'p1']) : live ? room.seats[ME === 'p1' ? 'p2' : 'p1']?.name ?? 'your friend' : '';
  /** Live: how many of the room's actions this screen has played, and for which game (seed). */
  const liveApplied = useRef(0);
  const liveSeed = useRef<number | null>(null);
  const [bot, setBot] = useState<LUBotLevel | null>(null);
  const [s, setS] = useState<LUState | null>(() => (mail?.lu ? luReplay(mail) : null));
  const [note, setNote] = useState<string | null>(null);
  /** Level-Up actions the server has (the guard for a move sent twice). */
  const served = useRef(mail?.lu?.actions.length ?? 0);
  const [sel, setSel] = useState<number | null>(null);
  const [mode, setMode] = useState<'go' | 'special' | 'mark' | 'mine' | 'off' | 'defuse' | 'clear' | 'wall'>('go');
  const [look, setLook] = useState<number | null>(null);
  /** The piece under the mouse: its card shows while you point at it. */
  const [hover, setHover] = useState<number | null>(null);
  const [pops, setPops] = useState<Popup[]>([]);
  /** What the other side did on its turn, shown on the board when it is your move again. */
  const [report, setReport] = useState<{ lines: string[]; at: number } | null>(null);
  const turnReport = useRef<string[]>([]);
  const [log, setLog] = useState<string[]>(() => (mail ? [`Your challenge against ${them}. ${ME === 'p1' ? 'Blue' : 'Red'} is your army.`] : []));
  const [menu, setMenu] = useState<'points' | 'help' | null>(null);
  const recorded = useRef(false);

  const view = useMemo(() => (s ? viewOf(s, ME) : null), [s, ME]);
  const legal = useMemo(() => (s && actor(s) === ME ? legalActions(s) : []), [s, ME]);

  // A live room this device is in: reconnect now, so the box shows who is there and the seat stays ours.
  useEffect(() => { if (!live && hasLiveGame()) luSession.resume(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: follow the room. A new seed is a new game; new actions are played in turn (with their pop-ups).
  useEffect(() => {
    if (!live || room.seed === null) return;
    if (room.seed !== liveSeed.current || room.actions.length < liveApplied.current) {
      let g = newGame(room.seed);
      for (const a of room.actions) g = play(g, a, false);
      const fresh = room.seed !== liveSeed.current;
      liveSeed.current = room.seed;
      liveApplied.current = room.actions.length;
      setS(g); setSel(null); setPops([]);
      if (fresh) { recorded.current = false; setLog([`Live game! You are ${room.seat === 'p1' ? 'Blue (you move first)' : 'Red'}. Room ${room.code}.`]); }
      return;
    }
    if (room.actions.length > liveApplied.current && s) {
      let cur = s;
      for (const a of room.actions.slice(liveApplied.current)) { const nx = play(cur, a, false); after(cur, nx); cur = nx; }
      liveApplied.current = room.actions.length;
      setS(cur);
    }
  }, [live, room.seed, room.actions]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (live && room.emote && room.emote.from !== ME) setLog((l) => [`${them}: ${EMOTES.find((e) => e.id === room.emote!.id)?.text}`, ...l].slice(0, 30));
  }, [room.emote?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  function start(level: LUBotLevel) {
    const g = newGame((Date.now() ^ Math.floor(Math.random() * 1e9)) | 0);
    setBot(level); setS(g); setSel(null); setPops([]); setLog(['The battle begins! Clear the forest and level up your army.']); recorded.current = false;
  }

  // Turn what happened into pop-ups and log lines (only what you could see).
  function after(prev: LUState, next: LUState) {
    const v = viewOf(next, ME);
    const ps: Popup[] = [];
    const lines: string[] = [];
    const seenPiece = (id: number) => { const q = next.pieces[id]; return q.owner === ME || q.known.includes(ME) || visible(next, v, ME, q); };
    const label = (id: number) => { const q = next.pieces[id]; return q.owner === ME ? `your ${nameOf(q)}` : q.known.includes(ME) ? `their ${nameOf(q)}` : 'an enemy'; };
    for (const e of next.events as LUEvent[]) {
      switch (e.k) {
        case 'battle': {
          const mine = next.pieces[e.att].owner === ME;
          ps.push({ k: 'battle', title: mine ? 'You attack!' : 'You are attacked!', att: { ...prev.pieces[e.att], known: ['p1', 'p2'] }, def: { ...prev.pieces[e.def], known: ['p1', 'p2'] }, a: e.a, d: e.d, outcome: e.outcome, why: e.why, mine });
          lines.push(`⚔ ${label(e.att)} vs ${label(e.def)}: ${e.a[1]} – ${e.d[1]}. ${e.outcome === 'win' ? 'Victory!' : e.outcome === 'crushed' ? 'Crushed!' : 'Bounced off.'}`);
          break;
        }
        case 'strike': {
          const mine = next.pieces[e.att].owner === ME;
          ps.push({ k: 'battle', title: mine ? 'Your scout strikes!' : 'A scout strikes!', att: { ...prev.pieces[e.att], known: ['p1', 'p2'] }, def: { ...prev.pieces[e.def], known: ['p1', 'p2'] }, roll: e.roll, outcome: e.outcome, why: e.outcome === 'win' ? 'Struck true' : e.outcome === 'crushed' ? 'Rolled a 1!' : 'Missed', mine });
          lines.push(`🗡 ${label(e.att)} strikes ${label(e.def)}: rolled ${e.roll}.`);
          break;
        }
        case 'levelup':
          if (next.pieces[e.piece].owner === ME) ps.push({ k: 'level', piece: next.pieces[e.piece], lv: e.level, why: e.why });
          else if (seenPiece(e.piece)) lines.push(`★ ${label(e.piece)} reached Lv ${e.level}!`);
          break;
        case 'xp': if (next.pieces[e.piece].owner === ME) lines.push(`+${e.points} ${e.why} (${nameOf(next.pieces[e.piece])})`); break;
        case 'mission': {
          const m = missionById(e.id)!;
          if (e.side === ME) ps.push({ k: 'mission', text: e.kind === 'secret' ? `Secret mission done: ${m.name}!` : `Mission card won: ${m.name}!`, sub: e.kind === 'secret' ? 'Bonus points, and a win now is a Complete win.' : 'Bonus points for the piece that did it.' });
          else if (e.kind === 'global') lines.push(`🏁 The enemy claimed "${m.name}".`);
          break;
        }
        case 'shot': lines.push(e.by === ME ? '🎯 Target marked. Fire on your next turn!' : '⚠ A bombardier has marked a target! Move off the red square.'); if (e.by !== ME) luSfx.warn(); break;
        case 'hit': lines.push(`💥 Bombardier hit ${label(e.piece)}!`); luSfx.boom(); break;
        case 'miss': lines.push('💨 The shot landed on an empty square.'); break;
        case 'shield': lines.push('🛡 A rook blocked the shot!'); break;
        case 'boom': lines.push(`💣 A mine blew up ${label(e.piece)}!`); luSfx.boom(); break;
        case 'revive': lines.push(`✚ ${label(e.piece)} is back in the fight!`); break;
        case 'role': if (next.pieces[e.piece].owner === ME) lines.push(`🎓 Your scout is now a ${LU_ROLES.find((r) => r.role === e.role)?.name}!`); break;
        case 'reload': if (next.pieces[e.piece].owner === ME) lines.push('🔄 Bombardier reloaded. Mark a target next turn.'); break;
        case 'defuse': if (next.pieces[e.piece].owner === ME) lines.push(e.roll === 1 ? `🧰 Your miner rolled a 1: the mine went off!` : `🧰 Your miner rolled ${e.roll}: mine defused${e.kept ? ' and picked up!' : '.'}`); else if (seenPiece(e.piece)) lines.push('🧰 An enemy miner defused a mine.'); break;
        case 'stun': if (seenPiece(e.piece)) lines.push(`💫 ${label(e.piece)} is stunned and misses a turn.`); break;
        case 'crew': if (next.pieces[e.piece].owner === ME) lines.push(e.on ? '🪖 A pawn climbed onto your bombardier.' : '🪖 Your crew climbed off: the bombardier can\'t fire without one.'); break;
        case 'crew-lost': lines.push(next.pieces[e.catapult].owner === ME ? '🪖 Your bombardier lost its crew! A pawn next to it can climb on.' : '🪖 An enemy bombardier lost its crew.'); break;
        case 'retrain': if (next.pieces[e.piece].owner === ME) lines.push('✨ Your pawn trained as a scout!'); break;
        case 'tree': if (e.gone) lines.push('🌲 A barricade crashes down.'); else if (isWall(next, e.at)) lines.push('🧱 The wall cracks. One more go to clear it.'); break;
        case 'wall': if (seenPiece(e.piece)) lines.push(next.pieces[e.piece].owner === ME ? '🧱 Your rook built a wall.' : '🧱 An enemy rook built a wall.'); break;
        case 'crater': lines.push('🕳 The blast left a crater. Nobody can cross it now.'); break;
        case 'promote': lines.push(`👑 ${label(e.piece)} reached the far side and became a queen!`); break;
        case 'check': lines.push(e.side === ME ? '⚠ CHECK! Protect your king.' : '⚔ Check!'); break;
      }
    }
    // The other side's turn report (owner, 2026-11-19: "I move, then it tells me to move again").
    const by = actor(prev);
    if (by !== ME && !next.result) {
      const report = [...lines];
      const ended = next.ply > prev.ply;
      if (ended && next.last && !report.some((x) => x.startsWith('⚔') || x.startsWith('🗡'))) {
        const q = pieceAt(next, next.last.to);
        const said = q && q.owner !== ME && v.seen.has(next.last.to)
          ? (identified(v, ME, q) ? `Their ${nameOf(q)} moved.` : 'An enemy moved (you can see it, but not what it is).')
          : !report.length ? 'The enemy moved somewhere in the fog.' : null;
        if (said) { report.unshift(said); lines.push(said); }
      }
      turnReport.current.push(...report.filter((x) => !turnReport.current.includes(x)));
      if (actor(next) === ME && turnReport.current.length) {
        setReport({ lines: turnReport.current.slice(0, 5), at: Date.now() });
        turnReport.current = [];
        luSfx.select();
      }
    } else if (by === ME) turnReport.current = [];
    if (ps.some((x) => x.k === 'battle')) luSfx.dice();
    setPops((q) => [...q, ...ps]);
    if (lines.length) setLog((l) => [...lines.reverse(), ...l].slice(0, 30));
    // Daily missions.
    for (const e of next.events) {
      if (e.k === 'levelup' && next.pieces[e.piece].owner === ME) noteDaily('lu-level');
      if (e.k === 'xp' && e.why === XP.brave.label && next.pieces[e.piece].owner === ME) noteDaily('lu-brave');
    }
  }

  function act(a: LUAction) {
    if (!s) return;
    const next = play(s, a);
    setSel(null); setMode('go');
    after(s, next);
    setS(next);
    if (live) {
      luSession.act(a, liveApplied.current);
      liveApplied.current++;
    }
    if (mail) {
      const ply = served.current;
      setNote(null);
      (a.t === 'resign' ? resignMail(mail.id) : sendLuMove(mail.id, a, ply))
        .then((g) => { served.current = g.lu?.actions.length ?? ply + 1; })
        .catch((e) => {
          setNote(`${(e as Error).message} Your move was not sent.`);
          getGame(mail.id).then((g) => { served.current = g.lu?.actions.length ?? 0; setS(luReplay(g)); }).catch(() => setS(s));
        });
    }
  }

  // Challenges: look for the other player's move now and then.
  useEffect(() => {
    if (!mail || !s || s.result || actor(s) === ME) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      getGame(mail.id).then((g) => {
        const n = g.lu?.actions.length ?? 0;
        if (n <= served.current) return;
        // Show each new action in turn (free bombardier steps, then the move).
        let cur = luReplay({ lu: { seed: g.lu!.seed, actions: g.lu!.actions.slice(0, served.current) } });
        for (const a of g.lu!.actions.slice(served.current)) { const nx = play(cur, a, false); after(cur, nx); cur = nx; }
        served.current = n;
        setS(cur);
      }).catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [s, mail]); // eslint-disable-line react-hooks/exhaustive-deps

  // The bot's turn, once the pop-ups are cleared.
  useEffect(() => {
    if (!s || !bot || mail || live || s.result || actor(s) === ME || pops.length) return;
    const t = setTimeout(() => {
      const a = chooseAction(s, bot);
      if (a) act(a);
    }, 1100);
    return () => clearTimeout(t);
  }, [s, pops.length, bot]); // eslint-disable-line react-hooks/exhaustive-deps

  // The turn report goes after a few seconds (or a tap).
  useEffect(() => {
    if (!report) return;
    const t = setTimeout(() => setReport(null), 4500);
    return () => clearTimeout(t);
  }, [report]);

  // Pop-up sounds; battles clear themselves.
  const top = pops[0];
  useEffect(() => {
    if (!top) return;
    if (top.k === 'level') luSfx.levelUp();
    else if (top.k === 'mission') luSfx.mission();
    else { setTimeout(() => (top.outcome === 'win') === top.mine ? luSfx.win() : luSfx.lose(), 350); luSfx.clash(); }
    if (top.k === 'battle') { const t = setTimeout(() => setPops((q) => q.slice(1)), 2600); return () => clearTimeout(t); }
  }, [top]);

  // The end: record it once.
  useEffect(() => {
    if (!s?.result || recorded.current) return;
    recorded.current = true;
    // A challenge counts once, even when you open it again.
    if (mail && (activeProfile()?.mailDone ?? []).includes(mail.id)) return;
    const won = s.result.winner === ME;
    updateProfile((x) => ({ ...x, levelUp: { played: (x.levelUp?.played ?? 0) + 1, won: (x.levelUp?.won ?? 0) + (won ? 1 : 0) }, ...(mail ? { mailDone: [mail.id, ...(x.mailDone ?? [])].slice(0, 200) } : {}) }));
    noteDaily('lu-play');
    if (won) noteDaily('lu-win');
  }, [s?.result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;

  // ---- Title screen ----
  // Always a way out (owner, 2026-11-19: "I feel trapped"). A live room stays open (come back from the Level-Up screen); a challenge is saved.
  const homeBtn = (
    <button className="lu-btn lu-home" onClick={back} aria-label={mail ? 'Back to Challenges' : 'Home'}>
      {mail ? '◀ 📬 Challenges' : '🏠 Home'}
    </button>
  );
  const bothIn = !!room.seats.p1 && !!room.seats.p2;
  if (live && (!s || !bothIn)) {
    return (
      <div className={`lu ${art}`}>
      {homeBtn}
        <div className="lu-win lu-title">
          <h1>LIVE LEVEL-UP</h1>
          {room.code ? (
            <>
              <p>Room code</p>
              <p className="lu-code">{room.code}</p>
              <p className="lu-small">You are {room.seat === 'p1' ? 'Blue (you move first)' : 'Red'}. {bothIn ? 'Starting…' : 'Waiting for your friend…'}</p>
              {!bothIn && <InviteBox code={room.code} />}
            </>
          ) : <p>{room.error ?? (room.status === 'connecting' ? 'Connecting…' : 'Opening a room…')}</p>}
          {room.error && room.code && <p className="lu-small">{room.error}</p>}
          <div className="lu-row">
            <button className="lu-btn" onClick={() => { setLive(false); setS(null); }}>⏸ Step away (keep the room)</button>
            <button className="lu-btn" onClick={() => { luSession.leave(); setLive(false); setS(null); }}>✖ Close the room</button>
          </div>
          <p className="lu-small">Stepping away keeps your room open: come back from the Level-Up screen. A room with nobody in it closes after 10 minutes.</p>
        </div>
      </div>
    );
  }
  if (!s || (!bot && !mail && !live)) {
    return (
      <div className={`lu ${art}`}>
      {homeBtn}
        {hasLiveGame() && (
          <div className="lu-win lu-back">
            <h2>⚡ Your live room {luSession.savedCode()} is still open</h2>
            {room.code && (() => {
              const other = room.seats[room.seat === 'p1' ? 'p2' : 'p1'];
              return <p className="lu-small">{other ? `${other.name} is in the room${other.connected ? '' : ' (away)'}.` : 'Nobody has joined yet.'}</p>;
            })()}
            <div className="lu-row">
              <button className="lu-btn on" onClick={() => { luSession.resume(); liveSeed.current = null; liveApplied.current = 0; setS(null); setLive(true); }}>↩ Back to it</button>
              <button className="lu-btn" onClick={() => { luSession.leave(); setS(null); }}>✖ Close it</button>
            </div>
          </div>
        )}
        <div className="lu-win lu-title">
          <h1>LEVEL-UP CHESS</h1>
          <p>Every good move earns points. Pieces level up and gain new powers. Every attack is a dice battle. The forest hides the enemy.</p>
        </div>
        <div className="lu-win">
          <h2>▶ Choose your foe</h2>
          <div className="lu-row">
            <button className="lu-btn" onClick={() => start('easy')}>Squire (easy)</button>
            <button className="lu-btn" onClick={() => start('normal')}>Knight (normal)</button>
            <button className="lu-btn" onClick={() => start('hard')}>Warlord (hard)</button>
          </div>
          {p.levelUp && <p className="lu-small">Battles fought: {p.levelUp.played} · won: {p.levelUp.won}</p>}
        </div>
        {roomServerUrl() && <LiveWindow name={p.nickname} go={() => { liveSeed.current = null; liveApplied.current = 0; setS(null); setLive(true); }} />}
        {challengeFriend && (
          <div className="lu-win">
            <h2>▶ Play a person, a move at a time</h2>
            <p className="lu-small">Challenge a friend by their player number. You each take your turn whenever you like (a move at a time), and the game waits in 📬 Challenges. Or join the ladder below.</p>
            <button className="lu-btn" onClick={challengeFriend}>⚔ Challenge a friend</button>
          </div>
        )}
        <div className="lu-row">
          <button className="lu-btn" onClick={() => setMenu('help')}>How to play</button>
          <button className="lu-btn" onClick={() => setMenu('points')}>How to earn points</button>
          <button className="lu-btn" onClick={back}>◀ Back</button>
        </div>
        <div className="lu-win">
          <h2>🎨 Look</h2>
          <div className="lu-row">
            {LU_ARTS.map((a) => <button key={a.id} className={`lu-btn ${art === a.id ? 'on' : ''}`} onClick={() => setArt(a.id)}>{a.label}</button>)}
            <span className="lu-row lu-preview">{(['knight', 'queen', 'catapult', 'tree'] as const).map((n) => <img key={n} src={sprite(n, 'p1')} alt="" />)}<img src={sprite('rook', 'p2')} alt="" /></span>
          </div>
        </div>
        {vaultBase() && <LadderWindow />}
        {menu && <Menu which={menu} close={() => setMenu(null)} />}
      </div>
    );
  }

  // ---- The battle ----
  const v = view!;
  // Your own army is always at the bottom: Red sees the board turned round.
  const px = (sq: number) => (flip ? W - 1 - fileOf(sq) : fileOf(sq)) * CELL;
  const py = (sq: number) => (flip ? rankOf(sq) : H - 1 - rankOf(sq)) * CELL;
  const selPiece = sel !== null ? s.pieces[sel] : null;
  const selActs = selPiece ? legal.filter((a) => 'piece' in a && a.piece === selPiece.id) : [];
  const special = selActs.filter((a) => a.t === 'revive');
  const tgt = (a: LUAction) => ('at' in a ? a.at : 'to' in a ? a.to : -1);
  const shown = selActs.filter((a) => {
    switch (mode) {
      case 'mark': return a.t === 'mark';
      case 'mine': return a.t === 'move' && !!a.mine;
      case 'off': return a.t === 'unboard';
      case 'defuse': return a.t === 'defuse';
      case 'clear': return a.t === 'clear';
      case 'wall': return a.t === 'wall';
      case 'special': return false;
      default: return (a.t === 'move' && !a.mine) || a.t === 'attack' || a.t === 'strike' || a.t === 'castle';
    }
  });
  const pick = (t: LUAction['t']) => selActs.find((a) => a.t === t);
  const looked = hover !== null && s.pieces[hover]?.at >= 0 ? s.pieces[hover] : look !== null ? s.pieces[look] : selPiece;
  const myTurn = actor(s) === ME && !s.result && !pops.length;
  const roles = legal.filter((a): a is Extract<LUAction, { t: 'role' }> => a.t === 'role');

  function tap(sq: number) {
    if (!s || !myTurn || roles.length) return;
    const target = shown.find((a) => tgt(a) === sq);
    if (target) { act(target); return; }
    const q = s.sq[sq] >= 0 ? s.pieces[s.sq[sq]] : null;
    if (q && q.owner === ME) { luSfx.select(); setSel(q.id === sel ? null : q.id); setMode('go'); setLook(null); return; }
    if (q && visible(s, v, ME, q)) { setLook(q.id); return; }
    setSel(null); setLook(null);
  }

  const cells: ReactElement[] = [];
  for (let sq = 0; sq < SQUARES; sq++) {
    const x = px(sq), y = py(sq);
      cells.push(<rect key={`g${sq}`} x={x} y={y} width={CELL} height={CELL} fill={luGrass(art, fileOf(sq), rankOf(sq))} />);
  }
  const things: ReactElement[] = [];
  for (let sq = 0; sq < SQUARES; sq++) {
    const x = px(sq), y = py(sq);
    if ((s.craters ?? []).includes(sq)) things.push(<image key={`c${sq}`} href={sprite('crater')} x={x} y={y} width={CELL} height={CELL} />);
    if (s.trees[sq] > 0) things.push(<image key={`t${sq}`} href={sprite(isWall(s, sq) ? (s.trees[sq] > 1 ? 'wall' : 'wall-cracked') : s.trees[sq] > 1 ? 'tree' : 'stump')} x={x} y={y} width={CELL} height={CELL} />);
    const mine = s.mines.find((m) => m.at === sq);
    if (mine && v.mines.has(sq)) things.push(<image key={`m${sq}`} href={sprite('mine')} x={x} y={y} width={CELL} height={CELL} opacity={0.9} />);
  }
  const pieces = s.pieces.filter((q) => q.at >= 0 && visible(s, v, ME, q)).map((q) => {
    const x = px(q.at), y = py(q.at);
    const known = identified(v, ME, q);
    const lv = level(q);
    return (
      <g key={`p${q.id}`} className={`lu-piece ${sel === q.id ? 'sel' : ''}`}>
        <title>{known ? `${q.owner === ME ? '' : 'Enemy '}${pieceLine(q)} · ${q.base} base` : 'Unknown enemy: watch how it moves!'}</title>
        {sel === q.id && <rect x={x + 0.3} y={y + 0.3} width={CELL - 0.6} height={CELL - 0.6} className="lu-selbox" />}
        <image href={sprite(known ? q.type : 'mystery', q.owner)} x={x} y={y} width={CELL} height={CELL} opacity={(q.owner === ME && q.type === 'scout' && lv >= 2) || (q.type === 'catapult' && q.crew === undefined) ? 0.55 : 1} />
        {known && lv > 1 && <text x={x + CELL - 0.5} y={y + 3.6} className="lu-lv" textAnchor="end">{lv === 3 ? '★' : '2'}</text>}
        {known && <text x={x + 0.6} y={y + CELL - 0.6} className={`lu-base ${q.owner}`}>{BASE_ICON[q.base]}</text>}
        {stunned(s, q) && <text x={x + CELL / 2} y={y + 3.4} textAnchor="middle" className="lu-stun">💫</text>}
        {/* The crew pawn rides on the bombardier: drawn small on top. No crew: a faded bombardier with "no crew". */}
        {q.type === 'catapult' && q.crew !== undefined && <image href={sprite('pawn', q.owner)} x={x + CELL * 0.02} y={y - CELL * 0.04} width={CELL * 0.52} height={CELL * 0.52} />}
        {q.type === 'catapult' && q.crew === undefined && <text x={x + CELL / 2} y={y + 3.6} textAnchor="middle" className="lu-nocrew">NO CREW</text>}
        {q.type === 'catapult' && q.owner === ME && q.crew !== undefined && <text x={x + CELL - 0.5} y={y + CELL - 0.6} textAnchor="end" className="lu-load">{q.load === 'loaded' ? '●' : q.load === 'aimed' ? '◎' : '○'}</text>}
      </g>
    );
  });
  const fog: ReactElement[] = [];
  for (let sq = 0; sq < SQUARES; sq++) if (!v.seen.has(sq)) fog.push(<rect key={`f${sq}`} x={px(sq)} y={py(sq)} width={CELL} height={CELL} className="lu-fog" />);
  const marks: ReactElement[] = [];
  for (const shot of s.shots) {
    const x = px(shot.at), y = py(shot.at);
    marks.push(<g key={`s${shot.at}`} className={shot.by === ME ? 'lu-aim' : 'lu-incoming'}><rect x={x + 0.5} y={y + 0.5} width={CELL - 1} height={CELL - 1} /><text x={x + CELL / 2} y={y + CELL / 2 + 2.5} textAnchor="middle">{shot.by === ME ? '◎' : '!'}</text></g>);
  }
  if (s.last) for (const sq of [s.last.from, s.last.to]) if (sq >= 0 && v.seen.has(sq)) marks.push(<rect key={`l${sq}`} x={px(sq) + 0.4} y={py(sq) + 0.4} width={CELL - 0.8} height={CELL - 0.8} className={`lu-last ${report ? 'flash' : ''}`} />);
  if (mode === 'mine' && selPiece) marks.push(<text key="drop" x={px(selPiece.at) + CELL / 2} y={py(selPiece.at) + CELL / 2 + 2.5} textAnchor="middle" className="lu-drop">💣</text>);
  for (const a of shown) {
    const to = tgt(a);
    if (to < 0) continue;
    const x = px(to), y = py(to);
    const enemy = a.t === 'attack' || a.t === 'strike' ? s.pieces[s.sq[to]] : null;
    let odds = '';
    if (enemy && selPiece && (a.t === 'attack' || a.t === 'strike')) {
      const w = a.t === 'attack' ? battleOdds(s, selPiece, enemy).win : strikeOdds(selPiece).win;
      odds = identified(v, ME, enemy) || a.t === 'strike' ? `${Math.round(w * 100)}%` : '?';
    }
    const kind = a.t === 'attack' || a.t === 'strike' ? 'hit' : a.t === 'mark' ? 'fire' : a.t === 'defuse' ? 'mine' : a.t === 'clear' || a.t === 'wall' ? 'build' : 'go';
    marks.push(
      <g key={`a${a.t}${to}`} className={`lu-target ${kind}`} onClick={() => tap(to)}>
        <rect x={x} y={y} width={CELL} height={CELL} />
        {kind === 'go' && <rect x={x + 4.5} y={y + 4.5} width={3} height={3} className="lu-dot" />}
        {kind === 'fire' && <text x={x + CELL / 2} y={y + CELL / 2 + 2.5} textAnchor="middle">◎</text>}
        {kind === 'mine' && <text x={x + CELL / 2} y={y + CELL / 2 + 2.5} textAnchor="middle">✱</text>}
        {kind === 'build' && <text x={x + CELL / 2} y={y + CELL / 2 + 2.5} textAnchor="middle">{a.t === 'clear' ? '🪓' : '🧱'}</text>}
        {odds && <text x={x + CELL / 2} y={y + 4} textAnchor="middle" className="odds">{odds}</text>}
      </g>,
    );
  }

  const revives = selActs.filter((a): a is Extract<LUAction, { t: 'revive' }> => a.t === 'revive');

  /** The buttons for the picked piece: modes for squares to tap, and one-tap actions. */
  function Controls() {
    if (!selPiece || !myTurn) return null;
    const p = selPiece;
    const modeBtn = (m: typeof mode, label: string) => <button key={m} className={`lu-btn ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>{label}</button>;
    const now = (a: LUAction | undefined, label: string) => a && <button key={a.t} className="lu-btn" onClick={() => act(a)}>{label}</button>;
    const btns: (ReactElement | undefined | false)[] = [];
    let note = '';
    if (p.type === 'catapult') {
      note = p.crew === undefined ? 'No crew: a pawn next to it must climb on before it can move or fire.'
        : `Crew on board · ${p.load === 'loaded' ? 'loaded' : p.load === 'aimed' ? 'target marked' : 'empty'}. ${p.stepPly === s!.ply ? 'It took its step this turn, so it stays put.' : 'Mark, fire or reload is free (one a turn), but then it can\'t move this turn.'}`;
      if (pick('move')) btns.push(modeBtn('go', 'Move'));
      if (pick('mark')) btns.push(modeBtn('mark', '🎯 Mark target'));
      btns.push(now(pick('fire'), '💥 Fire!'), now(pick('reload'), '🔄 Reload'));
    } else if (p.type === 'miner') {
      note = `Mines carried: ${p.carry ?? 0}. Step on a mine to defuse it (roll: 1 blows up, 6 keeps it).`;
      btns.push(modeBtn('go', 'Move'));
      if (selActs.some((a) => a.t === 'move' && a.mine)) btns.push(modeBtn('mine', '💣 Move + drop mine'));
      if (pick('defuse')) btns.push(modeBtn('defuse', '🧰 Defuse from here'));
    } else {
      if (special.length) btns.push(modeBtn('go', 'Move'), modeBtn('special', '✚ Revive'));
      if (pick('clear')) btns.push(modeBtn('go', 'Move'), modeBtn('clear', '🪓 Clear a barricade'));
      if (pick('wall')) btns.push(modeBtn('go', 'Move'), modeBtn('wall', '🧱 Build a wall'));
      for (const a of selActs) if (a.t === 'board') btns.push(<button key={`b${a.catapult}`} className="lu-btn" onClick={() => act(a)}>🪖 Climb onto the bombardier</button>);
      btns.push(now(pick('retrain'), '✨ Become a scout'));
    }
    if (stunned(s!, p)) note = '💫 Stunned: it misses this turn.';
    const shownBtns = btns.filter(Boolean);
    return (
      <>
        {note && <p className="lu-small">{note}</p>}
        {shownBtns.length > 0 && <div className="lu-row">{shownBtns}</div>}
      </>
    );
  }
  const myKingInCheck = inCheck(s, ME);

  return (
    <div className={`lu ${art}`}>
      {homeBtn}
      <div className="lu-board-wrap">
        {report && !top && !s.result && (
          <button key={report.at} className="lu-report" onClick={() => setReport(null)}>
            <b>{mail || live ? `${them}'s turn` : 'Enemy turn'}</b>
            {report.lines.map((l, i) => <span key={i}>{l}</span>)}
            <b className="lu-report-go">▶ Your move!</b>
          </button>
        )}
        <svg className="lu-board" viewBox={`0 0 ${W * CELL} ${H * CELL}`} shapeRendering={art === '8bit' ? 'crispEdges' : 'auto'} role="img" aria-label="Level-Up Chess board">
          <g>
            {cells}{things}{pieces}{fog}
          </g>
          {marks}
          {/* Tap targets for the tests and for exact taps. */}
          <g className="lu-hit" onMouseLeave={() => setHover(null)}>{Array.from({ length: SQUARES }, (_, sq) => <rect key={`h${sq}`} data-square={sq} x={px(sq)} y={py(sq)} width={CELL} height={CELL} onClick={() => tap(sq)}
            onMouseEnter={() => { const q = s.sq[sq] >= 0 ? s.pieces[s.sq[sq]] : null; setHover(q && visible(s, v, ME, q) ? q.id : null); }} />)}</g>
        </svg>
      </div>

      <div className="lu-side">
        <div className="lu-win">
          <div className="lu-row between">
            <b>{s.result ? 'BATTLE OVER' : roles.length ? '🎓 PICK A JOB' : s.turn === ME ? (myKingInCheck ? '⚠ CHECK! YOUR TURN' : '▶ YOUR TURN') : mail || live ? `${them.toUpperCase()}'S TURN…` : 'ENEMY TURN…'}</b>
            <span className="lu-small">Turn {Math.floor(s.ply / 2) + 1}</span>
          </div>
          {live && <p className="lu-small">⚡ Live vs {them}{room.seats[ME === 'p1' ? 'p2' : 'p1']?.connected === false ? ' (reconnecting…)' : ''} · you are {ME === 'p1' ? 'Blue' : 'Red'} · room {room.code}</p>}
          {mail && <p className="lu-small">⚔ Challenge vs {them} · you are {ME === 'p1' ? 'Blue' : 'Red'}{actor(s) !== ME && !s.result ? ' · come back later, we will tell you when it is your move' : ''}</p>}
          {note && <p className="lu-small" style={{ color: '#ff8a8a' }}>{note}</p>}
        </div>

        {looked && (
          <div className="lu-win">
            {identified(v, ME, looked) ? (
              <>
                <b>{looked.owner === ME ? '' : 'Enemy '}{nameOf(looked)}</b> <span className="lu-small">{BASE_ICON[looked.base]} {looked.base} base · power {LU_PIECES[looked.type].value}</span>
                <div className="lu-xp"><span style={{ width: `${Math.min(100, (looked.xp / LEVEL_AT[Math.min(2, level(looked))]) * 100)}%` }} /></div>
                <p className="lu-small">{pieceLine(looked)}</p>
                <ul className="lu-powers">
                  {(looked.type === 'scout' && !looked.role
                    ? [LU_PIECES.scout.levels[0], 'Picks a job: Medic (brings fallen friends back), Miner (hides and clears mines) or Spy (invisible to the enemy).', 'Final form of that job (a Spy becomes an Assassin).']
                    : LU_PIECES[looked.type as LUType].levels).map((t, i) => <li key={i} className={i < level(looked) ? 'have' : ''}>Lv {i + 1}: {t}</li>)}
                </ul>
              </>
            ) : <p><b>??? Unknown enemy</b><br /><span className="lu-small">Watch how it moves, fight it, or get your scout close to find out what it is.</span></p>}
            {selPiece && looked === selPiece && <Controls />}
            {mode === 'special' && revives.length > 0 && (
              <div className="lu-row">{revives.map((a) => <button key={a.fallen} className="lu-btn" onClick={() => act(a)}>✚ {nameOf(s.pieces[a.fallen])} (Lv {level(s.pieces[a.fallen])})</button>)}</div>
            )}
          </div>
        )}

        <div className="lu-win">
          <b>SECRET MISSION</b>
          <p className="lu-small">{s.secretDone[ME] ? '✔ ' : ''}{missionById(s.secret[ME])?.name}: {missionById(s.secret[ME])?.text}</p>
          <b>MISSION CARDS</b> <span className="lu-small">({s.raceDeck.length} in the deck)</span>
          <ul className="lu-race">
            {s.globals.slice(0, RACE_FACE_UP).map((g) => <li key={g.id}>🏁 {missionById(g.id)?.name}: {missionById(g.id)?.text}</li>)}
            {s.raceDone.map((g) => <li key={g.id} className={g.winner === ME ? 'won' : 'lost'}>{g.winner === ME ? '✔ You' : '✘ Enemy'}: {missionById(g.id)?.name}</li>)}
          </ul>
        </div>

        <div className="lu-win lu-log">
          {log.slice(0, 8).map((l, i) => <p key={i} className={i === 0 ? '' : 'old'}>{l}</p>)}
        </div>

        <div className="lu-row">
          <button className="lu-btn" onClick={() => setMenu('points')}>Points menu</button>
          <button className="lu-btn" onClick={() => setArt(art === '8bit' ? 'storybook' : '8bit')}>{art === '8bit' ? '🎨 Storybook look' : '👾 8-bit look'}</button>
          <button className="lu-btn" onClick={() => setMenu('help')}>Help</button>
          {!s.result && <button className="lu-btn" onClick={() => act({ t: 'resign', by: ME })}>Give up</button>}
          {live && !s.result && <button className="lu-btn" onClick={() => { setLive(false); setS(null); }}>⏸ Step away</button>}
          <button className="lu-btn" onClick={() => (mail ? back() : live ? (luSession.leave(), setLive(false), setS(null)) : (setS(null), setBot(null)))}>{live && !s.result ? '✖ Leave (gives up)' : '◀ Leave'}</button>
        </div>
        {live && (
          <div className="lu-row">
            {EMOTES.map((e) => <button key={e.id} className="lu-btn lu-emote" onClick={() => luSession.emote(e.id)}>{e.text}</button>)}
          </div>
        )}
      </div>

      {top && (
        <div className="lu-modal" onClick={() => top.k === 'battle' && setPops((q) => q.slice(1))}>
          {top.k === 'battle' && (
            <div className="lu-win lu-pop">
              <h2>{top.title}</h2>
              <div className="lu-duel">
                <div><img src={sprite(top.att.type, top.att.owner)} alt="" /><b>{nameOf(top.att)}</b><span className="lu-small">{BASE_ICON[top.att.base]}</span></div>
                <div className="lu-vs">
                  {top.a && top.d ? <><span className="lu-die">{top.a[0]}</span> → <b>{top.a[1]}</b><br />vs<br /><span className="lu-die">{top.d[0]}</span> → <b>{top.d[1]}</b></> : <><span className="lu-die">{top.roll}</span><br /><span className="lu-small">1 falls · 2-3 miss · 4-6 hit</span></>}
                </div>
                <div><img src={sprite(top.def.type, top.def.owner)} alt="" /><b>{nameOf(top.def)}</b><span className="lu-small">{BASE_ICON[top.def.base]}</span></div>
              </div>
              <h2 className={(top.outcome === 'win') === top.mine ? 'good' : 'bad'}>{top.outcome === 'win' ? 'VICTORY!' : top.outcome === 'crushed' ? 'CRUSHED!' : 'BOUNCED OFF'}</h2>
              <p className="lu-small">{top.why}</p>
            </div>
          )}
          {top.k === 'level' && (
            <div className="lu-win lu-pop lu-levelup">
              <h2>★ LEVEL UP! ★</h2>
              <img className="lu-big" src={sprite(top.piece.type, top.piece.owner)} alt="" />
              <p><b>{LU_PIECES[top.piece.type].name} reached Level {top.lv}!</b></p>
              <p>Why: <b>{top.why}</b></p>
              <p className="lu-small">New power: {LU_PIECES[top.piece.type].levels[top.lv - 1]}</p>
              <button className="lu-btn" onClick={() => setPops((q) => q.slice(1))}>▶ OK</button>
            </div>
          )}
          {top.k === 'mission' && (
            <div className="lu-win lu-pop">
              <h2>🏁 {top.text}</h2>
              <p className="lu-small">{top.sub}</p>
              <button className="lu-btn" onClick={() => setPops((q) => q.slice(1))}>▶ OK</button>
            </div>
          )}
        </div>
      )}
      {!top && !s.result && roles.length > 0 && (
        <div className="lu-modal">
          <div className="lu-win lu-pop">
            <h2>🎓 PICK A JOB</h2>
            <img className="lu-big" src={sprite('scout', ME)} alt="" />
            <p>Your scout reached level 2! What should it be now? It keeps its scout eyes.</p>
            <div className="lu-roles">
              {roles.map((a) => {
                const r = LU_ROLES.find((x) => x.role === a.role)!;
                return <button key={a.role} className="lu-btn" onClick={() => act(a)}><b>{r.name}</b><br /><span className="lu-small">{r.text}</span></button>;
              })}
            </div>
          </div>
        </div>
      )}
      {!top && s.result && (
        <div className="lu-modal">
          <div className="lu-win lu-pop">
            <h2>{s.result.winner === ME ? `★ ${s.result.grade.toUpperCase()} ★` : s.result.winner ? 'DEFEAT…' : 'A DRAW'}</h2>
            <p>{s.result.reason === 'assassin' ? (s.result.winner === ME ? 'Your assassin struck the king!' : 'An assassin struck your king!') : s.result.reason === 'checkmate' ? 'Checkmate!' : s.result.reason === 'resign' ? 'Someone gave up.' : 'Nobody can move.'}</p>
            {live && room.games > 0 && <p className="lu-small">Score: you {room.score[ME] ?? 0} – {room.score[ME === 'p1' ? 'p2' : 'p1'] ?? 0} {them}</p>}
            <p className="lu-small">Your pieces: {s.pieces.filter((q) => q.owner === ME && level(q) >= 2).length} reached level 2+, {s.pieces.filter((q) => q.owner === ME && level(q) >= 3).length} reached level 3.</p>
            <div className="lu-row">
              {live ? <>
                <button className="lu-btn" disabled={room.rematch.includes(ME)} onClick={() => luSession.rematchVote()}>{room.rematch.includes(ME) ? 'Waiting for them…' : room.rematch.length ? '▶ They want a rematch! Yes' : '▶ Rematch'}</button>
                <button className="lu-btn" onClick={() => { luSession.leave(); setLive(false); setS(null); }}>◀ Leave</button>
              </> : mail ? <button className="lu-btn" onClick={back}>◀ Challenges</button> : <>
                <button className="lu-btn" onClick={() => start(bot!)}>▶ Fight again</button>
                <button className="lu-btn" onClick={() => { setS(null); setBot(null); }}>◀ Title</button>
              </>}
            </div>
          </div>
        </div>
      )}
      {menu && <Menu which={menu} close={() => setMenu(null)} />}
    </div>
  );
}

function Menu({ which, close }: { which: 'points' | 'help'; close: () => void }) {
  return (
    <div className="lu-modal" onClick={close}>
      <div className="lu-win lu-pop lu-menu" onClick={(e) => e.stopPropagation()}>
        {which === 'points' ? (
          <>
            <h2>HOW TO EARN POINTS</h2>
            <p className="lu-small">Only the piece that made the move earns its points. 3 points: Level 2. 8 points: Level 3.</p>
            <table><tbody>{XP_RULES.map((r) => <tr key={r.id}><td className="pts">+{r.points}</td><td><b>{r.label}</b><br /><span className="lu-small">{r.tip}</span></td></tr>)}</tbody></table>
          </>
        ) : (
          <>
            <h2>HOW TO PLAY</h2>
            <ul className="lu-help">
              <li>Checkmate the enemy king to win. An Assassin (a level 3 scout) can strike the king and win at once.</li>
              <li>Every attack is a dice battle: each side rolls a die and adds its power. Higher wins. Lose by 4 or more and the attacker falls.</li>
              <li>Ties: attack with a friend next to the target and you win. Otherwise the bases decide: ▲ beats ●, ● beats ■, ■ beats ▲.</li>
              <li>The fog hides what your pieces can't see. Enemies show as ??? until they fight, or your scout gets close.</li>
              <li>Bombardiers can't be destroyed, but need a pawn crew on them. The crew stays on for good; an attack on a bombardier fights the crew, and only the crew can die. Each turn, as well as your move, a bombardier can mark a target, fire at a marked target (they get a turn to escape), or reload. Everything next to a shot is stunned and misses a turn. Level 2 rooks protect the friends next to them from shots. A level 3 blast also hits the 4 diagonal squares and leaves a crater nobody can cross.</li>
              <li>Your two scouts pick a job at level 2: Medic (brings fallen friends back), Miner (hides and clears mines) or Spy (invisible, then an Assassin).</li>
              <li>Mines blow up whoever steps on them and stun everything around. Your team sees your mines; miners see mines next to them.</li>
              <li>Pawns at level 2 step any way and attack diagonally any way. At level 3 a pawn can train as a scout.</li>
              <li>Battles shake the forest: barricades next to a fight take a hit, and fall after two.</li>
              <li>Mission cards: three face up for both players. First to do one claims it, and a new card turns over.</li>
              <li>Barricades: knights and pawns can clear one next to them (a rook's wall takes two goes). A bombardier shot blows any barricade up and stuns everyone around it. Level 2 rooks protect the friends next to them from shots; level 3 rooks build new walls.</li>
            </ul>
          </>
        )}
        <button className="lu-btn" onClick={close}>▶ Close</button>
      </div>
    </div>
  );
}

/**
 * The Level-Up ladder (owner, 2026-11-19): join at the bottom, challenge anyone
 * 1 or 2 places above you; win and you take their place. Games are challenges
 * played a move at a time (they show in 📬 Challenges). Numbers only.
 */
function LadderWindow() {
  const save = useSave();
  const p = activeProfile(save);
  const [rows, setRows] = useState<LadderRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => fetchLadder().then(setRows).catch((e) => setMsg((e as Error).message));
  useEffect(() => { if (open) void load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;
  const me = rows?.find((r) => r.me);
  const run = (f: () => Promise<unknown>, done: string) => { setMsg('…'); f().then(() => { setMsg(done); return load(); }).catch((e) => setMsg((e as Error).message)); };
  const name = (r: LadderRow) => (r.me ? `${p.nickname} (you)` : (p.friends ?? []).includes(r.n) ? `👫 ${labelFor(p, r.n)}` : labelFor(p, r.n));
  return (
    <div className="lu-win lu-ladder">
      <div className="lu-row between">
        <h2>🪜 LEVEL-UP LADDER</h2>
        <button className="lu-btn" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
      </div>
      {open && (
        <>
          <p className="lu-small">Join at the bottom. Challenge anyone 1 or {LADDER_REACH} places above you. Win and you take their place. Games are played a move at a time in 📬 Challenges.</p>
          {!p.cloud ? <NumberPrompt why="Get a player number to join the ladder." /> : rows && (
            <>
              <div className="lu-row">
                {me ? <button className="lu-btn" onClick={() => run(leaveLadder, 'You left the ladder.')}>Leave the ladder</button>
                  : <button className="lu-btn" onClick={() => run(joinLadder, 'You joined the ladder!')}>▶ Join the ladder</button>}
                {me && <span className="lu-small">You are #{me.rank} of {rows.length}</span>}
              </div>
              {rows.length === 0 ? <p className="lu-small">Nobody yet. Be the first!</p> : (
                <ol className="lu-ladder-list">
                  {rows.map((r) => {
                    const reach = me && r.rank < me.rank && me.rank - r.rank <= LADDER_REACH;
                    return (
                      <li key={r.n} className={r.me ? 'me' : ''}>
                        <span>#{r.rank} {name(r)}</span>
                        <span className="lu-small">{r.w}W {r.l}L</span>
                        {reach && <button className="lu-btn" onClick={() => run(() => ladderChallenge(r.n), 'Challenge sent! Find it in 📬 Challenges.')}>⚔ Challenge</button>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
          {msg && <p className="lu-small">{msg}</p>}
        </>
      )}
    </div>
  );
}

/** Live games with a room code: make a room, or join a friend's. */
function LiveWindow({ name, go }: { name: string; go: () => void }) {
  const [code, setCode] = useState('');
  const [colour, setColour] = useState<'p1' | 'p2' | 'random'>('random');
  return (
    <div className="lu-win">
      <h2>⚡ Play live with a friend</h2>
      <p className="lu-small">Both play at the same time. One of you makes a room and shares the code; the other joins.</p>
      <div className="lu-row">
        {(['p1', 'p2', 'random'] as const).map((c) => <button key={c} className={`lu-btn ${colour === c ? 'on' : ''}`} onClick={() => setColour(c)}>{c === 'p1' ? '🟦 Blue' : c === 'p2' ? '🟥 Red' : '🎲 Either'}</button>)}
        <button className="lu-btn" onClick={() => { luSession.create(name, colour); go(); }}>▶ Make a room</button>
      </div>
      <div className="lu-row">
        <input className="lu-input" aria-label="Room code" placeholder="CODE" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
        <button className="lu-btn" disabled={code.length !== 4} onClick={() => { luSession.join(code, name); go(); }}>▶ Join</button>
      </div>
    </div>
  );
}

function hasLiveGame(): boolean {
  return !!luSession.savedCode();
}

/**
 * On the waiting screen: send the room code (share menu or copy, with a link
 * that opens the room), or invite a friend straight away (a pop-up in their
 * app; numbers and the code only).
 */
function InviteBox({ code }: { code: string }) {
  const save = useSave();
  const p = activeProfile(save);
  const [sent, setSent] = useState<Record<string, string>>({});
  const [shared, setShared] = useState<string | null>(null);
  const link = `${location.origin}${location.pathname}?lu=${code}`;
  const text = `Play Level-Up Chess with me! Room code ${code}`;
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'Level-Up Chess', text, url: link }); setShared('Sent!'); return; }
      await navigator.clipboard.writeText(`${text}: ${link}`);
      setShared('Copied! Paste it in a message to your friend.');
    } catch { setShared(`Tell them the code: ${code}`); }
  };
  const invite = (n: string) => {
    setSent((x) => ({ ...x, [n]: 'Sending…' }));
    sendLiveInvite(n, code).then(() => setSent((x) => ({ ...x, [n]: '✔ Invited' }))).catch((e) => setSent((x) => ({ ...x, [n]: (e as Error).message })));
  };
  const friends = p?.friends ?? [];
  return (
    <div className="lu-invite">
      <button className="lu-btn" onClick={() => void share()}>📤 Send the code</button>
      {shared && <p className="lu-small">{shared}</p>}
      <h2>👫 Invite a friend</h2>
      {!p?.cloud ? <p className="lu-small">Get a player number (⚙️ Settings) to invite friends straight from here.</p>
        : friends.length === 0 ? <p className="lu-small">No friends yet. Add them in 📬 Challenges, or send the code.</p>
        : (
          <ul className="lu-ladder-list">
            {friends.slice(0, 12).map((n) => (
              <li key={n}>
                <span>{labelFor(p, n)}</span>
                <span />
                {sent[n] ? <span className="lu-small">{sent[n]}</span> : <button className="lu-btn" onClick={() => invite(n)}>⚡ Invite</button>}
              </li>
            ))}
          </ul>
        )}
      <p className="lu-small">They get a pop-up in Chess Chaos with a Join button. Or they can open Level-Up Chess → Play live and type {code}.</p>
    </div>
  );
}
