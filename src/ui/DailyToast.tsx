import { useEffect, useRef, useState } from 'react';
import { activeProfile } from '../storage/storage';
import { dailyById, isDone } from '../systems/daily';
import { sfx } from './sound';
import { useSave } from './store';

/** A pop-up the moment a daily mission is finished, anywhere in the app (owner, 2026-11-19). */
export function DailyToast() {
  const save = useSave();
  const p = activeProfile(save);
  const seen = useRef<{ key: string; done: Set<string> } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const d = p?.daily;
    if (!p || !d) return;
    const key = `${p.id}:${d.date}`;
    const done = new Set(d.ids.filter((id) => isDone(d, id)));
    const before = seen.current?.key === key ? seen.current.done : null;
    seen.current = { key, done };
    // Only news: nothing on first load, nothing for missions already collected.
    if (!before) return;
    const fresh = [...done].filter((id) => !before.has(id) && !d.claimed.includes(id));
    if (!fresh.length) return;
    const m = dailyById(fresh[0])!;
    setMsg(`📅 Daily mission done: ${m.text}! Collect 🪙 ${m.coins} on the home screen.`);
    sfx.promote();
  }, [p?.daily]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return <button className="daily-toast" role="status" onClick={() => setMsg(null)}>{msg}</button>;
}
