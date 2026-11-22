import { useMemo, useState } from 'react';
import { BOTS } from '../content/bots';
import { missionById, modifierById } from '../content/party';
import { MODE_INFO } from '../core/modes';
import { activeProfile, updateProfile } from '../storage/storage';
import { PATH, unlockedCount } from '../systems/coins';
import { PARTY_MODES, drawMode, missionIsOpen, setupParty } from '../systems/party';
import type { GameConfig } from './GameScreen';
import { useSave } from './store';
import { CardTile, HandPicker, useHand } from './Cards';
import { cardById, POWER_CARDS } from '../content/cards';
import { botPrize } from '../systems/cards';

/**
 * Party match setup against a bot: a surprise mode off your mode deck, or one
 * you pick; extras (buffs and handicaps) from the rating gap, which you can
 * switch off; and secret missions, which you can switch off too (owner, 2026-11-18).
 */
export function PartySetup({ start, back }: { start: (c: GameConfig) => void; back: () => void }) {
  const save = useSave();
  const p = activeProfile(save)!;
  const open = PATH.slice(0, unlockedCount(p.botRecords, p.placement?.rating));
  const [botId, setBotId] = useState(() => [...open].sort((a, b) => Math.abs(a.rating - p.rating) - Math.abs(b.rating - p.rating))[0].id);
  const bot = BOTS.find((b) => b.id === botId)!;
  const [humanSeat] = useState<'p1' | 'p2'>(() => (Math.random() < 0.5 ? 'p1' : 'p2'));
  const [peek, setPeek] = useState(false);
  const hand = useHand();
  // The bot brings one card: win and you can take it.
  const [prize] = useState(() => botPrize(bot.rating, (n) => Math.floor(Math.random() * n)));

  // Draw the mode once per visit (and remember the deck).
  const [draw] = useState(() => drawMode(p.modeDeck, undefined, Math.random, p.modePrefs));
  const [pick, setPick] = useState<string>('surprise');
  const [missionsOn, setMissionsOn] = useState(true);
  const [extrasOn, setExtrasOn] = useState(true);
  const modeId = pick === 'surprise' ? draw.mode : pick;
  const full = useMemo(() => {
    const players = humanSeat === 'p1'
      ? { p1: { rating: p.rating, bot: false }, p2: { rating: bot.rating, bot: true } }
      : { p1: { rating: bot.rating, bot: true }, p2: { rating: p.rating, bot: false } };
    return setupParty({ mode: modeId, players, online: false, noMissions: !missionsOn }, Math.random);
  }, [botId, modeId, humanSeat, missionsOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const setup = { ...full, modifiers: extrasOn ? full.modifiers : {}, missions: missionsOn ? full.missions : {}, bonus: missionsOn ? full.bonus : undefined };
  const mode = MODE_INFO.find((m) => m.id === modeId)!;
  const botSeat = humanSeat === 'p1' ? 'p2' : 'p1';
  const mine = setup.modifiers[humanSeat] ?? [];
  const theirs = setup.modifiers[botSeat] ?? [];
  const mission = setup.missions[humanSeat] ? missionById(setup.missions[humanSeat]!) : undefined;
  const theirMission = setup.missions[botSeat] ? missionById(setup.missions[botSeat]!) : undefined;

  const go = () => {
    // The surprise mode comes off your mode deck; a mode you picked leaves the deck alone.
    updateProfile((x) => ({ ...x, modeDeck: pick === 'surprise' ? draw.deck : x.modeDeck, partyMatches: x.partyMatches + 1 }));
    start({
      kind: 'bot', botId, humanSeat, mode: modeId,
      // Boss battle: the stronger player is the Boss (the Boss side is the harder one), like online.
      ...(modeId === 'boss' ? { extra: { boss: p.rating > bot.rating ? humanSeat : botSeat } } : {}),
      party: POWER_CARDS ? { ...setup, cards: { [humanSeat]: hand, [botSeat]: [prize] } } : setup,
      names: humanSeat === 'p1' ? { p1: p.nickname, p2: bot.name } : { p1: bot.name, p2: p.nickname },
    });
  };

  const modRow = (ids: string[]) => (ids.length ? ids.map((id) => {
    const d = modifierById(id)!;
    return <div key={id} className={`mod ${d.kind}`}><span className="mod-emoji">{d.emoji}</span><span><b>{d.name}</b><small>{d.blurb}</small></span></div>;
  }) : <p className="muted small">Nothing. You're evenly matched!</p>);

  return (
    <div className="panel wide taped">
      <h2>Party match! <span className="scribble">every game is different</span></h2>
      <div className="reveal-grid">
        <div className="reveal-card mode-card">
          <div className="reveal-emoji">{mode.emoji}</div>
          <h3>{mode.name}</h3>
          <p>{mode.blurb}</p>
        </div>
        <div className="reveal-card">
          <h3>Your extras</h3>
          {modRow(mine)}
          <h3>{bot.emoji} {bot.name}'s extras</h3>
          {modRow(theirs)}
        </div>
        {!missionsOn ? (
          <div className="reveal-card mission-card big open"><div className="reveal-emoji">🙅</div><h3>No secret missions</h3><p>Win the normal way for this mode.</p></div>
        ) : missionIsOpen(setup, humanSeat) && mission ? (
          <div className="reveal-card mission-card big open">
            <div className="reveal-emoji">🎯</div><h3>{mission.name}</h3><p>{mission.blurb}</p>
            <small>You're the underdog, so your mission is open: {bot.name} can see it. But if you do it (after your move {setup.gate[humanSeat]}), you win at once!</small>
          </div>
        ) : (
          <button className={`reveal-card mission-card big ${peek ? 'open' : ''}`} onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} aria-label="Hold to see your secret mission">
            {peek && mission ? <><div className="reveal-emoji">🎯</div><h3>{mission.name}</h3><p>{mission.blurb}</p><small>Do it after your move {setup.gate[humanSeat]}. Then everyone sees it, and you must keep it standing until {bot.name}'s next turn is over. If it still stands, you win!</small></> : <><div className="reveal-emoji">🤫</div><h3>Secret mission</h3><p>Hold to peek. Don't let anyone see!</p></>}
          </button>
        )}
        {missionIsOpen(setup, botSeat) && theirMission && (
          <div className="reveal-card mission-card big open warn-card">
            <div className="reveal-emoji">⚠️</div><h3>{bot.name}'s mission: {theirMission.name}</h3><p>{theirMission.blurb}</p>
            <small>{bot.name} is the underdog, so you can see it. If they do it, they win at once. Stop them!</small>
          </div>
        )}
      </div>
      <HandPicker />
      {POWER_CARDS && <div className="stakes">
        <h3>🃏 Cards at stake</h3>
        <div className="hand-row">
          {hand.map((id) => <CardTile key={id} c={cardById(id)!} small><span className="pc-kind">yours</span></CardTile>)}
          {!hand.length && <span className="muted small">You're not bringing any cards.</span>}
          <span className="stakes-vs">vs</span>
          <CardTile c={cardById(prize)!} small><span className="pc-kind">{bot.name}'s</span></CardTile>
        </div>
        <p className="muted small">Win and you take one of their cards. Every other card brought in is used up, win or lose.</p>
      </div>}
      <h3>Mode</h3>
      <div className="clock-chips">
        <button className={`chip ${pick === 'surprise' ? 'on' : ''}`} onClick={() => setPick('surprise')}>🎲 Surprise me</button>
        {PARTY_MODES.map((id) => {
          const m = MODE_INFO.find((x) => x.id === id);
          return m ? <button key={id} className={`chip ${pick === id ? 'on' : ''}`} onClick={() => setPick(id)}>{m.emoji} {m.name}</button> : null;
        })}
      </div>
      <div className="mission-toggle">
        <label><input type="checkbox" checked={missionsOn} onChange={(e) => setMissionsOn(e.target.checked)} /> 🤫 Secret missions</label>
        <label><input type="checkbox" checked={extrasOn} onChange={(e) => setExtrasOn(e.target.checked)} /> ⚖️ Use the extras (buffs and handicaps from your ratings)</label>
      </div>
      <h3>Opponent</h3>
      <div className="clock-chips">
        {open.map((b) => <button key={b.id} className={`chip ${b.id === botId ? 'on' : ''}`} onClick={() => setBotId(b.id)}>{b.emoji} {b.name} ★{b.rating}</button>)}
      </div>
      <p className="muted small">You play {humanSeat === 'p1' ? 'White' : 'Black'}. Extras come from the rating gap: the lower-rated side gets buffs, the higher-rated side gets handicaps. Want some modes more (or never)? Rank them with ▲ ▼ in Game modes.</p>
      <div className="row">
        <button className="btn primary" onClick={go}>Let's party!</button>
        <button className="btn" onClick={back}>← Home</button>
      </div>
    </div>
  );
}

