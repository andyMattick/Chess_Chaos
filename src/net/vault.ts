/**
 * Cloud save ("vault"), owner step 1. Shared by the Cloudflare worker, the
 * local dev server and the browser, so it uses only Web APIs (fetch types,
 * crypto.subtle, TextEncoder).
 *
 * Privacy by design: the browser locks the save with the player's save key
 * (AES-GCM) before it leaves the phone. The server stores a player number, a
 * hash of a login token, and locked bytes. It never sees a name, a game or
 * the key, and has nothing to show anyone else.
 */

export const VAULT_PREFIX = '/vault';
/** Biggest locked save we keep (characters of base64). */
export const MAX_SAVE_CHARS = 2_000_000;
const CHUNK = 100_000;
/** Wrong keys allowed before a number is locked for a while. */
export const MAX_FAILS = 20;
export const LOCK_MS = 60 * 60 * 1000;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'cache-control': 'no-store',
};

export function vaultResponse(body: string | null, status = 200, type = 'application/json'): Response {
  return new Response(body, { status, headers: { ...CORS, 'content-type': type } });
}

/** Storage for one player number (a Durable Object in production, a Map locally). */
export interface VaultBox {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export function isNumber(s: string): boolean {
  return /^\d{8}$/.test(s);
}

export function newNumber(rand: () => number = Math.random): string {
  // First digit 1-9 so it never looks like it lost a zero.
  return String(1 + Math.floor(rand() * 9)) + Array.from({ length: 7 }, () => Math.floor(rand() * 10)).join('');
}

/** Which vault route this is: create, or the number and action. Null if not a vault path. */
export function vaultRoute(pathname: string): { kind: 'create' } | { kind: 'box'; number: string } | { kind: 'bad' } | null {
  if (pathname === VAULT_PREFIX || pathname === `${VAULT_PREFIX}/`) return { kind: 'create' };
  if (!pathname.startsWith(`${VAULT_PREFIX}/`)) return null;
  const rest = pathname.slice(VAULT_PREFIX.length + 1).replace(/\/claim$/, '');
  return isNumber(rest) ? { kind: 'box', number: rest } : { kind: 'bad' };
}

export async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bearer(req: Request): string | null {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('authorization') ?? '');
  return m ? m[1] : null;
}

/**
 * One number's requests. `claim` (POST .../claim) takes an empty number for a
 * new player; GET, PUT and DELETE need the right token.
 */
export async function handleBox(req: Request, box: VaultBox, now = Date.now()): Promise<Response> {
  if (req.method === 'OPTIONS') return vaultResponse(null, 204);
  const token = bearer(req);
  if (!token) return vaultResponse('{"error":"no key"}', 401);
  const claim = req.method === 'POST' && new URL(req.url).pathname.endsWith('/claim');
  const stored = await box.get('auth');
  if (claim) {
    if (stored) return vaultResponse('{"error":"taken"}', 409);
    await box.put('auth', await sha256hex(token));
    await box.put('n', '0');
    return vaultResponse('{"ok":true}', 201);
  }
  if (!stored) return vaultResponse('{"error":"not found"}', 404);
  const fails = Number((await box.get('fails')) ?? 0);
  const failAt = Number((await box.get('failAt')) ?? 0);
  if (fails >= MAX_FAILS && now - failAt < LOCK_MS) return vaultResponse('{"error":"locked"}', 429);
  if ((await sha256hex(token)) !== stored) {
    await box.put('fails', String(now - failAt >= LOCK_MS ? 1 : fails + 1));
    await box.put('failAt', String(now));
    return vaultResponse('{"error":"wrong key"}', 403);
  }
  if (fails) await box.put('fails', '0');

  if (req.method === 'GET') {
    const n = Number((await box.get('n')) ?? 0);
    if (!n) return vaultResponse('{"error":"empty"}', 404);
    let out = '';
    for (let i = 0; i < n; i++) out += (await box.get(`s${i}`)) ?? '';
    return vaultResponse(out, 200, 'text/plain');
  }
  if (req.method === 'PUT') {
    const body = await req.text();
    if (!body || body.length > MAX_SAVE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(body)) return vaultResponse('{"error":"bad save"}', 400);
    const n = Math.ceil(body.length / CHUNK);
    for (let i = 0; i < n; i++) await box.put(`s${i}`, body.slice(i * CHUNK, (i + 1) * CHUNK));
    await box.put('n', String(n));
    await box.put('at', String(now));
    return vaultResponse('{"ok":true}');
  }
  if (req.method === 'DELETE') {
    await box.deleteAll();
    return vaultResponse('{"ok":true}');
  }
  return vaultResponse('{"error":"method"}', 405);
}

/**
 * The whole vault API for a server: `open(number)` gives that number's box
 * handler. Creating picks a free 8-digit number.
 */
export async function handleVault(req: Request, route: NonNullable<ReturnType<typeof vaultRoute>>, open: (number: string, req: Request) => Promise<Response>): Promise<Response> {
  if (req.method === 'OPTIONS') return vaultResponse(null, 204);
  if (route.kind === 'bad') return vaultResponse('{"error":"bad number"}', 400);
  if (route.kind === 'box') return open(route.number, req);
  if (req.method !== 'POST') return vaultResponse('{"error":"method"}', 405);
  const origin = new URL(req.url).origin;
  for (let i = 0; i < 6; i++) {
    const number = newNumber();
    const res = await open(number, new Request(`${origin}${VAULT_PREFIX}/${number}/claim`, { method: 'POST', headers: req.headers }));
    if (res.status === 201) return vaultResponse(JSON.stringify({ number }), 201);
    if (res.status !== 409) return res;
  }
  return vaultResponse('{"error":"busy"}', 503);
}

/** In-memory boxes for the local dev server and tests. */
export function memoryBoxes(): (number: string) => VaultBox {
  const all = new Map<string, Map<string, string>>();
  return (number) => {
    const m = all.get(number) ?? new Map<string, string>();
    all.set(number, m);
    return {
      get: async (k) => m.get(k),
      put: async (k, v) => { m.set(k, v); },
      deleteAll: async () => { m.clear(); },
    };
  };
}

/* ---------------------------------------------------------------------------
 * Keys and locking (browser side, but plain Web Crypto so tests can run it).
 * ------------------------------------------------------------------------- */

/** No 0/O, 1/I/L, so a child can copy it from a photo. 16 letters ≈ 80 bits. */
const KEY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newSaveKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join('');
  return chars.match(/.{4}/g)!.join('-');
}

/** Tidy what a player typed: upper case, no spaces, dashes every 4. */
export function cleanSaveKey(typed: string): string | null {
  const raw = typed.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (raw.length !== 16 || [...raw].some((c) => !KEY_ALPHABET.includes(c))) return null;
  return raw.match(/.{4}/g)!.join('-');
}

export function cleanNumber(typed: string): string | null {
  const raw = typed.replace(/\D/g, '');
  return isNumber(raw) ? raw : null;
}

/** "12345678" → "1234 5678" for showing. */
export function showNumber(n: string): string {
  return `${n.slice(0, 4)} ${n.slice(4)}`;
}

/** The login token sent to the server (it only ever stores a hash of this). */
export function authToken(key: string): Promise<string> {
  return sha256hex(`chess-chaos-auth:${key}`);
}

async function aesKey(key: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`chess-chaos-lock:${key}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function lock(text: string, key: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(key), new TextEncoder().encode(text)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return toB64(out);
}

export async function unlock(b64: string, key: string): Promise<string> {
  const all = fromB64(b64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await aesKey(key), all.slice(12));
  return new TextDecoder().decode(pt);
}
