import { roomServerUrl } from '../net/client';
import { authToken, lock, newSaveKey, unlock, VAULT_PREFIX } from '../net/vault';
import { activeProfile, load, subscribe, update, upsertProfile, type Profile } from './storage';
import type { GameRecord } from '../core/record';

/**
 * Cloud save (owner step 1). Each player can get a player number and a save
 * key. The save is locked with the key on this phone before it is sent, so
 * the server only keeps locked bytes. Number + key bring it back on any phone.
 */

export interface CloudStatus {
  /** When this phone last saved to the cloud (ms), for the active player. */
  savedAt: number | null;
  busy: boolean;
  error: string | null;
}

let status: CloudStatus = { savedAt: null, busy: false, error: null };
const listeners = new Set<() => void>();
const SYNC_KEY = 'chess-chaos:cloud-sync';

function setStatus(s: Partial<CloudStatus>) {
  status = { ...status, ...s };
  listeners.forEach((l) => l());
}
export const cloudStatus = {
  get: () => status,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

/** https://… of the room server, or null when there is no server (cloud save hidden). */
export function vaultBase(): string | null {
  const ws = roomServerUrl();
  if (!ws) return null;
  return ws.replace(/^ws/, 'http').replace(/\/ws$/, '');
}

interface CloudPayload { app: 'chess-chaos-cloud'; v: 1; at: number; profile: Profile; games: GameRecord[] }

function payloadFor(p: Profile): string {
  const { cloud: _omit, ...profile } = p;
  void _omit;
  return JSON.stringify({ app: 'chess-chaos-cloud', v: 1, at: Date.now(), profile, games: load().games[p.id] ?? [] } satisfies CloudPayload);
}

async function call(method: string, path: string, key: string, body?: string): Promise<Response> {
  const base = vaultBase();
  if (!base) throw new Error('No cloud server here.');
  return fetch(`${base}${path}`, { method, body, headers: { authorization: `Bearer ${await authToken(key)}`, ...(body ? { 'content-type': 'text/plain' } : {}) } });
}

function lastSynced(): Record<string, { at: number; size: number }> {
  try { return JSON.parse(globalThis.localStorage?.getItem(SYNC_KEY) ?? '{}'); } catch { return {}; }
}
function noteSynced(number: string, size: number) {
  try { globalThis.localStorage?.setItem(SYNC_KEY, JSON.stringify({ ...lastSynced(), [number]: { at: Date.now(), size } })); } catch { /* blocked */ }
}

/** Save this player to the cloud now. */
export async function uploadNow(p: Profile | undefined = activeProfile()): Promise<void> {
  if (!p?.cloud) return;
  setStatus({ busy: true });
  try {
    const text = payloadFor(p);
    const res = await call('PUT', `${VAULT_PREFIX}/${p.cloud.number}`, p.cloud.key, await lock(text, p.cloud.key));
    if (!res.ok) throw new Error(res.status === 404 ? 'This player number was deleted.' : 'The cloud did not answer. We will try again.');
    noteSynced(p.cloud.number, text.length);
    setStatus({ busy: false, savedAt: Date.now(), error: null });
  } catch (e) {
    setStatus({ busy: false, error: e instanceof Error ? e.message : 'No internet right now. We will try again.' });
  }
}

/** Make a player number for this player and save to it. */
export async function turnOnCloud(): Promise<{ number: string; key: string }> {
  const p = activeProfile();
  if (!p) throw new Error('Pick a player first.');
  const key = newSaveKey();
  const res = await call('POST', VAULT_PREFIX, key);
  if (!res.ok) throw new Error('The cloud is busy. Try again in a minute.');
  const { number } = (await res.json()) as { number: string };
  update((d) => upsertProfile(d, { ...activeProfile(d)!, cloud: { number, key } }));
  await uploadNow(activeProfile());
  return { number, key };
}

/** Bring a player back from the cloud onto this phone (replaces the same player here). */
export async function restoreFromCloud(number: string, key: string): Promise<Profile> {
  const res = await call('GET', `${VAULT_PREFIX}/${number}`, key);
  if (res.status === 403) throw new Error('That save key does not match. Check each letter.');
  if (res.status === 404) throw new Error('No save found for that player number.');
  if (res.status === 429) throw new Error('Too many tries. Wait an hour, then try again.');
  if (!res.ok) throw new Error('The cloud did not answer. Try again soon.');
  let data: CloudPayload;
  try {
    data = JSON.parse(await unlock(await res.text(), key)) as CloudPayload;
  } catch {
    throw new Error('That save key does not match. Check each letter.');
  }
  if (data.app !== 'chess-chaos-cloud' || !data.profile?.id) throw new Error('That save could not be read.');
  const profile: Profile = { ...data.profile, cloud: { number, key } };
  update((d) => ({ ...upsertProfile(d, profile), games: { ...d.games, [profile.id]: data.games ?? [] }, activeProfileId: profile.id }));
  noteSynced(number, 0);
  setStatus({ savedAt: data.at, error: null });
  return profile;
}

/** Delete the cloud copy and forget the number on this phone. The phone save stays. */
export async function turnOffCloud(): Promise<void> {
  const p = activeProfile();
  if (!p?.cloud) return;
  const res = await call('DELETE', `${VAULT_PREFIX}/${p.cloud.number}`, p.cloud.key);
  if (!res.ok && res.status !== 404) throw new Error('The cloud did not answer. Try again soon.');
  update((d) => upsertProfile(d, { ...activeProfile(d)!, cloud: undefined }));
  setStatus({ savedAt: null, error: null });
}

/** Save to the cloud a little while after things change (and when the app is put away). */
export function startCloudSync(delayMs = 15_000): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastText = '';
  const due = () => {
    const p = activeProfile();
    if (!p?.cloud) return;
    const text = payloadFor(p).replace(/"at":\d+,/, '');
    if (text === lastText) return;
    lastText = text;
    void uploadNow(p);
  };
  const off = subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(due, delayMs);
  });
  const hide = () => { if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); timer = null; due(); } };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', hide);
  const p = activeProfile();
  if (p?.cloud) setStatus({ savedAt: lastSynced()[p.cloud.number]?.at ?? null });
  return () => { off(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', hide); };
}
