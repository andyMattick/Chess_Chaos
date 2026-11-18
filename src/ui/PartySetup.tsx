import { useMemo, useState } from 'react';
import { BOTS } from '../content/bots';
import { missionById, modifierById } from '../content/party';
import { MODE_INFO } from '../core/modes';
import { activeProfile, updateProfile } from '../storage/storage';
import { PATH, unlockedCount } from '../systems/coins';
import { drawMode, setupParty } from '../systems/party';
import type { GameConfig } from './GameScreen';
import { useSave } from './store';
import { CardTile, HandPicker, useHand } from './Cards';
import { cardById } from '../content/cards';
import { botPrize } from '../systems/cards';

/**
 * Party match setup against a bot: the mode comes off your mode deck, the
 * rating gap decides buffs and handicaps, and each side gets a secret mission.
 */
export function PartySetup({ start, back }: { start: (c: GameConfig) => void; back: () => void }) {
  const save = useSave();
  const p = activeProfile(save)!;
  const open = PATH.slice(0, unlockedCount(p.botRecords));
  const [botId, setBotId] = useState(() => [...open].sort((a, b) => Math.abs(a.rating - p.rating) - Math.abs(b.rating - p.rating))[0].id);
  const bot = BOTS.find((b) => b.id === botId)!;
  const [humanSeat] = useState<'p1' | 'p2'>(() => (Math.random() < 0.5 ? 'p1' : 'p2'));
  const [peek, setPeek] = useState(false);
  const hand = useHand();
  // The bot brings one card: win and you can take it.
  const [prize] = useState(() => botPrize(bot.rating, (n) => Math.floor(Math.random() * n)));

  // Draw the mode once per visit (and remember the deck).
  const [draw] = useState(() => drawMode(p.modeDeck, undefined, Math.random, p.modePrefs));
  const setup = useMemo(() => {
    const players = humanSeat === 'p1'
      ? { p1: { rating: p.rating, bot: false }, p2: { rating: bot.rating, bot: true } }
      : { p1: { rating: bot.rating, bot: true }, p2: { rating: p.rating, bot: false } };
    return setupParty({ mode: draw.mode, players, online: false }, Math.random);
  }, [botId, draw.mode, humanSeat]); // eslint-disable-line react-hooks/exhaustive-deps
  const mode = MODE_INFO.find((m) => m.id === draw.mode)!;
  const botSeat = humanSeat === 'p1' ? 'p2' : 'p1';
  const mine = setup.modifiers[humanSeat] ?? [];
  const theirs = setup.modifiers[botSeat] ?? [];
  const mission = missionById(setup.missions[humanSeat]!);

  const go = () => {
    updateProfile((x) => ({ ...x, modeDeck: draw.deck, partyMatches: x.partyMatches + 1 }));
    start({
      kind: 'bot', botId, humanSeat, mode: draw.mode, party: { ...setup, cards: { [humanSeat]: hand, [botSeat]: [prize] } },
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
        <button className={`reveal-card mission-card big ${peek ? 'open' : ''}`} onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} aria-label="Hold to see your secret mission">
          {peek && mission ? <><div className="reveal-emoji">🎯</div><h3>{mission.name}</h3><p>{mission.blurb}</p><small>Finish it after your move {setup.gate[humanSeat]} to win instantly!</small></> : <><div className="reveal-emoji">🤫</div><h3>Secret mission</h3><p>Hold to peek. Don't let anyone see!</p></>}
        </button>
      </div>
      <HandPicker />
      <div className="stakes">
        <h3>🃏 Cards at stake</h3>
        <div className="hand-row">
          {hand.map((id) => <CardTile key={id} c={cardById(id)!} small><span className="pc-kind">yours</span></CardTile>)}
          {!hand.length && <span className="muted small">You're not bringing any cards.</span>}
          <span className="stakes-vs">vs</span>
          <CardTile c={cardById(prize)!} small><span className="pc-kind">{bot.name}'s</span></CardTile>
        </div>
        <p className="muted small">Win and you take one of their cards. Every other card brought in is used up, win or lose.</p>
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
