/**
 * A score bar with the number beside it in big type, not on top of the bar
 * (owner, 2026-11-22: hill scores were hard to read on the bars).
 */
export function ScoreBar({ value, max, label, colour, icon, showMax = true }: { value: number; max: number; label?: string; colour?: string; icon?: string; showMax?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="score-row" aria-label={`${label ? `${label}: ` : ''}${value}${showMax ? ` of ${max}` : ''}`}>
      {label && <span className="score-label">{label}</span>}
      <div className="hill-bar"><div style={{ width: `${pct}%`, ...(colour ? { background: colour } : {}) }} /></div>
      <b className="score-num">{icon}{value}{showMax && <small>/{max}</small>}</b>
    </div>
  );
}
