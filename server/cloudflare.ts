/**
 * Production room server on Cloudflare Workers + one Durable Object.
 * Free tier is enough for friends and classes (docs/08, question 16).
 *
 * Deploy:  npx wrangler deploy        (from the repo root, uses wrangler.toml)
 * Then set VITE_ROOM_SERVER=wss://<your-worker>.workers.dev/ws for the web build.
 */
import { RoomServer, parseClientMsg, type Conn } from '../src/net/room';

interface Env {
  LOBBY: DurableObjectNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      // All rooms live in one Durable Object so room codes are global.
      const stub = env.LOBBY.get(env.LOBBY.idFromName('lobby'));
      return stub.fetch(req);
    }
    return new Response('Chess Chaos room server', { headers: { 'access-control-allow-origin': '*' } });
  },
};

export class Lobby {
  rooms = new RoomServer();
  timer: ReturnType<typeof setInterval> | null = null;
  n = 0;

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();
    const conn: Conn = { id: `c${++this.n}-${Date.now()}`, send: (m) => { try { server.send(JSON.stringify(m)); } catch { /* closed */ } } };
    server.addEventListener('message', (e) => {
      const msg = parseClientMsg(String(e.data));
      if (msg) this.rooms.handle(conn, msg);
    });
    const close = () => this.rooms.close(conn);
    server.addEventListener('close', close);
    server.addEventListener('error', close);
    if (!this.timer) this.timer = setInterval(() => this.rooms.tick(), 2000);
    return new Response(null, { status: 101, webSocket: client });
  }
}

// Minimal Cloudflare types so this file type-checks without extra packages.
declare class WebSocketPair { 0: WebSocket; 1: WebSocket; }
interface DurableObjectNamespace { idFromName(name: string): unknown; get(id: unknown): { fetch(req: Request): Promise<Response> } }
declare global { interface WebSocket { accept(): void } interface ResponseInit { webSocket?: WebSocket } }
