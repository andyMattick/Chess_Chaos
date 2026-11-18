import { beforeEach, describe, expect, it } from 'vitest';
import { exportSave, findLostSave, importSave, load, newProfile, resetMemoryForTests, update, upsertProfile } from '../src/storage/storage';

class MemoryStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
let store: MemoryStorage;
beforeEach(() => {
  store = new MemoryStorage();
  // Object.keys(localStorage) must list the keys, like the real thing.
  (globalThis as { localStorage?: unknown }).localStorage = new Proxy(store, { ownKeys: () => [...store.m.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  resetMemoryForTests();
});

describe('keeping progress safe', () => {
  it('a broken save is kept as a rescue copy and offered back', () => {
    update((d) => upsertProfile(d, newProfile('Ava', '#f00')));
    store.setItem('chess-chaos:save', '{not json');
    store.m.delete('chess-chaos:save:backup');
    resetMemoryForTests();
    expect(load().profiles.length).toBe(0);
    expect([...store.m.keys()].some((k) => k.startsWith('chess-chaos:save:rescue:'))).toBe(true);
  });

  it('the backup copy brings players back after the main save is wiped', () => {
    update((d) => upsertProfile(d, newProfile('Ava', '#f00')));
    store.m.delete('chess-chaos:save');
    resetMemoryForTests();
    expect(load().profiles.length).toBe(0);
    expect(findLostSave()!.profiles[0].nickname).toBe('Ava');
  });

  it('export then import on another device keeps everyone', () => {
    const p = newProfile('Ava', '#f00');
    update((d) => upsertProfile(d, { ...p, rating: 777, coins: 50 }));
    const file = exportSave();
    store.clear();
    resetMemoryForTests();
    update((d) => upsertProfile(d, newProfile('Ben', '#0f0')));
    expect(importSave(file).players).toBe(1);
    const names = load().profiles.map((x) => `${x.nickname}:${x.rating}`).sort();
    expect(names).toEqual(['Ava:777', 'Ben:600']);
    expect(() => importSave('{"hello":1}')).toThrow();
  });
});
