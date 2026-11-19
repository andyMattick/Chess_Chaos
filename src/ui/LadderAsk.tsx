import { useEffect, useState } from 'react';
import { vaultBase } from '../storage/cloud';
import { activeProfile, updateProfile } from '../storage/storage';
import { fetchLadder, joinLadder } from '../storage/world';
import { useSave } from './store';

/**
 * Owner, 2026-11-19: next time a player opens the app, ask once whether they want
 * to join the Level-Up ladder. "No thanks" is remembered; they can still join
 * any time from the ladder box on the Level-Up screen. Needs a player number.
 */
export function LadderAsk({ quiet, openLevelUp }: { quiet: boolean; openLevelUp: () => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const number = p?.cloud?.number;
  useEffect(() => {
    if (!number || p?.ladderAsked || !vaultBase()) return;
    let stop = false;
    fetchLadder()
      .then((rows) => {
        if (stop) return;
        // Already on it (joined on another device): nothing to ask.
        if (rows.some((r) => r.n === number)) updateProfile((x) => ({ ...x, ladderAsked: true }));
        else setShow(true);
      })
      .catch(() => { /* offline: ask another time */ });
    return () => { stop = true; };
  }, [number]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show || quiet || !p) return null;
  const answer = (yes: boolean) => {
    if (!yes) { updateProfile((x) => ({ ...x, ladderAsked: true })); setShow(false); return; }
    setBusy(true);
    joinLadder()
      .then(() => { updateProfile((x) => ({ ...x, ladderAsked: true })); setShow(false); openLevelUp(); })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="number-modal" role="dialog" aria-label="Join the Level-Up ladder?">
      <div className="ladder-ask">
        <h2>🪜 Join the Level-Up ladder?</h2>
        <p>The ladder is a list of Level-Up Chess players. You start at the bottom and can challenge anyone 1 or 2 places above you. Win and you take their place!</p>
        <p className="muted small">Games are played a move at a time. Only your player number shows (or the name a friend gave you). You can leave the ladder any time.</p>
        {err && <p className="warn">{err}</p>}
        <div className="row wrap">
          <button className="btn primary" disabled={busy} onClick={() => answer(true)}>{busy ? 'Joining…' : '🪜 Yes, join!'}</button>
          <button className="btn" disabled={busy} onClick={() => answer(false)}>No thanks</button>
        </div>
        <p className="muted small">Said no? You can join later: Level-Up Chess → Level-Up Ladder.</p>
      </div>
    </div>
  );
}
