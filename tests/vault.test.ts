import { describe, expect, it } from 'vitest';
import { authToken, cleanNumber, cleanSaveKey, handleVault, handleBox, lock, memoryBoxes, newSaveKey, unlock, vaultRoute, MAX_FAILS } from '../src/net/vault';

const boxes = memoryBoxes();
const server = (req: Request) => {
  const route = vaultRoute(new URL(req.url).pathname);
  if (!route) return Promise.resolve(new Response('no', { status: 404 }));
  return handleVault(req, route, (n, r) => handleBox(r, boxes(n)));
};
const req = async (method: string, path: string, key: string, body?: string) =>
  server(new Request(`https://x.dev${path}`, { method, body, headers: { authorization: `Bearer ${await authToken(key)}` } }));

describe('cloud save (vault)', () => {
  it('makes keys a child can copy', () => {
    const k = newSaveKey();
    expect(k).toMatch(/^[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){3}$/);
    expect(cleanSaveKey(k.toLowerCase().replace(/-/g, ' '))).toBe(k);
    expect(cleanSaveKey('OOOO-1111-2222-3333')).toBeNull();
    expect(cleanNumber('1234 5678')).toBe('12345678');
    expect(cleanNumber('123')).toBeNull();
  });

  it('locks and unlocks with the key only', async () => {
    const k = newSaveKey();
    const box = await lock('{"nickname":"Ava"}', k);
    expect(box).not.toContain('Ava');
    expect(await unlock(box, k)).toBe('{"nickname":"Ava"}');
    await expect(unlock(box, newSaveKey())).rejects.toThrow();
  });

  it('creates a number, saves, loads and deletes', async () => {
    const k = newSaveKey();
    const made = await req('POST', '/vault', k);
    expect(made.status).toBe(201);
    const { number } = await made.json();
    expect(number).toMatch(/^[1-9]\d{7}$/);
    expect((await req('GET', `/vault/${number}`, k)).status).toBe(404); // nothing saved yet
    const big = 'A'.repeat(250_000); // more than one chunk
    expect((await req('PUT', `/vault/${number}`, k, big)).status).toBe(200);
    expect(await (await req('GET', `/vault/${number}`, k)).text()).toBe(big);
    expect((await req('PUT', `/vault/${number}`, k, 'not base64 !')).status).toBe(400);
    expect((await req('GET', `/vault/${number}`, newSaveKey())).status).toBe(403);
    // Someone cannot claim a number that is taken.
    expect((await req('POST', `/vault/${number}/claim`, newSaveKey())).status).toBe(409);
    expect((await req('DELETE', `/vault/${number}`, k)).status).toBe(200);
    expect((await req('GET', `/vault/${number}`, k)).status).toBe(404);
  });

  it('locks a number after too many wrong keys', async () => {
    const k = newSaveKey();
    const { number } = await (await req('POST', '/vault', k)).json();
    await req('PUT', `/vault/${number}`, k, 'QUJD');
    for (let i = 0; i < MAX_FAILS; i++) await req('GET', `/vault/${number}`, newSaveKey());
    expect((await req('GET', `/vault/${number}`, k)).status).toBe(429);
  });

  it('only answers vault paths', () => {
    expect(vaultRoute('/ws')).toBeNull();
    expect(vaultRoute('/vault/abc')).toEqual({ kind: 'bad' });
    expect(vaultRoute('/vault/12345678/claim')).toEqual({ kind: 'box', number: '12345678' });
  });
});
