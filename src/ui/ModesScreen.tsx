import { useEffect, useState } from 'react';
import { vaultBase } from '../storage/cloud';
import { fetchModeVotes, type ModeVotes } from '../storage/world';
import { BOTS } from '../content/bots';
import { MODE_INFO } from '../core/modes';
import { armyCost, DRAFT_BUDGET, randomArmy } from '../core/modes2';
import { activeProfile, updateProfile } from '../storage/storage';
import { PARTY_MODES, PREF_LABELS, prefOf } from '../systems/party';
import { PATH, unlockedCount } from '../systems/coins';
import type { GameConfig } from './GameScreen';
import { Character } from './skins';
import { useSave } from './store';
import { lookOf } from '../storage/storage';
import { skinFor } from '../content/cosmetics';
import { Icon } from './icons';

/**
 * Every 1 vs 1 game mode against a bot on this device. Party matches draw
 * from these at random; here you choose. Draft opens the army shop first.
 */
const SKIP = new Set(['standard', 'battle', 'survival']);

export function ModesScreen({ start, back }: { start: (c: GameConfig) => void; back: () => void }) {
  const save = useSave();
  const p = activeProfile(save)!;
  const open = PATH.slice(0, unlockedCount(p.botRecords, p.placement?.rating));
  const [botId, setBotId] = useState(() => [...open].sort((a, b) => Math.abs(a.rating - p.rating) - Math.abs(b.rating - p.rating))[0].id);
  const bot = BOTS.find((b) => b.id === botId)!;
  const [drafting, setDrafting] = useState(false);
  const modes = MODE_INFO.filter((m) => m.players.includes(2) && !SKIP.has(m.id));

  const begin = (mode: string, army?: string[]) => {
    const humanSeat = Math.random() < 0.5 ? 'p1' : 'p2';
    const botSeat = humanSeat === 'p1' ? 'p2' : 'p1';
    const extra: GameConfig['extra'] = {};
    // Boss battle: the lower-rated side takes the full army.
    if (mode === 'boss') extra.boss = p.rating > bot.rating ? humanSeat : botSeat;
    if (mode === 'draft') extra.armies = { [humanSeat]: army ?? [], [botSeat]: randomArmy(DRAFT_BUDGET, (n) => Math.floor(Math.random() * n)) };
    start({
      kind: 'bot', botId, humanSeat, mode, extra,
      names: humanSeat === 'p1' ? { p1: p.nickname, p2: bot.name } : { p1: bot.name, p2: p.nickname },
    });
  };

  const rank = (mode: string, level: number) => {
    const v = Math.max(0, Math.min(3, level));
    // A new ranking starts a fresh deck so it counts straight away.
    updateProfile((x) => ({ ...x, modePrefs: { ...(x.modePrefs ?? {}), [mode]: v }, modeDeck: [] }));
  };

  if (drafting) return <ArmyShop onDone={(army) => begin('draft', army)} onCancel={() => setDrafting(false)} />;

  return (
    <div className="panel wide">
      <h2>Game modes</h2>
      <p className="muted">Every mode here, against a bot. (Party matches pick one of these for you at random.)</p>
      <h3>Opponent</h3>
      <div className="clock-chips">
        {open.map((b) => <button key={b.id} className={`chip ${b.id === botId ? 'on' : ''}`} onClick={() => setBotId(b.id)}>{b.emoji} {b.name} ★{b.rating}</button>)}
      </div>
      <p className="muted small">Rank modes up or down with ▲ ▼ to change how often they come up in your Party matches. Online, both players' ranks count.</p>
      <EveryoneLikes />
      <div className="mode-grid">
        {[...(PARTY_MODES.includes('standard') ? [{ id: 'standard', emoji: '♟️', name: 'Classic', blurb: 'Normal chess.' }] : []), ...modes].map((m, i) => {
          const inDeck = PARTY_MODES.includes(m.id);
          const level = prefOf(p.modePrefs, m.id);
          return (
            <div key={m.id} className={`mode-tile rank-${inDeck ? level : 'x'}`} style={{ ['--r' as string]: `${[-1.2, 0.8, -0.4, 1.3][i % 4]}deg` }}>
              <button className="mode-play" onClick={() => (m.id === 'draft' ? setDrafting(true) : begin(m.id))} aria-label={`Play ${m.name}`}>
                <span className="mode-emoji">{m.emoji}</span>
                <b>{m.name}</b>
                <small>{m.blurb}</small>
              </button>
              {inDeck && (
                <div className="rank-row" aria-label={`How often ${m.name} comes up in Party matches`}>
                  <button className="rank-btn" onClick={() => rank(m.id, level - 1)} disabled={level <= 0} aria-label="Less often">▼</button>
                  <span className="rank-label">{PREF_LABELS[level]}</span>
                  <button className="rank-btn" onClick={() => rank(m.id, level + 1)} disabled={level >= 3} aria-label="More often">▲</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn" onClick={back}><Icon name="home" /> Home</button>
    </div>
  );
}

const SHOP: { type: string; cost: number }[] = [
  { type: 'queen', cost: 9 }, { type: 'rook', cost: 5 }, { type: 'bishop', cost: 3 }, { type: 'knight', cost: 3 }, { type: 'pawn', cost: 1 },
];

/** Draft: spend 30 points on an army (the king is free). Used before bot games and online. */
export function ArmyShop({ onDone, onCancel, title = 'Build your army' }: { onDone: (army: string[]) => void; onCancel?: () => void; title?: string }) {
  const save = useSave();
  const skins = lookOf(save).skins;
  const [army, setArmy] = useState<string[]>([]);
  const spent = armyCost(army);
  const count = (t: string) => army.filter((x) => x === t).length;
  const add = (t: string, c: number) => { if (spent + c <= DRAFT_BUDGET && army.length < 15) setArmy([...army, t]); };
  const remove = (t: string) => { const i = army.lastIndexOf(t); if (i >= 0) setArmy(army.filter((_, k) => k !== i)); };
  return (
    <div className="panel army-shop">
      <h2>{title} <small className="h-note">{DRAFT_BUDGET - spent} points left</small></h2>
      <p className="muted">You get a king for free. Spend up to {DRAFT_BUDGET} points. Pieces go on your first two rows.</p>
      <div className="shop-rows">
        {SHOP.map(({ type, cost }) => (
          <div key={type} className="shop-row">
            <svg viewBox="0 0 100 100"><Character skin={skinFor(skins, 'p1', type)} type={type} owner="p1" /></svg>
            <span className="shop-name"><b>{type[0].toUpperCase() + type.slice(1)}</b><small>{cost} point{cost > 1 ? 's' : ''}</small></span>
            <button className="btn small" onClick={() => remove(type)} disabled={!count(type)} aria-label={`One less ${type}`}>−</button>
            <b className="shop-count">{count(type)}</b>
            <button className="btn small" onClick={() => add(type, cost)} disabled={spent + cost > DRAFT_BUDGET || army.length >= 15} aria-label={`One more ${type}`}>+</button>
          </div>
        ))}
      </div>
      <div className="budget-bar"><div style={{ width: `${(spent / DRAFT_BUDGET) * 100}%` }} /></div>
      <div className="row wrap">
        <button className="btn primary" disabled={!army.length} onClick={() => onDone(army)}>Ready! ⚔️</button>
        <button className="btn" onClick={() => setArmy(randomArmy(DRAFT_BUDGET, (n) => Math.floor(Math.random() * n)))}>🎲 Surprise me</button>
        {onCancel && <button className="btn" onClick={onCancel}>Back</button>}
      </div>
    </div>
  );
}

/** "What everyone likes": all players' ▲▼ rankings added up (player numbers only). */
function EveryoneLikes() {
  const [votes, setVotes] = useState<ModeVotes | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open && !votes && vaultBase()) fetchModeVotes().then(setVotes).catch(() => {}); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!vaultBase()) return null;
  const name = (id: string) => (id === 'standard' ? '♟️ Classic' : (() => { const m = MODE_INFO.find((x) => x.id === id); return m ? `${m.emoji} ${m.name}` : id; })());
  return (
    <details className="settings" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>🌍 What everyone likes</summary>
      {!votes ? <p className="muted small">Loading…</p> : votes.voters === 0 ? <p className="muted small">No votes yet. Rank some modes and you're the first!</p> : (
        <>
          <p className="muted small">{votes.voters} {votes.voters === 1 ? 'player has' : 'players have'} ranked modes (only players with a player number, no names).</p>
          <ol className="leaderboard">
            {votes.modes.slice(0, 10).map((m, i) => (
              <li key={m.mode}><span className="place">{i + 1}</span><span className="lb-name"><b>{name(m.mode)}</b><small>❤️ {m.favourite} love it, 🚫 {m.never} never want it</small></span><span className="bot-rating">{'★'.repeat(Math.round(m.average))}{'☆'.repeat(3 - Math.round(m.average))}</span></li>
            ))}
          </ol>
        </>
      )}
    </details>
  );
}
