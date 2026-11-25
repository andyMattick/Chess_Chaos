import { useMemo, useState } from 'react';
import { BOTS } from '../content/bots';
import { activeProfile } from '../storage/storage';
import { alertMode, chooseAlert } from '../systems/alerts';
import { EASY_GOALS, GOAL_TEXT, type EasyGoalId } from '../tactics/missions';
import type { GameConfig } from './GameScreen';
import { useSave } from './store';
import { Icon } from './icons';

/**
 * Train mode setup: picks a bot near your rating, reveals the one alert for
 * this game, and three open goals (docs/01 "Training game").
 */
export function TrainSetup({ start, back }: { start: (c: GameConfig) => void; back: () => void }) {
  const save = useSave();
  const p = activeProfile(save)!;
  const alert = useMemo(() => chooseAlert(p.rating, p.missMap, p.lastAlert, Math.random), [p.rating, p.missMap, p.lastAlert]);
  const goals = useMemo(() => (Object.keys(EASY_GOALS) as EasyGoalId[]).sort(() => Math.random() - 0.5).slice(0, 3), []);
  // Bots at or a little below the player's level make training feel winnable.
  const candidates = useMemo(() => {
    const sorted = [...BOTS].sort((a, b) => Math.abs(a.rating - (p.rating - 50)) - Math.abs(b.rating - (p.rating - 50)));
    return sorted.slice(0, 4);
  }, [p.rating]);
  const [botIdx, setBotIdx] = useState(0);
  const bot = candidates[botIdx % candidates.length];
  const mode = alertMode(p.rating);

  const go = () => {
    const humanSeat = Math.random() < 0.6 ? 'p1' : 'p2';
    start({
      kind: 'bot', botId: bot.id, humanSeat,
      names: humanSeat === 'p1' ? { p1: p.nickname, p2: bot.name } : { p1: bot.name, p2: p.nickname },
      training: { alertId: alert.id, mode, goals },
    });
  };

  return (
    <div className="panel">
      <h2>Training time!</h2>
      <div className="alert-reveal">
        <div className="alert-emoji">{alert.emoji}</div>
        <div>
          <h3>This game: {alert.name}</h3>
          <p>{alert.blurb}</p>
          {mode.kind === 'on-request' && <p className="muted">You're getting good! Hints are on request: 3 per game.</p>}
        </div>
      </div>
      <h3>Your goals</h3>
      <ol className="goal-list">
        {goals.map((g) => <li key={g}><b>{GOAL_TEXT[g].title}</b> <span className="muted">{GOAL_TEXT[g].hint}</span></li>)}
      </ol>
      <div className="bot-hero" style={{ ['--c' as string]: bot.colour }}>
        <span className="bot-emoji">{bot.emoji}</span>
        <div>
          <h3>vs {bot.name} <small>★ {bot.rating}</small></h3>
          <p className="muted">Plays the {bot.opening}.</p>
        </div>
      </div>
      <div className="row">
        <button className="btn primary" onClick={go}>Let's go!</button>
        <button className="btn" onClick={() => setBotIdx((i) => i + 1)}>🔄 Different bot</button>
        <button className="btn" onClick={back}><Icon name="home" /> Home</button>
      </div>
    </div>
  );
}
