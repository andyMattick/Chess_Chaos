import type { Analysis, MoveNote } from '../systems/analysis';
import { GRADE_INFO } from '../systems/analysis';
import type { BoardOverlays } from './Board';

/**
 * Full analysis panel: a who-was-winning graph, every move with a grade, and
 * the chosen move explained with arrows (what was played, what was better).
 */
export function AnalysisPanel({ a, names, me, note, onPick }: {
  a: Analysis; names: Record<string, string>; me: string; note: MoveNote | null; onPick: (n: MoveNote) => void;
}) {
  const W = 260, H = 70;
  const n = a.evals.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => H / 2 - (Math.max(-6, Math.min(6, v)) / 6) * (H / 2 - 4);
  const line = a.evals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${W} ${H / 2} L0 ${H / 2} Z`;
  const sides = Object.keys(a.summary);
  return (
    <div className="analysis">
      <h4>🔍 Game analysis</h4>
      <svg className="eval-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Who was winning, move by move">
        <rect width={W} height={H / 2} fill="#fffaf0" />
        <rect y={H / 2} width={W} height={H / 2} fill="#3a3550" />
        <path d={area} fill="#fff" opacity={0.85} />
        <path d={line} fill="none" stroke="#ff4f9a" strokeWidth={2.5} />
        {a.notes.filter((m) => m.grade === 'blunder' || m.grade === 'mistake').map((m) => (
          <circle key={m.ply} cx={x(m.ply + 1)} cy={y(a.evals[m.ply + 1])} r={4} fill={GRADE_INFO[m.grade].colour} stroke="#241f33" strokeWidth={1.5} onClick={() => onPick(m)} style={{ cursor: 'pointer' }} />
        ))}
        {note && <line x1={x(note.ply)} x2={x(note.ply)} y1={0} y2={H} stroke="#241f33" strokeDasharray="3 3" />}
      </svg>
      <small className="muted">Up = White is winning, down = Black is winning.</small>
      <div className="analysis-sum">
        {sides.map((p) => {
          const s = a.summary[p];
          return (
            <div key={p} className={p === me ? 'me' : ''}>
              <b>{names[p]}</b> <span className="game-score">{s.score}</span>
              <small>✓✓ {s.best} · ✓ {s.good} · ?! {s.inaccuracy} · ? {s.mistake} · ?? {s.blunder}</small>
            </div>
          );
        })}
      </div>
      {note && (
        <div className="note-card" style={{ ['--g' as string]: GRADE_INFO[note.grade].colour }}>
          <b>{names[note.by]} played {note.san}: {GRADE_INFO[note.grade].label} {GRADE_INFO[note.grade].mark}</b>
          <p>{note.text}</p>
          {note.best && note.grade !== 'best' && note.grade !== 'good' && <small>🟢 green arrow: better move · 🟠 orange arrow: the move played</small>}
        </div>
      )}
      <ol className="analysis-moves">
        {Array.from({ length: Math.ceil(a.notes.length / 2) }, (_, i) => (
          <li key={i}>
            <span className="num">{i + 1}.</span>
            {[a.notes[i * 2], a.notes[i * 2 + 1]].map((m, k) => m ? (
              <button key={k} className={`an-move ${note?.ply === m.ply ? 'on' : ''}`} onClick={() => onPick(m)} style={{ ['--g' as string]: GRADE_INFO[m.grade].colour }}>
                {m.san} <i>{GRADE_INFO[m.grade].mark}</i>
              </button>
            ) : <span key={k} />)}
          </li>
        ))}
      </ol>
      <p className="muted small">Checked by our own chess robot (about as strong as a ★ 1400 player). It spots most slips, but not every deep idea.</p>
    </div>
  );
}

/** Arrows for the chosen move: what was played, and what was better. */
export function noteOverlay(note: MoveNote | null): BoardOverlays | undefined {
  if (!note) return undefined;
  const arrows: NonNullable<BoardOverlays['arrows']> = [{ from: note.played.from, to: note.played.to, color: note.grade === 'best' || note.grade === 'good' ? '#2fb36b' : '#ff8a3d' }];
  if (note.best && note.grade !== 'best' && note.grade !== 'good') arrows.push({ from: note.best.from, to: note.best.to, color: '#2fb36b' });
  return { arrows };
}
