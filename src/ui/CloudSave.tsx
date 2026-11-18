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
