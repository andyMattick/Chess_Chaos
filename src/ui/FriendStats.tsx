import { useEffect, useState } from 'react';
import { activeProfile } from '../storage/storage';
import { fetchBoard, postBoard, recordVs, type Board, type BoardRow } from '../storage/world';
import { useSave } from './store';
import { recordText, count } from './words';

/** The world leaderboard, with your friends' rows in full (looked up by the numbers you saved). */
export function useWorldBoard(): { board: Board | null; err: string | null } {
  const save = useSave();
  const p = activeProfile(save);
  const [board, setBoard] = useState<Board | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const number = p?.cloud?.number;
  const friends = (p?.friends ?? []).join(',');
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (p?.cloud && p.worldBoard !== false) await postBoard(p).catch(() => {});
        const b = await fetchBoard(number, friends ? friends.split(',') : []);
        if (live) { setBoard(b); setErr(null); }
      } catch (e) { if (live) setErr((e as Error).message); }
    })();
    return () => { live = false; };
  }, [number, friends, p?.worldBoard]); // eslint-disable-line react-hooks/exhaustive-deps
  return { board, err };
}

/** "★ 950 · #12 in the world · W 20 · L 12 · D 2 · 34 games", plus your record against them. */
export function StatsLine({ row, n }: { row: BoardRow | undefined; n?: string }) {
  const save = useSave();
  const vs = n ? recordVs(activeProfile(save), n) : null;
  return (
    <span className="stats-line">
      {row ? (
        <>
          <span className="bot-rating">★ {row.r}</span> number <b>{row.rank}</b> in the world. {recordText(row)} ({count(row.g, 'game')}).
        </>
      ) : n ? <span className="muted">Not on the world leaderboard yet (their app puts them on it once it syncs)</span> : null}
      {vs && <span className="vs"> Against them you {recordText(vs).toLowerCase()}.</span>}
    </span>
  );
}
