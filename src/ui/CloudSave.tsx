import { useState, useSyncExternalStore } from 'react';
import { cleanNumber, cleanSaveKey, showNumber } from '../net/vault';
import { cloudStatus, restoreFromCloud, turnOffCloud, turnOnCloud, uploadNow, vaultBase } from '../storage/cloud';
import { activeProfile } from '../storage/storage';
import { useSave } from './store';

function ago(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/** Settings card: get a player number, see it, save now, or delete the cloud copy. */
export function CloudSaveCard() {
  const save = useSave();
  const st = useSyncExternalStore(cloudStatus.subscribe, cloudStatus.get, cloudStatus.get);
  const p = activeProfile(save);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  if (!vaultBase() || !p) return null;
  const run = (f: () => Promise<unknown>) => { setBusy(true); setErr(null); f().catch((e) => setErr((e as Error).message)).finally(() => setBusy(false)); };
  if (!p.cloud) {
    return (
      <div className="cloud-card">
        <b>☁️ Cloud save</b>
        <p className="small">Get a player number so you can bring {p.nickname} back on any phone or tablet. Your save is locked with a key only you get. We keep no names.</p>
        <button className="btn small primary" disabled={busy} onClick={() => run(turnOnCloud)}>{busy ? 'Making it…' : '☁️ Get my player number'}</button>
        {err && <small className="warn">{err}</small>}
      </div>
    );
  }
  return (
    <div className="cloud-card">
      <b>☁️ Cloud save is on</b>
      <div className="cloud-codes">
        <span>Player number</span><code>{showNumber(p.cloud.number)}</code>
        <span>Save key</span><code>{p.cloud.key}</code>
      </div>
      <p className="small">📸 Take a photo of these or write them down. With both, you can load {p.nickname} on another device. Keep the key secret, like a password.</p>
      <p className="small muted">{st.busy ? 'Saving…' : st.error ? st.error : st.savedAt ? `Saved to the cloud ${ago(st.savedAt)}.` : 'Saves by itself after each game.'}</p>
      <div className="row wrap">
        <button className="btn small" disabled={busy || st.busy} onClick={() => run(() => uploadNow())}>Save now</button>
        {!sure ? (
          <button className="btn small" onClick={() => setSure(true)}>Delete cloud copy</button>
        ) : (
          <button className="btn small danger" disabled={busy} onClick={() => run(async () => { await turnOffCloud(); setSure(false); })}>Yes, delete it (this phone keeps its save)</button>
        )}
      </div>
      {err && <small className="warn">{err}</small>}
    </div>
  );
}

/** "Load from the cloud": type a player number and save key. */
export function CloudRestore({ done }: { done?: () => void }) {
  const [open, setOpen] = useState(false);
  const [num, setNum] = useState('');
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!vaultBase()) return null;
  if (!open) return <button className="btn small" onClick={() => setOpen(true)}>☁️ Load with a player number</button>;
  const n = cleanNumber(num);
  const k = cleanSaveKey(key);
  const go = () => {
    if (!n || !k) return;
    setBusy(true); setMsg(null);
    restoreFromCloud(n, k)
      .then((p) => { setMsg(`Welcome back, ${p.nickname}!`); done?.(); })
      .catch((e) => setMsg((e as Error).message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="cloud-card">
      <b>☁️ Load with a player number</b>
      <input aria-label="Player number" inputMode="numeric" placeholder="Player number (8 digits)" value={num} onChange={(e) => setNum(e.target.value)} />
      <input aria-label="Save key" autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="Save key (XXXX-XXXX-XXXX-XXXX)" value={key} onChange={(e) => setKey(e.target.value)} />
      {key && !k && <small className="muted">The key has 16 letters and numbers. There is no 0, O, 1, I or L in it.</small>}
      <button className="btn small primary" disabled={!n || !k || busy} onClick={go}>{busy ? 'Loading…' : 'Load my progress'}</button>
      {msg && <small>{msg}</small>}
    </div>
  );
}

/**
 * Asking for a player number (owner, 2026-11-18): once when the game opens
 * without one, and again from anything that needs one (challenges, friends,
 * tournaments, the world leaderboard). Saying no is fine.
 */
export function NumberPrompt({ why, onNo, onYes }: { why?: string; onNo?: () => void; onYes?: (number: string) => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  if (!vaultBase() || !p) return null;
  if (made || p.cloud) {
    const n = made ?? p.cloud!.number;
    return (
      <div className="cloud-card number-ask">
        <b>🎉 Your player number: <code>{showNumber(n)}</code></b>
        <p className="small">Your secret save key is in ⚙️ Settings → ☁️ Cloud save. 📸 Take a photo of it (with a grown-up) so you can get {p.nickname} back on any device.</p>
      </div>
    );
  }
  const yes = () => {
    setBusy(true); setErr(null);
    turnOnCloud().then((r) => { setMade(r.number); onYes?.(r.number); }).catch((e) => setErr((e as Error).message)).finally(() => setBusy(false));
  };
  return (
    <div className="cloud-card number-ask">
      <b>☁️ Get a player number?</b>
      {why && <p className="small"><b>{why}</b></p>}
      <ul className="small number-reasons">
        <li>💾 Your progress is backed up. New phone? Get it all back.</li>
        <li>👫 Add friends after a game and see their scores.</li>
        <li>📬 Send challenges and play in tournaments.</li>
        <li>🌍 See where you rank in the world.</li>
        <li>🔒 No names, emails or personal details: just your game progress, locked with a key only you get.</li>
      </ul>
      <small className="muted">Not sure? Ask a grown-up. You can always get one later.</small>
      <div className="row wrap">
        <button className="btn small primary" disabled={busy} onClick={yes}>{busy ? 'Making it…' : '☁️ Yes, make my number'}</button>
        {onNo && <button className="btn small" disabled={busy} onClick={onNo}>Not now</button>}
      </div>
      {err && <small className="warn">{err}</small>}
    </div>
  );
}
