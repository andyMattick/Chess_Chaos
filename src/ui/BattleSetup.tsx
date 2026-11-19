import { useState } from 'react';
import type { BattleKind } from '../core/variants';
import { activeProfile } from '../storage/storage';
import type { LocalBattle } from './BattleScreen';
import type { GameConfig } from './GameScreen';
import { useSave } from './store';
import { BOTS } from '../content/bots';

/**
 * Battle setup: 3-way, 4-way, 2 vs 2 and Hill wars against bots on this
 * device, plus the 1 vs 1 hill modes. Online versions live in Play online.
 */
const BIG: { id: string; label: string; emoji: string; kind: BattleKind; mode: LocalBattle['mode']; blurb: string }[] = [
  { id: '3', label: '3-way battle', emoji: '⚔️', kind: 'tri', mode: 'battle', blurb: 'You vs 2 bots on a six-sided board. Capture a king to knock its army out.' },
  { id: '4', label: '4-way battle', emoji: '💥', kind: 'four', mode: 'battle', blurb: 'You vs 3 bots. Last king standing wins.' },
  { id: 'teams', label: '2 vs 2 teams', emoji: '🤝', kind: 'teams', mode: 'battle', blurb: 'You and a bot partner (opposite you) vs two bots.' },
  { id: 'paint3', label: '3-way Paint the board', emoji: '🎨', kind: 'tri', mode: 'battle-paint', blurb: 'Paint squares by landing on them. Most squares after 30 rounds wins.' },
  { id: 'paint4', label: '4-way Paint the board', emoji: '🖌️', kind: 'four', mode: 'battle-paint', blurb: 'Four colours, one board. Most squares after 30 rounds wins.' },
  { id: 'hill4', label: '4-way Hill wars', emoji: '🚩', kind: 'four', mode: 'battle-hill', blurb: 'Hold the big hill in the middle. First to 30 points.' },
];

const LEVELS = [
  { label: '😊 Easy', rating: 500 },
  { label: '😤 Medium', rating: 850 },
  { label: '😈 Hard', rating: 1200 },
];

export function BattleSetup({ startBattle, startDuel, back }: { startBattle: (b: LocalBattle) => void; startDuel: (c: GameConfig) => void; back: () => void }) {
  const save = useSave();
  const p = activeProfile(save)!;
  const [level, setLevel] = useState(p.rating >= 1000 ? 2 : p.rating >= 700 ? 1 : 0);
  const rating = LEVELS[level].rating;

  const duel = (mode: 'koth' | 'hill-wars') => {
    const bot = [...BOTS].sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating))[0];
    const humanSeat = Math.random() < 0.5 ? 'p1' : 'p2';
    startDuel({ kind: 'bot', botId: bot.id, humanSeat, mode, names: humanSeat === 'p1' ? { p1: p.nickname, p2: bot.name } : { p1: bot.name, p2: p.nickname } });
  };

  return (
    <div className="panel wide taped">
      <h2>Battle modes <span className="scribble">more kings, more chaos</span></h2>
      <p className="muted">Bots on this device. To battle real friends, use <b>Play online</b> and pick a battle.</p>
      <div className="clock-chips" role="radiogroup" aria-label="Bot level">
        {LEVELS.map((l, i) => <button key={l.label} role="radio" aria-checked={i === level} className={`chip ${i === level ? 'on' : ''}`} onClick={() => setLevel(i)}>{l.label}</button>)}
      </div>
      <div className="big-buttons">
        {BIG.map((b, i) => (
          <button key={b.id} className="big" style={{ ['--c' as string]: ['#ff5a3c', '#8a5cff', '#2f9bff', '#ffcb2b'][i] }} onClick={() => startBattle({ kind: b.kind, mode: b.mode, botRating: rating })}>
            <span className="big-emoji">{b.emoji}</span>
            <span className="big-title">{b.label}</span>
            <span className="big-sub">{b.blurb}</span>
          </button>
        ))}
        <button className="big" style={{ ['--c' as string]: '#9be04a' }} onClick={() => duel('koth')}>
          <span className="big-emoji">⛰️</span>
          <span className="big-title">King of the hill</span>
          <span className="big-sub">1 vs 1. Walk your king to the middle 4 squares to win.</span>
        </button>
        <button className="big" style={{ ['--c' as string]: '#ff4f9a' }} onClick={() => duel('hill-wars')}>
          <span className="big-emoji">🚩</span>
          <span className="big-title">Hill wars 1 vs 1</span>
          <span className="big-sub">Score a point for every middle square you hold, every round. First to 20.</span>
        </button>
      </div>
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}
