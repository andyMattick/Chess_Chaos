import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  BASE_ICON, LEVEL_AT, LU_PIECES, LU_ROLES, RACE_FACE_UP, XP, XP_RULES, missionById, type LUType,
} from '../content/levelup';
import { chooseAction, type LUBotLevel } from '../levelup/ai';
import {
  N, actor, battleOdds, fileOf, identified, inCheck, legalActions, level, newGame, play, rankOf, strikeOdds, stunned, viewOf, visible,
  type LUAction, type LUEvent, type LUPiece, type LUState, type Side,
} from '../levelup/rules';
import { activeProfile, updateProfile } from '../storage/storage';
import { luReplay, type MailGame } from '../net/world';
import { getGame, labelFor, resignMail, sendLuMove } from '../storage/world';
import { noteDaily } from '../storage/daily';
import { luSfx } from './sound';
import { spriteUrl } from './luSprites';
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

export function LevelUpScreen({ back, mail }: { back: () => void; mail?: MailGame }) {
  const save = useSave();
  const p = activeProfile(save);
  // A challenge: you play your seat against a friend, a move at a time (owner, 2026-11-19).
  const ME: Side = mail && mail.players.p2 === p?.cloud?.number ? 'p2' : 'p1';
  const flip = ME === 'p2';
  const them = mail ? labelFor(p, mail.players[ME === 'p1' ? 'p2' : 'p1']) : '';
  const [bot, setBot] = useState<LUBotLevel | null>(null);
  const [s, setS] = useState<LUState | null>(() => (mail?.lu ? luReplay(mail) : null));
  const [note, setNote] = useState<string | null>(null);
  /** Level-Up actions the server has (the guard for a move sent twice). */
  const served = useRef(mail?.lu?.actions.length ?? 0);
  const [sel, setSel] = useState<number | null>(null);
  const [mode, setMode] = useState<'go' | 'special' | 'mark' | 'mine' | 'off' | 'defuse'>('go');
  const [look, setLook] = useState<number | null>(null);
  const [pops, setPops] = useState<Popup[]>([]);
  const [log, setLog] = useState<string[]>(() => (mail ? [`Your challenge against ${them}. ${ME === 'p1' ? 'Blue' : 'Red'} is your army.`] : []));
  const [menu, setMenu] = useState<'points' | 'help' | null>(null);
  const recorded = useRef(false);

  const view = useMemo(() => (s ? viewOf(s, ME) : null), [s]);
  const legal = useMemo(() => (s && actor(s) === ME ? legalActions(s) : []), [s]);

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
          if (e.side === ME) ps.push({ k: 'mission', text: e.kind === 'secret' ? `Secret mission done: ${m.name}!` : `Race won: ${m.name}!`, sub: e.kind === 'secret' ? 'Bonus points, and a win now is a Complete win.' : 'Bonus points for the piece that did it.' });
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
        case 'tree': if (e.gone) lines.push('🌲 A barricade crashes down.'); break;
        case 'crater': lines.push('🕳 The blast left a crater. Nobody can cross it now.'); break;
        case 'promote': lines.push(`👑 ${label(e.piece)} reached the far side and became a queen!`); break;
        case 'check': lines.push(e.side === ME ? '⚠ CHECK! Protect your king.' : '⚔ Check!'); break;
      }
    }
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
    if (!s || !bot || mail || s.result || actor(s) === ME || pops.length) return;
    const t = setTimeout(() => {
      const a = chooseAction(s, bot);
      if (a) act(a);
    }, 650);
    return () => clearTimeout(t);
  }, [s, pops.length, bot]); // eslint-disable-line react-hooks/exhaustive-deps

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
  if (!s || (!bot && !mail)) {
    return (
      <div className="lu">
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
        <div className="lu-row">
          <button className="lu-btn" onClick={() => setMenu('help')}>How to play</button>
          <button className="lu-btn" onClick={() => setMenu('points')}>How to earn points</button>
          <button className="lu-btn" onClick={back}>◀ Back</button>
        </div>
        {menu && <Menu which={menu} close={() => setMenu(null)} />}
      </div>
    );
  }

  // ---- The battle ----
  const v = view!;
  // Your own army is always at the bottom: Red sees the board turned round.
  const px = (sq: number) => (flip ? N - 1 - fileOf(sq) : fileOf(sq)) * CELL;
  const py = (sq: number) => (flip ? rankOf(sq) : N - 1 - rankOf(sq)) * CELL;
  const selPiece = sel !== null ? s.pieces[sel] : null;
  const selActs = selPiece ? legal.filter((a) => 'piece' in a && a.piece === selPiece.id) : [];
  const special = selActs.filter((a) => a.t === 'revive');
  const tgt = (a: LUAction) => (a.t === 'defuse' ? a.at : 'to' in a ? a.to : -1);
  const shown = selActs.filter((a) => {
    switch (mode) {
      case 'mark': return a.t === 'mark';
      case 'mine': return a.t === 'move' && !!a.mine;
      case 'off': return a.t === 'unboard';
      case 'defuse': return a.t === 'defuse';
      case 'special': return false;
      default: return (a.t === 'move' && !a.mine) || a.t === 'attack' || a.t === 'strike' || a.t === 'castle';
    }
  });
  const pick = (t: LUAction['t']) => selActs.find((a) => a.t === t);
  const looked = look !== null ? s.pieces[look] : selPiece;
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
  for (let sq = 0; sq < N * N; sq++) {
    const x = px(sq), y = py(sq);
    const light = (fileOf(sq) + rankOf(sq)) % 2 === 0;
    cells.push(<rect key={`g${sq}`} x={x} y={y} width={CELL} height={CELL} fill={light ? '#6bb34f' : '#5aa045'} />);
  }
  const things: ReactElement[] = [];
  for (let sq = 0; sq < N * N; sq++) {
    const x = px(sq), y = py(sq);
    if ((s.craters ?? []).includes(sq)) things.push(<image key={`c${sq}`} href={spriteUrl('crater')} x={x} y={y} width={CELL} height={CELL} />);
    if (s.trees[sq] > 0) things.push(<image key={`t${sq}`} href={spriteUrl(s.trees[sq] > 1 ? 'tree' : 'stump')} x={x} y={y} width={CELL} height={CELL} />);
    const mine = s.mines.find((m) => m.at === sq);
    if (mine && v.mines.has(sq)) things.push(<image key={`m${sq}`} href={spriteUrl('mine')} x={x} y={y} width={CELL} height={CELL} opacity={0.9} />);
  }
  const pieces = s.pieces.filter((q) => q.at >= 0 && visible(s, v, ME, q)).map((q) => {
    const x = px(q.at), y = py(q.at);
    const known = identified(v, ME, q);
    const lv = level(q);
    return (
      <g key={`p${q.id}`} className={`lu-piece ${sel === q.id ? 'sel' : ''}`}>
        <title>{known ? `${q.owner === ME ? '' : 'Enemy '}${pieceLine(q)} · ${q.base} base` : 'Unknown enemy: watch how it moves!'}</title>
        {sel === q.id && <rect x={x + 0.3} y={y + 0.3} width={CELL - 0.6} height={CELL - 0.6} className="lu-selbox" />}
        <image href={spriteUrl(known ? q.type : 'mystery', q.owner)} x={x} y={y} width={CELL} height={CELL} opacity={q.owner === ME && q.type === 'scout' && lv >= 2 ? 0.6 : 1} />
        {known && lv > 1 && <text x={x + CELL - 0.5} y={y + 3.6} className="lu-lv" textAnchor="end">{lv === 3 ? '★' : '2'}</text>}
        {known && <text x={x + 0.6} y={y + CELL - 0.6} className={`lu-base ${q.owner}`}>{BASE_ICON[q.base]}</text>}
        {stunned(s, q) && <text x={x + CELL / 2} y={y + 3.4} textAnchor="middle" className="lu-stun">💫</text>}
        {q.type === 'catapult' && (q.owner === ME || known) && <text x={x + CELL - 0.5} y={y + CELL - 0.6} textAnchor="end" className="lu-load">{q.crew === undefined ? '∅' : q.owner !== ME ? '♟' : q.load === 'loaded' ? '●' : q.load === 'aimed' ? '◎' : '○'}</text>}
      </g>
    );
  });
  const fog: ReactElement[] = [];
  for (let sq = 0; sq < N * N; sq++) if (!v.seen.has(sq)) fog.push(<rect key={`f${sq}`} x={px(sq)} y={py(sq)} width={CELL} height={CELL} className="lu-fog" />);
  const marks: ReactElement[] = [];
  for (const shot of s.shots) {
    const x = px(shot.at), y = py(shot.at);
    marks.push(<g key={`s${shot.at}`} className={shot.by === ME ? 'lu-aim' : 'lu-incoming'}><rect x={x + 0.5} y={y + 0.5} width={CELL - 1} height={CELL - 1} /><text x={x + CELL / 2} y={y + CELL / 2 + 2.5} textAnchor="middle">{shot.by === ME ? '◎' : '!'}</text></g>);
  }
  if (s.last) for (const sq of [s.last.from, s.last.to]) if (sq >= 0 && v.seen.has(sq)) marks.push(<rect key={`l${sq}`} x={px(sq) + 0.4} y={py(sq) + 0.4} width={CELL - 0.8} height={CELL - 0.8} className="lu-last" />);
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
    const kind = a.t === 'attack' || a.t === 'strike' ? 'hit' : a.t === 'mark' ? 'fire' : a.t === 'defuse' ? 'mine' : 'go';
    marks.push(
      <g key={`a${a.t}${to}`} className={`lu-target ${kind}`} onClick={() => tap(to)}>
        <rect x={x} y={y} width={CELL} height={CELL} />
        {kind === 'go' && <rect x={x + 4.5} y={y + 4.5} width={3} height={3} className="lu-dot" />}
        {kind === 'fire' && <text x={x + CELL / 2} y={y + CELL / 2 + 2.5} textAnchor="middle">◎</text>}
        {kind === 'mine' && <text x={x + CELL / 2} y={y + CELL / 2 + 2.5} textAnchor="middle">✱</text>}
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
        : `Crew on board · ${p.load === 'loaded' ? 'loaded' : p.load === 'aimed' ? 'target marked' : 'empty'}. Mark, fire and reload are free (one a turn) and don't use your move.`;
      if (pick('move')) btns.push(modeBtn('go', 'Move'));
      if (pick('mark')) btns.push(modeBtn('mark', '🎯 Mark target'));
      btns.push(now(pick('fire'), '💥 Fire!'), now(pick('reload'), '🔄 Reload'));
      if (pick('unboard')) btns.push(modeBtn('off', '🪖 Crew climbs off'));
    } else if (p.type === 'miner') {
      note = `Mines carried: ${p.carry ?? 0}. Step on a mine to defuse it (roll: 1 blows up, 6 keeps it).`;
      btns.push(modeBtn('go', 'Move'));
      if (selActs.some((a) => a.t === 'move' && a.mine)) btns.push(modeBtn('mine', '💣 Move + drop mine'));
      if (pick('defuse')) btns.push(modeBtn('defuse', '🧰 Defuse from here'));
    } else {
      if (special.length) btns.push(modeBtn('go', 'Move'), modeBtn('special', '✚ Revive'));
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
    <div className="lu">
      <div className="lu-board-wrap">
        <svg className="lu-board" viewBox={`0 0 ${N * CELL} ${N * CELL}`} shapeRendering="crispEdges" role="img" aria-label="Level-Up Chess board">
          <g>
            {cells}{things}{pieces}{fog}
          </g>
          {marks}
          {/* Tap targets for the tests and for exact taps. */}
          <g className="lu-hit">{Array.from({ length: N * N }, (_, sq) => <rect key={`h${sq}`} data-square={sq} x={px(sq)} y={py(sq)} width={CELL} height={CELL} onClick={() => tap(sq)} />)}</g>
        </svg>
      </div>

      <div className="lu-side">
        <div className="lu-win">
          <div className="lu-row between">
            <b>{s.result ? 'BATTLE OVER' : roles.length ? '🎓 PICK A JOB' : s.turn === ME ? (myKingInCheck ? '⚠ CHECK! YOUR TURN' : '▶ YOUR TURN') : mail ? `${them.toUpperCase()}'S TURN…` : 'ENEMY TURN…'}</b>
            <span className="lu-small">Turn {Math.floor(s.ply / 2) + 1}</span>
          </div>
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
                  {LU_PIECES[looked.type as LUType].levels.map((t, i) => <li key={i} className={i < level(looked) ? 'have' : ''}>Lv {i + 1}: {t}</li>)}
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
          <b>RACE CARDS</b> <span className="lu-small">({s.raceDeck.length} in the deck)</span>
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
          <button className="lu-btn" onClick={() => setMenu('help')}>Help</button>
          {!s.result && <button className="lu-btn" onClick={() => act({ t: 'resign', by: ME })}>Give up</button>}
          <button className="lu-btn" onClick={() => (mail ? back() : (setS(null), setBot(null)))}>◀ Leave</button>
        </div>
      </div>

      {top && (
        <div className="lu-modal" onClick={() => top.k === 'battle' && setPops((q) => q.slice(1))}>
          {top.k === 'battle' && (
            <div className="lu-win lu-pop">
              <h2>{top.title}</h2>
              <div className="lu-duel">
                <div><img src={spriteUrl(top.att.type, top.att.owner)} alt="" /><b>{nameOf(top.att)}</b><span className="lu-small">{BASE_ICON[top.att.base]}</span></div>
                <div className="lu-vs">
                  {top.a && top.d ? <><span className="lu-die">{top.a[0]}</span> → <b>{top.a[1]}</b><br />vs<br /><span className="lu-die">{top.d[0]}</span> → <b>{top.d[1]}</b></> : <><span className="lu-die">{top.roll}</span><br /><span className="lu-small">1 falls · 2-3 miss · 4-6 hit</span></>}
                </div>
                <div><img src={spriteUrl(top.def.type, top.def.owner)} alt="" /><b>{nameOf(top.def)}</b><span className="lu-small">{BASE_ICON[top.def.base]}</span></div>
              </div>
              <h2 className={(top.outcome === 'win') === top.mine ? 'good' : 'bad'}>{top.outcome === 'win' ? 'VICTORY!' : top.outcome === 'crushed' ? 'CRUSHED!' : 'BOUNCED OFF'}</h2>
              <p className="lu-small">{top.why}</p>
            </div>
          )}
          {top.k === 'level' && (
            <div className="lu-win lu-pop lu-levelup">
              <h2>★ LEVEL UP! ★</h2>
              <img className="lu-big" src={spriteUrl(top.piece.type, top.piece.owner)} alt="" />
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
            <img className="lu-big" src={spriteUrl('scout', ME)} alt="" />
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
            <p className="lu-small">Your pieces: {s.pieces.filter((q) => q.owner === ME && level(q) >= 2).length} reached level 2+, {s.pieces.filter((q) => q.owner === ME && level(q) >= 3).length} reached level 3.</p>
            <div className="lu-row">
              {mail ? <button className="lu-btn" onClick={back}>◀ Challenges</button> : <>
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
              <li>Bombardiers can't be destroyed, but need a pawn crew on them. Each turn, as well as your move, a bombardier can mark a target, fire at a marked target (they get a turn to escape), or reload. Everything next to a shot is stunned and misses a turn. Rooks at level 2 block shots. A level 3 blast also hits the 4 diagonal squares and leaves a crater nobody can cross.</li>
              <li>Your two scouts pick a job at level 2: Medic (brings fallen friends back), Miner (hides and clears mines) or Spy (invisible, then an Assassin).</li>
              <li>Mines blow up whoever steps on them and stun everything around. Your team sees your mines; miners see mines next to them.</li>
              <li>Pawns at level 2 step any way and attack diagonally any way. At level 3 a pawn can train as a scout.</li>
              <li>Battles shake the forest: barricades next to a fight take a hit, and fall after two.</li>
              <li>Race cards: three face up for both players. First to do one claims it, and a new card turns over.</li>
            </ul>
          </>
        )}
        <button className="lu-btn" onClick={close}>▶ Close</button>
      </div>
    </div>
  );
}
